exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { statusCode: 500, body: JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_ANON_KEY missing' }) };
  try {
    const body = JSON.parse(event.body || '{}');
    // Requires a table called family_records with columns: id uuid default gen_random_uuid(), payload jsonb, created_at timestamptz default now()
    const r = await fetch(`${url}/rest/v1/family_records`, {
      method: 'POST',
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ payload: body.app || body })
    });
    if (!r.ok) {
      const text = await r.text();
      return { statusCode: r.status, body: JSON.stringify({ error: text || 'Supabase insert failed. Table may not exist yet.' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ message: 'Saved to Supabase family_records table.' }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};