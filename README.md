# 🏎 F1 Telemetry Dashboard

Dashboard per analizzare la **telemetria F1** con dati reali dall'[OpenF1 API](https://openf1.org) — gratis e senza API key per i dati storici (dal 2023).

Design moderno **Apple liquid-glass**, costruito con **Vite + React + TypeScript**. App interamente statica: nessun backend, le chiamate partono direttamente dal browser (OpenF1 espone CORS).

👉 La web app è in **[`web/`](web/)**.

## Funzionalità

- **Analisi** — telemetria del giro (velocità, throttle, freno, marcia) con crosshair sincronizzato; **confronto fra due piloti** con tabella dei tempi di settore e delta; barra giri scorrevole; gomme; timeline eventi (team radio + direzione gara) allineata all'asse della telemetria.
- **Circuito** — mappa del tracciato animata con la posizione dei piloti nel tempo, playback e scrubber.
- **Sessione** — classifica (con Q1/Q2/Q3 in qualifica), timeline di direzione gara e team radio, grafico delle **posizioni in gara** (bump chart).
- **Live** — classifica in tempo reale con auto-refresh (richiede una sessione in corso; durante le sessioni live OpenF1 limita l'accesso ai soli utenti autenticati a pagamento).
- **Sidebar globale** — filtri di sessione (anno · GP · sessione) e selezione piloti (max 2).

## Avvio rapido

Serve [Node.js](https://nodejs.org) 18+.

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

## Build di produzione

```bash
cd web
npm run build    # genera web/dist/ — static, deployabile ovunque
npm run preview
```

Deploy: pubblica la cartella `web/dist/` su Vercel, Netlify o GitHub Pages.

## Struttura

```
web/          dashboard Vite + React (app attuale)
telemetry/    vecchia versione Streamlit (legacy)
```

## Dati

Fonte: [OpenF1 API](https://openf1.org). I dati storici (dal 2023) sono gratuiti.
I dati **in tempo reale** durante una sessione live richiedono l'abbonamento
OpenF1 (Sponsor, ~€9,90/mese).

---

> La vecchia app Streamlit resta disponibile in [`telemetry/`](telemetry/).
