exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return json(500, { error: 'OPENAI_API_KEY missing or invalid' });
    }

    const body = JSON.parse(event.body || '{}');
    const rawImages = collectImages(body).slice(0, 3);
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
      max_output_tokens: 2600
    };

    const first = await callOpenAI('https://api.openai.com/v1/responses', apiKey, payload, 35000);
    if (first.ok) {
      const text = first.data.output_text || extractResponsesText(first.data) || '未能生成分析。';
      const analysis = cleanParentText(text);
      return json(200, { analysis, report: buildStructuredHomeworkReport(analysis), model, route: 'responses', imageCount: images.length });
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
      max_tokens: 2600,
      temperature: 0.15
    };

    const second = await callOpenAI('https://api.openai.com/v1/chat/completions', apiKey, chatPayload, 35000);
    if (second.ok) {
      const text = second.data.choices?.[0]?.message?.content || '未能生成分析。';
      const analysis = cleanParentText(text);
      return json(200, { analysis, report: buildStructuredHomeworkReport(analysis), model: fallbackModel, route: 'chat-fallback', imageCount: images.length });
    }

    return json(second.status || first.status || 500, {
      error: friendlyError(second.data?.error?.message || first.data?.error?.message || 'OpenAI request failed'),
      debug: {responses:first.data?.error || first.error || null, chat:second.data?.error || second.error || null}
    });
  } catch (e) {
    return json(500, { error: friendlyError(e.message || String(e)) });
  }
};


function collectImages(body) {
  const out = [];
  if (Array.isArray(body.images)) out.push(...body.images);
  if (Array.isArray(body.imageDataList)) out.push(...body.imageDataList);
  if (body.image) out.push(body.image);
  if (body.homeworkImage) out.push(body.homeworkImage);
  return out.filter(Boolean);
}

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


V65 report quality rule:
- 必須完成所有章節，不要停在半句或只寫 summary。
- 如果看得清楚，請盡量指出具體題型：加法、減法、乘法、數列規律、family facts、speed and accuracy 等。
- 如果你能清楚看見某題答案，請先驗算，再判斷「做對 / 需要覆核」。不要把正確例子放入錯題。
- 如果看不清楚，不要硬講對錯，請寫「相片不夠清楚，建議覆核」。
- Report 要像補習老師俾家長的完整 feedback：先肯定，再指出 1-3 個重點，再給今晚很小的練習建議。

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



V70 final classification rule（最高優先）：
- 請你先在心入面把每一條 bullet 分成三類：GOOD / REVIEW / UNCLEAR。
- GOOD：答案正確、做得好、暫未見錯誤、成功推算、態度好。
- REVIEW：明確錯題、未完成、漏做、看不清要家長確認。
- 「需要覆核的位置」只可以出現 REVIEW / UNCLEAR，絕不可出現 GOOD。
- 「已做得好的地方」只可以出現 GOOD，絕不可出現明確錯題。
- 如果一句同時有「正確」和「正確應該係31 / 應該係31」，後者代表錯題，必須歸 REVIEW。
- 請不要為了填滿欄位而把正確題放入覆核；沒有明確錯就寫「暫未見明確錯題」。
V69 review separation rule（非常重要）：
- 「需要覆核的位置」絕對不可放正確答案或「Janice寫得正確」的句子。
- 如果一句包含「正確 / 寫得正確 / 暫時未見錯誤 / 成功推算 / 答對」，必須放入「已做得好的地方」或略過，不可放入覆核。
- 「需要覆核的位置」只可放三類：
  1) 【明確錯】例如 18+13=21，正確是31；
  2) 【需家長確認】例如手寫不清楚；
  3) 未完成 / 漏做。
