// US EPA AQI categories (the scale returned by Open-Meteo `us_aqi` and WAQI)
export const CATEGORIES = [
  { max: 50, key: 'good', label: 'Good', color: '#2ee59d', glow: 'rgba(46,229,157,.55)', emoji: '😊',
    meaning: 'Air quality is satisfactory and poses little or no risk.',
    general: 'Perfect day to be outside. Open the windows and let fresh air in.',
    sensitive: 'No special precautions needed.',
    activity: 'All outdoor activities are fine — running, cycling, sports.' },
  { max: 100, key: 'moderate', label: 'Moderate', color: '#ffd43b', glow: 'rgba(255,212,59,.5)', emoji: '🙂',
    meaning: 'Acceptable, but some pollutants may affect a very small number of unusually sensitive people.',
    general: 'Outdoor activity is fine for most people.',
    sensitive: 'Unusually sensitive people should consider shortening long, intense outdoor exertion.',
    activity: 'Normal activities OK. Sensitive people: take it easy on long runs.' },
  { max: 150, key: 'usg', label: 'Unhealthy for Sensitive Groups', short: 'Sensitive', color: '#ff922b', glow: 'rgba(255,146,43,.55)', emoji: '😐',
    meaning: 'Members of sensitive groups (children, elderly, asthma, heart/lung disease) may experience health effects.',
    general: 'The general public is less likely to be affected. Reduce prolonged heavy exertion.',
    sensitive: 'Children, elderly and people with asthma or heart disease should limit prolonged outdoor exertion. Keep inhalers handy.',
    activity: 'Prefer light exercise. Move intense workouts indoors.' },
  { max: 200, key: 'unhealthy', label: 'Unhealthy', color: '#ff4d6d', glow: 'rgba(255,77,109,.6)', emoji: '😷',
    meaning: 'Everyone may begin to experience health effects; sensitive groups may experience more serious effects.',
    general: 'Avoid prolonged outdoor exertion. Wear an N95/FFP2 mask outdoors. Run an air purifier indoors.',
    sensitive: 'Avoid all prolonged or heavy outdoor exertion. Stay indoors with windows closed.',
    activity: 'Skip outdoor workouts. Short essential trips only, with an N95 mask.' },
  { max: 300, key: 'very', label: 'Very Unhealthy', color: '#b56cff', glow: 'rgba(181,108,255,.6)', emoji: '🤢',
    meaning: 'Health alert: the risk of health effects is increased for everyone.',
    general: 'Avoid outdoor activity. Keep windows shut, use purifiers, wear N95 if you must go out.',
    sensitive: 'Remain indoors and keep activity levels low. Follow your doctor\'s advice.',
    activity: 'Stay indoors. Postpone outdoor plans, school sports and events.' },
  { max: Infinity, key: 'hazardous', label: 'Hazardous', color: '#ff2a2a', glow: 'rgba(160,0,40,.8)', emoji: '☠️',
    meaning: 'Health warning of emergency conditions: everyone is more likely to be affected.',
    general: 'Everyone should avoid all outdoor exertion. Seal windows, run purifiers on high.',
    sensitive: 'Stay indoors in a clean-air room. Seek medical help for breathing difficulty or chest pain.',
    activity: 'No outdoor activity. Treat as a health emergency.' },
]

export function category(aqi) {
  if (aqi == null || Number.isNaN(aqi)) return { key: 'na', label: 'No data', color: '#7a869a', glow: 'rgba(122,134,154,.4)', emoji: '❔', meaning: 'No data available.', general: '', sensitive: '', activity: '' }
  return CATEGORIES.find((c) => aqi <= c.max)
}

export const POLLUTANTS = [
  { key: 'pm2_5', label: 'PM2.5', unit: 'µg/m³', who: 15, desc: 'Fine particles ≤2.5µm. Penetrate deep into lungs and bloodstream; linked to heart & lung disease.' },
  { key: 'pm10', label: 'PM10', unit: 'µg/m³', who: 45, desc: 'Coarse particles ≤10µm (dust, pollen, construction). Irritate airways and worsen asthma.' },
  { key: 'nitrogen_dioxide', label: 'NO₂', unit: 'µg/m³', who: 25, desc: 'Mostly from vehicles & power plants. Inflames airways.' },
  { key: 'sulphur_dioxide', label: 'SO₂', unit: 'µg/m³', who: 40, desc: 'From burning coal & oil. Causes breathing problems.' },
  { key: 'carbon_monoxide', label: 'CO', unit: 'µg/m³', who: 4000, desc: 'Odourless gas from incomplete combustion. Reduces oxygen delivery.' },
  { key: 'ozone', label: 'O₃', unit: 'µg/m³', who: 100, desc: 'Ground-level ozone forms in sunlight from NOx + VOCs. Irritates lungs.' },
]

