import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { getAirQuality, getWeather, getStation, getMulti, reverseGeocode } from './lib/api'
import { CITIES } from './lib/cities'
import { category } from './lib/aqi'
import { checkAlerts } from './lib/alerts'
import LocationSearch from './components/LocationSearch'
import Dashboard from './components/Dashboard'
import { Loader, ErrorBox } from './components/ui'

const World = lazy(() => import('./components/World'))
const MapView = lazy(() => import('./components/MapView'))
const History = lazy(() => import('./components/History'))
const Forecast = lazy(() => import('./components/Forecast'))
const Compare = lazy(() => import('./components/Compare'))
const Health = lazy(() => import('./components/Health'))
const Assistant = lazy(() => import('./components/Assistant'))
const Alerts = lazy(() => import('./components/Alerts'))
const ShareCard = lazy(() => import('./components/ShareCard'))

const TABS = [
  ['overview', '◉', 'Live'], ['world', '🌍', '3D Globe'], ['map', '🗺️', 'Map'], ['history', '📈', 'History'],
  ['forecast', '🔮', 'Forecast'], ['compare', '⚖️', 'Compare'], ['health', '🩺', 'Health'], ['assistant', '🤖', 'AI'], ['alerts', '🔔', 'Alerts'],
]

function initialLoc() {
  const p = new URLSearchParams(location.search)
  if (p.get('lat')) return { name: p.get('name') || 'Shared location', lat: +p.get('lat'), lon: +p.get('lon'), country: p.get('country') || '' }
  try { const s = JSON.parse(localStorage.getItem('saans:loc')); if (s) return s } catch { /* none */ }
  return { name: 'New Delhi', lat: 28.6139, lon: 77.209, country: 'India' }
}

