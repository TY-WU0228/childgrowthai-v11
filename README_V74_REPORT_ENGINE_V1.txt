ChildGrowth AI V74 - Report Engine v1 / Growth Memory Layer

Based on V73 (keeps V72 calendar prep-event fix and V70 homework classification).

Main purpose:
- Upgrade from "single homework report" to a basic Report Engine.
- Each homework report is converted into structured Growth Memory data:
  subject, worksheetLevel, childYear, skillsStrong, skillsToReview, errorTypes, confidence, nextStep, qualityScore.

What changed:
1. Homework report now shows:
   - Report Quality Score /100
   - Growth Memory Tags
   - subject / level / child year / confidence
   - strong skills
   - review skills / error type

2. Recent homework history now shows:
   - quality score
   - subject / level / review tags

3. Analytics tab now has:
   - Report Engine v1 snapshot
   - Growth Memory readiness /100
   - top strong skill tags
   - top review skill tags
   - average report quality

4. Weekly Review upgraded:
   - This Week Snapshot
   - Academic Progress
   - Repeated Review Areas
   - Emotion & Energy Pattern
   - School / Activity Comments
   - Parent Action Plan

5. Report Quality Framework added:
   - Wow report standards
   - safety rules
   - quality score criteria

Important:
- This is still local-storage based, not true cloud memory.
- The app can now analyse trends from stored local records, but official long-term product should move this data to Supabase / backend database.
- No diagnosis, no professional assessment, no "gifted" or ability labels.

Kept:
- Official slogan: 陪孩子成長，看見每一步 / Let’s grow together, one step at a time.
- V72 Calendar prep event fix.
- V70 report classification stable.
- Homework AI multi-photo upload and "只分析第一張".
- Routine / Smart Prep / Capture / Activity Progress / School Teacher Comment.

No data deletion.