- 如果一條 number pattern 是正確，例如 70,63,56,49,42,35,28，必須放在「已做得好的地方」。
- 不要把「其他答案暫未見錯誤」放入覆核，這應該放在「已做得好的地方」或「家長解讀」。
V68 balanced handwriting rule（非常重要）：
- 不要過度保守。清楚看見「題目、孩子答案、正確答案」時，錯題必須放入「需要覆核的位置」，不要放入「已做得好的地方」。
- 例如：18+13 正確是31，如果孩子清楚寫21，這是【明確錯】；應放入需要覆核。
- 例如：6×6=36、18+9+10=37、9,18,27,36,45,54,63 如答案正確，應放入已做得好的地方，不可放覆核。
- 「正確應該係31 / 應該係31 / Janice寫21」這類句子表示錯題，不是做得好。
- 只有看不清手寫時，才用【需家長確認】。

- 你不是正式批改老師；鉛筆字可能被你讀錯。不要用「明顯計錯」這種絕對語氣，除非印刷題目和手寫答案都 95% 清楚。
- 「需要覆核的位置」只可放：
  1) 你非常清楚看見的錯誤，並標示【明確錯】；
  2) 你看不清楚或可能誤讀的答案，並標示【需家長確認】；
  3) 未完成。
- 如果你自己寫了「答對 / 正確 / Janice 答啱」，該項必須放在「已做得好的地方」，不可放在「需要覆核」。
- 對 6×6、18+9+10、Number Pattern 這類題，必須先用心算驗算；答案正確就不要列入覆核。
- 如看起來像 16 / 36、21 / 31、手寫有陰影或角度不清，請寫「AI 可能讀錯手寫，建議家長對原圖」，不要判錯。

V66 final report rule（必須跟）：
- 必須完成 0 至 6 所有章節，不要在半句中停止。
- 每個章節最多 3-5 點，寧願短但完整，不要長到被截斷。
- 如果圖片清晰，請盡量講具體題型，例如 Speed & Accuracy、加減乘除、Number Patterns、family facts、等差/等差減數。
- 如果看見孩子答案，先驗算再講。正確答案要放「已做得好的地方」，看不清或疑似錯才放「需要覆核」。
- 對 Year 2 做 Year 3 worksheet，要寫成「高於目前年級的挑戰，值得肯定，但仍要穩步鞏固」，不要寫天才/資優。
- 最後必須提供一個今晚可做的小步驟。

輸出格式：

🌟 0. Learning level awareness
- 圖片上是否見到 worksheet 年級 / 程度：
- 以小朋友目前年級來看：
- 以呢份 worksheet 程度來看：
- 今次值得肯定的位置：
- 需要避免過度解讀的位置：

📌 1. 我大約睇到嘅功課內容
- 

⚠️ 2. 需要覆核的位置（只放【明確錯】、【需家長確認】或未完成；正確 / 暫未見錯誤不可放這裡）
- 只列：95% 清楚的明確錯 / 未完成 / 圖片看不清。
- 如果例子其實係正確，必須移到「已做得好的地方」，不要放在這裡。
- 如有不確定，請寫明「【需家長確認】AI 可能讀錯手寫，建議家長再對一對原題」。

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


function sectionBetween(raw, startMarkers, endMarkers) {
  const text = String(raw || '');
  let start = -1;
  let marker = '';
  for (const m of startMarkers) {
    const i = text.indexOf(m);
    if (i >= 0 && (start < 0 || i < start)) { start = i; marker = m; }
  }
  if (start < 0) return '';
  const from = start + marker.length;
  let end = text.length;
  for (const m of endMarkers) {
    const i = text.indexOf(m, from);
    if (i >= 0 && i < end) end = i;
  }
  return text.slice(from, end).replace(/^[:：\s-]+/, '').trim();
}
function bulletsFrom(section, max = 5) {
  return String(section || '')
    .split(/\n+/)
    .map(x => x.replace(/^[\s\-•*]+/, '').trim())
    .filter(Boolean)
    .slice(0, max);
}
function firstUsefulLine(section) {
  return String(section || '')
    .split(/\n+/)
    .map(x => x.replace(/^[\s\-•*]+/, '').trim())
    .find(Boolean) || '';
}

