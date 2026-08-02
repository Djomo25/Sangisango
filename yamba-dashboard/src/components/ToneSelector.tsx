import type { TonAssistant } from '../api/commercants';

const OPTIONS: { valeur: TonAssistant; emoji: string; titre: string; description: string }[] = [
  { valeur: 'chaleureux', emoji: '🌸', titre: 'Chaleureux', description: 'Convivial, quelques emojis' },
  { valeur: 'professionnel', emoji: '💼', titre: 'Professionnel', description: 'Courtois, sobre' },
  { valeur: 'direct', emoji: '⚡', titre: 'Direct', description: 'Réponses courtes, efficace' },
];

export function ToneSelector({
  valeur,
  onChange,
}: {
  valeur: TonAssistant;
  onChange: (valeur: TonAssistant) => void;
}) {
  return (
    <div className="tone-cards">
      {OPTIONS.map((option) => (
        <button
          key={option.valeur}
          type="button"
          className={option.valeur === valeur ? 'tone-card on' : 'tone-card'}
          onClick={() => onChange(option.valeur)}
        >
          <span className="emoji">{option.emoji}</span>
          <div>
            <div className="t">{option.titre}</div>
            <div className="d">{option.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
