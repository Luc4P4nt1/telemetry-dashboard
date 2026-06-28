import streamlit as st
import requests
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import timedelta

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="F1 Telemetria",
    page_icon="🏎",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS ─────────────────────────────────────────────────────────────────
st.markdown("""
<style>
  /* Dark background */
  .stApp { background-color: #080808; color: #ffffff; }
  section[data-testid="stSidebar"] { background-color: #0f0f0f; border-right: 1px solid #1e1e1e; }
  
  /* Selectbox labels */
  label { color: #888888 !important; font-size: 11px !important;
          text-transform: uppercase; letter-spacing: 0.06em; }

  /* Header */
  .f1-header {
    display: flex; align-items: center; gap: 12px;
    padding: 0 0 16px; border-bottom: 1px solid #1e1e1e; margin-bottom: 20px;
  }
  .f1-badge {
    background: #e10600; border-radius: 4px; padding: 4px 10px;
    font-weight: 700; font-size: 13px; letter-spacing: 1px; color: white;
  }
  .f1-title { font-size: 16px; font-weight: 500; color: white; }

  /* Metric cards */
  .metric-row { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
  .metric-card {
    background: #111111; border: 1px solid #1e1e1e; border-radius: 8px;
    padding: 12px 16px; flex: 1; min-width: 110px;
  }
  .metric-label { font-size: 11px; color: #555; text-transform: uppercase;
                  letter-spacing: 0.06em; margin-bottom: 4px; }
  .metric-value { font-size: 20px; font-weight: 500; color: #ffffff; font-family: monospace; }
  .metric-unit { font-size: 12px; color: #888; margin-left: 3px; }

  /* Radio cards */
  .radio-card {
    background: #111111; border: 1px solid #1e1e1e; border-left: 3px solid #f472b6;
    border-radius: 6px; padding: 12px 16px; margin-bottom: 10px;
  }
  .radio-time { font-size: 12px; color: #f472b6; font-family: monospace; }
  .radio-clock { font-size: 11px; color: #555; float: right; }

  /* Hide Streamlit branding */
  #MainMenu, footer, header { visibility: hidden; }
  .stDeployButton { display: none; }
</style>
""", unsafe_allow_html=True)

BASE = "https://api.openf1.org/v1"

# ── API helpers ────────────────────────────────────────────────────────────────
@st.cache_data(ttl=3600)
def fetch(url: str):
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    return r.json()

@st.cache_data(ttl=3600)
def get_meetings(year):
    data = fetch(f"{BASE}/meetings?year={year}")
    return sorted(data, key=lambda x: x.get("date_start", ""))

@st.cache_data(ttl=3600)
def get_sessions(meeting_key):
    return fetch(f"{BASE}/sessions?meeting_key={meeting_key}")

@st.cache_data(ttl=3600)
def get_drivers(session_key):
    data = fetch(f"{BASE}/drivers?session_key={session_key}")
    return sorted(data, key=lambda x: x.get("last_name", ""))

@st.cache_data(ttl=3600)
def get_laps(session_key, driver_number):
    data = fetch(f"{BASE}/laps?session_key={session_key}&driver_number={driver_number}")
    return [l for l in data if l.get("lap_duration") and not l.get("is_pit_out_lap")]

@st.cache_data(ttl=3600)
def get_car_data(session_key, driver_number, date_start, date_end):
    url = (f"{BASE}/car_data?session_key={session_key}"
           f"&driver_number={driver_number}"
           f"&date>={date_start}&date<={date_end}")
    return fetch(url)

@st.cache_data(ttl=3600)
def get_team_radio(session_key, driver_number):
    return fetch(f"{BASE}/team_radio?session_key={session_key}&driver_number={driver_number}")

