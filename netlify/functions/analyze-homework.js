// V93 Report Integrity - parent fail-safe and clean review evidence
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return json(500, { error: 'OPENAI_API_KEY missing or invalid' });
    }

    const body = JSON.parse(event.body || '{}');
    const images = collectImages(body).slice(0, 6);
    const approxKB = Math.round(JSON.stringify(images).length / 1024);
    if (approxKB > 5200) {
      return json(413, { error: `圖片傳送太大（約 ${approxKB}KB）。請先用「只分析第一張」，或重新拍攝較清晰、較少反光的相片。`, debug:{approxKB} });
    }

    if (!images.length) {
      return json(400, { error: '未收到有效圖片。請先用一張清晰 JPG/PNG 功課相測試。' });
    }

    const prompt = buildHKParentTonePrompt(body);
    const aiMode = String(body.aiMode || 'fast').toLowerCase();
    const reliabilityMode = String(body.reliabilityMode || 'v83');
    // V83: fast mode ignores OPENAI_MODEL if that env is set to a slow model such as gpt-4.1.
    // Use OPENAI_QUALITY_MODEL only when explicitly requested.
    const model = aiMode === 'quality'
      ? (process.env.OPENAI_QUALITY_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1')
      : (process.env.OPENAI_FAST_MODEL || 'gpt-4.1-mini');
    const timeoutMs = Number(process.env.OPENAI_HOMEWORK_TIMEOUT_MS || '') || (images.length <= 1 ? 22000 : 18000);
    const maxTokens = Number(process.env.OPENAI_HOMEWORK_MAX_TOKENS || '') || (aiMode === 'quality' ? 1800 : 1250);
    const payload = {
      model,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          ...images.map(url => ({ type: 'input_image', image_url: url }))
        ]
      }],
      max_output_tokens: maxTokens,
      // V96.20: pin decoding to reduce same-photo report variance on fresh
      // analysis. Default temperature (~1.0) caused large run-to-run swings in
      // detected question/stable counts for the same homework photo.
      temperature: 0
    };

    const first = await callOpenAI('https://api.openai.com/v1/responses', apiKey, payload, timeoutMs);
    if (first.ok) {
      const text = first.data.output_text || extractResponsesText(first.data) || '未能生成分析。';
      const analysis = cleanParentText(text);
      return json(200, { analysis, report: buildStructuredHomeworkReport(analysis), model, route: 'responses-v83', imageCount: images.length, debug:{timeoutMs,approxKB,aiMode,reliabilityMode,maxTokens,rawOutputTextSample:text,cleanedOutputTextSample:analysis} });
    }

    const firstErr = first.data?.error?.message || first.error || '';
    if (/逾時|timeout|aborted|AbortError/i.test(firstErr)) {
      return json(504, { error: 'AI 暫時未能完成分析。請先用「只分析第一張」，或重新拍攝較清晰、較少反光的相片。', debug: { responses:first.data?.error || first.error || null, timeoutMs, approxKB, model, aiMode, reliabilityMode } });
    }

    // Fallback route
    const fallbackModel = process.env.OPENAI_FALLBACK_MODEL || process.env.OPENAI_FAST_MODEL || 'gpt-4.1-mini';
    const chatPayload = {
      model: fallbackModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...images.map(url => ({ type: 'image_url', image_url: { url } }))
        ]
      }],
      max_tokens: Math.min(maxTokens, 1200),
      // V96.20: pin fallback decoding too, with a fixed seed for reproducibility.
      temperature: 0,
      seed: 7
    };

    const second = await callOpenAI('https://api.openai.com/v1/chat/completions', apiKey, chatPayload, Math.min(timeoutMs, 14000));
    if (second.ok) {
      const text = second.data.choices?.[0]?.message?.content || '未能生成分析。';
      const analysis = cleanParentText(text);
      return json(200, { analysis, report: buildStructuredHomeworkReport(analysis), model: fallbackModel, route: 'chat-fallback-v83', imageCount: images.length, debug:{timeoutMs,approxKB,aiMode,reliabilityMode,maxTokens:Math.min(maxTokens,1200),rawOutputTextSample:text,cleanedOutputTextSample:analysis} });
    }

    return json(second.status || first.status || 500, {
      error: friendlyError(second.data?.error?.message || first.data?.error?.message || second.error || first.error || 'OpenAI request failed'),
      debug: {responses:first.data?.error || first.error || null, chat:second.data?.error || second.error || null}
    });
  } catch (e) {
    return json(500, { error: friendlyError(e.message || String(e)) });
  }
};


