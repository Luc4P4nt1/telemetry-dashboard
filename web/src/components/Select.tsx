interface Option {
  value: string | number;
  label: string;
}

interface Props {
  label: string;
  value: string | number;
  options: Option[];
  disabled?: boolean;
  onChange: (value: string) => void;
}

export default function Select({
  label,
  value,
  options,
  disabled,
  onChange,
}: Props) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="select">
        <select
          value={value}
          disabled={disabled || options.length === 0}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.length === 0 && <option>—</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
