ChildGrowth AI V88 - Dynamic Child + School Routine Fix

Based on V87.

Fixes:
1. Profile page button:
   - "同步 Janice 常用行程" is now dynamic.
   - It shows the current child's name, e.g. "同步 Test Child 常用行程".

2. School routine names:
   - School routines now use the school name from onboarding/profile.
   - Example: if school is "Blackburn Primary", weekly schedule will show "🏫 Blackburn Primary" instead of generic "School".

3. Existing beta data migration:
   - If a tester already created generic "School" routines in V87, V88 will normalise them to the profile school name when the profile page loads.
   - No automatic data deletion.

4. Janice-specific default activities:
   - Janice extras such as Soccer / Swimming / Chess are only added when the child name is Janice.
   - Other beta testers only get their own school routine unless they add activities during onboarding.

Use:
- Normal: https://childgrowthai.com.au/?v=88
- Beta tester: https://childgrowthai.com.au/?v=88&beta=1
- Admin debug: https://childgrowthai.com.au/?v=88&admin=1
