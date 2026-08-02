import type { Service } from '../api/commercants';

export function ServicesEditor({
  valeur,
  onChange,
}: {
  valeur: Service[];
  onChange: (valeur: Service[]) => void;
}) {
  function modifier(index: number, champ: keyof Service, val: string) {
    onChange(valeur.map((service, i) => (i === index ? { ...service, [champ]: val } : service)));
  }

  function supprimer(index: number) {
    onChange(valeur.filter((_, i) => i !== index));
  }

  function ajouter() {
    onChange([...valeur, { nom: '', prix: '' }]);
  }

  return (
    <div>
      {valeur.map((service, index) => (
        <div className="svc-row" key={index}>
          <input
            className="form-input"
            type="text"
            placeholder="Nom du service"
            value={service.nom}
            onChange={(event) => modifier(index, 'nom', event.target.value)}
          />
          <input
            className="form-input prix-input"
            type="text"
            placeholder="Prix (FC)"
            value={service.prix ?? ''}
            onChange={(event) => modifier(index, 'prix', event.target.value)}
          />
          <button
            type="button"
            className="supprimer-ligne"
            onClick={() => supprimer(index)}
            aria-label="Supprimer ce service"
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="add-line" onClick={ajouter}>
        + Ajouter un service
      </button>
    </div>
  );
}
