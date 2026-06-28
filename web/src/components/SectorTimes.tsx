import type { Lap } from "../lib/openf1";

interface Row {
  name: string;
  acr: string;
  color: string;
  lap: Lap | null;
}

interface Props {
  rows: Row[]; // 1 or 2 drivers
}

function fmtLap(s: number | null | undefined): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3).padStart(6, "0");
  return m > 0 ? `${m}:${sec}` : sec;
}

function delta(a: number | null | undefined, b: number | null | undefined) {
  if (a == null || b == null) return null;
  return b - a;
}

function Cell({ d }: { d: number | null }) {
  if (d == null) return <span className="st-cell">—</span>;
  const sign = d > 0 ? "+" : "";
  return (
    <span className={`st-cell delta ${d <= 0 ? "good" : "bad"}`}>
      {sign}
      {d.toFixed(3)}
    </span>
  );
}

export default function SectorTimes({ rows }: Props) {
  const ref = rows[0]?.lap ?? null;

  return (
    <div className="sectors">
      <div className="st-row st-head">
        <span>POS</span>
        <span>PILOTA</span>
        <span>TEMPO GIRO</span>
        <span>SETTORE 1</span>
        <span>SETTORE 2</span>
        <span>SETTORE 3</span>
      </div>
      {rows.map((r, i) => {
        const isRef = i === 0;
        return (
          <div className="st-row" key={r.acr}>
            <span className="st-pos">{i + 1}</span>
            <span className="st-driver" style={{ borderColor: r.color }}>
              <small>{r.name}</small>
              <b style={{ color: r.color }}>{r.acr}</b>
            </span>
            <span className="st-lap">{fmtLap(r.lap?.lap_duration)}</span>
            {isRef ? (
              <>
                <span className="st-cell abs">{r.lap?.duration_sector_1?.toFixed(3) ?? "—"}</span>
                <span className="st-cell abs">{r.lap?.duration_sector_2?.toFixed(3) ?? "—"}</span>
                <span className="st-cell abs">{r.lap?.duration_sector_3?.toFixed(3) ?? "—"}</span>
              </>
            ) : (
              <>
                <Cell d={delta(ref?.duration_sector_1, r.lap?.duration_sector_1)} />
                <Cell d={delta(ref?.duration_sector_2, r.lap?.duration_sector_2)} />
                <Cell d={delta(ref?.duration_sector_3, r.lap?.duration_sector_3)} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
