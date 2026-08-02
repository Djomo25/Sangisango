import { useEffect, useState, type FormEvent } from 'react';
import {
  ajouterCorrection,
  obtenirConversation,
  prendreLaMain,
  terminerConversation,
  type ConversationDetail,
  type Message,
} from '../api/conversations';
import { confirmerRendezVous } from '../api/rendez-vous';
import { ApiError } from '../api/client';
import { STATUT_RENDEZ_VOUS_META } from '../utils/statuts';
import { formatHeure, formatJourCourt } from '../utils/date';
import { Pill } from './Pill';
import './ConversationDetailPanel.css';

export function ConversationDetailPanel({
  conversationId,
  onActionReussie,
}: {
  conversationId: string;
  onActionReussie: () => void;
}) {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [prendreLaMainEnCours, setPrendreLaMainEnCours] = useState(false);
  const [terminerEnCours, setTerminerEnCours] = useState(false);
  const [confirmationEnCours, setConfirmationEnCours] = useState(false);

  const [texteCorrection, setTexteCorrection] = useState('');
  const [correctionEnCours, setCorrectionEnCours] = useState(false);
  const [correctionEnvoyee, setCorrectionEnvoyee] = useState(false);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const detail = await obtenirConversation(conversationId);
      setConversation(detail);
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    setTexteCorrection('');
    setCorrectionEnvoyee(false);
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function surPrendreLaMain() {
    setPrendreLaMainEnCours(true);
    try {
      await prendreLaMain(conversationId);
      await charger();
      onActionReussie();
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setPrendreLaMainEnCours(false);
    }
  }

  async function surTerminer() {
    setTerminerEnCours(true);
    try {
      await terminerConversation(conversationId);
      await charger();
      onActionReussie();
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setTerminerEnCours(false);
    }
  }

  async function surConfirmerRendezVous() {
    if (!conversation?.rendezVous) return;
    setConfirmationEnCours(true);
    try {
      await confirmerRendezVous(conversation.rendezVous.id);
      await charger();
      onActionReussie();
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setConfirmationEnCours(false);
    }
  }

  async function surEnvoyerCorrection(event: FormEvent, messageId: string) {
    event.preventDefault();
    if (!texteCorrection.trim()) return;
    setCorrectionEnCours(true);
    try {
      await ajouterCorrection(conversationId, messageId, texteCorrection.trim());
      setCorrectionEnvoyee(true);
      setTexteCorrection('');
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setCorrectionEnCours(false);
    }
  }

  if (chargement) {
    return <div className="conv-detail" />;
  }

  if (erreur && !conversation) {
    return (
      <div className="conv-detail">
        <p className="empty">{erreur}</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="conv-detail">
        <p className="empty">Sélectionnez une conversation</p>
      </div>
    );
  }

  const iaSuspendue =
    conversation.iaSuspendueJusqua && new Date(conversation.iaSuspendueJusqua).getTime() > Date.now();

  const dernierMessageIa = [...conversation.messages].reverse().find((m) => m.expediteur === 'ia');

  return (
    <div className="conv-detail">
      <div className="detail-head">
        <div>
          <strong>{conversation.clientNom || conversation.clientTelephone}</strong>
          <div className="muted-text">{conversation.clientTelephone}</div>
        </div>
        <div className="detail-head-actions">
          {iaSuspendue ? (
            <span className="detail-ia-suspendue">
              Vous avez la main jusqu'à {formatHeure(conversation.iaSuspendueJusqua as string)}
            </span>
          ) : (
            <button
              type="button"
              className="btn-ghost small"
              onClick={surPrendreLaMain}
              disabled={prendreLaMainEnCours}
            >
              {prendreLaMainEnCours ? 'En cours...' : 'Prendre la main'}
            </button>
          )}
          {conversation.statut !== 'terminee' && (
            <button
              type="button"
              className="btn-ghost small"
              onClick={surTerminer}
              disabled={terminerEnCours}
            >
              {terminerEnCours ? 'En cours...' : 'Marquer comme terminée'}
            </button>
          )}
        </div>
      </div>

      {erreur && <p className="detail-erreur">{erreur}</p>}

      <div className="chat-container">
        {conversation.messages.map((message) => (
          <Bulle key={message.id} message={message} />
        ))}
      </div>

      {conversation.rendezVous && (
        <div className="appt-box">
          <div className="appt-box-row">
            <span>
              📅 {formatJourCourt(conversation.rendezVous.creneau.dateHeure)} ·{' '}
              {formatHeure(conversation.rendezVous.creneau.dateHeure)}
            </span>
            <span>
              {conversation.rendezVous.service}
              {conversation.rendezVous.prix ? ` — ${conversation.rendezVous.prix} FC` : ''}
            </span>
          </div>
          <div className="appt-box-statut">
            <Pill ton={STATUT_RENDEZ_VOUS_META[conversation.rendezVous.statut].ton}>
              {STATUT_RENDEZ_VOUS_META[conversation.rendezVous.statut].label}
            </Pill>
            {conversation.rendezVous.statut === 'a_confirmer' && (
              <button
                type="button"
                className="btn-primary"
                onClick={surConfirmerRendezVous}
                disabled={confirmationEnCours}
              >
                {confirmationEnCours ? 'Confirmation...' : 'Confirmer le rendez-vous'}
              </button>
            )}
          </div>
        </div>
      )}

      {dernierMessageIa && (
        <form className="fix-box" onSubmit={(event) => surEnvoyerCorrection(event, dernierMessageIa.id)}>
          <label>Proposer une meilleure réponse</label>
          {correctionEnvoyee ? (
            <p className="fix-confirmation">Correction envoyée ✓</p>
          ) : (
            <div className="fix-input">
              <input
                type="text"
                placeholder="ex. préciser qu'on ne travaille pas les jours fériés…"
                value={texteCorrection}
                onChange={(event) => setTexteCorrection(event.target.value)}
              />
              <button type="submit" className="btn-ghost tiny" disabled={correctionEnCours}>
                Envoyer
              </button>
            </div>
          )}
          <p className="hint">
            Utilisé pour améliorer l'assistant — pas de mise à jour automatique en V1.
          </p>
        </form>
      )}
    </div>
  );
}

function Bulle({ message }: { message: Message }) {
  const cote = message.expediteur === 'client' ? 'client' : 'autre';
  return (
    <div className={`bubble bubble--${cote}`}>
      {message.expediteur !== 'client' && (
        <span className="bubble-sender">
          {message.expediteur === 'ia' ? 'Assistant IA' : 'Vous'}
        </span>
      )}
      {message.contenu}
      <span className="bubble-time">{formatHeure(message.createdAt)}</span>
    </div>
  );
}
