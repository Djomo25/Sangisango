import type { Horaires } from '../api/commercants';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export function HorairesEditor({
  valeur,
  onChange,
}: {
  valeur: Horaires;
  onChange: (valeur: Horaires) => void;
}) {
  function modifierJour(jour: string, plage: string) {
    onChange({ ...valeur, [jour]: plage });
  }

  return (
    <div>
      {JOURS.map((jour) => (
        <div className="horaires-row" key={jour}>
          <span className="horaires-jour">{jour}</span>
          <input
            className="form-input"
            type="text"
            placeholder="ex. 08h30-18h00 ou Fermé"
            value={valeur[jour] ?? ''}
            onChange={(event) => modifierJour(jour, event.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
