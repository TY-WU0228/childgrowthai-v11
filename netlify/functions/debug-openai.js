exports.handler = async function() {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey || !apiKey.startsWith('sk-')) return json(500, { ok: false, error: 'OPENAI_API_KEY missing or not starting with sk-' });
  try {
    const resp = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${apiKey}` } });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return json(resp.status, { ok: false, error: data.error?.message || 'OpenAI auth failed' });
    return json(200, { ok: true, message: 'OpenAI API key is readable by Netlify Function.', keyPrefix: apiKey.slice(0, 7), modelCount: Array.isArray(data.data) ? data.data.length : null });
  } catch (e) { return json(500, { ok: false, error: e.message }); }
};
function json(statusCode, obj) { return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(obj) }; }
