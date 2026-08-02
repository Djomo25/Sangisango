import type { FaqItem } from '../api/commercants';

export function FaqEditor({
  valeur,
  onChange,
}: {
  valeur: FaqItem[];
  onChange: (valeur: FaqItem[]) => void;
}) {
  function modifier(index: number, champ: keyof FaqItem, val: string) {
    onChange(valeur.map((item, i) => (i === index ? { ...item, [champ]: val } : item)));
  }

  function supprimer(index: number) {
    onChange(valeur.filter((_, i) => i !== index));
  }

  function ajouter() {
    onChange([...valeur, { question: '', reponse: '' }]);
  }

  return (
    <div>
      {valeur.map((item, index) => (
        <div className="faq-item" key={index}>
          <div className="form-field">
            <label>Question</label>
            <input
              className="form-input"
              type="text"
              placeholder="ex. Travaillez-vous le dimanche ?"
              value={item.question}
              onChange={(event) => modifier(index, 'question', event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Réponse</label>
            <textarea
              className="form-textarea"
              placeholder="ex. Oui, de 10h à 18h."
              value={item.reponse}
              onChange={(event) => modifier(index, 'reponse', event.target.value)}
            />
          </div>
          <button type="button" className="add-line" onClick={() => supprimer(index)}>
            Supprimer cette question
          </button>
        </div>
      ))}
      <button type="button" className="add-line" onClick={ajouter}>
        + Ajouter une question
      </button>
    </div>
  );
}
