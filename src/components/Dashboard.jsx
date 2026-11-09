import { lazy, Suspense } from 'react'
import { Card, Gauge, Tag, AqiChip } from './ui'
import { category, POLLUTANTS, round, fmtTime, fmtHour, haversine } from '../lib/aqi'
import { insights } from '../lib/insights'

const BreathOrb = lazy(() => import('./BreathOrb'))

export default function Dashboard({ loc, aq, wx, station, onShare, go }) {
  const c = aq.current || {}
  const cat = category(c.us_aqi)
  const { lines, s } = insights(aq, wx, loc.name)
  const st = station && !station.error && station.aqi != null ? station : null
  const dist = st?.geo ? haversine({ lat: loc.lat, lon: loc.lon }, { lat: st.geo[0], lon: st.geo[1] }) : null

  return (
    <div className="grid dash" style={{ '--cat': cat.color, '--catglow': cat.glow }}>
      <Card className="hero-card span2">
        <div className="hero-top">
          <div>
            <div className="eyebrow">LIVE AIR · {loc.country || ''}</div>
            <h1 className="place">{loc.name}</h1>
            <div className="tags">
              <Tag kind={aq.stale ? 'stale' : 'model'} />
              {st && <Tag kind="measured">Station AQI {st.aqi}</Tag>}
            </div>
          </div>
          <button className="btn glow" onClick={onShare}>📸 Share card</button>
        </div>
        <div className="hero-body">
          <Gauge value={c.us_aqi} size={230} />
          <div className="hero-txt">
            <div className="cat-big" style={{ color: cat.color }}>{cat.emoji} {cat.label}</div>
            <p>{cat.meaning}</p>
            {c.us_aqi > 500 && <p className="warn sm">⚠️ Beyond the top of the AQI scale (&gt;500) — an extreme event such as a dust storm or fire smoke (PM10 {round(c.pm10)} µg/m³).</p>}
            <p className="muted">👉 {cat.general}</p>
            <div className="mini-stats">
              <div><b>{c.european_aqi ?? '—'}</b><span>European AQI</span></div>
              <div><b style={{ color: s.naqi?.category.color }}>{s.naqi?.value ?? '—'}</b><span>India NAQI* {s.naqi ? `· ${s.naqi.category.label}` : ''}</span></div>
              <div><b>{c.uv_index != null ? round(c.uv_index, 1) : '—'}</b><span>UV index</span></div>
            </div>
            <div className="updated">
              🕒 Last updated <b>{fmtTime(c.t, aq.tz)}</b> ({aq.tz}) · Source: {aq.source}
              {aq.stale && <> · <span className="warn">showing cached data from {fmtTime(aq.cachedAt)}</span></>}
            </div>
          </div>
        </div>
      </Card>

      <Card className="orb-card" title="Your breath, visualised" icon="🫁">
        <Suspense fallback={<div style={{ height: 300 }} />}><BreathOrb color={cat.color} pm={c.pm2_5} height={300} /></Suspense>
        <p className="center muted sm">Particle density scales with live PM2.5 ({round(c.pm2_5, 1) ?? '—'} µg/m³). Breathe in… and out — 4s each.</p>
      </Card>

      <Card className="span3" title="Pollutants right now" icon="🧪" right={<Tag kind="model" />}>
        <div className="pol-grid">
          {POLLUTANTS.map((p) => {
            const v = c[p.key]
            const x = v != null ? v / p.who : null
            const col = x == null ? '#7a869a' : x <= 1 ? '#2ee59d' : x <= 2 ? '#ffd43b' : x <= 4 ? '#ff922b' : '#ff4d6d'
            return (
              <div className="pol" key={p.key} style={{ '--pc': col }} title={p.desc}>
                <div className="pol-n">{p.label}</div>
                <div className="pol-v">{v != null ? round(v, 1) : '—'}<small> {p.unit}</small></div>
                <div className="bar"><i style={{ width: Math.min(100, (x || 0) * 25) + '%' }} /></div>
                <div className="pol-w">{x != null ? `${round(x, 1)}× WHO guideline` : 'Not available here'}</div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Ground station (measured)" icon="📡">
        {st ? (
          <div className="station">
            <div className="st-aqi"><AqiChip v={st.aqi} /> <span>US AQI · dominant {st.dominant?.toUpperCase() || '—'}</span></div>
            <div><b>{st.station}</b></div>
            <div className="muted sm">{dist != null && `${round(dist, 1)} km away · `}measured {st.time ? fmtTime(st.time) : '—'}</div>
            <div className="sub-iaqi">
              {['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'].filter((k) => st.iaqi?.[k] != null).map((k) => (
                <span key={k}>{k.toUpperCase()} <b>{st.iaqi[k]}</b></span>
              ))}
            </div>
            <div className="muted xs">Sub-indices (AQI scale). Data: WAQI / aqicn.org — {st.attributions?.slice(0, 2).map((a) => a.name).join('; ')}</div>
          </div>
        ) : (
          <div className="muted sm">
            {station?.error ? `Ground-station data unavailable (${station.error}).` : 'Loading nearest station…'}
            <br />The model estimate above is still live. Configure <code>WAQI_TOKEN</code> to add real monitoring-station readings.
          </div>
        )}
      </Card>

      <Card title="Health cost today" icon="🚬">
        <div className="cig">
          <div className="cig-n">{s.cig != null ? round(s.cig, 1) : '—'}</div>
          <div>cigarettes / day equivalent<br /><span className="muted xs">24h avg PM2.5 ÷ 22 µg/m³ (Berkeley Earth)</span></div>
        </div>
        <div className="cig-row">{Array.from({ length: Math.min(20, Math.ceil(s.cig || 0)) }).map((_, i) => <span key={i}>🚬</span>)}</div>
      </Card>

      <Card title="Best time to step out" icon="🏃" right={<Tag kind="forecast" />}>
        {s.best ? (
          <div className="best">
            <div className="best-t">{fmtHour(s.best.start, aq.tz)} – {new Date(s.best.end).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: aq.tz })}</div>
            <div>Forecast AQI ≈ <AqiChip v={round(s.best.aqi)} /> · {category(s.best.aqi).activity}</div>
          </div>
        ) : <div className="muted">Forecast not available.</div>}
        <button className="btn ghost sm" onClick={() => go('forecast')}>See full forecast →</button>
      </Card>

      <Card className="span3" title="AI insights" icon="✨" right={<button className="btn ghost sm" onClick={() => go('assistant')}>Ask SAANS AI →</button>}>
        <ul className="insights">{lines.map((l, i) => <li key={i} style={{ animationDelay: i * 80 + 'ms' }}>{l}</li>)}</ul>
        <p className="muted xs">*India NAQI is computed by SAANS from 24h-average modelled concentrations using CPCB breakpoints — an estimate, not an official CPCB reading.</p>
      </Card>
    </div>
  )
}
