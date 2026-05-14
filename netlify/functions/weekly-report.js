exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey || !apiKey.startsWith('sk-')) return json(500, { error: 'OPENAI_API_KEY missing or invalid' });

    const body = JSON.parse(event.body || '{}');
    const records = Array.isArray(body.records) ? body.records.slice(-40) : [];

    const prompt = `你是 ChildGrowth AI 的香港家長學習顧問。
請根據以下最近記錄，寫一份自然、實用、唔嚇人的每週學習小結。

記錄：
${JSON.stringify(records, null, 2)}

要求：
- 用香港家長容易明白的自然中文。
- 不要列一大堆 raw emotion taps；請先整理成「每日情緒概況」。
- 如果資料不足，請直接講「目前記錄未夠多」，但仍然給 1-3 個很小的下星期行動。
- 不要用 AI 味字眼。
- 重點要實用，不要太長。
- 報告語氣要像有經驗的補習老師 / 家長顧問，不要像系統 log。
- 如果記錄中有重複點擊，請提醒「重複 tap 未必代表真實情緒」。

輸出格式：

🌟 本週整體觀察
-

📚 學習重點
-

😊 做題狀態 / 情緒觀察
-

🎯 下星期建議
-

💬 給家長一句提醒
-`;

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
        max_output_tokens: 900
      })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return json(resp.status, { error: data.error?.message || 'OpenAI request failed' });

    const report = data.output_text || extractResponsesText(data) || '未能生成週報。';
    return json(200, { report });
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
