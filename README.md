# 🪔 SAANS — Real-Time Air Quality Intelligence

> **SAANS** (साँस) means *breath*. SAANS turns raw, real-world air-quality data into a living, 3D, actionable experience — so people can understand the air they breathe and decide what to do about it.

Built for the **Let's Code Diwali Challenge 2026 — Breathe Better**.

**Live demo:** `<your-vercel-url>` · **Demo video:** `<your-video-link>`

![screenshot](docs/screenshot-dashboard.png)

---

## ✨ Highlights

| | |
|---|---|
| 🫁 **3D "Breath" orb** | A breathing glass sphere whose particle density is driven by the live PM2.5 reading |
| 🌍 **3D pollution globe** | Real-time AQI pillars for 76 cities (height = AQI), pulsing rings on hotspots, click to fly |
| 🪔 **Diwali Effect** | Aligns PM2.5 around every Diwali since 2023 (incl. 8 Nov 2026) to show the firecracker impact |
| 🧠 **In-browser ML** | Ridge-regression autoregressive model + weather covariates, back-tested vs. persistence baseline |
| 🤖 **AI + voice assistant** | Grounded on live data, Hinglish-friendly, speech in & out |
| 🚬 **Cigarette equivalent** | Translates PM2.5 exposure into cigarettes/day (Berkeley Earth) |

## ✅ Mandatory features

- **A. Live AQI dashboard** — US AQI gauge, European AQI, computed India NAQI, PM2.5 / PM10 / NO₂ / SO₂ / CO / O₃ with WHO-guideline multiples, severity category, source & last-updated timestamp (location timezone), ground-station reading (WAQI) next to the model estimate.
- **B. Interactive map** — Leaflet dark map, colour-coded city markers, real WAQI monitoring stations in view, click-anywhere probe with full pollutant detail, pulsing hotspots, AQI legend.
- **C. Historical tracker** — 7D/30D/90D/1Y/custom (since Aug 2022), daily AQI avg & peak chart, PM2.5 vs PM10 comparison, day-over-day % change, spike markers ⚡, two-date hourly comparison with % change.
- **D. Location comparison** — up to 5 places, pollutant table (best value highlighted), 7-day trend overlay, grouped pollutant bars, 👑 cleanest location.
- **E. Health & safety** — interactive AQI scale explainer ("you are here"), personal advice for 7 groups (children, elderly, asthma, heart, pregnancy, athletes…), mask/indoor tips, PM2.5 vs PM10 size visual, pollutant guide.
- **F. AQI forecast** — 5-day CAMS forecast with a clear **NOW** divider & shaded future, daily outlook cards, predicted spikes, best 2-hour outdoor window.

## 🏅 Bonus features (13/13)

1. **AI AQI Assistant** — LLM (Groq/OpenAI via serverless proxy) with a built-in data-grounded rule engine fallback.
2. **Smart AQI Alerts** — per-location thresholds, browser notifications + in-app toasts, **forecast-based early warnings**.
3. **ML-based prediction** — trained live on 30 days of hourly PM2.5 + weather; MAE/skill shown honestly.
4. **Pollution heatmap** — blurred, colour-graded grid of modelled AQI across the visible map area.
5. **Location-based AQI** — "📍 Near me" with geolocation + reverse geocoding.
6. **Clean Air Finder** — scans 32 points up to 160 km around you for relatively cleaner air.
7. **AQI sharing cards** — generated 1080×1350 PNG, download or Web-Share.
8. **Pollution impact report** — automated markdown report (averages, worst/best days, WHO exceedance, spikes, cumulative cigarettes).
9. **Pollution leaderboard** — live ranking of 76 cities (All / India / World).
10. **Voice assistant** — Web Speech API recognition + speech synthesis.
11. **Anomaly detection** — robust z-score (rolling median/MAD) on hourly PM2.5, merged into events.
12. **Multi-API integration** — Open-Meteo Air Quality + Weather + Geocoding, WAQI, BigDataCloud.
13. **AI insights** — plain-language summaries generated from the live numbers (no hallucinated values).

