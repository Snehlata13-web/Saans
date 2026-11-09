import { lazy, Suspense, useMemo } from 'react'
import { Card, Tag, AqiChip, CountUp, Ring } from './ui'
import { category, POLLUTANTS, round, fmtTime, fmtHour, haversine } from '../lib/aqi'
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

export default function Dashboard({ loc, aq, wx, station, onShare, go }) {
  const c = aq.current || {}
  const cat = category(c.us_aqi)
  const { lines, s } = insights(aq, wx, loc.name)
  const st = station && !station.error && station.aqi != null ? station : null
  const dist = st?.geo ? haversine({ lat: loc.lat, lon: loc.lon }, { lat: st.geo[0], lon: st.geo[1] }) : null
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
            <div className="aqi-mega" style={{ '--c': cat.color }}><CountUp value={c.us_aqi} /></div>
            <div className="aqi-side">
              <span className="aqi-unit">US AQI</span>
              <span className="cat-pill" style={{ '--c': cat.color }}>{cat.emoji} {cat.label}</span>
              <div className="tags">
                <Tag kind={aq.stale ? 'stale' : 'model'} />
                {st && <Tag kind="measured">Station {st.aqi}</Tag>}
              </div>
            </div>
          </div>
          <p className="lede">{cat.meaning} <span>{cat.general}</span></p>
          {c.us_aqi > 500 && <p className="warn sm">⚠️ Beyond the top of the AQI scale (&gt;500) — extreme event such as a dust storm (PM10 {round(c.pm10)} µg/m³).</p>}
          <div className="facts">
            <div><b><CountUp value={s.cig} decimals={1} /></b><span>cigarettes / day<br />equivalent 🚬</span></div>
            <div><b><CountUp value={s.whoX} decimals={1} />×</b><span>WHO PM2.5<br />daily limit</span></div>
            <div><b style={{ color: s.naqi?.category.color }}>{s.naqi?.value ?? '—'}</b><span>India NAQI*<br />{s.naqi?.category.label}</span></div>
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

        <Card className="b-tall" title="Ground station" icon="📡" right={<Tag kind="measured">Measured</Tag>}>
          {st ? (
            <div className="station">
              <div className="st-big" style={{ color: category(st.aqi).color }}>{st.aqi}</div>
              <div><b>{st.station}</b></div>
              <div className="muted xs">{dist != null && `${round(dist, 1)} km away · `}{st.time ? fmtTime(st.time) : ''}</div>
              <div className="sub-iaqi">
                {['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'].filter((k) => st.iaqi?.[k] != null).map((k) => <span key={k}>{k.toUpperCase()} <b>{st.iaqi[k]}</b></span>)}
              </div>
              <div className="muted xs">WAQI / aqicn.org — {st.attributions?.slice(0, 2).map((a) => a.name).join('; ')}</div>
            </div>
          ) : (
            <div className="muted sm">
              {station?.error ? 'Ground-station feed not connected yet.' : 'Finding nearest station…'}
              <br /><br />The model estimate is still fully live. Add <code>WAQI_TOKEN</code> to show real monitoring-station readings here.
            </div>
          )}
        </Card>

        <Card className="b-full src" right={null}>
          <div className="src-row">
            <span>🕒 Updated <b>{fmtTime(c.t, aq.tz)}</b> ({aq.tz})</span>
            <span>📡 {aq.source}</span>
            <span>🇪🇺 European AQI <b>{c.european_aqi ?? '—'}</b></span>
            <span>☀️ UV <b>{round(c.uv_index, 1) ?? '—'}</b></span>
            {aq.stale && <span className="warn">Cached data from {fmtTime(aq.cachedAt)}</span>}
          </div>
          <p className="muted xs">*India NAQI computed by SAANS from 24h-average modelled concentrations using CPCB breakpoints — an estimate, not an official CPCB reading.</p>
        </Card>
      </div>
    </>
  )
}
