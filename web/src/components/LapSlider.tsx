import type { Lap } from "../lib/openf1";

interface Props {
  laps: Lap[]; // reference driver laps (filtered: racing laps only)
  value: number | null;
  onChange: (lap: number) => void;
}

function fmtLap(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3).padStart(6, "0");
  return m > 0 ? `${m}:${sec}` : sec;
}

export default function LapSlider({ laps, value, onChange }: Props) {
  const total = laps.length ? Math.max(...laps.map((l) => l.lap_number)) : 1;
  const available = new Set(laps.map((l) => l.lap_number));
  const fastest = [...laps].sort(
    (a, b) => (a.lap_duration ?? 1e9) - (b.lap_duration ?? 1e9)
  )[0];
  const cur = laps.find((l) => l.lap_number === value) ?? null;
  const pct = total > 1 ? (((value ?? 1) - 1) / (total - 1)) * 100 : 0;

  return (
    <div className="lapslider">
      <div className="ls-head">
        <span className="ls-title">
          GIRO <b>{value ?? "—"}</b> <span className="ls-total">/ {total}</span>
        </span>
        <span className="ls-time">{fmtLap(cur?.lap_duration ?? null)}</span>
      </div>

      <input
        className="ls-range"
        type="range"
        min={1}
        max={total}
        step={1}
        value={value ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--f1) ${pct}%, rgba(255,255,255,0.12) ${pct}%)`,
        }}
      />

      <div className="ls-chips">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
          const has = available.has(n);
          const isFast = fastest && n === fastest.lap_number;
          return (
            <button
              key={n}
              className={`ls-chip${n === value ? " on" : ""}${isFast ? " fast" : ""}${has ? "" : " dim"}`}
              disabled={!has}
              onClick={() => has && onChange(n)}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="ls-hint">
        Trascina lo slider o clicca un giro. Sbiadito = giro box/SC ·{" "}
        <span style={{ color: "var(--gear)" }}>anello viola</span> = giro veloce.
      </div>
    </div>
  );
}
