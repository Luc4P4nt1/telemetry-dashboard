import { useMemo, useState } from "react";

export interface TLEvent {
  t: number; // absolute ms timestamp
  color: string;
  title: string; // short label (flag / driver acronym)
  detail?: string; // longer message
  audio?: string; // recording url (team radio)
}

export interface TLTrack {
  label: string;
  events: TLEvent[];
}

interface Props {
  start: number; // ms
  end: number; // ms
  tracks: TLTrack[];
  mode: "clock" | "seconds";
  // when set, the track plotting area uses these pixel insets (to align
  // exactly with the telemetry chart's plot area)
  padLeft?: number;
  padRight?: number;
}

function fmtTick(ms: number, start: number, mode: "clock" | "seconds"): string {
  if (mode === "seconds") return `${((ms - start) / 1000).toFixed(0)}s`;
  return new Date(ms).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Timeline({
  start,
  end,
  tracks,
  mode,
  padLeft,
  padRight,
}: Props) {
  const span = Math.max(1, end - start);
  const aligned = padLeft != null;
  const PL = padLeft ?? 0;
  const PR = padRight ?? 0;
  const [sel, setSel] = useState<TLEvent | null>(null);

  const leftOf = (t: number): string => {
    const frac = Math.max(0, Math.min(1, (t - start) / span));
    return aligned
      ? `calc(${PL}px + (100% - ${PL + PR}px) * ${frac})`
      : `${frac * 100}%`;
  };

  const ticks = useMemo(() => {
    const n = 6;
    return Array.from({ length: n + 1 }, (_, i) => start + (span / n) * i);
  }, [start, span]);

  const hasEvents = tracks.some((tr) => tr.events.length);
  const lineInset = aligned ? { left: PL, right: PR } : undefined;

  return (
    <div className={`tl${aligned ? " aligned" : ""}`}>
      {tracks.map((tr) => (
        <div className={`tl-row${aligned ? " al" : ""}`} key={tr.label}>
          {aligned ? (
            <span className="tl-flabel" style={{ paddingLeft: PL }}>
              {tr.label}
            </span>
          ) : (
            <span className="tl-label">{tr.label}</span>
          )}
          <div className="tl-track">
            <div className="tl-axis-line" style={lineInset} />
            {tr.events.map((e, i) => {
              const on = sel === e;
              return (
                <button
                  key={i}
                  className={`tl-marker${on ? " on" : ""}`}
                  style={{ left: leftOf(e.t), ["--c" as string]: e.color }}
                  title={`${e.title} · ${fmtTick(e.t, start, "clock")}`}
                  onClick={() => setSel(on ? null : e)}
                >
                  <span className="stem" />
                  <span className="dot" />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* shared time axis */}
      <div className={`tl-row tl-axis${aligned ? " al" : ""}`}>
        {!aligned && <span className="tl-label" />}
        <div className="tl-track">
          {ticks.map((tk, i) => (
            <span key={i} className="tl-tick" style={{ left: leftOf(tk) }}>
              {fmtTick(tk, start, mode)}
            </span>
          ))}
        </div>
      </div>

      {!hasEvents && (
        <div className="empty">Nessun evento in questo intervallo.</div>
      )}

      {/* selected event detail */}
      {sel && (
        <div className="tl-detail" style={{ borderLeftColor: sel.color }}>
          <div className="tl-detail-head">
            <span className="tl-detail-title" style={{ color: sel.color }}>
              {sel.title}
            </span>
            <span className="tl-detail-time">
              {new Date(sel.t).toLocaleTimeString("it-IT")}
            </span>
          </div>
          {sel.detail && <div className="tl-detail-msg">{sel.detail}</div>}
          {sel.audio && (
            <audio controls preload="none" src={sel.audio} style={{ width: "100%" }} />
          )}
        </div>
      )}
    </div>
  );
}
