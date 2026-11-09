// Vercel serverless proxy for the WAQI (aqicn.org) API.
// Keeps WAQI_TOKEN on the server (env var) — never shipped to the browser.
export default async function handler(req, res) {
  const token = process.env.WAQI_TOKEN
  if (!token) return res.status(200).json({ error: 'not configured', configured: false })

  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams)
  let url
  if (q.type === 'geo') {
    const lat = Number(q.lat), lon = Number(q.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: 'lat/lon required' })
    url = `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${token}`
  } else if (q.type === 'bounds') {
    const parts = String(q.latlng || '').split(',').map(Number)
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return res.status(400).json({ error: 'latlng=lat1,lon1,lat2,lon2 required' })
    url = `https://api.waqi.info/map/bounds?latlng=${parts.join(',')}&networks=all&token=${token}`
  } else {
    return res.status(400).json({ error: 'type must be geo or bounds' })
  }

  try {
    const r = await fetch(url)
    if (r.status === 429) return res.status(429).json({ error: 'WAQI rate limit' })
    const j = await r.json()
    if (j.status !== 'ok') return res.status(502).json({ error: j.data || 'WAQI error' })
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900')

    if (q.type === 'bounds') {
      const stations = (j.data || [])
        .filter((s) => s.aqi !== '-' && Number.isFinite(Number(s.aqi)))
        .map((s) => ({ uid: s.uid, lat: s.lat, lon: s.lon, aqi: Number(s.aqi), name: s.station?.name, time: s.station?.time }))
      return res.status(200).json({ stations })
    }
    const d = j.data
    const iaqi = Object.fromEntries(Object.entries(d.iaqi || {}).map(([k, v]) => [k, v?.v]))
    return res.status(200).json({
      aqi: Number.isFinite(Number(d.aqi)) ? Number(d.aqi) : null,
      dominant: d.dominentpol,
      station: d.city?.name, stationUrl: d.city?.url, geo: d.city?.geo,
      time: d.time?.iso, iaqi,
      attributions: (d.attributions || []).map((a) => ({ name: a.name, url: a.url })),
      forecast: d.forecast?.daily || null,
    })
  } catch (e) {
    return res.status(502).json({ error: 'Upstream WAQI request failed' })
  }
}
