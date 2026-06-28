import { useMemo, useState } from "react";
import type { Driver, SessionResult } from "../lib/openf1";

interface Props {
  results: SessionResult[];
  drivers: Driver[];
  sessionName?: string;
}

function fmtTime(s: number | null): string {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3).padStart(6, "0");
  return m > 0 ? `${m}:${sec}` : sec;
}

function gapLabel(r: SessionResult): string {
  if (r.dnf) return "DNF";
  if (r.dns) return "DNS";
  if (r.dsq) return "DSQ";
  if (r.position === 1) return "Leader";
  const g = r.gap_to_leader;
  if (g == null) return "—";
  if (typeof g === "number") return `+${g.toFixed(3)}`;
  return String(g);
}

// index of the last segment a driver actually set a time in
function lastSeg(d: (number | null)[]): number {
  for (let i = d.length - 1; i >= 0; i--) if (d[i] != null) return i;
  return -1;
}

export default function Classification({
  results,
  drivers,
  sessionName,
}: Props) {
  const byNum = useMemo(
    () => new Map(drivers.map((d) => [d.driver_number, d])),
    [drivers]
  );
  const isQuali = results.some((r) => Array.isArray(r.duration));
  const prefix = (sessionName ?? "").toLowerCase().includes("sprint")
    ? "SQ"
    : "Q";
  const [seg, setSeg] = useState(2);

  if (!results.length)
    return <div className="empty">Classifica non disponibile.</div>;

  // ── Qualifying: split into Q1 / Q2 / Q3 ──────────────────────
  if (isQuali) {
    const rows = results
      .map((r) => {
        const dur = (r.duration as (number | null)[]) ?? [null, null, null];
        const gap = Array.isArray(r.gap_to_leader)
          ? (r.gap_to_leader as (number | null)[])
          : [null, null, null];
        return { r, dur, gap, last: lastSeg(dur) };
      })
      .filter((x) => x.dur[seg] != null)
      .sort((a, b) => (a.dur[seg] ?? 1e9) - (b.dur[seg] ?? 1e9));

    return (
      <>
        <div className="segmented">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              className={i === seg ? "on" : ""}
              onClick={() => setSeg(i)}
            >
              {prefix}
              {i + 1}
            </button>
          ))}
        </div>
        <div className="table">
          {rows.map((x, idx) => {
            const d = byNum.get(x.r.driver_number);
            const eliminated = x.last === seg && seg < 2;
            const gapVal = x.gap[seg];
            return (
              <div
                className="trow"
                key={x.r.driver_number}
                style={{ opacity: eliminated ? 0.5 : 1 }}
              >
                <span className="pos">{idx + 1}</span>
                <span
                  className="dot"
                  style={{ background: `#${d?.team_colour ?? "888"}` }}
                />
                <span className="who">
                  <b>{d?.name_acronym ?? x.r.driver_number}</b>
                  <small>{d?.team_name ?? ""}</small>
                </span>
                <span className="gap">{fmtTime(x.dur[seg])}</span>
                <span className="pts">
                  {idx === 0 ? "" : gapVal != null ? `+${gapVal.toFixed(3)}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // ── Race / other: standard classification ────────────────────
  const rows = [...results].sort(
    (a, b) => (a.position ?? 999) - (b.position ?? 999)
  );

  return (
    <div className="table">
      {rows.map((r, i) => {
        const d = byNum.get(r.driver_number);
        const out = r.dnf || r.dns || r.dsq;
        return (
          <div
            className="trow"
            key={r.driver_number}
            style={{ opacity: out ? 0.55 : 1 }}
          >
            <span className="pos">{r.position ?? i + 1}</span>
            <span
              className="dot"
              style={{ background: `#${d?.team_colour ?? "888"}` }}
            />
            <span className="who">
              <b>{d?.name_acronym ?? r.driver_number}</b>
              <small>{d?.team_name ?? ""}</small>
            </span>
            <span className="gap">{gapLabel(r)}</span>
            <span className="pts">{r.points ? `${r.points} pt` : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
