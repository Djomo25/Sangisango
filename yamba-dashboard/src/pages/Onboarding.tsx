import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ServicesEditor } from '../components/ServicesEditor';
import { FaqEditor } from '../components/FaqEditor';
import { HorairesEditor } from '../components/HorairesEditor';
import { ToneSelector } from '../components/ToneSelector';
import { LienConversionCard } from '../components/LienConversionCard';
import {
  creerCommercant,
  type FaqItem,
  type Horaires,
  type Service,
  type TonAssistant,
} from '../api/commercants';
import { ApiError } from '../api/client';
import './Onboarding.css';

const TOTAL_ETAPES = 8;

export function Onboarding() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [etape, setEtape] = useState(1);

  // Étape 1 — Infos commerce
  const [nom, setNom] = useState('');
  const [secteur, setSecteur] = useState('');

  // Étape 2 — Connexion WhatsApp (simulée)
  const [telephone, setTelephone] = useState('');
  const [connecte, setConnecte] = useState(false);
  const [connexionEnCours, setConnexionEnCours] = useState(false);

  // Étape 3 — Coordonnées
  const [commune, setCommune] = useState('');

  // Étapes 4-7
  const [servicesJson, setServicesJson] = useState<Service[]>([]);
  const [faqJson, setFaqJson] = useState<FaqItem[]>([]);
  const [horaires, setHoraires] = useState<Horaires>({});
  const [tonAssistant, setTonAssistant] = useState<TonAssistant>('chaleureux');

  // Étape 8 — Création du compte
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [creationReussie, setCreationReussie] = useState(false);
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);
  const tentativeEnvoyee = useRef(false);

  function suivant() {
    if (etape === 2 && !connecte) return;
    setEtape((e) => Math.min(e + 1, TOTAL_ETAPES));
  }

  function precedent() {
    setEtape((e) => Math.max(e - 1, 1));
  }

  function corriger() {
    tentativeEnvoyee.current = false;
    setErreurCreation(null);
    setEtape(2);
  }

  // TODO: remplacer par la vraie intégration Meta Embedded Signup une fois disponible.
  function simulerConnexionWhatsapp() {
    if (!telephone.trim()) return;
    setConnexionEnCours(true);
    setTimeout(() => {
      setConnecte(true);
      setConnexionEnCours(false);
    }, 900);
  }

  useEffect(() => {
    if (etape !== TOTAL_ETAPES || tentativeEnvoyee.current) return;
    tentativeEnvoyee.current = true;

    async function creerCompte() {
      setCreationEnCours(true);
      setErreurCreation(null);
      try {
        const commercant = await creerCommercant({
          nom,
          secteur,
          commune,
          telephone,
          tonAssistant,
          horaires,
          servicesJson,
          faqJson,
        });
        await login(commercant.accessToken);
        setCreationReussie(true);
      } catch (error) {
        tentativeEnvoyee.current = false;
        setErreurCreation(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
      } finally {
        setCreationEnCours(false);
      }
    }

    creerCompte();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape]);

  return (
    <div className="onboarding-ecran">
      <div className="onboarding-carte">
        <div className="onb-dots">
          {Array.from({ length: TOTAL_ETAPES }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              className={
                n === etape ? 'onb-dot current' : n < etape ? 'onb-dot done' : 'onb-dot'
              }
            />
          ))}
        </div>

        <div className="onb-panels">
          {etape === 1 && (
            <div className="onb-panel">
              <div className="onb-eyebrow">Bienvenue</div>
              <h3>Créons votre assistant 👋</h3>
              <p className="onb-desc">Deux minutes suffisent. Commençons par votre commerce.</p>
              <div className="form-field">
                <label>Nom du commerce</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="ex. Chez Maman Nathalie"
                  value={nom}
                  onChange={(event) => setNom(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-field">
                <label>Secteur d'activité</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="ex. Coiffure & beauté"
                  value={secteur}
                  onChange={(event) => setSecteur(event.target.value)}
                />
              </div>
            </div>
          )}

          {etape === 2 && (
            <div className="onb-panel">
              <div className="onb-eyebrow">Connexion WhatsApp</div>
              <h3>Connectons votre WhatsApp</h3>
              <p className="onb-desc">C'est le numéro que vos clients utiliseront pour vous écrire.</p>

              {!connecte ? (
                <div className="fb-connect-box">
                  <div className="form-field">
                    <label>Numéro de téléphone</label>
                    <input
                      className="form-input"
                      type="tel"
                      inputMode="numeric"
                      placeholder="243900000000"
                      value={telephone}
                      onChange={(event) => setTelephone(event.target.value)}
                    />
                  </div>
                  <div className="wa-glyph">📱</div>
                  <p>Un accompagnement se fait avec vous — pas de document à fournir pour démarrer.</p>
                  <button
                    type="button"
                    className="btn-fb"
                    onClick={simulerConnexionWhatsapp}
                    disabled={!telephone.trim() || connexionEnCours}
                  >
                    <span className="fb-icon">f</span>
                    {connexionEnCours ? 'Connexion en cours…' : 'Se connecter avec Facebook'}
                  </button>
                </div>
              ) : (
                <div className="fb-connect-box connected">
                  <div className="fb-connected-row">
                    <div className="fb-connected-check">✓</div>
                    <div className="fb-connected-num">
                      <div className="lbl">Numéro connecté</div>
                      <div className="num">{telephone}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {etape === 3 && (
            <div className="onb-panel">
              <div className="onb-eyebrow">Coordonnées</div>
              <h3>Où êtes-vous situé ?</h3>
              <p className="onb-desc">Votre numéro WhatsApp est déjà connecté ✓</p>
              <div className="form-field">
                <label>Commune</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="ex. Limete, Kinshasa"
                  value={commune}
                  onChange={(event) => setCommune(event.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          {etape === 4 && (
            <div className="onb-panel">
              <div className="onb-eyebrow">Services</div>
              <h3>Que proposez-vous ?</h3>
              <p className="onb-desc">Avec les prix — l'assistant s'en sert pour répondre.</p>
              <ServicesEditor valeur={servicesJson} onChange={setServicesJson} />
            </div>
          )}

          {etape === 5 && (
            <div className="onb-panel">
              <div className="onb-eyebrow">FAQ personnalisée</div>
              <h3>Les questions qu'on vous pose souvent</h3>
              <FaqEditor valeur={faqJson} onChange={setFaqJson} />
            </div>
          )}

          {etape === 6 && (
            <div className="onb-panel">
              <div className="onb-eyebrow">Horaires</div>
              <h3>Vos jours et heures d'ouverture</h3>
              <HorairesEditor valeur={horaires} onChange={setHoraires} />
            </div>
          )}

          {etape === 7 && (
            <div className="onb-panel">
              <div className="onb-eyebrow">Ton de l'assistant</div>
              <h3>Comment doit-il parler à vos clients ?</h3>
              <ToneSelector valeur={tonAssistant} onChange={setTonAssistant} />
            </div>
          )}

          {etape === 8 && (
            <div className="onb-panel recap-panel">
              {creationEnCours && <p className="recap-chargement">Création de votre assistant…</p>}

              {erreurCreation && (
                <>
                  <p className="recap-erreur">{erreurCreation}</p>
                  <button type="button" className="btn-ghost" onClick={corriger}>
                    ← Corriger
                  </button>
                </>
              )}

              {creationReussie && (
                <>
                  <div className="recap-check">✓</div>
                  <h3>Votre assistant est en ligne</h3>
                  <p className="onb-desc">
                    Voici le lien à mettre en bio, en publicité ou sur votre carte de visite.
                  </p>
                  <LienConversionCard />
                  <button
                    type="button"
                    className="cta-final"
                    onClick={() => navigate('/conversations', { replace: true })}
                  >
                    Voir mon tableau de bord →
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {etape < TOTAL_ETAPES && (
          <div className="onb-nav">
            <button
              type="button"
              className="btn-ghost"
              onClick={precedent}
              style={{ visibility: etape === 1 ? 'hidden' : 'visible' }}
            >
              Retour
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={suivant}
              disabled={etape === 2 && !connecte}
            >
              {etape === TOTAL_ETAPES - 1 ? 'Générer mon lien' : 'Continuer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