// EPA PM2.5 breakpoints (2024 revision) -> AQI, used for converting ML predictions
const PM25_BP = [
  [0, 9, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500], [325.5, 99999, 500, 500],
]
export function pm25ToUsAqi(c) {
  if (c == null || Number.isNaN(c)) return null
  c = Math.max(0, Math.round(c * 10) / 10)
  const b = PM25_BP.find(([lo, hi]) => c <= hi) || PM25_BP[PM25_BP.length - 1]
  const [cl, ch, il, ih] = b
  return Math.round(((ih - il) / (ch - cl)) * (c - cl) + il)
}

// India CPCB National AQI sub-index breakpoints
const NAQI_BP = {
  pm2_5: [0, 30, 60, 90, 120, 250, 380],
  pm10: [0, 50, 100, 250, 350, 430, 510],
  nitrogen_dioxide: [0, 40, 80, 180, 280, 400, 520],
  sulphur_dioxide: [0, 40, 80, 380, 800, 1600, 2100],
  carbon_monoxide: [0, 1, 2, 10, 17, 34, 46], // mg/m³
  ozone: [0, 50, 100, 168, 208, 748, 1000],
}
const NAQI_I = [0, 50, 100, 200, 300, 400, 500]
export const NAQI_CATS = [
  { max: 50, label: 'Good', color: '#2ee59d' }, { max: 100, label: 'Satisfactory', color: '#a3e635' },
  { max: 200, label: 'Moderate', color: '#ffd43b' }, { max: 300, label: 'Poor', color: '#ff922b' },
  { max: 400, label: 'Very Poor', color: '#ff4d6d' }, { max: Infinity, label: 'Severe', color: '#b5179e' },
]
function subIndex(key, c) {
  const bp = NAQI_BP[key]
  if (c == null) return null
  for (let i = 1; i < bp.length; i++) {
    if (c <= bp[i]) return Math.round(NAQI_I[i - 1] + ((c - bp[i - 1]) / (bp[i] - bp[i - 1])) * (NAQI_I[i] - NAQI_I[i - 1]))
  }
  return 500
}
// avg: 24h averages of pollutant concentrations (µg/m³). Returns NAQI + dominant pollutant.
export function computeNAQI(avg) {
  const subs = {}
  for (const k of Object.keys(NAQI_BP)) {
    let v = avg[k]
    if (v == null) continue
    if (k === 'carbon_monoxide') v = v / 1000
    subs[k] = subIndex(k, v)
  }
  const keys = Object.keys(subs)
  if (keys.length < 3 || (subs.pm2_5 == null && subs.pm10 == null)) return null
  const dom = keys.reduce((a, b) => (subs[a] >= subs[b] ? a : b))
  const value = subs[dom]
  return { value, dominant: dom, category: NAQI_CATS.find((c) => value <= c.max), subs }
}

// Berkeley Earth: 22 µg/m³ of PM2.5 for 24h ≈ smoking one cigarette
export const cigarettes = (pm25) => (pm25 == null ? null : pm25 / 22)

export const polLabel = (k) => POLLUTANTS.find((p) => p.key === k)?.label || k

export function fmtTime(iso, tz) {
  if (!iso) return '—'
  const d = iso instanceof Date ? iso : new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', ...(tz ? { timeZone: tz } : {}) })
}

export const fmtHour = (t, tz) => new Date(t).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz || undefined })

export function haversine(a, b) {
  const R = 6371, toR = (x) => (x * Math.PI) / 180
  const dLat = toR(b.lat - a.lat), dLon = toR(b.lon - a.lon)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export const avg = (arr) => {
  const v = arr.filter((x) => x != null && !Number.isNaN(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
export const round = (x, d = 0) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d)
