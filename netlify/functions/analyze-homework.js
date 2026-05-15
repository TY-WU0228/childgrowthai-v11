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

Learning Level Awareness（學習水平資料）：
${JSON.stringify(body.learningContext || {}, null, 2)}

非常重要：

- V25 Auto-detect rule: 家長不需要每次手動填 worksheet level。請你優先從圖片上的標題、頁眉、頁腳、logo、書名、題目說明讀取年級或程度，例如 Year 3、Year 4、Grade 5、Extension、Challenge、QS、NAPLAN、Olympiad、Competition。
- 如果圖片上清楚見到 worksheet 年級，請直接使用你讀到的年級，並同 childCurrentYear 比較。
- 如果圖片上看不到年級，請寫「相片上未見到明確年級，因此只能按題目難度作初步估計」，不要亂估。
- 如果圖片上年級和手動補充資料不一致，請指出「圖片顯示」與「家長補充」可能不同，建議家長確認。

- 請同時比較「小朋友目前年級」和「呢份 worksheet 的程度」。
- 如果小朋友目前是 Year 2，但正在做 Year 3 / Year 4 / extension 題目，請清楚指出：這是高於目前年級常規要求的練習。
- 但不要輕易用「天才」、「資優」、「智商很高」等標籤。除非家長資料明確提供正式評估，否則只可寫「有延伸學習潛力」、「表現高於目前年級要求」、「值得同老師討論是否適合 extension」。
- 如果 worksheet level 高，但錯題較多，請分開講：以目前年級來說值得肯定；以該 worksheet level 來說仍需要鞏固哪些步驟。
- 不要只用錯題數評價能力，要考慮：題目程度、是否獨立完成、孩子感覺、家長備註、圖片清晰度。
- 對 gifted/enrichment 類情況，請提供穩陣培養方向：保持挑戰、重視思考過程、避免只追求超前、可同學校/老師討論 extension 或 enrichment。

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

V33 safety and parent-product rule:
- 如果家長提到讀寫困難、ADHD、情緒問題、焦慮、資優或高能力，只可以用「學習觀察」角度回應，不可作診斷。
- 不要寫「孩子有 ADHD / dyslexia / anxiety / gifted」這類結論；除非家長明確提供正式評估，否則只可寫「值得留意」、「可與老師或專業人士討論」。
- 每份 report 必須有一個很小、今晚就能做的 next step。
- 如果資料不足，請講清楚資料不足，而不是硬作長期結論。

V26 accuracy rule（避免前後矛盾）：
- 在「需要留意嘅位置」入面，只可以列出三類：明確計錯 / 未完成 / 圖片看不清需要覆核。
- 不可以把正確算式放入「可能錯」例子。例如 15+4=19、16+21=37 這類正確答案，不要用來支持「可能答錯」。
- 如果你舉例，必須先驗算該例子。正確例子要放在「已做得好的地方」，錯誤例子才可放在「需要覆核」。
- 如果沒有明確錯題，請寫「暫時未見到明確錯題，但有些位置因相片/塗改需要再覆核」。
- 用「需要覆核的位置」代替「可能錯題」，除非你能清楚看見錯誤。

輸出格式：

🌟 0. Learning level awareness
- 圖片上是否見到 worksheet 年級 / 程度：
- 以小朋友目前年級來看：
- 以呢份 worksheet 程度來看：
- 今次值得肯定的位置：
- 需要避免過度解讀的位置：

📌 1. 我大約睇到嘅功課內容
- 

⚠️ 2. 需要覆核的位置
- 只列：明確計錯 / 未完成 / 圖片看不清。
- 如果例子其實係正確，請不要放在這裡。
- 如有不確定，請寫明「呢部分相片未必睇得清楚，建議家長再對一對原題」。

✅ 2b. 已做得好的地方
- 可列 1-3 個明確做對或值得肯定的位置。

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
