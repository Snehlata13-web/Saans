// Vercel serverless AI endpoint. Uses GROQ_API_KEY (free, OpenAI-compatible) or OPENAI_API_KEY.
// The browser falls back to a built-in rule engine when neither key is configured.
const SYSTEM = `You are SAANS, a friendly air-quality assistant. Answer in the user's language (English or Hinglish/Hindi).
Use ONLY the live data in CONTEXT for numbers; never invent readings. Say whether a value is a ground-station measurement,
a model estimate (Copernicus CAMS via Open-Meteo) or a forecast. Keep answers short (max ~120 words), practical and kind.
Give health guidance based on US EPA AQI categories and WHO guidelines. You are not a doctor; suggest medical help for symptoms.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const groq = process.env.GROQ_API_KEY, openai = process.env.OPENAI_API_KEY
  if (!groq && !openai) return res.status(200).json({ error: 'No AI key configured' })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { messages = [], context = {} } = body || {}
  const msgs = [
    { role: 'system', content: SYSTEM + '\n\nCONTEXT (JSON):\n' + JSON.stringify(context).slice(0, 6000) },
    ...messages.slice(-10).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content).slice(0, 2000) })),
  ]
  const url = groq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions'
  const model = groq ? (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile') : (process.env.OPENAI_MODEL || 'gpt-4o-mini')
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groq || openai}` },
      body: JSON.stringify({ model, messages: msgs, temperature: 0.4, max_tokens: 400 }),
    })
    if (r.status === 429) return res.status(429).json({ error: 'AI rate limit' })
    const j = await r.json()
    const text = j.choices?.[0]?.message?.content
    if (!text) return res.status(502).json({ error: 'Empty AI response' })
    return res.status(200).json({ text, model })
  } catch {
    return res.status(502).json({ error: 'AI request failed' })
  }
}
