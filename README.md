# 🏎 F1 Telemetria Dashboard

Dashboard interattiva per analizzare la telemetria F1 con dati reali dall'API OpenF1.

## Funzionalità

- Seleziona anno, Gran Premio, sessione, pilota e giro
- Grafici sincronizzati di velocità, throttle, freno e marcia
- Overlay DRS sul grafico velocità
- Marker verticali dei team radio
- Player audio dei team radio direttamente in app

## Dati disponibili

- Stagioni: **2023, 2024, 2025**
- Fonte: [OpenF1 API](https://openf1.org) — gratuita, senza API key

## Installazione locale

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Deploy su Streamlit Cloud

1. Pusha questo repo su GitHub
2. Vai su [share.streamlit.io](https://share.streamlit.io)
3. Connetti il repo e seleziona `app.py`
4. Click **Deploy** — è gratis!
