import { useEffect, useMemo, useState } from "react";
import Select from "./components/Select";
import MetricCard from "./components/MetricCard";
import TelemetryChart, { type ChartSeries } from "./components/TelemetryChart";
import Classification from "./components/Classification";
import Standings from "./components/Standings";
import PositionChart from "./components/PositionChart";
import Tyre from "./components/Tyre";
import DriverList from "./components/DriverList";
import LapSlider from "./components/LapSlider";
import SectorTimes from "./components/SectorTimes";
import TrackMap, { type TrackDriver } from "./components/TrackMap";
import LiveTiming from "./components/LiveTiming";
import Timeline, { type TLTrack, type TLEvent } from "./components/Timeline";
import { flagColor } from "./lib/flags";
import {
  getMeetings,
  getSessions,
  getDrivers,
  getLaps,
  getCarData,
  getSessionRadio,
  getRaceControl,
  getSessionResult,
  getPositions,
  getStints,
  getLocation,
  isLiveLock,
  getLatestSession,
  getLiveDrivers,
  getLivePositions,
  getLiveIntervals,
  getLiveLaps,
  getLiveStints,
  tyreOnLap,
  type Meeting,
  type Session,
  type Driver,
  type Lap,
  type CarData,
  type TeamRadio,
  type RaceControlMsg,
  type SessionResult,
  type Position,
  type Stint,
  type Location,
  type Interval,
} from "./lib/openf1";

// distinct colours for the two selected drivers (primary / comparison)
const CMP = ["#ff1801", "#34d399"];

// OpenF1 data starts in 2023; include every season up to the current year
const YEARS = Array.from(
  { length: new Date().getFullYear() - 2023 + 1 },
  (_, i) => new Date().getFullYear() - i
);
type Page = "driver" | "track" | "session" | "live";

function fmtLap(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3).padStart(6, "0");
  return m > 0 ? `${m}:${sec}` : sec;
}