export default function App() {
  const [loc, setLoc] = useState(initialLoc)
  const [tab, setTab] = useState(() => location.hash.slice(1) || 'overview')
  const [aq, setAq] = useState(null)
  const [wx, setWx] = useState(null)
  const [station, setStation] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [world, setWorld] = useState([])
  const [worldErr, setWorldErr] = useState(null)
  const [share, setShare] = useState(false)
  const [toasts, setToasts] = useState([])
  const [intro, setIntro] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const notify = useCallback((t) => {
    const id = Math.random()
    setToasts((x) => [...x, { ...t, id }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 7000)
  }, [])

  const pick = (p) => {
    const l = { name: p.name, lat: p.lat, lon: p.lon, country: p.country || '' }
    setLoc(l); localStorage.setItem('saans:loc', JSON.stringify(l))
    setTab('overview'); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const go = (t) => { setTab(t); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  useEffect(() => { history.replaceState(null, '', `?lat=${loc.lat.toFixed(4)}&lon=${loc.lon.toFixed(4)}&name=${encodeURIComponent(loc.name)}&country=${encodeURIComponent(loc.country || '')}#${tab}`) }, [loc, tab])

  useEffect(() => {
    const h = () => { const t = location.hash.slice(1); if (TABS.some(([k]) => k === t)) setTab(t) }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  // main location data
  useEffect(() => {
    let off = false
    setLoading(true); setErr(null); setStation(null)
    getAirQuality(loc.lat, loc.lon, { pastDays: 30, forecastDays: 5 })
      .then((d) => { if (!off) { setAq(d); setLoading(false) } })
      .catch((e) => { if (!off) { setErr(e); setLoading(false) } })
    getWeather(loc.lat, loc.lon).then((d) => !off && setWx(d)).catch(() => !off && setWx(null))
    getStation(loc.lat, loc.lon).then((d) => !off && setStation(d)).catch((e) => !off && setStation({ error: e.status === 503 ? 'not configured' : e.message }))
    return () => { off = true }
  }, [loc.lat, loc.lon, refreshKey])

  // auto refresh every 10 min
  useEffect(() => { const i = setInterval(() => setRefreshKey((k) => k + 1), 10 * 60e3); return () => clearInterval(i) }, [])

  // world cities for globe, map, leaderboard
  useEffect(() => {
    const load = () => getMulti(CITIES).then((d) => { setWorld(d); setWorldErr(null) }).catch(setWorldErr)
    load()
    const i = setInterval(load, 15 * 60e3)
    return () => clearInterval(i)
  }, [])

  // alerts watcher
  useEffect(() => {
    const run = () => checkAlerts(notify).catch(() => {})
    const t = setTimeout(run, 8000)
    const i = setInterval(run, 15 * 60e3)
    return () => { clearTimeout(t); clearInterval(i) }
  }, [notify])

  useEffect(() => { const t = setTimeout(() => setIntro(false), 2600); return () => clearTimeout(t) }, [])

  const locate = () => {
    if (!navigator.geolocation) return notify({ title: 'Location unavailable', body: 'Your browser does not support geolocation.' })
    navigator.geolocation.getCurrentPosition(async (p) => {
      const g = await reverseGeocode(p.coords.latitude, p.coords.longitude)
      pick({ ...g, lat: p.coords.latitude, lon: p.coords.longitude })
      notify({ title: '📍 Located you', body: `Showing air quality near ${g.name}.` })
    }, () => notify({ title: 'Location denied', body: 'Allow location access or search for a place.' }), { timeout: 10000 })
  }

  const cat = category(aq?.current?.us_aqi)
  const ticker = [...world].filter((p) => p.us_aqi != null).sort((a, b) => b.us_aqi - a.us_aqi)

  return (
    <div className="app" style={{ '--cat': cat.color, '--catglow': cat.glow }}>
      {intro && (
        <div className="intro">
          <div className="intro-orb" />
          <h1>SAANS</h1>
          <p>breathe in… <span>breathe out</span></p>
        </div>
      )}
      <div className="bg"><i className="b1" /><i className="b2" /><i className="b3" /><div className="gridfx" /></div>

      <header className="top">
        <div className="brand" onClick={() => go('overview')}>
          <span className="logo">🪔</span>
          <div><b>SAANS</b><small>Air Quality Intelligence</small></div>
        </div>
        <LocationSearch onPick={pick} />
        <button className="btn ghost" onClick={locate} title="Use my location">📍 Near me</button>
        <div className="live"><i />LIVE</div>
      </header>

      {ticker.length > 0 && (
        <div className="ticker"><div className="ticker-in">
          {[...ticker, ...ticker].map((p, i) => (
            <span key={i} onClick={() => pick(p)}><i style={{ background: category(p.us_aqi).color }} />{p.name} <b style={{ color: category(p.us_aqi).color }}>{p.us_aqi}</b></span>
          ))}
        </div></div>
      )}

      <nav className="tabs">
        {TABS.map(([k, ic, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}><span>{ic}</span>{l}</button>)}
      </nav>

      <main>
        {loading && !aq && <Loader />}
        <ErrorBox error={err} onRetry={() => setRefreshKey((k) => k + 1)} />
        <Suspense fallback={<Loader text="Loading module…" />}>
          {tab === 'world' && <World world={world} worldErr={worldErr} loc={loc} aq={aq} onPick={pick} />}
          {tab === 'map' && <MapView loc={loc} world={world} onPick={pick} />}
          {tab === 'health' && <Health aq={aq} />}
          {tab === 'compare' && <Compare loc={loc} />}
          {tab === 'history' && <History loc={loc} />}
          {tab === 'alerts' && <Alerts loc={loc} notify={notify} />}
          {aq && <>
            {tab === 'overview' && <Dashboard loc={loc} aq={aq} wx={wx} station={station} onShare={() => setShare(true)} go={go} />}
            {tab === 'forecast' && <Forecast loc={loc} aq={aq} wx={wx} />}
            {tab === 'assistant' && <Assistant loc={loc} aq={aq} wx={wx} station={station} />}
            {share && <ShareCard loc={loc} aq={aq} onClose={() => setShare(false)} />}
          </>}
        </Suspense>
      </main>

      <footer>
        <p><b>Data sources:</b> <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer">Open-Meteo Air Quality API</a> (Copernicus Atmosphere Monitoring Service, CAMS — modelled estimates & forecasts) ·{' '}
          <a href="https://aqicn.org/api/" target="_blank" rel="noreferrer">World Air Quality Index Project (WAQI)</a> (ground-station measurements) ·{' '}
          <a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">Open-Meteo Weather & Geocoding</a> · <a href="https://www.bigdatacloud.com" target="_blank" rel="noreferrer">BigDataCloud</a> reverse geocoding · Map © OpenStreetMap, CARTO.</p>
        <p className="muted xs">SAANS never fabricates readings. Model estimates, ground measurements, forecasts and ML predictions are always labelled. Health guidance is general information, not medical advice. Built for the Let's Code Diwali Challenge 2026 🪔</p>
      </footer>

      <div className="toasts">{toasts.map((t) => <div key={t.id} className="toast"><b>{t.title}</b><span>{t.body}</span></div>)}</div>
    </div>
  )
}
