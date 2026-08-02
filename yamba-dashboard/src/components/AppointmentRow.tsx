import type { RendezVous } from '../api/rendez-vous';
import { STATUT_RENDEZ_VOUS_META } from '../utils/statuts';
import { formatHeure, formatJourCourt } from '../utils/date';
import { Pill } from './Pill';
import './AppointmentRow.css';

export function AppointmentRow({
  rendezVous,
  onConfirmer,
  onAnnuler,
  actionEnCours,
}: {
  rendezVous: RendezVous;
  onConfirmer: () => void;
  onAnnuler: () => void;
  actionEnCours: boolean;
}) {
  const meta = STATUT_RENDEZ_VOUS_META[rendezVous.statut];
  const nom = rendezVous.conversation.clientNom || rendezVous.conversation.clientTelephone;

  return (
    <div className="appt-row">
      <div className="appt-row-when">
        <span className="appt-day">{formatJourCourt(rendezVous.creneau.dateHeure)}</span>
        <span className="appt-time">{formatHeure(rendezVous.creneau.dateHeure)}</span>
      </div>

      <div className="appt-row-who">
        <strong>{nom}</strong>
        <span className="muted-text">
          {rendezVous.service}
          {rendezVous.prix ? ` — ${rendezVous.prix} FC` : ''}
        </span>
      </div>

      <Pill ton={meta.ton}>{meta.label}</Pill>

      <div className="appt-row-actions">
        {rendezVous.statut === 'a_confirmer' && (
          <button
            type="button"
            className="btn-primary"
            onClick={onConfirmer}
            disabled={actionEnCours}
          >
            {actionEnCours ? '...' : 'Confirmer'}
          </button>
        )}
        {rendezVous.statut !== 'annule' && (
          <button
            type="button"
            className="btn-ghost small btn-annuler"
            onClick={onAnnuler}
            disabled={actionEnCours}
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
