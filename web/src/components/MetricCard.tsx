interface Props {
  label: string;
  value: string;
  unit?: string;
  color?: string;
}

export default function MetricCard({ label, value, unit, color }: Props) {
  return (
    <div className="glass metric">
      {color && <span className="accent" style={{ background: color }} />}
      <span className="label">{label}</span>
      <span className="value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </span>
    </div>
  );
}