# ── Sidebar ────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown('<div style="padding:4px 0 16px"><span style="background:#e10600;border-radius:4px;padding:4px 10px;font-weight:700;font-size:13px;color:white;letter-spacing:1px">F1</span>&nbsp;&nbsp;<span style="font-size:15px;font-weight:500">Telemetria</span></div>', unsafe_allow_html=True)

    year = st.selectbox("Anno", ["2025", "2024", "2023"], index=1)

    meetings = get_meetings(year)
    meeting_opts = {f"{m['country_name']} — {m['circuit_short_name']}": m["meeting_key"]
                    for m in meetings}
    meeting_label = st.selectbox("Gran Premio", list(meeting_opts.keys()))
    meeting_key = meeting_opts[meeting_label]

    sessions = get_sessions(meeting_key)
    session_opts = {s["session_name"]: s["session_key"] for s in sessions}
    session_label = st.selectbox("Sessione", list(session_opts.keys()))
    session_key = session_opts[session_label]

    drivers = get_drivers(session_key)
    driver_opts = {f"#{d['driver_number']} {d['name_acronym']} — {d.get('last_name','')}": d["driver_number"]
                   for d in drivers}
    driver_label = st.selectbox("Pilota", list(driver_opts.keys()))
    driver_num = driver_opts[driver_label]

    laps = get_laps(session_key, driver_num)
    lap_opts = {f"Giro {l['lap_number']}  —  {l['lap_duration']:.3f}s": l["lap_number"]
                for l in laps}

    if not lap_opts:
        st.warning("Nessun giro disponibile.")
        st.stop()

    lap_label = st.selectbox("Giro", list(lap_opts.keys()))
    lap_num = lap_opts[lap_label]
    lap_info = next(l for l in laps if l["lap_number"] == lap_num)

    # Lap stats in sidebar
    st.divider()
    st.markdown("**Tempi settoriali**")
    c1, c2, c3 = st.columns(3)
    c1.metric("S1", f"{lap_info.get('duration_sector_1', 0):.2f}s")
    c2.metric("S2", f"{lap_info.get('duration_sector_2', 0):.2f}s")
    c3.metric("S3", f"{lap_info.get('duration_sector_3', 0):.2f}s")

    st.markdown("**Velocità**")
    st.markdown(f"""
    <div style="font-size:13px;color:#888;margin-top:4px">
      Speed trap: <span style="color:#2a78d6;font-weight:500">{lap_info.get('st_speed','—')} km/h</span><br>
      Int. 1: {lap_info.get('i1_speed','—')} km/h<br>
      Int. 2: {lap_info.get('i2_speed','—')} km/h
    </div>
    """, unsafe_allow_html=True)

# ── Main area ──────────────────────────────────────────────────────────────────
driver_info = next(d for d in drivers if d["driver_number"] == driver_num)
driver_name = driver_info.get("full_name") or driver_info.get("last_name", str(driver_num))

st.markdown(f"""
<div class="f1-header">
  <span class="f1-badge">F1</span>
  <span class="f1-title">
    {driver_name} &nbsp;·&nbsp; {meeting_label.split('—')[0].strip()}
    &nbsp;·&nbsp; {session_label}
    &nbsp;·&nbsp; Giro {lap_num}
    &nbsp;·&nbsp; <span style="color:#888">{lap_info['lap_duration']:.3f}s</span>
  </span>
</div>
""", unsafe_allow_html=True)

# ── Load telemetry ─────────────────────────────────────────────────────────────
with st.spinner("Caricando telemetria..."):
    t_start = pd.to_datetime(lap_info["date_start"], utc=True)
    t_end   = t_start + timedelta(seconds=lap_info["lap_duration"] + 2)

    car_raw   = get_car_data(session_key, driver_num,
                             t_start.isoformat(), t_end.isoformat())
    radio_raw = get_team_radio(session_key, driver_num)

if not car_raw:
    st.error("Nessun dato di telemetria per questo giro.")
    st.stop()

# Build telemetry dataframe
df = pd.DataFrame(car_raw)
df["date"] = pd.to_datetime(df["date"], utc=True)
df = df[df["speed"] > 0].reset_index(drop=True)
df["t"] = (df["date"] - df["date"].iloc[0]).dt.total_seconds()
df["drs_on"] = df["drs"].apply(lambda x: 1 if (x or 0) >= 10 else 0)

# Filter radio for this lap
radio_df = pd.DataFrame(radio_raw) if radio_raw else pd.DataFrame()
if not radio_df.empty and "date" in radio_df.columns:
    radio_df["date"] = pd.to_datetime(radio_df["date"], utc=True)
    radio_df = radio_df[(radio_df["date"] >= t_start) & (radio_df["date"] <= t_end)].copy()
    radio_df["t"] = (radio_df["date"] - t_start).dt.total_seconds()

# ── Plotly chart ───────────────────────────────────────────────────────────────
COLORS = dict(speed="#2a78d6", throttle="#1baf7a", brake="#e34948",
              gear="#9b59b6", radio="#f472b6", drs="#f59e0b", bg="#080808",
              grid="#1e1e1e", text="#888888")

fig = make_subplots(
    rows=4, cols=1,
    shared_xaxes=True,
    vertical_spacing=0.03,
    subplot_titles=("Velocità (km/h)", "Throttle (%)", "Freno", "Marcia"),
    row_heights=[0.40, 0.22, 0.16, 0.22],
)

