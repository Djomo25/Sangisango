import './FilterPills.css';

export interface OptionFiltre<T extends string> {
  valeur: T;
  label: string;
}

export function FilterPills<T extends string>({
  options,
  valeur,
  onChange,
}: {
  options: readonly OptionFiltre<T>[];
  valeur: T;
  onChange: (valeur: T) => void;
}) {
  return (
    <div className="filter-pills">
      {options.map((option) => (
        <button
          key={option.valeur}
          type="button"
          className={option.valeur === valeur ? 'filter-pill filter-pill--actif' : 'filter-pill'}
          onClick={() => onChange(option.valeur)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
