import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { getStationsInBounds } from '../lib/api'
import { Card, Tag, AqiChip, CountUp, Ring } from './ui'
import { category, naqiCategory, naqiNow, POLLUTANTS, round, fmtTime, fmtHour, haversine, polLabel } from '../lib/aqi'
import { insights } from '../lib/insights'

const BreathOrb = lazy(() => import('./BreathOrb'))

function Spark({ aq }) {
  const now = Date.now()
  const rows = useMemo(() => [
    ...aq.past.filter((r) => r.t > now - 24 * 3600e3),
    ...aq.forecast.slice(0, 24),
  ].filter((r) => r.us_aqi != null), [aq])
  if (rows.length < 4) return null
  const W = 600, H = 150, P = 8
  const t0 = rows[0].t, t1 = rows[rows.length - 1].t
  const max = Math.max(...rows.map((r) => r.us_aqi)) * 1.15, min = Math.min(...rows.map((r) => r.us_aqi)) * 0.8
  const x = (t) => P + ((t - t0) / (t1 - t0)) * (W - 2 * P)
  const y = (v) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P)
  const pts = rows.map((r) => [x(r.t), y(r.us_aqi)])
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const nx = x(now)
  const peak = rows.reduce((m, r) => (r.us_aqi > m.us_aqi ? r : m))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="spark" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" x2="1">
          {rows.filter((_, i) => i % 6 === 0).map((r, i, a) => <stop key={i} offset={i / (a.length - 1 || 1)} stopColor={category(r.us_aqi).color} />)}
        </linearGradient>
        <linearGradient id="sf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".18" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <clipPath id="past"><rect x="0" y="0" width={nx} height={H} /></clipPath>
        <clipPath id="fut"><rect x={nx} y="0" width={W} height={H} /></clipPath>
      </defs>
      <path d={d + ` L ${W - P} ${H} L ${P} ${H} Z`} fill="url(#sf)" />
      <path d={d} fill="none" stroke="url(#sg)" strokeWidth="3" clipPath="url(#past)" />
      <path d={d} fill="none" stroke="url(#sg)" strokeWidth="3" strokeDasharray="6 6" clipPath="url(#fut)" opacity=".85" />
      <line x1={nx} x2={nx} y1="0" y2={H} stroke="#fff" strokeOpacity=".5" strokeDasharray="2 4" />
      <circle cx={nx} cy={y(aq.current?.us_aqi ?? rows[0].us_aqi)} r="6" fill="#fff" className="now-dot" />
      <text x={nx + 8} y="16" className="spark-t">NOW</text>
      <text x={P} y="16" className="spark-t mut">−24h · modelled</text>
      <text x={W - P} y="16" textAnchor="end" className="spark-t mut">+24h · forecast</text>
      <circle cx={x(peak.t)} cy={y(peak.us_aqi)} r="4" fill={category(peak.us_aqi).color} />
      <text x={Math.min(W - 60, x(peak.t) + 6)} y={y(peak.us_aqi) - 8} className="spark-t">peak {peak.us_aqi}</text>
    </svg>
  )
}

