// Thin typed client for the OpenF1 REST API (https://openf1.org).
// CORS is enabled (access-control-allow-origin: *) so we call it straight
// from the browser — no backend required.

const BASE = "https://api.openf1.org/v1";

const cache = new Map<string, unknown>();

// OpenF1 limits to 3 requests/second. Serialize requests with a small gap
// so cascading fetches never trip the rate limiter. Cached paths skip the queue.
const GAP_MS = 350;
let queue: Promise<unknown> = Promise.resolve();

function schedule<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue
    .catch(() => {})
    .then(() => new Promise((r) => setTimeout(r, GAP_MS)))
    .then(fn);
  queue = run.catch(() => {});
  return run;
}

// Throw an Error carrying OpenF1's own `detail` message when the request
// fails (e.g. the 401 "Live F1 session in progress" global lock).
async function readOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let detail = `OpenF1 ${res.status}`;
  try {
    const j = await res.json();
    if (j?.detail) detail = j.detail as string;
  } catch {
    /* ignore */
  }
  const err = new Error(detail) as Error & { status?: number };
  err.status = res.status;
  throw err;
}

async function fetchJSON<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T;
  return schedule(async () => {
    if (cache.has(path)) return cache.get(path) as T;
    const data = await readOrThrow<T>(await fetch(`${BASE}${path}`));
    cache.set(path, data);
    return data;
  });
}

// like fetchJSON but never cached — for live polling
function fetchLive<T>(path: string): Promise<T> {
  return schedule(async () => readOrThrow<T>(await fetch(`${BASE}${path}`)));
}

// is this the OpenF1 "live session in progress" global restriction?
export const isLiveLock = (e: unknown) =>
  e instanceof Error && /Live F1 session/i.test(e.message);

export interface Meeting {
  meeting_key: number;
  meeting_name: string;
  country_name: string;
  circuit_short_name: string;
  date_start: string;
}

export interface Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  country_name?: string;
}

export interface Driver {
  driver_number: number;
  full_name: string;
  last_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  headshot_url: string | null;
  country_code: string | null;
}

export interface Lap {
  driver_number?: number;
  lap_number: number;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  i1_speed: number | null;
  i2_speed: number | null;
  st_speed: number | null;
  date_start: string | null;
  is_pit_out_lap: boolean;
}

export interface CarData {
  date: string;
  speed: number;
  throttle: number;
  brake: number;
  n_gear: number;
  rpm: number;
  drs: number;
}

export interface TeamRadio {
  date: string;
  recording_url: string;
  driver_number: number;
}

export interface RaceControlMsg {
  date: string;
  lap_number: number | null;
  category: string;
  flag: string | null;
  scope: string | null;
  sector: number | null;
  message: string;
  driver_number: number | null;
}

export interface SessionResult {
  position: number | null;
  driver_number: number;
  number_of_laps: number;
  points: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  duration: number | number[] | null;
  gap_to_leader: number | string | null;
}

export const getMeetings = (year: number) =>
  fetchJSON<Meeting[]>(`/meetings?year=${year}`).then((d) =>
    [...d].sort((a, b) => a.date_start.localeCompare(b.date_start))
  );

export const getSessions = (meetingKey: number) =>
  fetchJSON<Session[]>(`/sessions?meeting_key=${meetingKey}`);

export const getDrivers = (sessionKey: number) =>
  fetchJSON<Driver[]>(`/drivers?session_key=${sessionKey}`).then((d) =>
    // dedupe (API sometimes returns duplicate driver rows) and sort by name
    Array.from(new Map(d.map((x) => [x.driver_number, x])).values()).sort(
      (a, b) => a.last_name.localeCompare(b.last_name)
    )
  );

export const getLaps = (sessionKey: number, driverNumber: number) =>
  fetchJSON<Lap[]>(
    `/laps?session_key=${sessionKey}&driver_number=${driverNumber}`
  ).then((d) => d.filter((l) => l.lap_duration && !l.is_pit_out_lap));