function isPositiveReviewLine(line) {
  const s = String(line || '');
  if (/明確錯|需家長確認|需要覆核|應該係|應為|應是|正確應該|Janice 寫\s*\d+|AI 疑似讀到|疑似錯|計錯|錯誤/.test(s)) return false;
  return /答對|答啱|正確|寫得正確|答案正確|已做對|全部正確|成功推算|順利找到|未見錯誤|暫時未見到錯誤|未見到錯誤|值得肯定|做得好|right|correct/i.test(s);
}
function isClearErrorLine(line) {
  const s = String(line || '');
  return /正確應該係|應該係|應為|應是|Janice\s*寫|寫\s*\d+|明確錯/.test(s) && /[0-9]/.test(s);
}
function softenReviewLine(line) {
  let s = String(line || '').trim();
  if (!s) return '';
  if (isClearErrorLine(s)) {
    return s.replace(/請家長確認：/g, '').replace(/【需家長確認】/g, '【明確錯】');
  }
  s = s.replace(/明顯計錯/g, 'AI 視覺疑似需要家長確認');
  s = s.replace(/明確計錯/g, 'AI 視覺疑似需要家長確認');
  s = s.replace(/計錯/g, '疑似需覆核');
  s = s.replace(/Janice 寫/g, 'AI 疑似讀到 Janice 寫');
  if (!/(家長|覆核|確認|看不清|不清|疑似)/.test(s)) {
    s = '請家長確認：' + s;
  }
  return s;
}
function classifyReviewLineV69(line) {
  const s = String(line || '').trim();
  if (!s) return 'empty';
  if (isPositiveReviewLine(s)) return 'positive';
  if (/未見錯誤|暫時未見到錯誤|其餘答案|都能清楚看到|大部分.*正確/.test(s)) return 'positive';
  if (/明確錯|正確應該係|應該係|應為|應是|Janice\s*寫|寫\s*\d+/.test(s) && /[0-9]/.test(s)) return 'review';
  if (/需家長確認|看不清|不清楚|未完成|漏|空白/.test(s)) return 'review';
  return 'review';
}
function cleanReviewPoints(points) {
  const movedToGood = [];
  const review = [];
  (Array.isArray(points) ? points : []).forEach(p => {
    const s = String(p || '').trim();
    if (!s) return;
    const cls = classifyReviewLineV69(s);
    if (cls === 'positive') movedToGood.push(s.replace(/^[-•\s]+/, ''));
    else if (cls === 'review') review.push(softenReviewLine(s));
  });
  return { review, movedToGood };
}


