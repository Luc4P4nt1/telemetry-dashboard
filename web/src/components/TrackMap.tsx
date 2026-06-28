import { useEffect, useMemo, useRef, useState } from "react";
import type { Lap } from "../lib/openf1";

export interface TrackDriver {
  driverNumber: number;
  acr: string;
  color: string;
  points: { t: number; x: number; y: number }[]; // sorted by t
}

interface Props {
  drivers: TrackDriver[];
  laps: Lap[]; // primary driver racing laps (for the lap counter)
}

const VW = 1000;
const VH = 680;
const PAD = 60;
const TRAIL = 26; // trail length in frames
const STEP_MS = 250; // nominal time between frames (≈4 Hz)
const SPEEDS = [1, 2, 4, 8];

// align another driver's samples to the base frame times (linear interp)
function alignTo(
  base: number[],
  pts: { t: number; x: number; y: number }[]
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = new Array(base.length);
  if (!pts.length) return out.fill({ x: NaN, y: NaN });
  let j = 0;
  for (let i = 0; i < base.length; i++) {
    const t = base[i];
    while (j < pts.length - 1 && pts[j + 1].t < t) j++;
    const a = pts[j];
    const b = pts[Math.min(j + 1, pts.length - 1)];
    if (t <= a.t || b.t === a.t) out[i] = { x: a.x, y: a.y };
    else if (t >= b.t) out[i] = { x: b.x, y: b.y };
    else {
      const f = (t - a.t) / (b.t - a.t);
      out[i] = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
  }
  return out;
}

function fmtClock(ms: number) {
  return new Date(ms).toLocaleTimeString("it-IT");
}
function fmtElapsed(ms: number) {
  const s = Math.max(0, ms / 1000);
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3).padStart(6, "0");
  return `+${m}:${sec}`;
}

