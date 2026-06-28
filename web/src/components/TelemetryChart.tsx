import { useEffect, useMemo, useRef, useState } from "react";
import type { CarData } from "../lib/openf1";
import { drsActive } from "../lib/openf1";

interface Sample {
  t: number;
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  rpm: number;
  drs: number;
}

export interface ChartSeries {
  data: CarData[];
  startMs: number;
  color: string;
  label: string;
}

interface Props {
  series: ChartSeries[];
  radio?: { t: number }[];
}

type ChannelKey = "speed" | "throttle" | "brake" | "gear";

interface Channel {
  key: ChannelKey;
  label: string;
  color: string;
  min: number;
  max: number;
  height: number;
  step?: boolean;
  fmt: (v: number) => string;
  ticks: number[];
}

const PAD_L = 46;
const PAD_R = 16;
const PAD_T = 8;
const PAD_B = 24;
const GAP = 14;

function toSamples(data: CarData[], startMs: number): Sample[] {
  const s = data
    .map((d) => ({
      t: (new Date(d.date).getTime() - startMs) / 1000,
      speed: d.speed,
      throttle: d.throttle,
      brake: d.brake,
      gear: d.n_gear,
      rpm: d.rpm,
      drs: d.drs,
    }))
    .filter((d) => d.speed > 0)
    .sort((a, b) => a.t - b.t);
  const t0 = s.length ? s[0].t : 0;
  return s.map((d) => ({ ...d, t: d.t - t0 }));
}