export const getCarData = (
  sessionKey: number,
  driverNumber: number,
  dateStart: string,
  dateEnd: string
) =>
  fetchJSON<CarData[]>(
    `/car_data?session_key=${sessionKey}&driver_number=${driverNumber}` +
      `&date>=${dateStart}&date<=${dateEnd}`
  );

export const getTeamRadio = (sessionKey: number, driverNumber: number) =>
  fetchJSON<TeamRadio[]>(
    `/team_radio?session_key=${sessionKey}&driver_number=${driverNumber}`
  );

// Session-wide team radio (all drivers), chronological.
export const getSessionRadio = (sessionKey: number) =>
  fetchJSON<TeamRadio[]>(`/team_radio?session_key=${sessionKey}`).then((d) =>
    [...d].sort((a, b) => a.date.localeCompare(b.date))
  );

// Race control / direzione gara — flags, safety car, incidents, DRS, etc.
export const getRaceControl = (sessionKey: number) =>
  fetchJSON<RaceControlMsg[]>(`/race_control?session_key=${sessionKey}`).then(
    (d) => [...d].sort((a, b) => a.date.localeCompare(b.date))
  );

// Official classification for the session.
export const getSessionResult = (sessionKey: number) =>
  fetchJSON<SessionResult[]>(`/session_result?session_key=${sessionKey}`);

export interface Position {
  date: string;
  driver_number: number;
  position: number;
}

// Position changes over time (used to reconstruct standings at a given moment).
export const getPositions = (sessionKey: number) =>
  fetchJSON<Position[]>(`/position?session_key=${sessionKey}`);

export interface Stint {
  driver_number: number;
  stint_number: number;
  lap_start: number;
  lap_end: number;
  compound: string;
  tyre_age_at_start: number;
}

export const getStints = (sessionKey: number) =>
  fetchJSON<Stint[]>(`/stints?session_key=${sessionKey}`);

// ── Live (real-time) — uncached, query the current session ──
export interface Interval {
  driver_number: number;
  gap_to_leader: number | string | null;
  interval: number | string | null;
  date: string;
}

export const getLatestSession = () =>
  fetchLive<Session[]>(`/sessions?session_key=latest`).then((a) => a[0] ?? null);
export const getLiveDrivers = () =>
  fetchLive<Driver[]>(`/drivers?session_key=latest`);
export const getLivePositions = () =>
  fetchLive<Position[]>(`/position?session_key=latest`);
export const getLiveIntervals = () =>
  fetchLive<Interval[]>(`/intervals?session_key=latest`);
export const getLiveLaps = () => fetchLive<Lap[]>(`/laps?session_key=latest`);
export const getLiveStints = () =>
  fetchLive<Stint[]>(`/stints?session_key=latest`);

export interface Location {
  date: string;
  driver_number: number;
  x: number;
  y: number;
  z: number;
}

// Car x/y position over time (~4 Hz). Used for the track map.
export const getLocation = (
  sessionKey: number,
  driverNumber: number,
  dateStart: string,
  dateEnd: string
) =>
  fetchJSON<Location[]>(
    `/location?session_key=${sessionKey}&driver_number=${driverNumber}` +
      `&date>=${dateStart}&date<=${dateEnd}`
  );

// Compound + tyre age for a driver on a given lap.
export function tyreOnLap(
  stints: Stint[],
  driverNumber: number,
  lapNumber: number
): { compound: string; age: number } | null {
  const s = stints.find(
    (x) =>
      x.driver_number === driverNumber &&
      lapNumber >= x.lap_start &&
      lapNumber <= x.lap_end
  );
  if (!s) return null;
  return { compound: s.compound, age: s.tyre_age_at_start + (lapNumber - s.lap_start) };
}

// DRS codes >= 10 mean the flap is open / available-and-used on track.
export const drsActive = (drs: number) => (drs ?? 0) >= 10;
