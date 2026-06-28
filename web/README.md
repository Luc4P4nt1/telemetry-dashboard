# 🏎 F1 Telemetria — Dashboard

Dashboard moderna per la telemetria F1, in stile **Apple liquid glass**.
Costruita con **Vite + React + TypeScript**, grafici SVG fatti a mano
(nessuna libreria di charting), dati live da [OpenF1](https://openf1.org).

Sostituisce la vecchia versione Streamlit (`../telemetry/app.py`).

## Caratteristiche

- Cascata Anno → Gran Premio → Sessione → Pilota → Giro
- Grafici sincronizzati: velocità, throttle, freno, marcia
- Crosshair con tooltip che mostra tutti i canali (incl. RPM e DRS)
- Ombreggiatura DRS sul grafico velocità + marker dei team radio
- Player audio dei team radio
- Card metriche: tempo giro, settori, top speed, speed trap
- Design glassmorphism: frosted glass, blur, glow ambientali, font di sistema

## Sviluppo

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build di produzione

```bash
npm run build    # genera dist/ (static, deployabile ovunque)
npm run preview
```

L'app è interamente statica: nessun backend. OpenF1 espone CORS
(`access-control-allow-origin: *`), quindi le chiamate API partono
direttamente dal browser. Deploy su Vercel / Netlify / GitHub Pages
servendo la cartella `dist/`.