# ── Speed ──
fig.add_trace(go.Scatter(
    x=df["t"], y=df["speed"],
    mode="lines", name="Velocità",
    line=dict(color=COLORS["speed"], width=1.5),
    fill="tozeroy", fillcolor="rgba(42,120,214,0.07)",
), row=1, col=1)

# DRS overlay
drs_on = df[df["drs_on"] == 1]
if not drs_on.empty:
    fig.add_trace(go.Scatter(
        x=drs_on["t"], y=drs_on["speed"],
        mode="lines", name="DRS",
        line=dict(color=COLORS["drs"], width=0),
        fill="tozeroy", fillcolor="rgba(245,158,11,0.12)",
        showlegend=True,
    ), row=1, col=1)

# ── Throttle ──
fig.add_trace(go.Scatter(
    x=df["t"], y=df["throttle"],
    mode="lines", name="Throttle",
    line=dict(color=COLORS["throttle"], width=1.5),
    fill="tozeroy", fillcolor="rgba(27,175,122,0.07)",
), row=2, col=1)

# ── Brake ──
fig.add_trace(go.Scatter(
    x=df["t"], y=df["brake"],
    mode="lines", name="Freno",
    line=dict(color=COLORS["brake"], width=0),
    fill="tozeroy", fillcolor="rgba(227,73,72,0.5)",
    line_shape="hv",
), row=3, col=1)

# ── Gear ──
fig.add_trace(go.Scatter(
    x=df["t"], y=df["n_gear"],
    mode="lines", name="Marcia",
    line=dict(color=COLORS["gear"], width=1.5, shape="hv"),
    fill="tozeroy", fillcolor="rgba(155,89,182,0.07)",
), row=4, col=1)

# ── Radio markers ──
if not radio_df.empty:
    for _, row_ in radio_df.iterrows():
        for r in [1, 2, 3, 4]:
            fig.add_vline(
                x=row_["t"],
                line=dict(color=COLORS["radio"], width=1.2, dash="dot"),
                row=r, col=1,
            )

# ── Layout ──
fig.update_layout(
    paper_bgcolor=COLORS["bg"],
    plot_bgcolor=COLORS["bg"],
    font=dict(color=COLORS["text"], size=11, family="monospace"),
    height=580,
    margin=dict(l=56, r=20, t=36, b=40),
    hovermode="x unified",
    hoverlabel=dict(bgcolor="#1a1a1a", bordercolor="#2a2a2a", font_color="#fff"),
    legend=dict(
        orientation="h", yanchor="bottom", y=1.02,
        bgcolor="rgba(0,0,0,0)", font=dict(size=11),
    ),
    showlegend=True,
)

for i in range(1, 5):
    fig.update_xaxes(
        showgrid=True, gridcolor=COLORS["grid"], gridwidth=1,
        zeroline=False, tickfont=dict(color=COLORS["text"], size=10),
        row=i, col=1,
    )
    fig.update_yaxes(
        showgrid=True, gridcolor=COLORS["grid"], gridwidth=1,
        zeroline=False, tickfont=dict(color=COLORS["text"], size=10),
        row=i, col=1,
    )

fig.update_yaxes(range=[0, df["speed"].max() * 1.1], row=1, col=1)
fig.update_yaxes(range=[0, 105], row=2, col=1)
fig.update_yaxes(range=[0, 105], row=3, col=1)
fig.update_yaxes(range=[0, 8.5], tickvals=list(range(9)), row=4, col=1)
fig.update_xaxes(title_text="Tempo (s)", row=4, col=1,
                 title_font=dict(color=COLORS["text"], size=11))

for ann in fig.layout.annotations:
    ann.font.color = "#555555"
    ann.font.size = 10

st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

# ── Team Radio ─────────────────────────────────────────────────────────────────
st.markdown(f"""
<div style="font-size:10px;color:#555;letter-spacing:0.08em;margin:8px 0 12px">
  TEAM RADIO — {len(radio_df) if not radio_df.empty else 0} MESSAGGI
</div>
""", unsafe_allow_html=True)

if radio_df.empty or len(radio_df) == 0:
    st.markdown('<div style="color:#444;font-size:13px">Nessun radio trovato in questo giro. Prova una sessione del 2023 o 2024.</div>', unsafe_allow_html=True)
else:
    for _, row_ in radio_df.iterrows():
        clock = pd.to_datetime(row_["date"]).strftime("%H:%M:%S")
        st.markdown(f"""
        <div class="radio-card">
          <span class="radio-time">t = {row_['t']:.1f}s nel giro</span>
          <span class="radio-clock">{clock}</span>
        </div>
        """, unsafe_allow_html=True)
        st.audio(row_["recording_url"])
