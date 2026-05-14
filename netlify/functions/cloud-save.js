exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || (!anonKey && !serviceKey)) {
    return json(500, {
      code: 'ENV_MISSING',
      message: 'SUPABASE_URL and key are required.',
      error: 'SUPABASE_URL or SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY missing'
    });
  }

  const key = serviceKey || anonKey;
  const mode = serviceKey ? 'server service role mode' : 'anon MVP mode';

  try {
    const body = JSON.parse(event.body || '{}');

    const r = await fetch(`${url}/rest/v1/family_records`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        payload: body.app || body,
        app_version: body.appVersion || 'ChildGrowthAI',
        source: 'netlify-function'
      })
    });

    if (!r.ok) {
      const text = await r.text();
      const isTableMissing = /family_records|PGRST205|schema cache/i.test(text);
      return json(r.status, {
        code: isTableMissing ? 'TABLE_MISSING' : 'SUPABASE_INSERT_FAILED',
        message: isTableMissing
          ? 'Supabase connected, but public.family_records table was not found.'
          : 'Supabase insert failed.',
        technical: text || 'Supabase insert failed.',
        mode
      });
    }

    return json(200, {
      message: 'Saved to Supabase family_records table.',
      mode
    });
  } catch (e) {
    return json(500, {
      code: 'SERVER_ERROR',
      message: e.message || String(e),
      technical: e.stack || e.message || String(e),
      mode
    });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(obj)
  };
}
