const COMPOUND: Record<string, { c: string; label: string }> = {
  SOFT: { c: "#ff3b30", label: "Soft" },
  MEDIUM: { c: "#ffd60a", label: "Medium" },
  HARD: { c: "#f2f2f7", label: "Hard" },
  INTERMEDIATE: { c: "#30d158", label: "Inter" },
  WET: { c: "#0a84ff", label: "Wet" },
};

interface Props {
  compound: string;
  age: number;
}

export default function Tyre({ compound, age }: Props) {
  const m = COMPOUND[compound?.toUpperCase()] ?? { c: "#888", label: compound };
  return (
    <span className="tyre">
      <span className="tyre-ring" style={{ borderColor: m.c, color: m.c }}>
        {m.label[0]}
      </span>
      <span className="tyre-text">
        {m.label} · {age} {age === 1 ? "giro" : "giri"}
      </span>
    </span>
  );
}
