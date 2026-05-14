exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey || !apiKey.startsWith('sk-')) return json(500, { error: 'OPENAI_API_KEY missing or invalid' });

    const body = JSON.parse(event.body || '{}');
    const comment = (body.comment || '').trim();
    if (!comment) return json(400, { error: '請先輸入老師 comment。' });

    const prompt = `你是香港小學補習老師，請幫家長解讀老師 comment。

老師 comment:
${comment}

小朋友資料:
${JSON.stringify(body.child || {})}

語氣要求：
- 用香港家長自然中文。
- 像補習老師 WhatsApp feedback。
- 不要太嚴厲，不要嚇家長。
- 不要用 AI 味字眼，例如 signal、friction、analytics、pattern inconsistency。
- 重點係：家長今晚可以點做。

輸出格式：

👩‍🏫 1. 老師 comment 重點
-

🧠 2. 可能反映嘅學習 / 情緒狀態
-

⚠️ 3. 家長需要留意
-

💬 4. 可以點樣回應老師
-

✅ 5. 今晚一個小行動
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
    const analysis = data.output_text || extractResponsesText(data) || '未能生成分析。';
    return json(200, { analysis: cleanText(analysis) });
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
function cleanText(text) {
  return String(text || '').replace(/signal/gi, '狀態').replace(/friction|摩擦/gi, '操作阻力').trim();
}
function json(statusCode, obj) {
  return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(obj) };
}