export default function Dashboard({ loc, aq, wx, station, onShare, go, scale = 'US', onScale }) {
  const c = aq.current || {}
  const { lines, s } = insights(aq, wx, loc.name)
  const st = station && !station.error && station.aqi != null ? station : null
  const [net, setNet] = useState(null)
  useEffect(() => {
    let off = false
    setNet(null)
    getStationsInBounds([loc.lat - 0.25, loc.lon - 0.3, loc.lat + 0.25, loc.lon + 0.3])
      .then((r) => {
        if (off) return
        const fresh = (r.stations || []).map((x) => ({ ...x, dist: haversine({ lat: loc.lat, lon: loc.lon }, x), ageH: x.time ? (Date.now() - new Date(x.time).getTime()) / 3600e3 : 99 }))
          .filter((x) => x.dist <= 25 && x.ageH < 3).sort((a, b) => a.aqi - b.aqi)
        setNet(fresh)
      }).catch(() => !off && setNet([]))
    return () => { off = true }
  }, [loc.lat, loc.lon])
  const med = net?.length ? net[Math.floor(net.length / 2)].aqi : null
  const hot = net?.length ? net[net.length - 1] : null
  const IN = scale === 'IN'
  // Stations (WAQI) publish the US-EPA index only, so they drive the headline on the US scale.
  // On the India scale SAANS applies CPCB breakpoints to the latest concentrations.
  const useSt = med != null && !IN
  const modelVal = IN ? naqiNow(c)?.value : c.us_aqi
  const headline = useSt ? med : modelVal
  const cat = IN ? naqiCategory(headline) : category(headline)
  const scaleName = IN ? 'India NAQI (CPCB)' : 'US AQI (EPA)'
  const orbit = POLLUTANTS.filter((p) => c[p.key] != null).map((p) => {
    const x = c[p.key] / p.who
    return { label: p.label, value: round(c[p.key], p.key === 'carbon_monoxide' ? 0 : 1), color: x <= 1 ? '#2ee59d' : x <= 2 ? '#ffd43b' : x <= 4 ? '#ff922b' : '#ff4d6d' }
  })

  return (
    <>
      <section className="hero">
        <div className="hero-l">
          <div className="kicker"><i />LIVE AIR · {loc.country || 'Earth'} · {fmtTime(c.t, aq.tz)}</div>
          <h1 className="mega" data-text={loc.name}>{loc.name}</h1>
          <div className="aqi-row">
            <div className="aqi-mega" style={{ '--c': cat.color }}><CountUp value={headline} /></div>
            <div className="aqi-side">
              <span className="aqi-unit">{scaleName} · {useSt ? 'MEASURED' : 'MODEL ESTIMATE'}</span>
              <span className="cat-pill" style={{ '--c': cat.color }}>{cat.emoji} {cat.label}</span>
              <div className="tags">
                {useSt ? <Tag kind="measured">Median of {net.length} station{net.length > 1 ? 's' : ''} ≤25 km</Tag> : <Tag kind={aq.stale ? 'stale' : 'model'}>{IN ? 'CPCB scale · from CAMS concentrations' : undefined}</Tag>}
                {useSt ? <Tag kind="model">Model {modelVal ?? '—'}</Tag> : med != null && <Tag kind="measured">Stations median US AQI {med}</Tag>}
              </div>
              <span className="xs muted">Main pollutant: <b>{polLabel(c.dominant)}</b> · <button className="linkbtn" onClick={onScale}>switch to {IN ? 'US AQI' : 'India NAQI'}</button></span>
            </div>
          </div>
          <p className="lede">{cat.meaning} <span>{cat.general}</span></p>
          {hot && net.length > 1 && <p className="sm hotspot">🔥 Hotspot right now: <b>{hot.name?.split(',')[0]}</b> — US AQI {hot.aqi} <span className="muted xs">(measured {fmtTime(hot.time)})</span></p>}
          {!useSt && !IN && net && <p className="xs muted">No ground station within 25 km reported in the last 3 hours — showing the Copernicus CAMS model estimate, which can under-estimate local hotspots.</p>}
          {c.us_aqi >= 500 && !useSt && <p className="warn sm">⚠️ Model shows an extreme event at the top of the AQI scale (e.g. a modelled dust storm, PM10 {round(c.pm10)} µg/m³). Dust models can over-estimate.</p>}
          <div className="facts">
            <div><b><CountUp value={s.cig} decimals={1} /></b><span>cigarettes / day<br />equivalent 🚬</span></div>
            <div><b><CountUp value={s.whoX} decimals={1} />×</b><span>WHO PM2.5<br />daily limit</span></div>
            <div><b style={{ color: s.naqi?.category.color }}>{s.naqi?.value ?? '—'}</b><span>NAQI 24h avg*<br />{s.naqi?.category.label}</span></div>
          </div>
          <div className="cta">
            <button className="btn glow" onClick={onShare}>📸 Create share card</button>
            <button className="btn" onClick={() => go('assistant')}>✨ Ask SAANS AI</button>
            <button className="btn ghost" onClick={() => go('forecast')}>Forecast →</button>
          </div>
        </div>
        <div className="hero-r">
          <div className="breath-label"><span className="in">inhale</span><span className="out">exhale</span></div>
          <Suspense fallback={<div style={{ height: 560 }} />}>
            <BreathOrb color={cat.color} pm={c.pm2_5} height={560} orbit={orbit} zoom={6.4} />
          </Suspense>
          <div className="orb-cap">Each glowing speck ≈ live PM2.5 density · {round(c.pm2_5, 1)} µg/m³</div>
        </div>
        <div className="scroll-hint">scroll<i /></div>
      </section>

      <div className="bento">
        <Card className="b-wide" title="Last 24h → next 24h" icon="〰" right={<div className="tags"><Tag kind="history">Modelled</Tag><Tag kind="forecast" /></div>}>
          <Spark aq={aq} />
        </Card>

        <Card className="b-tall" title="Best time to step out" icon="🏃" right={<Tag kind="forecast" />}>
          {s.best ? (
            <div className="best">
              <div className="best-t">{fmtHour(s.best.start, aq.tz)}</div>
              <div className="muted sm">until {new Date(s.best.end).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: aq.tz })}</div>
              <div className="best-aqi"><AqiChip v={round(s.best.aqi)} /> forecast AQI</div>
              <p className="sm">{category(s.best.aqi).activity}</p>
            </div>
          ) : <div className="muted">Forecast not available.</div>}
        </Card>

        {POLLUTANTS.map((p) => {
          const v = c[p.key]
          const x = v != null ? v / p.who : null
          const col = x == null ? '#7a869a' : x <= 1 ? '#2ee59d' : x <= 2 ? '#ffd43b' : x <= 4 ? '#ff922b' : '#ff4d6d'
          return (
            <div className="card pol" key={p.key} style={{ '--pc': col }} title={p.desc}>
              <div className="spot" />
              <Ring pct={(x || 0) / 4} color={col} size={70}><b>{x != null ? round(x, 1) + '×' : '—'}</b></Ring>
              <div>
                <div className="pol-n">{p.label}</div>
                <div className="pol-v">{v != null ? round(v, 1) : '—'}<small> {p.unit}</small></div>
                <div className="pol-w">WHO guideline {p.who}</div>
              </div>
            </div>
          )
        })}

        <Card className="b-wide" title="AI insights" icon="✦" right={<button className="btn ghost sm" onClick={() => go('assistant')}>Ask follow-ups →</button>}>
          <ul className="insights">{lines.map((l, i) => <li key={i} style={{ animationDelay: i * 90 + 'ms' }}>{l}</li>)}</ul>
        </Card>

        <Card className="b-tall" title="Monitoring stations nearby" icon="📡" right={<Tag kind="measured">Measured · WAQI</Tag>}>
          {net == null ? <div className="muted sm">Finding stations…</div> : net.length ? (
            <ul className="st-list">
              {[...net].reverse().slice(0, 8).map((x) => {
                const v = x.aqi
                const cc = category(v)
                return (
                  <li key={x.uid}>
                    <span className="st-n">{x.name?.split(',')[0]}<small>{round(x.dist, 1)} km · {x.time ? new Date(x.time).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}</small></span>
                    <AqiChip v={v} color={cc.color} />
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="muted sm">
              {st && <p>Nearest station <b>{st.station}</b>: US AQI {st.aqi} ({fmtTime(st.time)}) — older than 3 h or farther than 25 km.</p>}
              No fresh ground-station reading within 25 km. The model estimate above is still live.
            </div>
          )}
          <p className="muted xs">Station values are WAQI's US-EPA index (hourly). Data: World Air Quality Index Project (aqicn.org) · CPCB / state boards.</p>
        </Card>

        <Card className="b-full src" right={null}>
          <div className="src-row">
            <span>🕒 Updated <b>{fmtTime(c.t, aq.tz)}</b> ({aq.tz})</span>
            <span>📡 {aq.source}</span>
            <span>🇪🇺 European AQI <b>{c.european_aqi ?? '—'}</b></span>
            <span>☀️ UV <b>{round(c.uv_index, 1) ?? '—'}</b></span>
            {aq.stale && <span className="warn">Cached data from {fmtTime(aq.cachedAt)}</span>}
          </div>
          <p className="muted xs">How SAANS computes AQI: US EPA method from modelled concentrations — NowCast (12h) for PM2.5/PM10, 1h NO₂/SO₂, 8h CO. CAMS ozone (8h sub-index: {c.o3_aqi ?? '—'}) is shown separately and not used in the headline because the model strongly over-estimates ozone over South Asia (Open-Meteo's raw index here: {c.us_aqi_cams ?? '—'}). Ground-station readings (WAQI) take priority when a station within 25 km reported in the last 2 hours.</p>
          <p className="muted xs">*India NAQI computed by SAANS from 24h-average modelled concentrations using CPCB breakpoints — an estimate, not an official CPCB reading.</p>
        </Card>
      </div>
    </>
  )
}