Plus: live city ticker, shareable URLs (`?lat=&lon=&name=`), auto-refresh every 10 min, offline/stale fallback.

## 🔌 Public APIs used (credited in-app)

| API | Used for | Data type | Key |
|---|---|---|---|
| [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) (Copernicus CAMS) | current, hourly history (since 2022), 5-day forecast, multi-city | **Model estimate / forecast** | none |
| [WAQI / aqicn.org](https://aqicn.org/api/) | nearest monitoring station, stations on map | **Ground-station measurement** | `WAQI_TOKEN` (server-side) |
| [CPCB via data.gov.in](https://data.gov.in/resource/real-time-air-quality-index-various-locations) | official India NAQI per station (24h avg) | **Official measurement** | `DATAGOV_API_KEY` (server-side) |
| [Open-Meteo Weather API](https://open-meteo.com/en/docs) | wind, humidity, boundary-layer height (insights + ML) | model | none |
| [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | place search | — | none |
| [BigDataCloud reverse geocode](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api) | names for "near me" / map probe | — | none |
| [Groq](https://console.groq.com) / OpenAI | optional LLM for the assistant | — | `GROQ_API_KEY` (server-side) |

### Data honesty
- **AQI is computed by SAANS using the official US EPA method** (NowCast 12h for PM2.5/PM10, 1h NO₂/SO₂, 8h CO) from the modelled concentrations. Open-Meteo's raw `us_aqi` was not used for the headline because it is driven by CAMS ozone, which is strongly over-estimated over South Asia (e.g. Mumbai raw 222 vs. 159 measured), and it is not capped at 500. Validation on 9 Nov 2026 against IQAir station data: Delhi 192 vs 196, Mumbai 160 vs 159.
- Nearby ground stations (WAQI, ≤25 km) are shown next to the model, and become the headline value when they reported within the last 2 hours.
- Every number is labelled as **Ground-station measurement**, **Model estimate · CAMS**, **Historical (modelled)**, **Forecast**, or **ML prediction · experimental**.
- No hard-coded or fabricated AQI values. If an API fails, SAANS shows the last good response clearly marked **"Cached — live fetch failed"** with its timestamp.
- Failures, timeouts and `429` rate limits are retried with exponential back-off; responses are cached (memory + localStorage) to stay within free-tier limits.
- India NAQI is *computed* from 24 h modelled concentrations using CPCB breakpoints and is labelled as an estimate.

## 🧱 Tech stack

React 19 + Vite · Three.js / React-Three-Fiber / Drei (3D) · Leaflet (map) · Recharts (charts) · Vercel Serverless Functions (`/api`) for secret-keeping proxies.

```
api/            serverless functions (WAQI proxy, AI chat) — keys stay on the server
src/lib/        api.js (fetch, cache, retries), aqi.js (scales, NAQI, WHO), analytics.js (ML, anomalies), insights.js
src/components/ Dashboard, Globe, BreathOrb, MapView, History (+Diwali Effect), Forecast, Compare, Health, World, Assistant, Alerts, ShareCard
```

## 🚀 Run locally

```bash
git clone <repo-url> && cd saans
npm install
cp .env.example .env      # optional: add WAQI_TOKEN and/or GROQ_API_KEY
npm run dev               # http://localhost:5173  (the /api functions run inside Vite dev server)
```

No keys? Everything still works with Open-Meteo; the ground-station card and LLM mode simply switch off gracefully.

## ☁️ Deploy (Vercel)

1. Push to GitHub → **Import** in Vercel (framework: Vite, auto-detected).
2. Add env vars `WAQI_TOKEN` (free at https://aqicn.org/data-platform/token) and optionally `GROQ_API_KEY`.
3. Deploy. `/api/*.js` become serverless functions automatically.

## ⚠️ Disclaimer
Health guidance is general information based on US EPA AQI categories and WHO guidelines — not medical advice.

Made with ❤️ and 🪔 for cleaner air.
