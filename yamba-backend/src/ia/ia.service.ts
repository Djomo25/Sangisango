import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { Commercant, Conversation, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { CreneauxService } from '../creneaux/creneaux.service';
import { RendezVousService } from '../rendez-vous/rendez-vous.service';
import { JOURS_SEMAINE, formaterDateHeureFr } from '../common/date-fr.util';

const CLAUDE_MODEL = 'claude-sonnet-5';
const NOMBRE_MESSAGES_HISTORIQUE = 20;
const PLACEHOLDER_CRENEAU = '{{CRENEAU_PROPOSE}}';
const TEXTE_CRENEAU_INDISPONIBLE =
  "complet pour le moment — un membre de l'équipe va revenir vers vous pour trouver un horaire";

const DESCRIPTIONS_TON: Record<string, string> = {
  chaleureux:
    'Chaleureux et accueillant, comme avec un client fidèle. Emojis avec modération, ton amical et proche.',
  professionnel:
    'Professionnel et courtois. Phrases claires et précises, sans familiarité excessive.',
  direct: 'Direct et concis. Va droit au but, sans formules de politesse superflues.',
};

const MOIS_ANNEE = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

type ActionIa = 'aucune' | 'proposer_creneau' | 'creer_rendez_vous';

interface ReponseIa {
  reponseTexte: string;
  necessiteTransfert: boolean;
  action: ActionIa;
  service?: string;
  dateHeureApproximative?: string;
  dateHeureConfirmee?: string;
}

interface MessageHistorique {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
    private readonly creneauxService: CreneauxService,
    @Inject(forwardRef(() => RendezVousService))
    private readonly rendezVousService: RendezVousService,
  ) {}

  private get mockMode(): boolean {
    return this.configService.get<string>('MOCK_MODE') === 'true';
  }

  /**
   * Génère la réponse de l'assistant pour une conversation : construit le system
   * prompt à partir du profil du commerçant, appelle Claude avec l'historique,
   * exécute l'action éventuellement demandée (proposer un créneau, créer un
   * rendez-vous), enregistre la réponse finale en base et l'envoie au client via
   * WhatsApp. Si l'IA signale ne pas savoir répondre (ou en cas d'échec d'une
   * action), la conversation passe au statut "attention". Ne fait rien si le
   * commerçant a "pris la main" sur la conversation (iaSuspendueJusqua futur).
   * Si l'appel à l'API IA échoue lui-même (crédit épuisé, quota, panne réseau),
   * envoie un message de secours générique au client et transfère au commerçant
   * plutôt que de laisser la conversation sans réponse.
   */
  async genererReponse(conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: { commercant: true },
    });

    if (conversation.iaSuspendueJusqua && conversation.iaSuspendueJusqua.getTime() > Date.now()) {
      this.logger.log(
        `IA suspendue jusqu'à ${conversation.iaSuspendueJusqua.toISOString()} sur la conversation ${conversationId}, message ignoré.`,
      );
      return;
    }

    const messagesRecents = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: NOMBRE_MESSAGES_HISTORIQUE,
    });
    messagesRecents.reverse();

    const systemPrompt = this.construireSystemPrompt(conversation.commercant);
    const historique: MessageHistorique[] = messagesRecents.map((message) => ({
      role: message.expediteur === 'client' ? 'user' : 'assistant',
      content: message.contenu,
    }));

    let reponseIa: ReponseIa;
    try {
      reponseIa = await this.appellerClaude(systemPrompt, historique, conversation.commercant);
    } catch (error) {
      // Panne de l'API IA (crédit épuisé, quota, réseau...) : le client ne doit
      // jamais rester sans réponse ni le commerçant sans être prévenu qu'il
      // doit reprendre la main manuellement.
      this.logger.error(
        `Échec de l'appel à l'API IA pour la conversation ${conversationId}, transfert au commerçant : ${(error as Error).message}`,
      );
      const reponseTexteSecours =
        "Merci pour votre message. Un membre de notre équipe va revenir vers vous rapidement.";
      await this.prisma.message.create({
        data: { conversationId, expediteur: 'ia', contenu: reponseTexteSecours },
      });
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { statut: 'attention' },
      });
      try {
        await this.whatsappService.envoyerMessage(conversation.clientTelephone, reponseTexteSecours);
      } catch (envoiError) {
        // L'essentiel (message de secours + statut "attention") est déjà en
        // base : on n'échoue pas toute la requête si même l'envoi échoue,
        // pour éviter que Meta ne retente indéfiniment le même webhook.
        this.logger.error(
          `Échec de l'envoi du message de secours sur la conversation ${conversationId} : ${(envoiError as Error).message}`,
        );
      }
      return;
    }

    const { reponseTexte, necessiteTransfert } = await this.executerAction(reponseIa, conversation);

    await this.prisma.message.create({
      data: {
        conversationId,
        expediteur: 'ia',
        contenu: reponseTexte,
      },
    });

    if (necessiteTransfert) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { statut: 'attention' },
      });
    }

    await this.whatsappService.envoyerMessage(conversation.clientTelephone, reponseTexte);
  }

  /**
   * Exécute l'action décidée par l'IA (aucune / proposer_creneau /
   * creer_rendez_vous) et retourne le texte final à envoyer au client ainsi que
   * le besoin de transfert éventuel (peut être forcé à true si l'action échoue).
   */
  private async executerAction(
    reponseIa: ReponseIa,
    conversation: Conversation & { commercant: Commercant },
  ): Promise<{ reponseTexte: string; necessiteTransfert: boolean }> {
    if (reponseIa.action === 'proposer_creneau') {
      return this.gererPropositionCreneau(reponseIa, conversation.commercant.id);
    }

    if (reponseIa.action === 'creer_rendez_vous') {
      return this.gererCreationRendezVous(reponseIa, conversation);
    }

    return {
      reponseTexte: reponseIa.reponseTexte,
      necessiteTransfert: reponseIa.necessiteTransfert,
    };
  }

  private async gererPropositionCreneau(
    reponseIa: ReponseIa,
    commercantId: string,
  ): Promise<{ reponseTexte: string; necessiteTransfert: boolean }> {
    const dateApprox = this.parserDate(reponseIa.dateHeureApproximative) ?? new Date();
    const creneau = await this.creneauxService.proposerCreneau(commercantId, dateApprox);

    const texteCreneau = creneau
      ? this.formaterDateCreneau(creneau.dateHeure)
      : TEXTE_CRENEAU_INDISPONIBLE;

    const reponseTexte = reponseIa.reponseTexte.includes(PLACEHOLDER_CRENEAU)
      ? reponseIa.reponseTexte.split(PLACEHOLDER_CRENEAU).join(texteCreneau)
      : `${reponseIa.reponseTexte} ${texteCreneau}`;

    // Si aucun créneau n'est disponible, l'IA ne peut pas aider davantage : on
    // transfère au commerçant plutôt que de laisser le client sans solution.
    return { reponseTexte, necessiteTransfert: creneau ? reponseIa.necessiteTransfert : true };
  }

  private async gererCreationRendezVous(
    reponseIa: ReponseIa,
    conversation: Conversation & { commercant: Commercant },
  ): Promise<{ reponseTexte: string; necessiteTransfert: boolean }> {
    const dateConfirmee = this.parserDate(reponseIa.dateHeureConfirmee);
    const service = reponseIa.service?.trim();

    if (!dateConfirmee || !service) {
      this.logger.warn(
        'Action creer_rendez_vous reçue sans date/service exploitable, transfert forcé.',
      );
      return { reponseTexte: reponseIa.reponseTexte, necessiteTransfert: true };
    }

    const creneau = await this.prisma.creneauDisponible.findFirst({
      where: {
        commercantId: conversation.commercantId,
        dateHeure: dateConfirmee,
        statut: 'disponible',
      },
    });

    if (!creneau) {
      return {
        reponseTexte:
          "Ce créneau ne semble plus disponible entre-temps. Je transmets votre demande à l'équipe pour trouver un nouveau créneau avec vous.",
        necessiteTransfert: true,
      };
    }

    try {
      await this.rendezVousService.creerRendezVous(
        conversation.commercantId,
        conversation.id,
        creneau.id,
        service,
      );
      return {
        reponseTexte: reponseIa.reponseTexte,
        necessiteTransfert: reponseIa.necessiteTransfert,
      };
    } catch (error) {
      this.logger.warn(`Échec de la création du rendez-vous : ${(error as Error).message}`);
      return {
        reponseTexte:
          "Ce créneau vient d'être réservé entre-temps. Je transmets votre demande à l'équipe pour trouver un nouveau créneau avec vous.",
        necessiteTransfert: true,
      };
    }
  }

  private async appellerClaude(
    systemPrompt: string,
    historique: MessageHistorique[],
    commercant: Commercant,
  ): Promise<ReponseIa> {
    if (this.mockMode) {
      return this.genererReponseMock(historique, commercant);
    }

    const anthropic = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: historique,
    });

    let texteBrut = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        texteBrut += block.text;
      }
    }

    return this.parserReponseStructuree(texteBrut);
  }

  /**
   * Simulation utilisée en MOCK_MODE : reproduit de façon simplifiée (mots-clés)
   * la détection d'intention que ferait Claude, pour pouvoir tester tout le
   * flux (proposition puis confirmation de créneau) sans clé API réelle.
   */
  private genererReponseMock(historique: MessageHistorique[], commercant: Commercant): ReponseIa {
    const dernierMessageClient = [...historique].reverse().find((m) => m.role === 'user');
    const texteClient = (dernierMessageClient?.content ?? '').toLowerCase();

    const dernierMessageIa = [...historique].reverse().find((m) => m.role === 'assistant');
    const creneauPropose = dernierMessageIa?.content.match(
      /(\d{2})\/(\d{2})\/(\d{4}) à (\d{2})h(\d{2})/,
    );

    const motsConfirmation = [
      'oui',
      'ça marche',
      'ca marche',
      "d'accord",
      'daccord',
      'ok',
      'parfait',
      "c'est bon",
    ];
    const estConfirmation = motsConfirmation.some((mot) => texteClient.includes(mot));

    if (estConfirmation && creneauPropose) {
      const [, jj, mm, aaaa, hh, min] = creneauPropose;
      return {
        reponseTexte: `[MOCK IA] C'est noté, votre demande de rendez-vous pour ${this.premierServiceDisponible(commercant)} est enregistrée. Le commerçant vous la confirmera rapidement.`,
        necessiteTransfert: false,
        action: 'creer_rendez_vous',
        service: this.premierServiceDisponible(commercant),
        dateHeureConfirmee: `${aaaa}-${mm}-${jj}T${hh}:${min}:00`,
      };
    }

    const motsInteret = [
      'combien',
      'prix',
      'disponib',
      'rendez-vous',
      'rdv',
      'créneau',
      'creneau',
      'venir',
      'quand',
    ];
    const montreInteret = motsInteret.some((mot) => texteClient.includes(mot));

    if (montreInteret) {
      const demain = new Date();
      demain.setDate(demain.getDate() + 1);
      demain.setHours(9, 0, 0, 0);

      return {
        reponseTexte: `[MOCK IA] Merci pour votre message ! Le prochain créneau disponible est ${PLACEHOLDER_CRENEAU}. Cela vous convient-il ?`,
        necessiteTransfert: false,
        action: 'proposer_creneau',
        service: this.premierServiceDisponible(commercant),
        dateHeureApproximative: demain.toISOString(),
      };
    }

    return {
      reponseTexte: `[MOCK IA] Merci pour votre message${
        dernierMessageClient ? ` : "${dernierMessageClient.content}"` : ''
      }. Un membre de notre équipe reviendra vers vous si besoin.`,
      necessiteTransfert: false,
      action: 'aucune',
    };
  }

  private premierServiceDisponible(commercant: Commercant): string {
    if (Array.isArray(commercant.servicesJson)) {
      const premier = commercant.servicesJson[0];
      if (premier && typeof premier === 'object' && 'nom' in premier) {
        return this.versTexte((premier as { nom: unknown }).nom);
      }
    }
    return 'ce service';
  }

  private parserReponseStructuree(texte: string): ReponseIa {
    try {
      const nettoye = texte
        .trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/, '')
        .trim();
      const parsed = JSON.parse(nettoye) as {
        reponse?: unknown;
        necessite_transfert?: unknown;
        action?: unknown;
        service?: unknown;
        date_heure_approximative?: unknown;
        date_heure_confirmee?: unknown;
      };

      if (typeof parsed.reponse === 'string') {
        const action: ActionIa =
          parsed.action === 'proposer_creneau' || parsed.action === 'creer_rendez_vous'
            ? parsed.action
            : 'aucune';

        return {
          reponseTexte: parsed.reponse,
          necessiteTransfert: Boolean(parsed.necessite_transfert),
          action,
          service: typeof parsed.service === 'string' ? parsed.service : undefined,
          dateHeureApproximative:
            typeof parsed.date_heure_approximative === 'string'
              ? parsed.date_heure_approximative
              : undefined,
          dateHeureConfirmee:
            typeof parsed.date_heure_confirmee === 'string'
              ? parsed.date_heure_confirmee
              : undefined,
        };
      }
    } catch {
      // Format inattendu : on logue et on retombe sur le comportement de sécurité ci-dessous.
    }

    this.logger.warn(`Réponse IA non structurée reçue, transfert forcé au commerçant : ${texte}`);
    // Par sécurité, si le format structuré n'est pas respecté, on transfère au
    // commerçant plutôt que d'envoyer au client une réponse potentiellement non fiable.
    return { reponseTexte: texte, necessiteTransfert: true, action: 'aucune' };
  }

  private parserDate(valeur?: string): Date | null {
    if (!valeur) return null;
    const date = new Date(valeur);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /** Formate une date en français, numérique et sans ambiguïté (ex: "le mardi 24/07/2026 à 09h00"). */
  private formaterDateCreneau(date: Date): string {
    return `le ${formaterDateHeureFr(date)}`;
  }

  /** Formate la date du jour en toutes lettres (ex: "jeudi 23 juillet 2026"). */
  private formaterDateDuJour(date: Date): string {
    const jour = JOURS_SEMAINE[date.getDay()];
    const mois = MOIS_ANNEE[date.getMonth()];
    return `${jour} ${date.getDate()} ${mois} ${date.getFullYear()}`;
  }

  private construireSystemPrompt(commercant: Commercant): string {
    const descriptionTon = DESCRIPTIONS_TON[commercant.tonAssistant] ?? DESCRIPTIONS_TON.chaleureux;

    return `Tu es l'assistant WhatsApp de "${commercant.nom}", un commerce de ${commercant.secteur} situé à ${commercant.commune} (Kinshasa, RDC).
Nous sommes le ${this.formaterDateDuJour(new Date())}.

TON À ADOPTER : ${descriptionTon}

HORAIRES :
${this.formaterHoraires(commercant.horaires)}

SERVICES PROPOSÉS :
${this.formaterServices(commercant.servicesJson)}

QUESTIONS FRÉQUENTES :
${this.formaterFaq(commercant.faqJson)}

INSTRUCTIONS :
- Réponds UNIQUEMENT à partir des informations ci-dessus (services, horaires, FAQ). N'invente jamais un service, un prix, un horaire ou une information absente de ce profil.
- Dès qu'un client montre de l'intérêt pour un service (il demande un prix, dit vouloir venir, demande les disponibilités, etc.) et évoque une date ou une période souhaitée, utilise l'action "proposer_creneau". Ne propose JAMAIS toi-même un horaire précis : le système vérifie les disponibilités réelles et l'insère à la place de ${PLACEHOLDER_CRENEAU} dans ta réponse.
- Quand tu utilises "proposer_creneau", inclus obligatoirement le texte exact ${PLACEHOLDER_CRENEAU} dans le champ "reponse" (le système le remplace par "le [jour] [date] à [heure]", ou par une phrase indiquant qu'aucun créneau n'est disponible) — formule ta phrase pour qu'elle reste correcte dans les deux cas, par exemple : "Le prochain créneau disponible est ${PLACEHOLDER_CRENEAU}.".
- Quand le client confirme explicitement un créneau que tu lui as précédemment proposé (ex: "oui ça marche", "c'est bon pour moi", "d'accord"), utilise l'action "creer_rendez_vous" et reprends exactement la date et l'heure de ta proposition précédente au format ISO 8601 dans "date_heure_confirmee". Indique dans ta réponse que la demande est enregistrée et sera confirmée par le commerçant — ne dis jamais que le rendez-vous est définitivement confirmé, seul le commerçant peut le confirmer.
- Si la question sort de ce périmètre, si tu ne sais pas répondre avec certitude, ou si le client demande explicitement à parler à un humain, indique-le via "necessite_transfert": true — un commerçant prendra le relais.

FORMAT DE RÉPONSE (obligatoire, aucune exception) :
Réponds uniquement avec un objet JSON valide, sans texte ni balise markdown avant ou après, exactement sous cette forme :
{"reponse": "<le message à envoyer tel quel au client, dans le ton défini ci-dessus>", "necessite_transfert": <true ou false>, "action": "aucune" | "proposer_creneau" | "creer_rendez_vous", "service": "<nom exact du service concerné, requis si action != aucune>", "date_heure_approximative": "<date/heure ISO 8601 déduite de la demande du client, uniquement si action = proposer_creneau>", "date_heure_confirmee": "<date/heure ISO 8601 exacte de ta précédente proposition que le client confirme, uniquement si action = creer_rendez_vous>"}`;
  }

  private formaterHoraires(horaires: Prisma.JsonValue): string {
    if (horaires && typeof horaires === 'object' && !Array.isArray(horaires)) {
      return Object.entries(horaires)
        .map(([jour, plage]) => `- ${jour} : ${this.versTexte(plage)}`)
        .join('\n');
    }
    return JSON.stringify(horaires);
  }

  private formaterServices(servicesJson: Prisma.JsonValue): string {
    if (Array.isArray(servicesJson)) {
      return servicesJson
        .map((service) => {
          if (service && typeof service === 'object' && 'nom' in service) {
            const prix = 'prix' in service ? ` — ${this.versTexte(service.prix)} FC` : '';
            return `- ${this.versTexte(service.nom)}${prix}`;
          }
          return `- ${JSON.stringify(service)}`;
        })
        .join('\n');
    }
    return JSON.stringify(servicesJson);
  }

  private formaterFaq(faqJson: Prisma.JsonValue): string {
    if (Array.isArray(faqJson)) {
      return faqJson
        .map((item) => {
          if (item && typeof item === 'object' && 'question' in item && 'reponse' in item) {
            return `Q: ${this.versTexte(item.question)}\nR: ${this.versTexte(item.reponse)}`;
          }
          return JSON.stringify(item);
        })
        .join('\n\n');
    }
    return JSON.stringify(faqJson);
  }

  private versTexte(valeur: unknown): string {
    if (typeof valeur === 'string' || typeof valeur === 'number' || typeof valeur === 'boolean') {
      return String(valeur);
    }
    return JSON.stringify(valeur);
  }
}
