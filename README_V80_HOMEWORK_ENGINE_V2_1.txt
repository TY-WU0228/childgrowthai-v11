ChildGrowth AI V80 - Homework Engine v2.1 / Clean Evidence + Reading Intelligence

Based on V79 and keeps V78/V79 fixes.

V80 focus:
1. Clean Evidence
   - Removes report headings and commentary from Extract + Mark evidence.
   - Excludes lines such as 需要覆核的位置 / 可能出錯原因 / 給家長解讀 / 暫未見明確錯題.

2. Reading Intelligence
   - English reading reports get a Reading Intelligence table when evidence is available.
   - Tries to identify focus: tone, recipients, purpose, special instructions, reading detail.

3. Growth tags cleaned
   - Filters out general / General Learning tags.
   - If there is no clear review skill, it shows a parent-friendly fallback instead of many general tags.

4. More honest quality score
   - Caps/adjusts quality when evidence is noisy or tags are generic.

5. Keeps:
   - V79 Engine v2 flow
   - V78 quick capture first-click fix
   - 6 homework photos
   - V72 calendar prep event
   - official slogan

Important beta limitation:
- Math can be code-checked after extraction.
- Reading comprehension still depends on AI vision + wording clarity.
