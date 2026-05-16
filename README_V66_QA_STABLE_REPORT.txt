ChildGrowth AI V66 - QA Stable Report

Built from V65 and cross-checked before packaging.

Fixes / improvements:
1. Homework AI report quality
   - Backend now returns a structured report object, not only raw text.
   - Frontend displays the full report reliably.
   - Full original AI text is still preserved.
   - Output token budget increased to reduce half-finished reports.
   - Prompt requires sections 0-6 and concrete worksheet topics where visible.

2. QA checks performed:
   - index.html script syntax check.
   - Netlify function syntax check.
   - Homework full view present.
   - Recent homework has “查看完整分析”.
   - V64 image compression / “只分析第一張” retained.
   - V61 smart prep retained.
   - V60 routine restore retained.
   - V57 Capture + Calendar retained.

No data deletion.

Recommended test:
1. Use “只分析第一張”.
2. Then test 2-3 homework photos.
3. Press “查看完整分析” in recent homework analysis.