export default function App() {
  const [page, setPage] = useState<Page>("driver");

  const [year, setYear] = useState(new Date().getFullYear());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingKey, setMeetingKey] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionKey, setSessionKey] = useState<number | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverNum, setDriverNum] = useState<number | null>(null);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [lapNum, setLapNum] = useState<number | null>(null);

  // second driver (comparison)
  const [driverNum2, setDriverNum2] = useState<number | null>(null);
  const [laps2, setLaps2] = useState<Lap[]>([]);
  const [lapNum2, setLapNum2] = useState<number | null>(null);
  const [car2, setCar2] = useState<CarData[]>([]);

  const [stints, setStints] = useState<Stint[]>([]);
  const [loc1, setLoc1] = useState<Location[]>([]);
  const [loc2, setLoc2] = useState<Location[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [car, setCar] = useState<CarData[]>([]);

  // live timing
  const [liveSession, setLiveSession] = useState<Session | null>(null);
  const [liveDrivers, setLiveDrivers] = useState<Driver[]>([]);
  const [livePositions, setLivePositions] = useState<Position[]>([]);
  const [liveIntervals, setLiveIntervals] = useState<Interval[]>([]);
  const [liveLaps, setLiveLaps] = useState<Lap[]>([]);
  const [liveStints, setLiveStints] = useState<Stint[]>([]);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(0);
  const [liveLoading, setLiveLoading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [radio, setRadio] = useState<TeamRadio[]>([]);
  const [raceControl, setRaceControl] = useState<RaceControlMsg[]>([]);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── cascade ────────────────────────────────────────────────
  useEffect(() => {
    getMeetings(year)
      .then((m) => {
        setMeetings(m);
        // default to the most recent GP that has already started
        // (skip future rounds still on the calendar)
        const now = Date.now();
        const past = m.filter((x) => new Date(x.date_start).getTime() <= now);
        const pool = past.length ? past : m;
        const def = pool[pool.length - 1];
        setMeetingKey(def ? def.meeting_key : null);
        setLoadError(null);
      })
      .catch((e) =>
        setLoadError(
          isLiveLock(e)
            ? "live-lock"
            : "Impossibile caricare i dati. Controlla la connessione e riprova."
        )
      );
  }, [year, reloadKey]);

  useEffect(() => {
    if (!meetingKey) return;
    getSessions(meetingKey).then((s) => {
      setSessions(s);
      // default to the most recent session that has already started
      // (e.g. keep Qualifying if the Race hasn't run yet)
      const now = Date.now();
      const started = s.filter((x) => new Date(x.date_start).getTime() <= now);
      const pool = started.length ? started : s;
      const latest = [...pool].sort((a, b) =>
        b.date_start.localeCompare(a.date_start)
      )[0];
      setSessionKey(latest ? latest.session_key : null);
    });
  }, [meetingKey]);

  useEffect(() => {
    if (!sessionKey) return;
    getDrivers(sessionKey).then((d) => {
      setDrivers(d);
      // default to Leclerc when present, else the first driver
      const def = d.find((x) => x.name_acronym === "LEC") ?? d[0];
      setDriverNum(def ? def.driver_number : null);
    });
  }, [sessionKey]);

  // session-wide data: classifica, direzione gara, team radio, posizioni
  useEffect(() => {
    if (!sessionKey) {
      setResults([]);
      setRaceControl([]);
      setRadio([]);
      setPositions([]);
      setStints([]);
      return;
    }
    getSessionResult(sessionKey).then(setResults).catch(() => setResults([]));
    getRaceControl(sessionKey).then(setRaceControl).catch(() => setRaceControl([]));
    getSessionRadio(sessionKey).then(setRadio).catch(() => setRadio([]));
    getPositions(sessionKey).then(setPositions).catch(() => setPositions([]));
    getStints(sessionKey).then(setStints).catch(() => setStints([]));
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey || !driverNum) return;
    getLaps(sessionKey, driverNum).then((l) => {
      setLaps(l);
      const fastest = [...l].sort(
        (a, b) => (a.lap_duration ?? 1e9) - (b.lap_duration ?? 1e9)
      )[0];
      setLapNum(fastest ? fastest.lap_number : null);
    });
  }, [sessionKey, driverNum]);

  const lap = useMemo(
    () => laps.find((l) => l.lap_number === lapNum) ?? null,
    [laps, lapNum]
  );

  // ── live timing: poll the current session every 5s ─────────
  useEffect(() => {
    if (page !== "live") return;
    let active = true;
    setLiveLoading(true);
    async function load() {
      try {
        const sess = await getLatestSession();
        if (!active) return;
        setLiveSession(sess);
        const [drv, pos, iv, lp, st] = await Promise.all([
          getLiveDrivers(),
          getLivePositions(),
          getLiveIntervals(),
          getLiveLaps(),
          getLiveStints(),
        ]);
        if (!active) return;
        setLiveDrivers(drv);
        setLivePositions(pos);
        setLiveIntervals(iv);
        setLiveLaps(lp);
        setLiveStints(st);
        setLiveUpdatedAt(Date.now());
      } catch {
        /* ignore poll errors */
      } finally {
        if (active) setLiveLoading(false);
      }
    }
    load();
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [page]);

  // ── track map: x/y location for the whole session ──────────
  useEffect(() => {
    if (page !== "track" || !sessionKey || !driverNum) return;
    const sess = sessions.find((s) => s.session_key === sessionKey);
    if (!sess) return;
    setTrackLoading(true);
    setLoc1([]);
    setLoc2([]);
    Promise.all([
      getLocation(sessionKey, driverNum, sess.date_start, sess.date_end),
      driverNum2
        ? getLocation(sessionKey, driverNum2, sess.date_start, sess.date_end)
        : Promise.resolve([] as Location[]),
    ])
      .then(([a, b]) => {
        setLoc1(a);
        setLoc2(b);
      })
      .catch(() => {})
      .finally(() => setTrackLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sessionKey, driverNum, driverNum2]);

  // ── second driver (comparison) ─────────────────────────────
  useEffect(() => {
    setLaps2([]);
    setLapNum2(null);
    setCar2([]);
    if (!sessionKey || !driverNum2) return;
    getLaps(sessionKey, driverNum2).then((l) => {
      setLaps2(l);
      const fastest = [...l].sort(
        (a, b) => (a.lap_duration ?? 1e9) - (b.lap_duration ?? 1e9)
      )[0];
      setLapNum2(fastest ? fastest.lap_number : null);
    });
  }, [sessionKey, driverNum2]);

  const lap2 = useMemo(
    () => laps2.find((l) => l.lap_number === lapNum2) ?? null,
    [laps2, lapNum2]
  );

  useEffect(() => {
    if (!sessionKey || !driverNum2 || !lap2?.date_start || !lap2.lap_duration) {
      setCar2([]);
      return;
    }
    const start = new Date(lap2.date_start);
    const end = new Date(start.getTime() + (lap2.lap_duration + 2) * 1000);
    getCarData(sessionKey, driverNum2, start.toISOString(), end.toISOString())
      .then(setCar2)
      .catch(() => setCar2([]));
  }, [sessionKey, driverNum2, lap2]);

  // both selected drivers share the same lap number
  useEffect(() => {
    if (page !== "driver" || !driverNum2 || lapNum == null || !laps2.length)
      return;
    if (laps2.some((l) => l.lap_number === lapNum) && lapNum2 !== lapNum)
      setLapNum2(lapNum);
  }, [page, driverNum2, lapNum, lapNum2, laps2]);

  // ── telemetry ──────────────────────────────────────────────
  useEffect(() => {
    if (!sessionKey || !driverNum || !lap?.date_start || !lap.lap_duration) {
      setCar([]);
      return;
    }
    setLoading(true);
    setError(null);
    const start = new Date(lap.date_start);
    const end = new Date(start.getTime() + (lap.lap_duration + 2) * 1000);
    getCarData(sessionKey, driverNum, start.toISOString(), end.toISOString())
      .then((c) => {
        setCar(c);
        if (!c.length) setError("Nessun dato di telemetria per questo giro.");
      })
      .catch(() => setError("Errore nel caricamento della telemetria."))
      .finally(() => setLoading(false));
  }, [sessionKey, driverNum, lap]);

  const driver = drivers.find((d) => d.driver_number === driverNum);
  const driver2 = drivers.find((d) => d.driver_number === driverNum2) ?? null;
  const meeting = meetings.find((m) => m.meeting_key === meetingKey);
  const session = sessions.find((s) => s.session_key === sessionKey);
  const startMs = lap?.date_start ? new Date(lap.date_start).getTime() : 0;
  const startMs2 = lap2?.date_start ? new Date(lap2.date_start).getTime() : 0;

  const tyre1 = driverNum && lapNum ? tyreOnLap(stints, driverNum, lapNum) : null;
  const tyre2 =
    driverNum2 && lapNum2 ? tyreOnLap(stints, driverNum2, lapNum2) : null;

  const chartSeries: ChartSeries[] = [];
  if (car.length && driver)
    chartSeries.push({ data: car, startMs, color: CMP[0], label: driver.name_acronym });
  if (car2.length && driver2)
    chartSeries.push({ data: car2, startMs: startMs2, color: CMP[1], label: driver2.name_acronym });
  const comparing = chartSeries.length > 1;

  const toPts = (loc: Location[]) =>
    loc
      .filter((p) => p.x != null && p.y != null && (p.x !== 0 || p.y !== 0))
      .map((p) => ({ t: new Date(p.date).getTime(), x: p.x, y: p.y }))
      .sort((a, b) => a.t - b.t);

  const trackDrivers: TrackDriver[] = [];
  if (driver && loc1.length)
    trackDrivers.push({ driverNumber: driver.driver_number, acr: driver.name_acronym, color: CMP[0], points: toPts(loc1) });
  if (driver2 && loc2.length)
    trackDrivers.push({ driverNumber: driver2.driver_number, acr: driver2.name_acronym, color: CMP[1], points: toPts(loc2) });

  // window [start, end] of the selected lap (wall-clock)
  const lapWin = useMemo(() => {
    if (!lap?.date_start || !lap.lap_duration) return null;
    const lo = new Date(lap.date_start).getTime();
    return { lo, hi: lo + lap.lap_duration * 1000 };
  }, [lap]);

  // chart markers: selected driver's radio inside the lap window
  const radioMarks = useMemo(() => {
    if (!lapWin) return [];
    return radio
      .filter((r) => {
        const t = new Date(r.date).getTime();
        return r.driver_number === driverNum && t >= lapWin.lo && t <= lapWin.hi + 2000;
      })
      .map((r) => ({ t: (new Date(r.date).getTime() - startMs) / 1000 }));
  }, [radio, lapWin, driverNum, startMs]);

  // per-lap team radio (selected driver, within the lap window)
  const lapRadio = useMemo(() => {
    if (!lapWin) return [];
    return radio.filter((r) => {
      const t = new Date(r.date).getTime();
      return r.driver_number === driverNum && t >= lapWin.lo && t <= lapWin.hi;
    });
  }, [radio, lapWin, driverNum]);

  // per-lap race control (messages whose timestamp falls in the lap window)
  const lapRaceControl = useMemo(() => {
    if (!lapWin) return [];
    return raceControl.filter((m) => {
      const t = new Date(m.date).getTime();
      return t >= lapWin.lo && t <= lapWin.hi;
    });
  }, [raceControl, lapWin]);

  // standings as of the end of the selected lap (from position changes)
  const lapStandings = useMemo(() => {
    if (!lapWin || !positions.length) return [];
    const latest = new Map<number, { t: number; position: number }>();
    for (const p of positions) {
      const t = new Date(p.date).getTime();
      if (t > lapWin.hi) continue;
      const prev = latest.get(p.driver_number);
      if (!prev || t >= prev.t) latest.set(p.driver_number, { t, position: p.position });
    }
    return [...latest.entries()]
      .map(([driver_number, v]) => ({ driver_number, position: v.position }))
      .sort((a, b) => a.position - b.position);
  }, [positions, lapWin]);

  const topSpeed = car.length ? Math.max(...car.map((c) => c.speed)) : 0;

  // telemetry time span (matches the chart's x-domain) so the event
  // timeline lines up exactly under the telemetry plot
  const telSpan = useMemo(() => {
    const span = (data: CarData[]) => {
      const ts = data
        .filter((d) => d.speed > 0)
        .map((d) => new Date(d.date).getTime());
      return ts.length ? { first: Math.min(...ts), last: Math.max(...ts) } : null;
    };
    const a = span(car);
    const b = span(car2);
    if (!a && !b) return null;
    const first = a?.first ?? b!.first;
    const durs = [a && a.last - a.first, b && b.last - b.first].filter(
      (x): x is number => x != null
    );
    return { start: first, end: first + (durs.length ? Math.max(...durs) : 0) };
  }, [car, car2]);

  // ── timeline tracks ────────────────────────────────────────
  const driversByNum = useMemo(
    () => new Map(drivers.map((d) => [d.driver_number, d])),
    [drivers]
  );

  const rcEvents = (msgs: RaceControlMsg[]): TLEvent[] =>
    msgs.map((m) => {
      const drv = m.driver_number ? driversByNum.get(m.driver_number) : null;
      return {
        t: new Date(m.date).getTime(),
        color: flagColor(m.flag, m.category),
        title: m.flag ?? m.category,
        detail: (drv ? `${drv.name_acronym} — ` : "") + m.message,
      };
    });

  const radioEvents = (items: TeamRadio[]): TLEvent[] =>
    items.map((r) => {
      const drv = driversByNum.get(r.driver_number);
      return {
        t: new Date(r.date).getTime(),
        color: `#${drv?.team_colour ?? "888"}`,
        title: drv?.name_acronym ?? `#${r.driver_number}`,
        detail: drv?.team_name ?? "",
        audio: r.recording_url,
      };
    });

  const lapTracks: TLTrack[] = [
    { label: "Direzione Gara", events: rcEvents(lapRaceControl) },
    { label: "Team Radio", events: radioEvents(lapRadio) },
  ];
  const sessionTracks: TLTrack[] = [
    { label: "Direzione Gara", events: rcEvents(raceControl) },
    { label: "Team Radio", events: radioEvents(radio) },
  ];
  const sessRange = session
    ? {
        start: new Date(session.date_start).getTime(),
        end: new Date(session.date_end).getTime(),
      }
    : null;

  // global driver selection (max 2): slot 0 = primary, slot 1 = comparison
  const selected = [driverNum, driverNum2].filter(
    (x): x is number => x != null
  );

  function toggleDriver(n: number) {
    if (driverNum === n) {
      setDriverNum(driverNum2 ?? null);
      setDriverNum2(null);
    } else if (driverNum2 === n) {
      setDriverNum2(null);
    } else if (driverNum == null) {
      setDriverNum(n);
    } else if (driverNum2 == null) {
      setDriverNum2(n);
    } else {
      setDriverNum2(n);
    }
  }

  return (
    <div className="shell">
      {/* ── global sidebar: session filters + driver selection ── */}
      <aside className="sidebar">
        <div className="brand">
          <span className="badge">F1</span>
          <div>
            <div className="title">Telemetria</div>
            <div className="sub">
              {meeting?.country_name ?? "—"}
              {session && ` · ${session.session_name}`}
            </div>
          </div>
        </div>

        <div className="glass side-panel">
          <div className="side-head"><i />SESSIONE</div>
          <Select
            label="Gran Premio"
            value={meetingKey ?? ""}
            options={meetings.map((m) => ({
              value: m.meeting_key,
              label: `${m.country_name} — ${m.circuit_short_name}`,
            }))}
            onChange={(v) => setMeetingKey(Number(v))}
          />
          <div className="side-grid">
            <Select
              label="Anno"
              value={year}
              options={YEARS.map((y) => ({ value: y, label: String(y) }))}
              onChange={(v) => setYear(Number(v))}
            />
            <Select
              label="Sessione"
              value={sessionKey ?? ""}
              options={sessions.map((s) => ({
                value: s.session_key,
                label: s.session_name,
              }))}
              onChange={(v) => setSessionKey(Number(v))}
            />
          </div>
        </div>

        <div className="glass side-panel dl-panel">
          <DriverList
            drivers={drivers}
            results={results}
            selected={selected}
            colors={CMP}
            onToggle={toggleDriver}
          />
        </div>
      </aside>

      {/* ── main column ── */}
      <main className="main">
        <div className="topbar">
          <nav className="pagenav">
            <button className={page === "driver" ? "on" : ""} onClick={() => setPage("driver")}>Analisi</button>
            <button className={page === "track" ? "on" : ""} onClick={() => setPage("track")}>Circuito</button>
            <button className={page === "session" ? "on" : ""} onClick={() => setPage("session")}>Sessione</button>
            <button className={`live-tab${page === "live" ? " on" : ""}`} onClick={() => setPage("live")}>
              <span className="live-dot" />Live
            </button>
          </nav>
        </div>

        {loadError && (
          <div className="glass banner">
            <div className="banner-body">
              <b>{loadError === "live-lock" ? "Sessione F1 in diretta" : "Errore di caricamento"}</b>
              <span>
                {loadError === "live-lock"
                  ? "OpenF1 blocca temporaneamente l'accesso ai dati (anche storici) mentre è in corso una sessione F1 dal vivo. I dati torneranno disponibili al termine della sessione."
                  : loadError}
              </span>
            </div>
            <button className="tm-btn" onClick={() => setReloadKey((k) => k + 1)}>
              ↻ Riprova
            </button>
          </div>
        )}

        {page === "driver"
          ? DriverView()
          : page === "track"
          ? TrackView()
          : page === "live"
          ? LiveView()
          : SessionView()}
      </main>
    </div>
  );

  // ── Live timing page ───────────────────────────────────────
  function LiveView() {
    const now = Date.now();
    const isLive =
      !!liveSession &&
      now >= new Date(liveSession.date_start).getTime() &&
      now <= new Date(liveSession.date_end).getTime();
    return (
      <>
        <section className="glass panel live-head">
          <div className="live-title">
            <span className={`live-badge${isLive ? " on" : ""}`}>
              <span className="live-dot" />
              {isLive ? "IN DIRETTA" : "NON IN DIRETTA"}
            </span>
            {liveSession
              ? `${liveSession.country_name ?? ""} · ${liveSession.session_name}`
              : "—"}
          </div>
          <div className="live-sub">
            {liveSession &&
              (isLive
                ? "Sessione in corso"
                : `Ultima sessione · ${new Date(
                    liveSession.date_start
                  ).toLocaleString("it-IT")}`)}
            {liveUpdatedAt
              ? ` · aggiornato ${new Date(liveUpdatedAt).toLocaleTimeString("it-IT")}`
              : ""}
          </div>
        </section>

        {liveLoading && !liveDrivers.length ? (
          <div className="glass panel">
            <div className="center-state">
              <div className="spinner" />
              Caricamento dati live…
            </div>
          </div>
        ) : (
          <section className="glass panel">
            <h2>Classifica Live</h2>
            <LiveTiming
              drivers={liveDrivers}
              positions={livePositions}
              intervals={liveIntervals}
              laps={liveLaps}
              stints={liveStints}
            />
          </section>
        )}

        {!isLive && (
          <div className="empty" style={{ paddingLeft: 4 }}>
            Nessuna gara in diretta in questo momento — mostro l'ultima sessione
            disponibile.
          </div>
        )}
      </>
    );
  }

  // ── Circuito (track map) page ──────────────────────────────
  function TrackView() {
    if (trackLoading)
      return (
        <div className="glass panel">
          <div className="center-state">
            <div className="spinner" />
            Caricamento posizioni… (può richiedere qualche secondo)
          </div>
        </div>
      );
    if (!trackDrivers.length)
      return (
        <div className="glass panel">
          <div className="center-state">
            Seleziona uno o due piloti per vedere il circuito.
          </div>
        </div>
      );
    return <TrackMap drivers={trackDrivers} laps={laps} />;
  }

  // ── Driver page (analisi + confronto) ─────────────────────
  function DriverView() {
    if (!driver)
      return (
        <div className="glass panel">
          <div className="center-state">
            Seleziona un pilota dalla barra laterale.
          </div>
        </div>
      );
    return (
      <>
        <div className="glass driver-bar">
          <div className="db-row">
            {driverNum2 && (
              <span className="db-key" style={{ background: CMP[0] }} />
            )}
            <span className="dot" style={{ background: `#${driver.team_colour ?? "888"}` }} />
            <b>#{driver.driver_number} {driver.name_acronym}</b>
            <span className="muted">{driver.team_name}</span>
            {tyre1 && <Tyre compound={tyre1.compound} age={tyre1.age} />}
          </div>
          {driverNum2 && driver2 && (
            <div className="db-row">
              <span className="db-key" style={{ background: CMP[1] }} />
              <span className="dot" style={{ background: `#${driver2.team_colour ?? "888"}` }} />
              <b>#{driver2.driver_number} {driver2.name_acronym}</b>
              <span className="muted">{driver2.team_name}</span>
              {tyre2 && <Tyre compound={tyre2.compound} age={tyre2.age} />}
            </div>
          )}
        </div>

        <section className="glass panel lap-card">
          <h2>Analisi Giro</h2>
          <LapSlider
            laps={laps}
            value={lapNum}
            onChange={(n) => {
              setLapNum(n);
              if (driverNum2) setLapNum2(n);
            }}
          />
        </section>

        {driverNum2 && (
          <section className="glass panel">
            <h2>Tempi di Settore</h2>
            <SectorTimes
              rows={[
                { name: driver.full_name, acr: driver.name_acronym, color: CMP[0], lap },
                ...(driver2
                  ? [{ name: driver2.full_name, acr: driver2.name_acronym, color: CMP[1], lap: lap2 }]
                  : []),
              ]}
            />
          </section>
        )}

        {lap && (
          <div className="metrics">
            <MetricCard label="Tempo Giro" value={fmtLap(lap.lap_duration)} color="var(--f1)" />
            <MetricCard label="Settore 1" value={lap.duration_sector_1?.toFixed(3) ?? "—"} unit="s" />
            <MetricCard label="Settore 2" value={lap.duration_sector_2?.toFixed(3) ?? "—"} unit="s" />
            <MetricCard label="Settore 3" value={lap.duration_sector_3?.toFixed(3) ?? "—"} unit="s" />
            <MetricCard label="Top Speed" value={topSpeed ? String(Math.round(topSpeed)) : "—"} unit="km/h" color="var(--speed)" />
            <MetricCard label="Speed Trap" value={lap.st_speed ? String(lap.st_speed) : "—"} unit="km/h" />
          </div>
        )}

        <div className="glass chart-card">
          <div className="chart-head">
            <h2>{comparing ? "Confronto telemetria" : `Telemetria · Giro ${lapNum ?? "—"}`}</h2>
            <div className="legend">
              {comparing ? (
                <>
                  <span><i style={{ background: CMP[0] }} />{driver?.name_acronym} · G{lapNum}</span>
                  <span><i style={{ background: CMP[1] }} />{driver2?.name_acronym} · G{lapNum2}</span>
                </>
              ) : (
                <>
                  <span><i style={{ background: "var(--speed)" }} />Velocità</span>
                  <span><i style={{ background: "var(--throttle)" }} />Throttle</span>
                  <span><i style={{ background: "var(--brake)" }} />Freno</span>
                  <span><i style={{ background: "var(--gear)" }} />Marcia</span>
                  <span><i style={{ background: "var(--drs)" }} />DRS</span>
                  <span><i style={{ background: "var(--radio)" }} />Radio</span>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="center-state"><div className="spinner" />Caricamento telemetria…</div>
          ) : error ? (
            <div className="center-state error-state">{error}</div>
          ) : chartSeries.length ? (
            <TelemetryChart series={chartSeries} radio={radioMarks} />
          ) : (
            <div className="center-state">Seleziona un giro.</div>
          )}
        </div>

        {/* per-lap event timeline — aligned to the telemetry chart axis */}
        {(telSpan || lapWin) && (
          <section className="glass panel">
            <h2>Eventi · Giro {lapNum ?? "—"}</h2>
            <Timeline
              start={telSpan?.start ?? lapWin!.lo}
              end={telSpan?.end ?? lapWin!.hi}
              tracks={lapTracks}
              mode="seconds"
              padLeft={46}
              padRight={16}
            />
          </section>
        )}

        {/* live standings at the selected lap */}
        <section className="glass panel">
          <h2>Classifica · al Giro {lapNum ?? "—"}</h2>
          <div className="panel-scroll">
            <Standings rows={lapStandings} drivers={drivers} highlight={driverNum} />
          </div>
        </section>
      </>
    );
  }

  // ── Session (general) page ─────────────────────────────────
  function SessionView() {
    return (
      <>
        {sessRange && (
          <section className="glass panel">
            <h2>
              Timeline Sessione · {raceControl.length} eventi gara ·{" "}
              {radio.length} radio
            </h2>
            <Timeline
              start={sessRange.start}
              end={sessRange.end}
              tracks={sessionTracks}
              mode="clock"
            />
          </section>
        )}

        <section className="glass panel">
          <h2>Classifica · {session?.session_name ?? ""}</h2>
          <div className="panel-scroll">
            <Classification results={results} drivers={drivers} sessionName={session?.session_name} />
          </div>
        </section>

        {positions.length > 0 && (
          <section className="glass panel">
            <h2>Posizioni in gara · Top 10</h2>
            <PositionChart
              positions={positions}
              drivers={drivers}
              results={results}
              highlight={selected}
            />
          </section>
        )}
      </>
    );
  }
}
