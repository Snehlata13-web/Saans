import { useEffect, useRef, useState } from 'react'
import { Card, Tag } from './ui'
import { category, round, POLLUTANTS } from '../lib/aqi'
import { insights, contextFor } from '../lib/insights'

const SUGGEST = ['Is it safe to go for a run now?', 'Should my kids play outside?', 'When is the best time to go out today?', 'What is PM2.5?', 'Will air get worse tomorrow?', 'Kya mujhe mask pehenna chahiye?']

function localAnswer(q, { aq, wx, loc }) {
  const t = q.toLowerCase()
  const c = aq.current || {}
  const cat = category(c.us_aqi)
  const { s } = insights(aq, wx, loc.name)
  const tf = (x) => new Date(x).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', timeZone: aq.tz })
  const head = `${loc.name}: US AQI ${c.us_aqi ?? '—'} (${cat.label}, model estimate).`
  if (/run|jog|exercise|walk|gym|cycle|sport|workout|daud|sair/.test(t))
    return `${head} ${cat.activity}${s.best ? ` The cleanest 2-hour window in the next 48h is around ${tf(s.best.start)} (forecast AQI ≈ ${round(s.best.aqi)}).` : ''}`
  if (/kid|child|baby|school|bachch/.test(t)) return `${head} ${c.us_aqi > 100 ? 'Children are more vulnerable — keep play indoors today and avoid traffic-heavy routes.' : 'Outdoor play is fine today.'} ${cat.sensitive}`
  if (/mask|n95/.test(t)) return `${head} ${c.us_aqi > 150 ? 'Yes — wear a well-fitted N95/FFP2 outdoors.' : c.us_aqi > 100 ? 'Recommended for sensitive groups (N95/FFP2).' : 'Not necessary for most people right now.'} Cloth masks don't filter PM2.5.`
  if (/best time|when.*(go|out)|kab/.test(t)) return s.best ? `Best 2-hour window: ${tf(s.best.start)} with forecast AQI ≈ ${round(s.best.aqi)} (${category(s.best.aqi).label}). This is a forecast, not a measurement.` : 'Forecast is unavailable right now.'
  if (/tomorrow|forecast|worse|better|kal|future|predict/.test(t)) {
    const f = aq.forecast.slice(12, 36).map((r) => r.us_aqi).filter((v) => v != null)
    const m = f.length ? Math.round(f.reduce((a, b) => a + b) / f.length) : null
    return m == null ? 'Forecast not available.' : `Forecast (CAMS) for the next ~24h after tonight: average AQI ≈ ${m} (${category(m).label}), peak ≈ ${Math.max(...f)}. Right now it is ${c.us_aqi}. ${m > c.us_aqi ? 'So it is expected to get worse.' : 'So it should improve a bit.'}`
  }
  if (/cigar|smok/.test(t)) return `24h average PM2.5 is ${round(s.avgs.pm2_5, 1)} µg/m³ ≈ ${round(s.cig, 1)} cigarettes/day (Berkeley Earth: 22 µg/m³ ≈ 1 cigarette).`
  if (/diwali|cracker|patakh|firework/.test(t)) return `Firecrackers release huge bursts of PM2.5, metals and SO₂ in a few hours, and cold calm nights trap them near the ground. Open the History tab → "Diwali Effect" to see how ${loc.name}'s PM2.5 changed around every Diwali since 2023.`
  if (/why|reason|cause|kyu/.test(t)) {
    const w = wx?.current
    return `${head} Likely drivers: ${w ? `wind ${w.wind_speed_10m} km/h${w.wind_speed_10m < 6 ? ' (calm — poor dispersion)' : ''}, humidity ${w.relative_humidity_2m}%` : 'weather'}, plus local sources like traffic, construction dust, biomass/stubble burning and industry. Dominant pollutant now: ${POLLUTANTS.map((p) => ({ p, x: (c[p.key] || 0) / p.who })).sort((a, b) => b.x - a.x)[0].p.label}.`
  }
  for (const p of POLLUTANTS) if (t.includes(p.label.toLowerCase().replace('₂', '2').replace('₃', '3')) || t.includes(p.key)) return `${p.label}: ${p.desc} Right now: ${round(c[p.key], 1) ?? '—'} ${p.unit} (WHO guideline ${p.who}).`
  if (/asthma|heart|elder|old|pregnan|sensitive/.test(t)) return `${head} ${cat.sensitive}`
  if (/aqi|meaning|mean|what is/.test(t)) return `AQI (Air Quality Index) turns pollutant concentrations into one 0–500 number. 0–50 Good, 51–100 Moderate, 101–150 Unhealthy for sensitive groups, 151–200 Unhealthy, 201–300 Very unhealthy, 301+ Hazardous. ${head}`
  return insights(aq, wx, loc.name).lines.slice(0, 4).join(' ')
}

export default function Assistant({ aq, wx, station, loc }) {
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: `Namaste! 🙏 I'm SAANS AI. Ask me anything about the air in ${loc.name} — by typing or with the 🎙️ mic.` }])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [speak, setSpeak] = useState(true)
  const [mode, setMode] = useState('…')
  const box = useRef()
  const rec = useRef()

  useEffect(() => { box.current?.scrollTo(0, 1e6) }, [msgs])

  const say = (text) => {
    if (!speak || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ''))
    u.rate = 1.03
    window.speechSynthesis.speak(u)
  }

  const ask = async (text) => {
    if (!text.trim()) return
    const next = [...msgs, { role: 'user', content: text }]
    setMsgs(next); setQ(''); setBusy(true)
    let answer
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.slice(1), context: contextFor(aq, wx, station, loc) }) })
      if (!r.ok) throw new Error(r.status)
      answer = (await r.json()).text
      setMode('LLM')
    } catch {
      answer = localAnswer(text, { aq, wx, loc })
      setMode('built-in engine')
    }
    setMsgs((m) => [...m, { role: 'assistant', content: answer }])
    setBusy(false)
    say(answer)
  }

  const mic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return alert('Voice input is not supported in this browser (try Chrome).')
    if (listening) { rec.current?.stop(); return }
    const r = new SR()
    r.lang = navigator.language || 'en-IN'
    r.interimResults = false
    r.onresult = (e) => ask(e.results[0][0].transcript)
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    rec.current = r
    r.start(); setListening(true)
  }

  return (
    <div className="grid">
      <Card className="span3 chat" title="SAANS AI — your air-quality assistant" icon="🤖" right={<div className="tags"><Tag kind="model">Grounded on live data</Tag><span className="muted xs">mode: {mode}</span></div>}>
        <div className="msgs" ref={box}>
          {msgs.map((m, i) => <div key={i} className={'msg ' + m.role}>{m.content}</div>)}
          {busy && <div className="msg assistant typing"><i /><i /><i /></div>}
        </div>
        <div className="sugg">{SUGGEST.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>
        <form className="chat-in" onSubmit={(e) => { e.preventDefault(); ask(q) }}>
          <button type="button" className={'mic' + (listening ? ' on' : '')} onClick={mic} title="Voice input">🎙️</button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={listening ? 'Listening…' : 'Ask about the air… (English / Hinglish)'} />
          <label className="xs muted"><input type="checkbox" checked={speak} onChange={(e) => setSpeak(e.target.checked)} /> 🔊 speak</label>
          <button className="btn glow" disabled={busy}>Send</button>
        </form>
      </Card>
    </div>
  )
}
