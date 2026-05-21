ChildGrowth AI V89 - Home Screen Beta Storage Guard

Based on V88.

Reason:
- On iPhone, Safari / WhatsApp in-app browser and Add-to-Home-Screen web app can behave like different storage containers.
- If a parent fills onboarding in the browser and only afterwards adds the site to Home Screen, the Home Screen app may not see the browser's localStorage, so it can look like the setup was not saved.

Fixes:
1. Beta onboarding now shows an iPhone testing notice:
   - Add to Home Screen first.
   - Open from the Home Screen icon.
   - Then fill onboarding inside the Home Screen app.

2. Manifest updated:
   - start_url is now /?v=89&beta=1&homescreen=1
   - This helps the Home Screen icon open the beta onboarding path instead of plain /.

3. Beta mode is remembered:
   - Stores cg_beta_mode=1 in localStorage after onboarding / skip.
   - If the Home Screen opens without query params but has beta storage, it stays in beta mode.

4. Storage check:
   - Warns if browser storage is blocked, such as Private or restricted mode.

5. Data safety:
   - No automatic deletion.
   - Existing data is preserved.
   - Start as new family still needs user confirmation.

Recommended tester instruction:
- Open the beta link in Safari normal mode.
- Add to Home Screen first.
- Then open the ChildGrowth AI icon and complete setup there.

Use:
- Beta tester: https://childgrowthai.com.au/?v=89&beta=1
- Home screen start URL: https://childgrowthai.com.au/?v=89&beta=1&homescreen=1
- Admin debug: https://childgrowthai.com.au/?v=89&admin=1
