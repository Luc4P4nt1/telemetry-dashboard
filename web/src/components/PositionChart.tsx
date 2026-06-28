import { useEffect, useMemo, useRef, useState } from "react";
import type { Driver, Position, SessionResult } from "../lib/openf1";

interface Props {
  positions: Position[];
  drivers: Driver[];
  results: SessionResult[];
  highlight?: number[]; // driver numbers to emphasise
}

const PADL = 52;
const PADR = 62;
const PADT = 14;
const PADB = 26;
const ROWH = 26;
const TOP_N = 10;

export default function PositionChart({
  positions,
  drivers,
  results,
  highlight = [],
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setWidth(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const byNum = useMemo(
    () => new Map(drivers.map((d) => [d.driver_number, d])),
    [drivers]
  );

  // per-driver position series, sorted by time
  const series = useMemo(() => {
    const map = new Map<number, { t: number; pos: number }[]>();
    for (const p of positions) {
      if (p.position == null) continue;
      const t = new Date(p.date).getTime();
      const arr = map.get(p.driver_number) ?? [];
      arr.push({ t, pos: p.position });
      map.set(p.driver_number, arr);
    }
    map.forEach((arr) => arr.sort((a, b) => a.t - b.t));
    return map;
  }, [positions]);

  // which drivers to draw: top-N by final classification (or final position)
  const order = useMemo(() => {
    const fromResults = results
      .filter((r) => r.position != null)
      .sort((a, b) => (a.position! - b.position!))
      .map((r) => r.driver_number);
    if (fromResults.length) return fromResults.slice(0, TOP_N);
    // fall back to last known position
    return [...series.entries()]
      .map(([n, arr]) => ({ n, last: arr[arr.length - 1]?.pos ?? 99 }))
      .sort((a, b) => a.last - b.last)
      .slice(0, TOP_N)
      .map((x) => x.n);
  }, [results, series]);

  const drawn = order.filter((n) => series.has(n));

  const { tMin, tMax, maxPos } = useMemo(() => {
    let tMin = Infinity, tMax = -Infinity, maxPos = TOP_N;
    for (const n of drawn) {
      for (const p of series.get(n)!) {
        if (p.t < tMin) tMin = p.t;
        if (p.t > tMax) tMax = p.t;
        if (p.pos > maxPos) maxPos = p.pos;
      }
    }
    return { tMin, tMax, maxPos: Math.min(maxPos, 20) };
  }, [drawn, series]);

  if (!drawn.length)
    return <div className="empty">Posizioni non disponibili per questa sessione.</div>;

  const H = PADT + PADB + (maxPos - 1) * ROWH;
  const plotW = Math.max(1, width - PADL - PADR);
  const tSpan = Math.max(1, tMax - tMin);
  const x = (t: number) => PADL + ((t - tMin) / tSpan) * plotW;
  const y = (pos: number) => PADT + (Math.min(pos, maxPos) - 1) * ROWH;

  function pathFor(pts: { t: number; pos: number }[]) {
    if (!pts.length) return "";
    let d = `M ${x(pts[0].t).toFixed(1)} ${y(pts[0].pos).toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${x(pts[i].t).toFixed(1)} ${y(pts[i - 1].pos).toFixed(1)}`;
      d += ` L ${x(pts[i].t).toFixed(1)} ${y(pts[i].pos).toFixed(1)}`;
    }
    d += ` L ${x(tMax).toFixed(1)} ${y(pts[pts.length - 1].pos).toFixed(1)}`;
    return d;
  }

  const timeTicks = Array.from({ length: 6 }, (_, i) => tMin + (tSpan / 5) * i);

  return (
    <div ref={wrapRef} className="poschart">
      <svg width={width} height={H} className="pc-svg">
        {/* position gridlines */}
        {Array.from({ length: maxPos }, (_, i) => i + 1).map((pos) => (
          <g key={pos}>
            <line x1={PADL} x2={width - PADR} y1={y(pos)} y2={y(pos)} stroke="rgba(255,255,255,0.05)" />
            <text x={PADL - 12} y={y(pos) + 4} fontSize={11} textAnchor="end" fill="var(--text-faint)">
              {pos}
            </text>
          </g>
        ))}

        {/* driver lines */}
        {drawn.map((n) => {
          const d = byNum.get(n);
          const pts = series.get(n)!;
          const col = `#${d?.team_colour ?? "888"}`;
          const hi = highlight.includes(n);
          const dimmed = highlight.length > 0 && !hi;
          return (
            <g key={n} opacity={dimmed ? 0.32 : 1}>
              <path
                d={pathFor(pts)}
                fill="none"
                stroke={col}
                strokeWidth={hi ? 3.5 : 2.2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* end dot + label */}
              <circle cx={x(tMax)} cy={y(pts[pts.length - 1].pos)} r={hi ? 4.5 : 3.5} fill={col} />
              <text
                x={x(tMax) + 8}
                y={y(pts[pts.length - 1].pos) + 4}
                fontSize={12}
                fontWeight={700}
                fill={col}
              >
                {d?.name_acronym ?? n}
              </text>
            </g>
          );
        })}

        {/* time axis */}
        {timeTicks.map((tk, i) => (
          <text key={i} x={x(tk)} y={H - 6} fontSize={10} textAnchor="middle" fill="var(--text-faint)">
            {new Date(tk).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
          </text>
        ))}
      </svg>
    </div>
  );
}
