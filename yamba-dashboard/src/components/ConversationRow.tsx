import type { ConversationApercu } from '../api/conversations';
import { STATUT_CONVERSATION_META } from '../utils/statuts';
import { formatHeureOuJour } from '../utils/date';
import { Pill } from './Pill';
import './ConversationRow.css';

export function ConversationRow({
  conversation,
  selectionnee,
  onClick,
}: {
  conversation: ConversationApercu;
  selectionnee: boolean;
  onClick: () => void;
}) {
  const meta = STATUT_CONVERSATION_META[conversation.statut];
  const nom = conversation.clientNom || conversation.clientTelephone;
  const heure = conversation.dernierMessage
    ? formatHeureOuJour(conversation.dernierMessage.createdAt)
    : formatHeureOuJour(conversation.createdAt);
  const apercu = conversation.dernierMessage?.contenu ?? '(aucun message)';

  return (
    <div
      className={selectionnee ? 'conv-row conv-row--selectionnee' : 'conv-row'}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick();
      }}
    >
      <div className="conv-row-top">
        <span className="conv-name">{nom}</span>
        <span className="conv-time">{heure}</span>
      </div>
      <div className="conv-row-bottom">
        <span className="conv-snippet">{apercu}</span>
        <Pill ton={meta.ton}>{meta.label}</Pill>
      </div>
    </div>
  );
}
