ChildGrowth AI V79 - Homework Engine v2

Based on V78 and keeps all V78 fixes:
- compact homework summary
- stronger contradiction guard
- quick capture first-click fix
- up to 6 homework photos

New V79 scope:
1. Extract → Mark → Report → Skill Trend architecture
   - AI is prompted to extract page/question/student answer/correct answer/status/skill/sub-skill/confidence.
   - Frontend and backend build Engine v2 evidence from the report.
   - Basic arithmetic evidence is code-checked wherever possible.

2. Homework report now shows:
   - Engine v2 flow
   - Extract + Mark evidence table
   - Skill Status per sub-skill

3. Analytics dashboard now shows Skill Status Summary instead of two separate raw tag lists.
   - This reduces confusion such as "addition is strong x9 and review x7".
   - It shows Strong / Generally Strong / Mixed / Needs Review / Insufficient Data.

4. Growth Memory upgraded:
   - engineVersion: v2
   - skillsStrong / skillsToReview are informed by evidence status when available.

Important beta limitation:
- True Extract-Mark separation still depends on AI reading the photo correctly.
- Basic arithmetic can be verified by code after extraction.
- English reading and handwriting still require AI vision + parent confirmation.

No data deletion.
