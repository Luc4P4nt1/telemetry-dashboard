import type { Driver } from "../lib/openf1";

interface Props {
  rows: { driver_number: number; position: number }[];
  drivers: Driver[];
  highlight?: number | null;
}

export default function Standings({ rows, drivers, highlight }: Props) {
  const byNum = new Map(drivers.map((d) => [d.driver_number, d]));
  if (!rows.length)
    return (
      <div className="empty">Posizioni non disponibili per questa sessione.</div>
    );

  return (
    <div className="table">
      {rows.map((r) => {
        const d = byNum.get(r.driver_number);
        const on = highlight === r.driver_number;
        return (
          <div
            className="trow"
            key={r.driver_number}
            style={
              on
                ? { background: "rgba(255,255,255,0.07)", borderRadius: 10 }
                : undefined
            }
          >
            <span className="pos">{r.position}</span>
            <span
              className="dot"
              style={{ background: `#${d?.team_colour ?? "888"}` }}
            />
            <span className="who">
              <b>{d?.name_acronym ?? r.driver_number}</b>
              <small>{d?.team_name ?? ""}</small>
            </span>
            <span className="gap" />
            <span className="pts" />
          </div>
        );
      })}
    </div>
  );
}
