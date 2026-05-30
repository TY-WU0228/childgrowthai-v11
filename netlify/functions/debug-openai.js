// A1 (V95): This debug endpoint exposes whether OPENAI_API_KEY is configured,
// its key prefix and model count. It is now DISABLED by default and only
// responds when ENABLE_DEBUG_ENDPOINTS === '1' is explicitly set in the
// environment. In production it returns 404 so it cannot be probed.
exports.handler = async function() {
  if ((process.env.ENABLE_DEBUG_ENDPOINTS || '').trim() !== '1') {
    return json(404, { ok: false, error: 'Not found' });
  }
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