export default function TrackMap({ drivers, laps }: Props) {
  const primary = drivers[0];

  // frame timeline = primary driver's samples
  const base = useMemo(
    () => (primary ? primary.points.map((p) => p.t) : []),
    [primary]
  );
  const N = base.length;

  // world → screen transform (fit primary path, invert Y)
  const proj = useMemo(() => {
    const pts = primary?.points ?? [];
    if (!pts.length) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const sx = (VW - 2 * PAD) / (maxX - minX || 1);
    const sy = (VH - 2 * PAD) / (maxY - minY || 1);
    const s = Math.min(sx, sy);
    const ox = PAD + (VW - 2 * PAD - (maxX - minX) * s) / 2;
    const oy = PAD + (VH - 2 * PAD - (maxY - minY) * s) / 2;
    return {
      x: (x: number) => ox + (x - minX) * s,
      // invert Y so the map isn't upside-down
      y: (y: number) => VH - (oy + (y - minY) * s),
    };
  }, [primary]);

  // screen-space positions per driver, aligned to base frames
  const screen = useMemo(() => {
    if (!proj || !primary) return [];
    return drivers.map((d, di) => {
      const aligned =
        di === 0 ? primary.points.map((p) => ({ x: p.x, y: p.y })) : alignTo(base, d.points);
      const sx = new Float32Array(N);
      const sy = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        sx[i] = proj.x(aligned[i]?.x ?? NaN);
        sy[i] = proj.y(aligned[i]?.y ?? NaN);
      }
      return { sx, sy };
    });
  }, [drivers, base, proj, primary, N]);

  // static track outline path
  const trackPath = useMemo(() => {
    if (!proj || !primary) return "";
    let d = "";
    primary.points.forEach((p, i) => {
      d += `${i ? "L" : "M"} ${proj.x(p.x).toFixed(1)} ${proj.y(p.y).toFixed(1)} `;
    });
    return d;
  }, [proj, primary]);

  // ── playback ──────────────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  const [speed, setSpeed] = useState(2);
  const idxRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(2);
  const markerRefs = useRef<(SVGGElement | null)[]>([]);
  const trailRefs = useRef<(SVGPolylineElement | null)[]>([]);

  useEffect(() => void (playingRef.current = playing), [playing]);
  useEffect(() => void (speedRef.current = speed), [speed]);

  function paint(idx: number) {
    const i = Math.max(0, Math.min(N - 1, Math.round(idx)));
    screen.forEach((s, di) => {
      const g = markerRefs.current[di];
      if (g && !Number.isNaN(s.sx[i])) g.setAttribute("transform", `translate(${s.sx[i]} ${s.sy[i]})`);
      const tl = trailRefs.current[di];
      if (tl) {
        let pts = "";
        for (let k = Math.max(0, i - TRAIL); k <= i; k++)
          if (!Number.isNaN(s.sx[k])) pts += `${s.sx[k].toFixed(1)},${s.sy[k].toFixed(1)} `;
        tl.setAttribute("points", pts);
      }
    });
  }

  // animation loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (playingRef.current && N > 1) {
        idxRef.current += (dt / STEP_MS) * speedRef.current;
        if (idxRef.current >= N - 1) {
          idxRef.current = N - 1;
          playingRef.current = false;
          setPlaying(false);
        }
      }
      paint(idxRef.current);
      setFrame(Math.round(idxRef.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, N]);

  function scrub(v: number) {
    idxRef.current = v;
    setFrame(v);
    paint(v);
  }
  function restart() {
    scrub(0);
    setPlaying(true);
  }

  const curT = base[Math.min(frame, N - 1)] ?? 0;
  const t0 = base[0] ?? 0;
  const totalLaps = laps.length ? Math.max(...laps.map((l) => l.lap_number)) : 0;
  const curLap = useMemo(() => {
    for (const l of laps) {
      if (!l.date_start || !l.lap_duration) continue;
      const s = new Date(l.date_start).getTime();
      if (curT >= s && curT <= s + l.lap_duration * 1000) return l.lap_number;
    }
    return null;
  }, [laps, curT]);

  if (!primary || !N)
    return <div className="center-state">Nessun dato di posizione per questa selezione.</div>;

  return (
    <div className="trackmap">
      <div className="tm-stage glass">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="tm-svg">
          {/* track base */}
          <path d={trackPath} className="tm-road" />
          <path d={trackPath} className="tm-road-center" />

          {/* trails + markers */}
          {drivers.map((d, di) => (
            <polyline
              key={`tr${d.driverNumber}`}
              ref={(el) => (trailRefs.current[di] = el)}
              fill="none"
              stroke={d.color}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.55}
            />
          ))}
          {drivers.map((d, di) => (
            <g
              key={`mk${d.driverNumber}`}
              ref={(el) => (markerRefs.current[di] = el)}
            >
              <circle r={15} fill={d.color} opacity={0.25} />
              <circle r={11} fill={d.color} stroke="#08080b" strokeWidth={2} />
              <text textAnchor="middle" dy={4} fontSize={11} fontWeight={700} fill="#08080b">
                {d.driverNumber}
              </text>
            </g>
          ))}
        </svg>

        {/* HUD */}
        <div className="tm-hud">
          <div className="tm-lap">
            GIRO {curLap ?? "—"} <span>/ {totalLaps}</span>
          </div>
          <div className="tm-elapsed">{fmtElapsed(curT - t0)}</div>
          <div className="tm-clock">{fmtClock(curT)}</div>
        </div>

        <div className="tm-legend glass">
          {drivers.map((d) => (
            <div className="tm-leg" key={d.driverNumber}>
              <span className="bar" style={{ background: d.color }} />
              <b>#{d.driverNumber}</b> {d.acr}
            </div>
          ))}
        </div>
      </div>

      {/* controls */}
      <div className="tm-controls">
        <button className="tm-btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? "❚❚ Pausa" : "▶ Play"}
        </button>
        <button className="tm-btn" onClick={restart}>↺ Riavvia</button>
        <div className="tm-speed">
          <span>VELOCITÀ</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`tm-sp${s === speed ? " on" : ""}`}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className="tm-frame">
        <input
          type="range"
          min={0}
          max={N - 1}
          value={frame}
          onChange={(e) => {
            setPlaying(false);
            scrub(Number(e.target.value));
          }}
        />
        <span className="tm-frame-num">
          {frame} / {N - 1}
        </span>
      </div>
    </div>
  );
}
