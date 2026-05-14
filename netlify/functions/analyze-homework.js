exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return json(500, { error: 'OPENAI_API_KEY missing or invalid' });
    }

    const body = JSON.parse(event.body || '{}');
    const rawImages = Array.isArray(body.images) ? body.images.slice(0, 3) : [];
    const images = rawImages.map(cleanImageDataUrl).filter(Boolean);

    if (!images.length) {
      return json(400, { error: '未收到有效圖片。請先用一張清晰 JPG/PNG 功課相測試。' });
    }

    const prompt = buildHKParentTonePrompt(body);

    const model = process.env.OPENAI_MODEL || 'gpt-4.1';
    const payload = {
      model,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          ...images.map(url => ({ type: 'input_image', image_url: url }))
        ]
      }],
      max_output_tokens: 1300
    };

    const first = await callOpenAI('https://api.openai.com/v1/responses', apiKey, payload, 35000);
    if (first.ok) {
      const text = first.data.output_text || extractResponsesText(first.data) || '未能生成分析。';
      return json(200, { analysis: cleanParentText(text), model, route: 'responses', imageCount: images.length });
    }

    // Fallback route
    const fallbackModel = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4.1-mini';
    const chatPayload = {
      model: fallbackModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...images.map(url => ({ type: 'image_url', image_url: { url } }))
        ]
      }],
      max_tokens: 1300,
      temperature: 0.15
    };

    const second = await callOpenAI('https://api.openai.com/v1/chat/completions', apiKey, chatPayload, 35000);
    if (second.ok) {
      const text = second.data.choices?.[0]?.message?.content || '未能生成分析。';
      return json(200, { analysis: cleanParentText(text), model: fallbackModel, route: 'chat-fallback', imageCount: images.length });
    }

    return json(second.status || first.status || 500, {
      error: friendlyError(second.data?.error?.message || first.data?.error?.message || 'OpenAI request failed')
    });
  } catch (e) {
    return json(500, { error: friendlyError(e.message || String(e)) });
  }
};

function buildHKParentTonePrompt(body) {
  return `你是 ChildGrowth AI 的「香港小學補習老師 + 家長學習顧問」。

請分析上傳的功課 / worksheet 圖片，然後用香港家長容易明白的自然中文回覆。

小朋友資料：
${JSON.stringify(body.child || {})}

科目：${body.subject || ''}
完成狀態：${body.status || ''}
家長備註：${body.note || ''}

非常重要規則：
1. 不要扮 OCR 100% 準。如果圖片模糊、角度歪、字太細，請清楚講「我未必睇得清楚」。
2. 不要亂推斷。看不到的內容不要當成事實。
3. 如果答案可能不清楚，請用「似乎」、「有機會」、「建議再對一對原題」。
4. 中文要自然，像補習老師 WhatsApp feedback，不要像機械翻譯。
5. 避免使用以下 AI 味字眼：
   - friction / 摩擦
   - signal / confidence_signal / fatigue_signal
   - analytics
   - pattern inconsistency
   - internal reasoning
   - concept gap
6. 請改用自然說法：
   - 下次做題小貼士
   - 今次答題狀態
   - 容易忽略的位置
   - 建議慢一步確認
   - 題目資訊不足，不能直接推斷
   - 理解位需要再鞏固
7. 如果有英文 true/false / all/most/some 題，請用邏輯自然中文解釋：
   - 例如「題目只講部分情況，不能推斷所有情況都成立。」
   - 不要寫「題干冇提過全部冇花」這類生硬句子。
8. 家長看到後要覺得：清楚、溫和、實用、可信。

輸出格式：

📌 1. 我大約睇到嘅功課內容
- 

⚠️ 2. 需要留意嘅位置
- 如有不確定，請寫明「呢部分相片未必睇得清楚，建議家長再對一對原題」。

🧠 3. 可能出錯原因
- 粗心：
- 理解位：
- 閱讀題目：
- 做題狀態：

💬 4. 給家長的簡短解讀
- 用 2-4 句自然中文，像補習老師同家長講。

📈 5. 長期觀察重點
- 科目 / 題型：
- 今次主要小心位：
- 下次可留意：

✅ 6. 下次做題小貼士
- 只列 2-3 個最實用做法。`;
}

function cleanImageDataUrl(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/\s/g, '');
  const match = s.match(/^data:image\/(png|jpg|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i);
  if (match) {
    const ext = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
    const b64 = match[2];
    if (b64.length < 100) return null;
    return `data:image/${ext};base64,${b64}`;
  }
  if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 100) return `data:image/jpeg;base64,${s}`;
  return null;
}

async function callOpenAI(url, apiKey, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, data };
  } catch (e) {
    return { ok: false, status: 500, data: { error: { message: e.name === 'AbortError' ? 'AI 分析逾時，請先用一張清晰相片再試。' : e.message } } };
  } finally {
    clearTimeout(timer);
  }
}

function extractResponsesText(data) {
  try {
    const out = [];
    for (const item of data.output || []) {
      for (const c of item.content || []) if (c.text) out.push(c.text);
    }
    return out.join('\n').trim();
  } catch { return ''; }
}

function cleanParentText(text) {
  return String(text || '')
    .replace(/confidence_signal/gi, '答題狀態')
    .replace(/fatigue_signal/gi, '精神狀態')
    .replace(/concept gap/gi, '理解位')
    .replace(/friction|摩擦/gi, '操作阻力')
    .replace(/pattern inconsistency/gi, '規律掌握不穩')
    .trim();
}

function friendlyError(msg) {
  if (!msg) return '未知 AI 錯誤。';
  if (/credit|quota|billing|insufficient/i.test(msg)) return 'OpenAI credit / billing 可能不足，請檢查 API credit。';
  if (/Incorrect API key|invalid api key|Unauthorized|401/i.test(msg)) return 'OpenAI API key 無效，請重新建立 secret key 後 redeploy。';
  if (/pattern/i.test(msg)) return '圖片格式或 API 格式問題。請先用一張清晰 JPG 相片測試。';
  return msg;
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(obj) };
}
