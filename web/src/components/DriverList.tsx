import { useMemo } from "react";
import type { Driver, SessionResult } from "../lib/openf1";
import { flagEmoji } from "../lib/countries";

interface Props {
  drivers: Driver[];
  results: SessionResult[];
  selected: number[]; // ordered, max 2 (slot 0 = primary)
  colors: string[];
  onToggle: (driverNumber: number) => void;
}

export default function DriverList({
  drivers,
  results,
  selected,
  colors,
  onToggle,
}: Props) {
  // order by finishing position when available, else by car number
  const ordered = useMemo(() => {
    const pos = new Map(
      results.filter((r) => r.position != null).map((r) => [r.driver_number, r.position as number])
    );
    return [...drivers].sort((a, b) => {
      const pa = pos.get(a.driver_number);
      const pb = pos.get(b.driver_number);
      if (pa != null && pb != null) return pa - pb;
      if (pa != null) return -1;
      if (pb != null) return 1;
      return a.driver_number - b.driver_number;
    });
  }, [drivers, results]);

  const posOf = (n: number, idx: number) => {
    const r = results.find((x) => x.driver_number === n);
    return r?.position ?? idx + 1;
  };

  return (
    <div className="dl">
      <div className="dl-head">
        <span className="dl-title">
          <i />PILOTI
        </span>
        <span className="dl-count">
          {selected.length}/{drivers.length}
        </span>
      </div>
      <div className="dl-scroll">
        {ordered.map((d, i) => {
          const slot = selected.indexOf(d.driver_number); // -1, 0, 1
          const sel = slot >= 0;
          const c = sel ? colors[slot] : undefined;
          return (
            <button
              key={d.driver_number}
              className={`dl-item${sel ? " sel" : ""}`}
              style={
                sel
                  ? { background: `${c}1f`, ["--c" as string]: c }
                  : undefined
              }
              onClick={() => onToggle(d.driver_number)}
            >
              <span className="dl-bar" style={{ background: `#${d.team_colour ?? "888"}` }} />
              <span className="dl-pos">{posOf(d.driver_number, i)}</span>
              <span className="dl-flag">{flagEmoji(d.country_code)}</span>
              <span className="dl-name">{d.last_name || d.name_acronym}</span>
              <span
                className={`dl-check${sel ? " on" : ""}`}
                style={sel ? { background: c, borderColor: c } : undefined}
              >
                {sel ? "✓" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