function collectImages(body) {
  const raw = [];
  if (Array.isArray(body.images)) raw.push(...body.images);
  if (Array.isArray(body.imageDataList)) raw.push(...body.imageDataList);
  if (body.image) raw.push(body.image);
  if (body.homeworkImage) raw.push(body.homeworkImage);

  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const cleaned = cleanImageDataUrl(item);
    if (!cleaned) continue;
    const key = cleaned.length + ':' + cleaned.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function buildHKParentTonePrompt(body) {
  const child = body.child || {};
  const context = body.learningContext || {};
  return `你是 ChildGrowth AI 的「香港小學補習老師 + 家長學習顧問」。

請分析上傳的功課 / worksheet 圖片，用香港家長容易明白的自然中文回覆。
語氣：清楚、溫和、實用、可信。不要像機械翻譯。

小朋友資料：
${JSON.stringify(child)}

家長備註：
${body.note || body.text || ''}

Learning context：
${JSON.stringify(context, null, 2)}

V86 Parent Report Polish rules:
- "Learning level awareness" should be parent-facing as "程度觀察"; keep wording short.
- Remove section-heading leakage: never output "3. 需要覆核的位置" inside "已做得好的地方".
- For parent beta, the report must feel helpful within the first 10 seconds.
- When answers are not visible, say "需要家長確認"; do not guess.
- For past/present worksheets, focus on task requirement misunderstanding: child may be changing verbs instead of writing the label "past/present".
- Strong area should describe what the child actually did well. Review area should only include real mistakes/unclear/incomplete items.
- No debug, model names, QA score, JSON, function wording or version wording in parent report.

V85 Beta Parent Mode rules:
- Parent report must not mention model, QA score, trial readiness, debug, JSON, technical evidence, or version number.
- Do not put section headings such as "3. 需要覆核的位置" inside "已做得好的地方".
- Strong skills and review skills must not repeat the same skill unless there is real question-level evidence.
- If worksheet instruction says "write past or present", evaluate whether the child wrote the required label (past/present), not whether they changed the verb.
- If child changes the verb instead of writing past/present, identify this as "reading instruction / task requirement misunderstanding" plus "present vs past tense".
- "今晚只做一件事" must name one concrete question or action the parent can do in 5 minutes.
- For word search/spelling pages: word search success can be a strength; tense/past-present errors should be review.

Trial-ready / Wow report rules:
- 第一屏要能產生「家長 wow 感」：一句說明孩子今日最值得留意的能力或覆核點。
- 如果 AI 未能看到學生答案，不能寫「全部正確」。
- 如果分析不完整，要清楚寫「初步觀察 / 需要補相」，不要扮完整。
- Report quality 不是越高越好；證據不足時 confidence 要 Low 或 Medium。
- 每份 report 最後的 next step 要像補習老師 WhatsApp：細、具體、今晚能做到。


V93 Report Integrity rules:
- Parent report must never mention JSON, function, API, OpenAI, model, route, debug, timeout, retry, V83/V92/V93, schema or technical evidence.
- If any image is not fully analysed, say clearly that this is a partial / incomplete observation and do not pretend it is a complete report.
- Parent-facing report should be short: Wow summary 1-2 sentences, parent interpretation 2-4 sentences, next step one concrete action.
- Section 3 must only contain exact review items. Do not put general summaries, causes, learning observations, or confidence statements in Section 3.
- A review item must include at least a question/position, student answer if visible, correct/expected answer if determinable, and status wrong/unclear/missing.
- Do not write “有 X 個位置值得覆核” unless X items are actually listed in Section 3.

V93 Review Detail rules:
- 如果你寫「X 個位置值得覆核」，必須逐條列出 X 個位置；不能只寫原因。
- 「需要覆核的位置」每一行必須是具體題目 / 位置，不可以是泛泛原因。
- 格式必須盡量用：Page ? | Q: ... | Student: ... | Correct: ... | Status: wrong/unclear/missing | Skill: ... | Sub-skill: ...
- 明確錯、看不清、未完成要分清楚。
- 正確題不可放入「需要覆核的位置」；如果一句包含「正確 / 無需覆核 / 目前答案正確」，不可標為【明確錯】。
- 數學題要優先用 code-like mental check：重新計一次正確答案，再判斷 wrong/correct。
- 如果是多頁功課，所有 wrong / unclear / missing 都要列出；正確題可只在做得好概括。

Parent-facing report rules:
- 家長第一眼要清楚：做得好、真正要覆核、今晚做一件事。
- 如果選擇題全部正確，不要硬寫 careless / rushing / instruction reading / handwriting unclear 做 review skills。
- 「需要覆核的位置」只放：明確錯、看不清、未完成、無法判斷答案。不要放「可能出錯原因」「粗心/心急」「做題狀態」。
- Reading comprehension 請逐題抽取：Question focus, Student answer, Correct answer, Result, Evidence reason。（用 "Student" 作標籤，不要寫死任何特定小朋友名）
- 如果未見學生答案，不要同時寫「全部正確」；要寫「需要家長補充答案相」。
- Growth Memory tags 不要使用 general。要用 tone, identifying recipients, purpose, details/following instructions 等具體 tags。

Homework Engine v2.1 流程：\nA. Extract：先逐頁讀出題目、學生答案、正確答案或可推算答案、confidence。\nB. Mark：數學基礎題要清楚標示 correct / wrong / unclear；不確定就寫【需家長確認】。\nC. Report：只根據 Extract/Mark 結果寫家長 report。\nD. Skill Trend：每個 evidence 都要盡量標 skill + sub-skill；不要輸出 general/general。
E. Clean Evidence：不要把 section heading、可能出錯原因、給家長解讀、暫未見明確錯題當成 evidence。\n\n最高優先規則：
1. 先看圖片上是否有 Year / Level / Grade / Term / worksheet 標題。看不到就講「相片上未見明確年級」。
2. 比較 worksheet level 和小朋友目前年級，但不要講「資優 / 智力高 / 智力低」。
3. 你不是正式批改老師；鉛筆字、陰影、角度可能令你誤讀。看不清就寫【需家長確認】。
4. 「已做得好的地方」只放正確 / 做得好 / 成功推算 / 暫未見錯誤。不要把任何錯題放入這裡。
5. 「需要覆核的位置」只放【明確錯】、【需家長確認】、未完成 / 漏做。正確題、暫無錯、答案正確、無需覆核、目前答案正確不可放入這裡；如果你寫了『其實是正確答案』，就絕對不可標為【明確錯】。
6. 如果你在任何段落提到「18+13寫咗21」或「正確應該係31」，一定要在需要覆核列出【明確錯】18+13=21，正確應為31。
7. 如果一句有「寫得正確 / 答對 / 成功推算 / 暫未見錯誤」，不可放入需要覆核。
8. 每個判斷要有證據：我見到咩，所以推論咩。
9. 不作醫療、心理、讀寫障礙、ADHD 或資優診斷。
10. 最後一定要有「今晚只做一件事」，要非常具體。

請按以下格式完整輸出，不要漏章節；內容要短而準，每段最多 3 點，不要把不同 section 混在同一段：

✨ Parent Wow Summary
- 用 1 句講今日最值得家長留意的能力 / 覆核點；不可空泛。

🔎 Engine v2 Extracted Evidence
- 每頁最多列 12 題；所有 wrong / unclear / missing 必須列出。格式：Page 1 | Q: 18+13 | Student: 21 | Correct: 31 | Status: wrong | Skill: Addition | Sub-skill: carrying addition | Confidence: high
- 如果是英文 multiple choice，用格式：Page 1 | Q: purpose of letter | Student: A | Correct: A | Status: correct | Skill: Reading Comprehension | Sub-skill: purpose | Confidence: medium
- 看不清就 Status: unclear，不要硬估。
- V96.22 題目級數計算：每一條 worksheet 題目只輸出一行 evidence，要對應 worksheet 上實際的題號（a、b、c… 或 Q1、Q2…）。同一條題目唔可以拆成幾行。
- 「圈出較大／circle the greater value」呢類比較題：每一條比較題只輸出一行，用該題題號（例如 Q2 a），唔好將被比較的兩個算式（例如 2×9 同 4×6）當成兩條獨立題目分開列。一條比較題 = 一條題目。

🌟 0. Learning level awareness
- 圖片上是否見到 worksheet 年級 / 程度：
- 以小朋友目前年級來看：
- 以呢份 worksheet 程度來看：
- 今次值得肯定的位置：
- 需要避免過度解讀的位置：

📌 1. 我大約睇到嘅功課內容
- 最多 3 點 bullet，不要寫長段落，不要混入「做得好 / 需要覆核」內容。
- 英文閱讀請只概括題型，不要把所有答案塞成一段。
- 請列出具體題型，例如 addition / multiplication / number patterns / reading comprehension / spelling 等。

✅ 2. 已做得好的地方
- 只列真正做對、掌握到、值得肯定的位置。

⚠️ 3. 需要覆核的位置
- 【明確錯】清楚錯題，必須寫出題號/位置、學生答案、正確答案；不要只寫原因。
- 【需家長確認】看不清、手寫有陰影、未能肯定；必須寫出是哪一題/哪個位置。
- 【未完成】漏做 / 空白。
- 如果沒有明確錯，請寫「暫未見明確錯題」。

🧠 4. 可能出錯原因
- 粗心 / 心急：
- 理解位：
- 閱讀題目：
- 做題狀態：

💬 5. 給家長的簡短解讀
- 2-4 句，像補習老師 WhatsApp feedback。

✅ 6. 今晚只做一件事
- 只列一個今晚可以做到的小步驟。

🏷️ 7. Growth Memory Tags
- subject:
- worksheetLevel:
- skillsStrong: 只放具體 skill，例如 reading detail / purpose / tone / carrying addition；不要放 general
- skillsToReview: 如果沒有明確弱點，寫 none clearly identified；不要硬塞 general
- errorTypes:
- confidence: High / Medium / Low`;
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
    return { ok: false, status: 500, data: { error: { message: e.name === 'AbortError' ? 'AI 暫時未能完成分析。請先用一張清晰相片再試。' : e.message } } };
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
    .split(/\n+/)
    .filter(line => !/(JSON|function|model|route|debug|schema|OpenAI|API|Netlify|serverless|maxTokens|responses|chat-fallback|technical evidence)/i.test(line) && !/^\s*V\d+\b/i.test(line))
    .join('\n')
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




function choiceStatusV78(line) {
  const s = String(line || '').replace(/\s+/g, ' ');
  const sel = (s.match(/(?:選擇|選|answer|chosen)\s*([A-D])/i) || [])[1];
  const corr = (s.match(/(?:正確答案|答案|correct answer)\s*(?:應為|應該是|應該係|是|為|係|should be|is)?\s*([A-D])/i) || [])[1];
  if (sel && corr) return sel.toUpperCase() === corr.toUpperCase() ? 'good' : 'review';
  if (/其實.{0,12}正確答案|答案正確|目前答案正確|暫未見明確錯|暫未見錯|無需覆核|不用覆核/.test(s)) return 'good';
  if (/選擇\s*[A-D].{0,100}正確|選\s*[A-D].{0,100}正確/.test(s) && !/正確答案\s*(?:應為|應該|是|為|係)\s*[A-D]/.test(s)) return 'good';
  return 'unknown';
}
function clearlyCorrectReviewLineV78(line) {
  const s = String(line || '');
  if (!/明確錯|需要覆核|需家長確認/.test(s)) return false;
  const choice = choiceStatusV78(s);
  if (choice === 'good') return true;
  if (choice === 'review') return false;
  const ar = typeof arithmeticAllCorrectV77 === 'function' ? arithmeticAllCorrectV77(s) : null;
  if (ar === true) return true;
  if (ar === false) return false;
  return /答案正確|目前答案正確|正確，?\s*無需覆核|正確，?\s*暫無錯|暫無錯|暫未見錯|暫未見明確錯|其實.{0,12}正確答案|無需覆核|不用覆核/.test(s) && !/正確應為|正確應該|應該係|應該是|應為|correct answer should be/i.test(s);
}
function cleanReviewPrefixV78(line) {
  return String(line || '')
    .replace(/^\s*請家長確認[:：]?\s*/, '')
    .replace(/^\s*【明確錯】\s*/, '')
    .replace(/^\s*【需家長確認】\s*/, '')
    .replace(/^\s*【未完成】\s*/, '')
    .trim();
}

function hasNoReviewPhraseV77(line) {
  const s = String(line || '');
  return /無需覆核|不用覆核|毋須覆核|目前答案正確|答案正確|正確，?\s*無需覆核|正確，?\s*暫無錯|暫無錯|暫時無錯|暫未見錯|暫未見明確錯|正確無誤/.test(s);
}
function arithmeticAllCorrectV77(line) {
  const s = String(line || '').replace(/×/g, 'x');
  const exprs = [];
  const rx = /((?:\d+\s*[+xX*]\s*)+\d+)\s*(?:=|＝)\s*(\d+)/g;
  let m;
  while ((m = rx.exec(s)) !== null) {
    const correct = calcExpressionV76(m[1]);
    const ans = parseInt(m[2], 10);
    if (correct !== null) exprs.push({ correct, ans });
  }
  if (!exprs.length) return null;
  return exprs.every(x => x.correct === x.ans);
}
function contradictoryPositiveLineV77(line) {
  const s = String(line || '');
  if (typeof clearlyCorrectReviewLineV78 === 'function' && clearlyCorrectReviewLineV78(s)) return true;
  const noReview = hasNoReviewPhraseV77(s);
  if (!noReview) return false;
  const ar = arithmeticAllCorrectV77(s);
  if (ar === false) return false;
  return true;
}
function cleanGoodLineV77(line) {
  return String(line || '')
    .replace(/^\s*請家長確認[:：]?\s*/, '')
    .replace(/^\s*【明確錯】\s*/, '')
    .replace(/^\s*【需家長確認】\s*/, '')
    .replace(/^\s*【未完成】\s*/, '')
    .trim();
}

function calcExpressionV76(expr) {
  try {
    const cleaned = String(expr || '').replace(/×/g, '*').replace(/x/gi, '*').replace(/÷/g, '/').replace(/[^0-9+\-*/(). ]/g, '');
    if (!cleaned || !/[+\-*/]/.test(cleaned)) return null;
    if (!/^[0-9+\-*/().\s]+$/.test(cleaned)) return null;
    const val = Function('"use strict";return (' + cleaned + ')')();
    if (Number.isFinite(val) && Math.abs(val - Math.round(val)) < 1e-9) return Math.round(val);
    return null;
  } catch (e) {
    return null;
  }
}
function extractArithmeticErrorsV76(text) {
  const s = String(text || '').replace(/×/g, 'x').replace(/\s+/g, ' ');
  const out = [];
  const patterns = [
    /((?:\d+\s*[+xX*]\s*)+\d+)\s*(?:=|＝)?\s*(?:寫咗|寫了|寫|答咗|答了|答|Janice\s*(?:寫|答))\s*(\d+)/g,
    /((?:\d+\s*[+xX*]\s*)+\d+)\s*(?:=|＝)\s*(\d+)/g
  ];
  patterns.forEach(rx => {
    let m;
    while ((m = rx.exec(s)) !== null) {
      const expr = m[1];
      const childAns = parseInt(m[2], 10);
      const correct = calcExpressionV76(expr);
      if (correct === null) continue;
      if (childAns !== correct) {
        out.push(`【明確錯】${expr.replace(/\s+/g, '')} = ${childAns}，正確應為 ${correct}`);
      }
    }
  });
  return out;
}
function isPositiveOnlyLineV76(line) {
  const s = String(line || '');
  if (contradictoryPositiveLineV77(s)) return true;
  const hasPositive = /正確|暫無錯|暫未見錯|暫時未見錯|暫時未見到錯|未見錯誤|答案正確|寫得正確|目前答案正確|無需覆核|不用覆核|暫無錯誤|暫未見明確錯|答對|答啱|成功推算|掌握|順利/i.test(s);
  const hasError = /明確錯|正確應該|正確應為|應該係|應為|應是|錯誤|計錯|寫咗\s*\d+|寫了\s*\d+|寫\s*\d+.*正確應/i.test(s);
  if (hasPositive && hasError) {
    const ar = arithmeticAllCorrectV77(s);
    if (ar === true) return true;
    if (hasNoReviewPhraseV77(s) && ar !== false) return true;
  }
  return hasPositive && !hasError;
}
function hardGuardReportV76(report) {
  report = report || {};
  const good = [];
  const review = [];
  (Array.isArray(report.strengths) ? report.strengths : []).forEach(x => {
    const s = normalizeReportLine ? normalizeReportLine(x) : String(x || '').trim();
    if (!s) return;
    if (clearlyCorrectReviewLineV78(s)) good.push(cleanReviewPrefixV78(s));
    else if (contradictoryPositiveLineV77(s)) good.push(cleanGoodLineV77(s));
    else {
      const errs = extractArithmeticErrorsV76(s);
      if (errs.length) review.push(...errs);
      else good.push(s);
    }
  });
  (Array.isArray(report.checkPoints) ? report.checkPoints : []).forEach(x => {
    const s = normalizeReportLine ? normalizeReportLine(x) : String(x || '').trim();
    if (!s) return;
    if (clearlyCorrectReviewLineV78(s)) { good.push(cleanReviewPrefixV78(s)); return; }
    if (contradictoryPositiveLineV77(s)) { good.push(cleanGoodLineV77(s)); return; }
    const errs = extractArithmeticErrorsV76(s);
    if (errs.length) { review.push(...errs); return; }
    if (isPositiveOnlyLineV76(s)) {
      good.push(cleanGoodLineV77(s));
      return;
    }
    review.push(s);
  });
  report.strengths = uniqueLinesV70 ? uniqueLinesV70(good).slice(0, 6) : [...new Set(good)].slice(0, 6);
  report.checkPoints = uniqueLinesV70 ? uniqueLinesV70(review).slice(0, 6) : [...new Set(review)].slice(0, 6);
  return report;
}



function normV80(s){return String(s||'').replace(/\s+/g,' ').trim();}
function isGenericTagV80(x){return /^(general|General Learning|general learning|general\s*learning|general learning \/ general|一般|綜合|unknown|unclear)$/i.test(String(x||'').trim());}
function isNoiseEvidenceLineV80(line){
  const s=normV80(line);
  if(!s) return true;
  if(/^(✅|⚠️|🧠|💬|🌟|📌|🏷️|🔎)?\s*\d+\.?\s*(已做得好的地方|需要覆核的位置|可能出錯原因|給家長的簡短解讀|今晚只做一件事|我睇到|Learning level awareness|Growth Memory|Homework Engine|Extract \+ Mark|Skill Status)/i.test(s)) return true;
  if(/^(已做得好的地方|需要覆核的位置|可能出錯原因|給家長的簡短解讀|今晚只做一件事|暫未見明確錯題|暫未見錯題|暫時未見明確錯題|暫未見明確錯誤|未見明顯需要覆核)$/i.test(s)) return true;
  if(/請家長確認[:：]?\s*(🧠|\d+\.|可能出錯原因|粗心|心急|做題狀態|閱讀題目|理解位|暫未見|未見)/.test(s)) return true;
  if(/^(粗心\s*\/\s*心急|理解位|閱讀題目|做題狀態)[:：]/.test(s) && !/[A-D]|\d+\s*[+xX*×÷\/\-]\s*\d+/.test(s)) return true;
  if(/^(暫時|目前|今次).{0,8}(未見|沒有).{0,12}(明確|粗心|錯|誤選|混淆)/.test(s)) return true;
  return false;
}
function specificSkillForTextV80(line){
  const s=String(line||'').toLowerCase();
  if(/tone|語氣/.test(s)) return {skill:'Reading Comprehension',subSkill:'tone'};
  if(/recipient|收信|invited|邀請.*朋友|朋友.*邀請/.test(s)) return {skill:'Reading Comprehension',subSkill:'details / recipients'};
  if(/purpose|目的|invite friends|surprise birthday/.test(s)) return {skill:'Reading Comprehension',subSkill:'purpose'};
  if(/special instruction|back gate|secret|特別指示|保密|後門/.test(s)) return {skill:'Reading Comprehension',subSkill:'special instructions'};
  if(/multiple choice|選擇題/.test(s)) return {skill:'Reading Comprehension',subSkill:'multiple choice'};
  if(/reading detail|細節|閱讀理解|comprehension/.test(s)) return {skill:'Reading Comprehension',subSkill:'reading detail'};
  if(/number pattern|patterns|數列|規律/.test(s)) return {skill:'Number Patterns',subSkill:/遞減|decreas/.test(s)?'decreasing pattern':/交替|alternat/.test(s)?'alternating pattern':'missing number pattern'};
  if(/spelling|串字|拼字/.test(s)) return {skill:'Spelling',subSkill:'spelling accuracy'};
  if(/grammar|文法/.test(s)) return {skill:'Grammar',subSkill:'grammar'};
  if(/handwriting|字跡|書寫/.test(s)) return {skill:'Handwriting',subSkill:'handwriting clarity'};
  if(/addition|加法|進位/.test(s)) return {skill:'Addition',subSkill:/進位|carrying/.test(s)?'carrying addition':'addition'};
  return null;
}
function focusFromQuestionV80(q){
  const s=String(q||'').toLowerCase();
  if(/tone|語氣/.test(s)) return 'Tone';
  if(/recipient|who are|收信|邀請/.test(s)) return 'Recipients';
  if(/purpose|目的/.test(s)) return 'Purpose';
  if(/special instruction|instructions|back gate|secret|特別指示/.test(s)) return 'Special instructions';
  return 'Reading detail';
}
function readingEvidenceFromLineV80(line){
  const s=normV80(line);
  const out=[];
  if(isNoiseEvidenceLineV80(s)) return out;
  const patterns=[
    /第\s*(\d+)\s*題[^「]*「([^」]{5,180})」[^。；\n]*?(?:選擇|選)\s*([A-D])(?:[^。；\n]*?(?:正確答案|答案)\s*(?:應為|應該是|應該係|是|為|係)?\s*([A-D]))?[^。；\n]*?(正確|答對|錯|不正確|incorrect|correct)?/gi,
    /(?:Q|Question)\s*(\d+)[^:：]*[:：]\s*([^|。；\n]{5,180}).*?(?:Student|Janice|選擇|選)\s*([A-D])(?:.*?(?:Correct|正確答案|答案)\s*([A-D]))?/gi
  ];
  patterns.forEach(rx=>{let m;while((m=rx.exec(s))!==null){
    const num=m[1], q=m[2], selected=(m[3]||'').toUpperCase(), corr=(m[4]||'').toUpperCase();
    if(!q || isNoiseEvidenceLineV80(q)) continue;
    let status='unclear';
    if(corr) status=selected===corr?'correct':'wrong';
    else if(/正確|答對|correct/i.test(m[5]||s)) status='correct';
    else if(/錯|不正確|incorrect/i.test(m[5]||'')) status='wrong';
    const sk=specificSkillForTextV80(q)||{skill:'Reading Comprehension',subSkill:focusFromQuestionV80(q).toLowerCase()};
    addEvidenceV79(out,{page:'',question:`Q${num}: ${focusFromQuestionV80(q)}`,studentAnswer:selected||'',correctAnswer:corr||selected||'',status,skill:sk.skill,subSkill:sk.subSkill,confidence:'medium',source:'reading'});
  }});
  if(!out.length && /(四題|全部|所有).{0,12}(選擇題|multiple choice).{0,18}(正確|答對)/i.test(s)){
    addEvidenceV79(out,{page:'',question:'Reading comprehension overall',studentAnswer:'all answered',correctAnswer:'all correct',status:'correct',skill:'Reading Comprehension',subSkill:'reading detail',confidence:'medium',source:'reading-summary'});
  }
  return out;
}
function shouldKeepEvidenceV80(e){
  if(!e||!e.question) return false;
  const q=normV80(e.question);
  if(isNoiseEvidenceLineV80(q)) return false;
  if(isGenericTagV80(e.skill)&&isGenericTagV80(e.subSkill)) return false;
  if(isGenericTagV80(e.subSkill)&&!/[+\-xX*×÷\/]|Reading|Spelling|Grammar|Pattern/i.test(String(e.skill||''))) return false;
  if(/暫未見明確錯|暫未見錯|未見明顯需要覆核|可能出錯原因|給家長|今晚只做/.test(q)) return false;
  return true;
}
function filterEvidenceV80(evidence){
  const out=[];
  (evidence||[]).forEach(e=>{
    if(!shouldKeepEvidenceV80(e)) return;
    const fixed={...e};
    const spec=specificSkillForTextV80((fixed.question||'')+' '+(fixed.subSkill||''));
    if(spec && (isGenericTagV80(fixed.skill)||fixed.skill==='General Learning')){fixed.skill=spec.skill;fixed.subSkill=spec.subSkill;}
    addEvidenceV79(out,fixed);
  });
  return out;
}

function evidenceSourceTypeV96(source){
  const s=String(source||'').toLowerCase();
  if(s==='extract') return 'primary_worksheet';
  if(s==='strength'||s==='review') return 'derived_report_text';
  if(s==='reason') return 'reason';
  if(s==='summary') return 'summary';
  if(s==='parent') return 'parent_summary';
  if(s==='raw') return 'raw_analysis';
  return s || 'unknown';
}
function confirmedEvidenceForGrowthV96(e){
  if(!e) return false;
  if(e.sourceType && e.sourceType!=='primary_worksheet') return false;
  return e.status==='correct' || e.status==='wrong';
}
function normalizeEngineEvidenceV96(e, lineSource){
  if(!e || !e.question) return null;
  const fixed={...e};
  fixed.source=fixed.source||lineSource||'unknown';
  fixed.sourceType=evidenceSourceTypeV96(lineSource||fixed.source);
  if(fixed.sourceType!=='primary_worksheet') return null;
  fixed.status=String(fixed.status||'unclear').toLowerCase();
  if(/correct|right|正確|答對/.test(fixed.status)) fixed.status='correct';
  else if(/wrong|incorrect|錯/.test(fixed.status)) fixed.status='wrong';
  else if(/missing|blank|未完成|漏做|空白/.test(fixed.status)) fixed.status='missing';
  else fixed.status='unclear';

  const combined=[fixed.question,fixed.studentAnswer,fixed.correctAnswer].join(' ');
  const positive=/正確|答對|無需覆核|不用覆核|暫未見錯|目前答案正確|no review/i.test(combined);
  const negative=/明確錯|錯誤|incorrect|wrong|正確應|應為|應該/i.test(combined);
  if(positive && negative){
    fixed.status='unclear';
    fixed.confidence='low';
    fixed.contradiction=true;
  }
  return fixed;
}

function normalizeExprV79(expr) {
  return String(expr || '').replace(/×/g, 'x').replace(/\*/g, 'x').replace(/\s+/g, '').trim();
}
function skillForExprV79(expr) {
  const s = String(expr || '').replace(/\s+/g, '').toLowerCase();
  const nums = (s.match(/\d+/g) || []).map(Number);
  if (/[x*×]/i.test(s)) return { skill: 'Multiplication', subSkill: 'multiplication facts' };
  if (/[÷/]/.test(s)) return { skill: 'Division', subSkill: 'division facts' };
  if (/-/.test(s)) return { skill: 'Subtraction', subSkill: nums.some(n => n >= 10) ? 'two-digit subtraction' : 'basic subtraction' };
  if (/\+/.test(s)) {
    const terms = s.split('+').map(n => parseInt(n, 10)).filter(n => !isNaN(n));
    const ones = terms.reduce((a, n) => a + (n % 10), 0);
    if (terms.length >= 3) return { skill: 'Addition', subSkill: 'multi-step addition' };
    if (terms.some(n => n >= 10) && ones >= 10) return { skill: 'Addition', subSkill: 'carrying addition' };
    if (terms.some(n => n >= 10)) return { skill: 'Addition', subSkill: 'two-digit addition' };
    return { skill: 'Addition', subSkill: 'basic addition' };
  }
  return { skill: 'Maths', subSkill: 'calculation' };
}
function skillForTextV79(line) {
  const s = String(line || '').toLowerCase();
  if (/number pattern|patterns|數列|規律/.test(s)) return { skill: 'Number Patterns', subSkill: /遞減|decreas/.test(s) ? 'decreasing pattern' : /alternat|交替/.test(s) ? 'alternating pattern' : 'missing number pattern' };
  if (/reading comprehension|閱讀理解|purpose|tone|recipient|special instruction|multiple choice|邀請|信件/.test(s)) return { skill: 'Reading Comprehension', subSkill: /tone|語氣/.test(s) ? 'tone' : /purpose|目的/.test(s) ? 'purpose' : /recipient|收信|邀請/.test(s) ? 'details / recipients' : 'reading detail' };
  if (/spelling|串字|拼字/.test(s)) return { skill: 'Spelling', subSkill: 'spelling accuracy' };
  if (/grammar|文法/.test(s)) return { skill: 'Grammar', subSkill: 'grammar' };
  if (/handwriting|書寫|字跡/.test(s)) return { skill: 'Handwriting', subSkill: 'handwriting clarity' };
  if (/addition|加法|進位/.test(s)) return { skill: 'Addition', subSkill: /進位|carrying/.test(s) ? 'carrying addition' : 'addition' };
  return { skill: 'General Learning', subSkill: 'general' };
}
function evidenceKeyV79(e) {
  return [e.page || '', e.question || '', e.studentAnswer || '', e.correctAnswer || '', e.status || ''].join('|').toLowerCase();
}
function addEvidenceV79(arr, e) {
  if (!e || !e.question) return;
  const key = evidenceKeyV79(e);
  if (arr.some(x => evidenceKeyV79(x) === key)) return;
  arr.push(e);
}
function evidenceFromLineV79(line, source = 'raw') {
  const s = normV80(line);
  const out = [];
  if (isNoiseEvidenceLineV80(s)) return out;
  readingEvidenceFromLineV80(s).forEach(e => addEvidenceV79(out, e));
  const rx = /((?:\d+\s*[+xX*×÷\/\-]\s*)+\d+)\s*(?:=|＝)\s*(\d+)/g;
  let m;
  while ((m = rx.exec(s)) !== null) {
    const expr = m[1], ans = parseInt(m[2], 10);
    const correct = calcExpressionV76(expr);
    const sk = skillForExprV79(expr);
    let status = 'unclear';
    if (correct !== null) status = ans === correct ? 'correct' : 'wrong';
    addEvidenceV79(out, { page: '', question: normalizeExprV79(expr), studentAnswer: String(ans), correctAnswer: correct !== null ? String(correct) : '', status, skill: sk.skill, subSkill: sk.subSkill, confidence: 'medium', source });
  }
  if (!out.length) {
    const spec = specificSkillForTextV80(s);
    if (spec && /(正確|答對|做得好|掌握|明確錯|錯誤|需要練|需覆核|看不清|未完成|漏做)/.test(s)) {
      let status = 'unclear';
      if (/正確|答對|做得好|掌握|暫未見錯/.test(s)) status = 'correct';
      if (/明確錯|錯誤/.test(s) && !/正確|無需覆核|目前答案正確|暫未見錯/.test(s)) status = 'wrong';
      addEvidenceV79(out, { page: '', question: s.slice(0, 120), studentAnswer: '', correctAnswer: '', status, skill: spec.skill, subSkill: spec.subSkill, confidence: 'low', source });
    }
  }
  return filterEvidenceV80(out);
}
function skillTrendV79(evidence) {
  const map = {};
  (evidence || []).filter(confirmedEvidenceForGrowthV96).forEach(e => {
    const key = (e.skill || 'General Learning') + '|' + (e.subSkill || 'general');
    if (!map[key]) map[key] = { skill: e.skill || 'General Learning', subSkill: e.subSkill || 'general', correct: 0, wrong: 0, unclear: 0, total: 0, examples: [] };
    const row = map[key];
    row.total++;
    if (e.status === 'correct') row.correct++;
    else if (e.status === 'wrong') row.wrong++;
    else row.unclear++;
    if (row.examples.length < 3) row.examples.push(e);
  });
  return Object.values(map).map(row => {
    const review = row.wrong + row.unclear;
    let status = 'Insufficient Data';
    if (row.total >= 2 && row.correct > 0 && review === 0) status = 'Strong';
    else if (row.wrong >= 2 && row.wrong >= row.correct) status = 'Needs Review';
    else if (row.correct >= 2 && row.correct >= review * 2) status = 'Generally Strong';
    else if (row.correct > 0 && review > 0) status = 'Mixed';
    row.status = status;
    return row;
  }).sort((a, b) => (b.wrong + b.unclear + b.correct) - (a.wrong + a.unclear + a.correct));
}
function buildEngineV2FromReportV79(report) {
  const evidence = [];
  const extractedEvidence = Array.isArray(report.extractedEvidence) ? report.extractedEvidence : [];
  const sources = extractedEvidence.map(x => ({ x, source: 'extract' }));
  sources.forEach(({ x, source }) => {
    String(x || '').split(/\n|\u3002|\uff1b/).forEach(line => evidenceFromLineV79(line, source).forEach(e => {
      const fixed = normalizeEngineEvidenceV96(e, source);
      if (fixed) addEvidenceV79(evidence, fixed);
    }));
  });
  const cleanEvidence = filterEvidenceV80(evidence).filter(e => e.sourceType === 'primary_worksheet').slice(0, 60);
  const evidenceStatus = cleanEvidence.length ? 'confirmed_worksheet_evidence' : 'insufficient_confirmed_evidence';
  return { version: 'v2.1', flow: 'Extract -> Mark -> Report -> Skill Trend', evidence: cleanEvidence, summary: skillTrendV79(cleanEvidence), evidenceStatus, needsReview: !cleanEvidence.length };
}
function addEvidenceLineV79(arr, line) {
  const s = normalizeReportLine(line);
  if (s && !arr.some(x => normalizeReportLine(x).toLowerCase() === s.toLowerCase())) arr.push(s);
}
function applyEngineV2ToReportV79(report) {
  report.engineV2 = buildEngineV2FromReportV79(report);
  const confirmedEvidence = (report.engineV2.evidence || []).filter(confirmedEvidenceForGrowthV96);
  if(!confirmedEvidence.length){
    report.strengths = [];
    report.checkPoints = ['needs_review: insufficient_confirmed_evidence'];
    report.reasons = [];
    report.confidence = 'low';
    return report;
  }
  const good = [];
  const review = [];
  confirmedEvidence.forEach(e => {
    if (e.status === 'wrong') addEvidenceLineV79(review, `【明確錯】${e.question}${e.studentAnswer ? ' = ' + e.studentAnswer : ''}${e.correctAnswer ? '，正確應為 ' + e.correctAnswer : ''}`);
    if (e.status === 'correct') addEvidenceLineV79(good, `${e.question}${e.studentAnswer ? ' = ' + e.studentAnswer : ''} 正確`);
  });
  report.strengths = uniqueLinesV70(good).slice(0, 6);
  report.checkPoints = uniqueLinesV70(review).filter(x => !clearlyCorrectReviewLineV78(x)).slice(0, 30);
  return report;
}

function buildStructuredHomeworkReport(raw) {
  const text = cleanParentText(raw || '');
  const wow = sectionBetween(text, ['✨ Parent Wow Summary','Parent Wow Summary'], ['🔎 Engine v2','🌟 0.']);
  const level = sectionBetween(text, ['🌟 0. Learning level awareness', '0. Learning level awareness', 'Learning level awareness'], ['📌 1.', '1. 我大約', '✅ 2.']);
  const content = sectionBetween(text, ['📌 1. 我大約睇到嘅功課內容', '1. 我大約睇到嘅功課內容', '我大約睇到嘅功課內容'], ['✅ 2.', '2. 已做得好', '⚠️ 3.']);
  const good = sectionBetween(text, ['✅ 2. 已做得好的地方', '2. 已做得好的地方', '已做得好的地方'], ['⚠️ 3.', '3. 需要覆核', '🧠 4.']);
  const extracted = sectionBetween(text, ['Engine v2 Extracted Evidence', 'Extracted Evidence'], ['0. Learning level awareness', 'Learning level awareness']);
  const check = sectionBetween(text, ['⚠️ 3. 需要覆核的位置', '3. 需要覆核的位置', '需要覆核的位置'], ['🧠 4.', '4. 可能出錯原因', '💬 5.']);
  const reason = sectionBetween(text, ['🧠 4. 可能出錯原因', '4. 可能出錯原因', '可能出錯原因'], ['💬 5.', '5. 給家長', '✅ 6.']);
  const parent = sectionBetween(text, ['💬 5. 給家長的簡短解讀', '5. 給家長的簡短解讀', '給家長的簡短解讀'], ['✅ 6.', '6. 今晚']);
  const longTerm = sectionBetween(text, ['📈 5. 長期觀察重點', '長期觀察重點'], ['✅ 6.']);
  const tips = sectionBetween(text, ['✅ 6. 今晚只做一件事', '6. 今晚只做一件事', '今晚只做一件事', '✅ 6. 下次做題小貼士', '下次做題小貼士'], []);
  const rawStrengths = bulletsFrom(good, 4);
  const cleanedReview = cleanReviewPoints(bulletsFrom(check, 30));
  const report = {
    title: 'AI 功課分析',
    wowSummary: firstUsefulLine(wow),
    shortSummary: firstUsefulLine(wow) || firstUsefulLine(parent) || firstUsefulLine(level) || text.slice(0, 180),
    summary: content || text.slice(0, 420),
    levelAwareness: level || '已按圖片內容和目前年級作初步觀察；如圖片清楚顯示 Year 3 / extension，應肯定孩子正在挑戰較高水平。',
    strengths: [...rawStrengths, ...cleanedReview.movedToGood].slice(0, 6),
    checkPoints: cleanedReview.review,
    extractedEvidence: bulletsFrom(extracted, 60),
    reasons: bulletsFrom(reason, 5),
    parentInterpretation: parent,
    longTermFocus: bulletsFrom(longTerm, 4),
    nextStep: firstUsefulLine(tips) || '今晚只揀一題最有代表性的題目慢慢講解。',
    confidence: 'medium',
    rawAnalysis: text
  };
  return applyEngineV2ToReportV79(hardGuardReportV76(sanitizeStructuredReportV70(report)));
}

function friendlyError(msg) {
  if (!msg) return 'AI 暫時未能完成分析。';
  if (/credit|quota|billing|insufficient|Incorrect API key|invalid api key|Unauthorized|401/i.test(msg)) return 'AI 連線設定暫時未能使用，請稍後再試。';
  if (/pattern|format/i.test(msg)) return '圖片格式未能讀取。請先用一張清晰 JPG 相片測試。';
  if (/timeout|逾時|AbortError|aborted/i.test(msg)) return 'AI 暫時未能完成分析。請先用「只分析第一張」再試。';
  return String(msg).replace(/(JSON|function|OpenAI|API|model|route|debug|V\d+)/gi,'AI');
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(obj) };
}
