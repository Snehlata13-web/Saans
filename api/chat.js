// Vercel serverless AI endpoint. Provider priority: GEMINI_API_KEY → GROQ_API_KEY → OPENAI_API_KEY.
// Keys live only on the server. The browser falls back to a built-in rule engine when none is configured.
const SYSTEM = `You are SAANS AI, a friendly air-quality assistant inside the SAANS app.
Reply in the user's language (English, Hindi or Hinglish — match them). Keep answers short (max ~120 words), practical and kind; use bullet points when helpful.
Use ONLY the live data in CONTEXT for numbers; never invent readings. Say whether a value is a ground-station measurement,
a model estimate (Copernicus CAMS via Open-Meteo) or a forecast. When the user is in India, quote India NAQI (CPCB) and mention US AQI if useful.
Base health guidance on CPCB / US EPA categories and WHO guidelines. You are not a doctor; suggest medical help for symptoms like chest pain or breathlessness.`

async function gemini(key, sys, msgs) {
  const models = [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'].filter(Boolean)
  let last
  for (const m of models) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: msgs.map((x) => ({ role: x.role === 'user' ? 'user' : 'model', parts: [{ text: x.content }] })),
        generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
      }),
    })
    if (r.status === 404) { last = 'model not found'; continue }
    if (r.status === 429) throw Object.assign(new Error('AI rate limit'), { status: 429 })
    const j = await r.json()
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim()
    if (text) return { text, model: m }
    last = j.error?.message || 'empty response'
  }
  throw new Error(last)
}

async function openaiLike(url, key, model, sys, msgs) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: sys }, ...msgs], temperature: 0.4, max_tokens: 500 }),
  })
  if (r.status === 429) throw Object.assign(new Error('AI rate limit'), { status: 429 })
  const j = await r.json()
  const text = j.choices?.[0]?.message?.content
  if (!text) throw new Error(j.error?.message || 'empty response')
  return { text, model }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { GEMINI_API_KEY: g, GROQ_API_KEY: q, OPENAI_API_KEY: o } = process.env
  if (!g && !q && !o) return res.status(200).json({ error: 'No AI key configured' })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { messages = [], context = {} } = body || {}
  const sys = SYSTEM + '\n\nCONTEXT (JSON):\n' + JSON.stringify(context).slice(0, 8000)
  const msgs = messages.slice(-10).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content).slice(0, 2000) }))
  if (!msgs.length || msgs[0].role !== 'user') msgs.unshift({ role: 'user', content: 'Hi' })
  try {
    const out = g ? await gemini(g, sys, msgs)
      : q ? await openaiLike('https://api.groq.com/openai/v1/chat/completions', q, process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', sys, msgs)
      : await openaiLike('https://api.openai.com/v1/chat/completions', o, process.env.OPENAI_MODEL || 'gpt-4o-mini', sys, msgs)
    return res.status(200).json(out)
  } catch (e) {
    return res.status(200).json({ error: e.message || 'AI request failed' })
  }
}
