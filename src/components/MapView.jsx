import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Rectangle, Pane, useMap, useMapEvents, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { category, CATEGORIES, round, fmtTime } from '../lib/aqi'
import { getMulti, getStationsInBounds, reverseGeocode } from '../lib/api'
import { Tag } from './ui'

function Events({ onMove, onClick }) {
  const map = useMap()
  const t = useRef()
  useMapEvents({
    moveend: () => { clearTimeout(t.current); t.current = setTimeout(() => onMove(map.getBounds(), map.getZoom()), 500) },
    click: (e) => onClick(e.latlng),
  })
  useEffect(() => { onMove(map.getBounds(), map.getZoom()) }, [])
  return null
}
function FlyTo({ loc }) {
  const map = useMap()
  useEffect(() => { map.flyTo([loc.lat, loc.lon], Math.max(map.getZoom(), 7), { duration: 1.2 }) }, [loc.lat, loc.lon])
  return null
}

const pulse = (color) => L.divIcon({ className: '', html: `<div class="pulse" style="--c:${color}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] })

export default function MapView({ loc, world, onPick }) {
  const [grid, setGrid] = useState([])
  const [stations, setStations] = useState([])
  const [heat, setHeat] = useState(true)
  const [showSt, setShowSt] = useState(true)
  const [probe, setProbe] = useState(null)
  const [msg, setMsg] = useState('')

  const onMove = async (b, z) => {
    const s = b.getSouth(), n = b.getNorth(), w = b.getWest(), e = b.getEast()
    const N = 7
    const pts = []
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const lat = s + ((i + 0.5) * (n - s)) / N, lon = w + ((j + 0.5) * (e - w)) / N
      if (Math.abs(lat) < 85) pts.push({ lat, lon, dLat: (n - s) / N, dLon: (e - w) / N })
    }
    try {
      setMsg('')
      if (heat) setGrid(await getMulti(pts, ['us_aqi', 'pm2_5']))
    } catch (err) { setMsg('Heatmap: ' + err.message) }
    if (showSt) {
      try {
        const r = await getStationsInBounds([s, w, n, e])
        setStations(r.stations?.slice(0, 600) || [])
      } catch { setStations([]) }
    }
  }

  const onClick = async (ll) => {
    setProbe({ lat: ll.lat, lon: ll.lng, loading: true })
    try {
      const [d] = await getMulti([{ lat: ll.lat, lon: ll.lng }], ['us_aqi', 'pm2_5', 'pm10', 'nitrogen_dioxide', 'ozone', 'carbon_monoxide', 'sulphur_dioxide'])
      const g = await reverseGeocode(ll.lat, ll.lng)
      setProbe({ ...d, ...g, lat: ll.lat, lon: ll.lng })
    } catch (e) { setProbe({ lat: ll.lat, lon: ll.lng, error: e.message }) }
  }

  const visible = [...world, ...stations.map((s) => ({ ...s, us_aqi: s.aqi }))]
  const hotspots = [...world].filter((p) => p.us_aqi != null).sort((a, b) => b.us_aqi - a.us_aqi).slice(0, 6)

  return (
    <div className="map-shell">
      <div className="map-tools">
        <label><input type="checkbox" checked={heat} onChange={(e) => setHeat(e.target.checked)} /> Heatmap <Tag kind="model" /></label>
        <label><input type="checkbox" checked={showSt} onChange={(e) => setShowSt(e.target.checked)} /> Stations <Tag kind="measured" /></label>
        <span className="muted xs">Click anywhere on the map to probe air quality · pulsing = hotspots</span>
        {msg && <span className="warn xs">{msg}</span>}
      </div>
      <MapContainer center={[loc.lat, loc.lon]} zoom={5} className="map" worldCopyJump preferCanvas>
        <TileLayer attribution='&copy; OpenStreetMap &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <Events onMove={onMove} onClick={onClick} />
        <FlyTo loc={loc} />
        <Pane name="heat" style={{ zIndex: 350, filter: 'blur(18px)', opacity: 0.75 }}>
          {heat && grid.map((g, i) => g.us_aqi != null && (
            <Rectangle key={i} bounds={[[g.lat - g.dLat / 2, g.lon - g.dLon / 2], [g.lat + g.dLat / 2, g.lon + g.dLon / 2]]}
              pathOptions={{ stroke: false, fillColor: category(g.us_aqi).color, fillOpacity: 0.55 }} interactive={false} />
          ))}
        </Pane>
        {showSt && stations.map((s) => (
          <CircleMarker key={s.uid} center={[s.lat, s.lon]} radius={5} pathOptions={{ color: '#fff', weight: 1, fillColor: category(s.aqi).color, fillOpacity: 0.95 }}>
            <Popup><b>{s.name}</b><br />Measured US AQI: <b style={{ color: category(s.aqi).color }}>{s.aqi}</b><br /><small>{s.time && fmtTime(s.time)} · WAQI</small></Popup>
          </CircleMarker>
        ))}
        {world.filter((p) => p.us_aqi != null).map((p) => (
          <CircleMarker key={p.name} center={[p.lat, p.lon]} radius={9 + Math.min(14, p.us_aqi / 25)} pathOptions={{ color: category(p.us_aqi).color, weight: 2, fillColor: category(p.us_aqi).color, fillOpacity: 0.35 }}>
            <Popup>
              <b>{p.name}</b>, {p.country}<br />
              US AQI <b style={{ color: category(p.us_aqi).color }}>{p.us_aqi}</b> · {category(p.us_aqi).label}<br />
              PM2.5 {p.pm2_5} · PM10 {p.pm10} µg/m³<br /><small>Model estimate (CAMS) · {fmtTime(p.t)}</small><br />
              <button className="btn sm" onClick={() => onPick(p)}>Open dashboard</button>
            </Popup>
          </CircleMarker>
        ))}
        {hotspots.map((p) => <Marker key={'h' + p.name} position={[p.lat, p.lon]} icon={pulse(category(p.us_aqi).color)} interactive={false} />)}
        {probe && (
          <Popup position={[probe.lat, probe.lon]} eventHandlers={{ remove: () => setProbe(null) }}>
            {probe.loading ? 'Loading…' : probe.error ? `Error: ${probe.error}` : (
              <div>
                <b>{probe.name}</b>{probe.country && `, ${probe.country}`}<br />
                US AQI <b style={{ color: category(probe.us_aqi).color }}>{probe.us_aqi ?? '—'}</b> · {category(probe.us_aqi).label}<br />
                PM2.5 {round(probe.pm2_5, 1)} · PM10 {round(probe.pm10, 1)} · NO₂ {round(probe.nitrogen_dioxide, 1)}<br />
                O₃ {round(probe.ozone, 1)} · SO₂ {round(probe.sulphur_dioxide, 1)} · CO {round(probe.carbon_monoxide)} µg/m³<br />
                <small>Model estimate (CAMS) · {fmtTime(probe.t)}</small><br />
                <button className="btn sm" onClick={() => onPick({ name: probe.name, country: probe.country, lat: probe.lat, lon: probe.lon })}>Open dashboard</button>
              </div>
            )}
          </Popup>
        )}
      </MapContainer>
      <div className="legend">
        {CATEGORIES.map((c, i) => <span key={c.key}><i style={{ background: c.color }} />{(i ? CATEGORIES[i - 1].max + 1 : 0)}{c.max < 999 ? '–' + c.max : '+'} {c.short || c.label}</span>)}
      </div>
      <div className="hot-list">
        <b>🔥 Hotspots now</b>
        {hotspots.map((p) => <button key={p.name} onClick={() => onPick(p)}><span style={{ color: category(p.us_aqi).color }}>{p.us_aqi}</span> {p.name}</button>)}
        {visible.length === 0 && <span className="muted xs">loading…</span>}
      </div>
    </div>
  )
}