export default function TelemetryChart({ series, radio = [] }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hoverX, setHoverX] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width)
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const compare = series.length > 1;

  const ser = useMemo(
    () => series.map((s) => ({ ...s, samples: toSamples(s.data, s.startMs) })),
    [series]
  );

  const maxT = useMemo(
    () =>
      Math.max(
        1,
        ...ser.map((s) => (s.samples.length ? s.samples[s.samples.length - 1].t : 0))
      ),
    [ser]
  );
  const maxSpeed = useMemo(
    () => Math.max(120, ...ser.flatMap((s) => s.samples.map((x) => x.speed))),
    [ser]
  );

  const channels: Channel[] = useMemo(() => {
    const speedTop = Math.ceil((maxSpeed * 1.05) / 50) * 50;
    return [
      { key: "speed", label: "Velocità", color: "var(--speed)", min: 0, max: speedTop, height: 200, fmt: (v) => `${Math.round(v)}`, ticks: [0, speedTop / 2, speedTop] },
      { key: "throttle", label: "Throttle", color: "var(--throttle)", min: 0, max: 100, height: 84, fmt: (v) => `${Math.round(v)}`, ticks: [0, 100] },
      { key: "brake", label: "Freno", color: "var(--brake)", min: 0, max: 100, height: 64, step: true, fmt: (v) => `${Math.round(v)}`, ticks: [0, 100] },
      { key: "gear", label: "Marcia", color: "var(--gear)", min: 0, max: 8, height: 92, step: true, fmt: (v) => `${Math.round(v)}`, ticks: [1, 4, 8] },
    ];
  }, [maxSpeed]);

  const plotW = Math.max(1, width - PAD_L - PAD_R);
  const xOf = (t: number) => PAD_L + (t / maxT) * plotW;

  const offsets: number[] = [];
  let acc = PAD_T;
  for (const ch of channels) {
    offsets.push(acc);
    acc += ch.height + GAP;
  }
  const totalH = acc - GAP + PAD_B;

  const yOf = (ch: Channel, top: number, v: number) => {
    const f = (v - ch.min) / (ch.max - ch.min);
    return top + (1 - Math.max(0, Math.min(1, f))) * ch.height;
  };

  function buildPath(samples: Sample[], ch: Channel, top: number, area: boolean) {
    if (!samples.length) return "";
    let d = "";
    samples.forEach((s, i) => {
      const x = xOf(s.t);
      const y = yOf(ch, top, s[ch.key]);
      if (i === 0) d += `M ${x} ${y}`;
      else if (ch.step) {
        const px = xOf(samples[i - 1].t);
        d += ` L ${px} ${y} L ${x} ${y}`;
      } else d += ` L ${x} ${y}`;
    });
    if (area) {
      const lastX = xOf(samples[samples.length - 1].t);
      const baseY = top + ch.height;
      d += ` L ${lastX} ${baseY} L ${PAD_L} ${baseY} Z`;
    }
    return d;
  }

  // DRS bands from the first series only (primary driver)
  const drsBands = useMemo(() => {
    const samples = ser[0]?.samples ?? [];
    const bands: { x0: number; x1: number }[] = [];
    let open: number | null = null;
    samples.forEach((s, i) => {
      const on = drsActive(s.drs);
      if (on && open === null) open = s.t;
      if ((!on || i === samples.length - 1) && open !== null) {
        bands.push({ x0: xOf(open), x1: xOf(s.t) });
        open = null;
      }
    });
    return bands;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ser, width, maxT]);

  function nearest(samples: Sample[], t: number): Sample | null {
    if (!samples.length) return null;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < samples.length; i++) {
      const d = Math.abs(samples[i].t - t);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return samples[best];
  }

  const hoverT = hoverX !== null ? ((hoverX - PAD_L) / plotW) * maxT : null;
  const hoverPts =
    hoverT === null ? null : ser.map((s) => nearest(s.samples, hoverT));
  const hoverPx = hoverT !== null ? xOf(hoverT) : null;

  function lineColor(ch: Channel, idx: number) {
    return compare ? ser[idx].color : ch.color;
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < PAD_L || x > width - PAD_R) setHoverX(null);
    else setHoverX(x);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <svg
        className="chart-svg"
        width={width}
        height={totalH}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverX(null)}
      >
        {channels.map((ch, ci) => {
          const top = offsets[ci];
          return (
            <g key={ch.key}>
              {ch.ticks.map((tv) => {
                const y = yOf(ch, top, tv);
                return (
                  <g key={tv}>
                    <line x1={PAD_L} x2={width - PAD_R} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                    <text x={PAD_L - 8} y={y + 3} fontSize={10} textAnchor="end">{ch.fmt(tv)}</text>
                  </g>
                );
              })}

              {ch.key === "speed" &&
                drsBands.map((b, i) => (
                  <rect key={i} x={b.x0} y={top} width={Math.max(0, b.x1 - b.x0)} height={ch.height} fill="var(--drs)" opacity={0.1} />
                ))}

              {/* one area fill for the primary series only (single-driver mode) */}
              {!compare &&
                ser.map((s, si) => (
                  <path key={`a${si}`} d={buildPath(s.samples, ch, top, true)} fill={ch.color} opacity={0.1} />
                ))}

              {/* lines per series */}
              {ser.map((s, si) => (
                <path
                  key={`l${si}`}
                  d={buildPath(s.samples, ch, top, false)}
                  fill="none"
                  stroke={lineColor(ch, si)}
                  strokeWidth={ch.key === "speed" ? 2 : 1.6}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={compare ? 0.92 : 1}
                />
              ))}

              <text x={PAD_L} y={top - 1} fontSize={10} fill={ch.color}>
                {ch.label.toUpperCase()}
              </text>

              {hoverPts &&
                hoverPx !== null &&
                hoverPts.map((p, si) =>
                  p ? (
                    <circle key={si} cx={hoverPx} cy={yOf(ch, top, p[ch.key])} r={3} fill={lineColor(ch, si)} stroke="#08080b" strokeWidth={1.5} />
                  ) : null
                )}
            </g>
          );
        })}

        {radio.map((r, i) => (
          <line key={i} x1={xOf(r.t)} x2={xOf(r.t)} y1={PAD_T} y2={totalH - PAD_B} stroke="var(--radio)" strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />
        ))}

        {Array.from({ length: 6 }, (_, i) => {
          const t = (maxT / 5) * i;
          return (
            <text key={i} x={xOf(t)} y={totalH - 7} fontSize={10} textAnchor="middle">{t.toFixed(1)}s</text>
          );
        })}

        {hoverPx !== null && (
          <line className="crosshair" x1={hoverPx} x2={hoverPx} y1={PAD_T} y2={totalH - PAD_B} />
        )}
      </svg>

      {hoverPts && hoverPx !== null && hoverT !== null && (
        <div
          className="tooltip"
          style={{ left: Math.min(width - 160, Math.max(0, hoverPx + 12)), top: 10 }}
        >
          <span className="tt-time">t = {hoverT.toFixed(2)} s</span>
          {hoverPts.map((p, si) =>
            p ? (
              <div className="tt-series" key={si}>
                <span className="tt-name" style={{ color: lineColor(channels[0], si) }}>
                  {ser[si].label}
                </span>
                <span className="tt-stats">
                  {Math.round(p.speed)}km/h · {Math.round(p.throttle)}% ·{" "}
                  {p.brake > 0 ? "Brk" : "—"} · M{p.gear}
                  {drsActive(p.drs) ? " · DRS" : ""}
                </span>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