function normalizeReportLine(line) {
  return String(line || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}
function classifyReportLineV70(line, source = '') {
  const s = normalizeReportLine(line);
  if (!s) return 'empty';
  if (/明確錯|正確應該係|正確應是|正確是|應該係|應為|應是|答案應該|答案應為/.test(s) && /[0-9]/.test(s)) return 'review';
  if (/Janice\s*(寫|答).{0,12}\d+/.test(s) && /(正確應該|應該係|應為|應是|明確錯)/.test(s)) return 'review';
  if (/需家長確認|需要家長確認|看不清|睇唔清|不清楚|未完成|漏做|空白|未填|漏填/.test(s)) return 'review';
  if (/答對|答啱|寫得正確|答案正確|正確完成|已做對|全部正確|成功推算|順利找到|未見錯誤|暫未見錯誤|暫時未見到錯誤|未見到錯誤|都正確|做得好|值得肯定|right|correct/i.test(s)) return 'good';
  if (/其餘答案|其他答案|大部分答案/.test(s) && /正確|未見錯|清楚/.test(s)) return 'good';
  return source === 'review' ? 'review' : 'good';
}
function reviewLineV70(line) {
  const s = normalizeReportLine(line);
  if (!s) return '';
  if (/明確錯|需家長確認/.test(s)) return s;
  if (/正確應該係|正確應是|正確是|應該係|應為|應是|答案應該|答案應為/.test(s) && /[0-9]/.test(s)) return '【明確錯】 ' + s;
  if (/看不清|睇唔清|不清楚|未完成|漏做|空白|未填|漏填/.test(s)) return '【需家長確認】 ' + s;
  return '【需家長確認】 ' + s;
}
function uniqueLinesV70(arr) {
  const seen = new Set();
  return (arr || []).map(normalizeReportLine).filter(Boolean).filter(x => {
    const key = x.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function sanitizeStructuredReportV70(report) {
  const goods = [];
  const reviews = [];
  const sourceGood = Array.isArray(report.strengths) ? report.strengths : bulletsFrom(report.strengths || '', 4);
  const sourceReview = Array.isArray(report.checkPoints) ? report.checkPoints : bulletsFrom(report.checkPoints || '', 6);
  sourceGood.forEach(line => {
    const cls = classifyReportLineV70(line, 'good');
    if (cls === 'review') reviews.push(reviewLineV70(line));
    else if (cls === 'good') goods.push(normalizeReportLine(line));
  });
  sourceReview.forEach(line => {
    const cls = classifyReportLineV70(line, 'review');
    if (cls === 'good') goods.push(normalizeReportLine(line));
    else if (cls === 'review') reviews.push(reviewLineV70(line));
  });
  report.strengths = uniqueLinesV70(goods).slice(0, 6);
  report.checkPoints = uniqueLinesV70(reviews).slice(0, 6);
  return report;
}

function buildStructuredHomeworkReport(raw) {
  const text = cleanParentText(raw || '');
  const level = sectionBetween(text, ['🌟 0. Learning level awareness', '0. Learning level awareness', 'Learning level awareness'], ['📌 1.', '1. 我大約', '⚠️ 2.']);
  const content = sectionBetween(text, ['📌 1. 我大約睇到嘅功課內容', '1. 我大約睇到嘅功課內容', '我大約睇到嘅功課內容'], ['⚠️ 2.', '✅ 2b.', '🧠 3.']);
  const check = sectionBetween(text, ['⚠️ 2. 需要覆核的位置', '2. 需要覆核的位置', '需要覆核的位置'], ['✅ 2b.', '🧠 3.', '💬 4.']);
  const good = sectionBetween(text, ['✅ 2b. 已做得好的地方', '2b. 已做得好的地方', '已做得好的地方'], ['🧠 3.', '💬 4.', '📈 5.']);
  const reason = sectionBetween(text, ['🧠 3. 可能出錯原因', '3. 可能出錯原因', '可能出錯原因'], ['💬 4.', '📈 5.', '✅ 6.']);
  const parent = sectionBetween(text, ['💬 4. 給家長的簡短解讀', '4. 給家長的簡短解讀', '給家長的簡短解讀'], ['📈 5.', '✅ 6.']);
  const longTerm = sectionBetween(text, ['📈 5. 長期觀察重點', '5. 長期觀察重點', '長期觀察重點'], ['✅ 6.']);
  const tips = sectionBetween(text, ['✅ 6. 下次做題小貼士', '6. 下次做題小貼士', '下次做題小貼士'], []);
  const rawStrengths = bulletsFrom(good, 4);
  const cleanedReview = cleanReviewPoints(bulletsFrom(check, 6));
  const report = {
    title: 'AI 功課分析',
    shortSummary: firstUsefulLine(parent) || firstUsefulLine(level) || text.slice(0, 180),
    summary: content || text.slice(0, 420),
    levelAwareness: level || '已按圖片內容和目前年級作初步觀察；如圖片清楚顯示 Year 3 / extension，應肯定孩子正在挑戰較高水平。',
    strengths: [...rawStrengths, ...cleanedReview.movedToGood].slice(0, 6),
    checkPoints: cleanedReview.review,
    reasons: bulletsFrom(reason, 5),
    parentInterpretation: parent,
    longTermFocus: bulletsFrom(longTerm, 4),
    nextStep: firstUsefulLine(tips) || '今晚只揀一題最有代表性的題目慢慢講解。',
    confidence: 'medium',
    rawAnalysis: text
  };
  return sanitizeStructuredReportV70(report);
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
