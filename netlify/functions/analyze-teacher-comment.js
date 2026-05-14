exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey || !apiKey.startsWith('sk-')) return json(500, { error: 'OPENAI_API_KEY missing or invalid' });

    const body = JSON.parse(event.body || '{}');
    const comment = (body.comment || '').trim();
    if (!comment) return json(400, { error: 'Please enter a teacher comment first.' });

    const prompt = `You are ChildGrowth AI. Analyse this teacher comment for a parent.

Child profile:
${JSON.stringify(body.child || {})}

Teacher comment:
${comment}

Use Traditional Chinese. Be practical, calm, and parent-friendly.
Return this structure:

👩‍🏫 1. 老師 comment 重點
-

🧠 2. 可能反映嘅學習 / 情緒狀態
-

⚠️ 3. 需要家長留意
-

💬 4. 家長可以點樣回應老師
-

✅ 5. 今晚可以做嘅一個小行動
-`;

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
        max_output_tokens: 800
      })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return json(resp.status, { error: data.error?.message || 'OpenAI request failed' });
    const analysis = data.output_text || extractResponsesText(data) || 'No analysis returned.';
    return json(200, { analysis });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};

function extractResponsesText(data) {
  try {
    const out = [];
    for (const item of data.output || []) {
      for (const c of item.content || []) if (c.text) out.push(c.text);
    }
    return out.join('\n').trim();
  } catch { return ''; }
}
function json(statusCode, obj) {
  return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(obj) };
}
