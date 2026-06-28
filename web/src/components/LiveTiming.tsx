import { useMemo } from "react";
import type { Driver, Interval, Lap, Position, Stint } from "../lib/openf1";
import Tyre from "./Tyre";

interface Props {
  drivers: Driver[];
  positions: Position[];
  intervals: Interval[];
  laps: Lap[];
  stints: Stint[];
}

function fmtLap(s: number | null | undefined): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3).padStart(6, "0");
  return m > 0 ? `${m}:${sec}` : sec;
}

function fmtGap(g: number | string | null | undefined): string {
  if (g == null) return "—";
  if (typeof g === "number") return `+${g.toFixed(3)}`;
  return String(g);
}

// latest record per driver (by date)
function latestByDriver<T extends { driver_number: number; date: string }>(
  arr: T[]
): Map<number, T> {
  const m = new Map<number, T>();
  for (const r of arr) {
    const t = new Date(r.date).getTime();
    const prev = m.get(r.driver_number);
    if (!prev || t >= new Date(prev.date).getTime()) m.set(r.driver_number, r);
  }
  return m;
}

export default function LiveTiming({
  drivers,
  positions,
  intervals,
  laps,
  stints,
}: Props) {
  const rows = useMemo(() => {
    const byNum = new Map(drivers.map((d) => [d.driver_number, d]));
    const pos = latestByDriver(positions);
    const iv = latestByDriver(intervals);

    // last completed lap (+ its number) per driver
    const lastLap = new Map<number, Lap>();
    for (const l of laps) {
      if (l.driver_number == null || !l.lap_duration) continue;
      const prev = lastLap.get(l.driver_number);
      if (!prev || l.lap_number > prev.lap_number) lastLap.set(l.driver_number, l);
    }

    // current stint (highest lap_start) per driver
    const curStint = new Map<number, Stint>();
    for (const s of stints) {
      const prev = curStint.get(s.driver_number);
      if (!prev || s.lap_start > prev.lap_start) curStint.set(s.driver_number, s);
    }

    return [...pos.values()]
      .filter((p) => byNum.has(p.driver_number))
      .sort((a, b) => a.position - b.position)
      .map((p) => {
        const d = byNum.get(p.driver_number)!;
        const ll = lastLap.get(p.driver_number);
        const st = curStint.get(p.driver_number);
        const age =
          st && ll ? st.tyre_age_at_start + (ll.lap_number - st.lap_start) : null;
        return {
          pos: p.position,
          d,
          gapLeader: iv.get(p.driver_number)?.gap_to_leader,
          interval: iv.get(p.driver_number)?.interval,
          lastLap: ll?.lap_duration ?? null,
          compound: st?.compound ?? null,
          age,
        };
      });
  }, [drivers, positions, intervals, laps, stints]);

  if (!rows.length)
    return (
      <div className="empty">Nessun dato di posizione per questa sessione.</div>
    );

  return (
    <div className="live-tower">
      <div className="lt-row lt-head">
        <span>POS</span>
        <span>PILOTA</span>
        <span>INTERVALLO</span>
        <span>DISTACCO</span>
        <span>ULTIMO GIRO</span>
        <span>GOMMA</span>
      </div>
      {rows.map((r) => (
        <div className="lt-row" key={r.d.driver_number}>
          <span className="lt-pos">{r.pos}</span>
          <span className="lt-driver" style={{ borderColor: `#${r.d.team_colour ?? "888"}` }}>
            <b>{r.d.name_acronym}</b>
            <small>{r.d.team_name}</small>
          </span>
          <span className="lt-cell">{r.pos === 1 ? "—" : fmtGap(r.interval)}</span>
          <span className="lt-cell">{r.pos === 1 ? "LEADER" : fmtGap(r.gapLeader)}</span>
          <span className="lt-cell mono">{fmtLap(r.lastLap)}</span>
          <span className="lt-cell">
            {r.compound ? <Tyre compound={r.compound} age={r.age ?? 0} /> : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
