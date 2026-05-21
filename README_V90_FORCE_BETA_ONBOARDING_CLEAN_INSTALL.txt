ChildGrowth AI V90 - Force Beta Onboarding Clean Install

Problem found:
- On a friend's phone, adding the older beta site to Home Screen before filling onboarding could open the default Janice screen instead of onboarding.
- This happened because the Home Screen icon could open without beta query params and fall through to default demo data.

Fix:
1. In beta / homescreen mode, if beta onboarding is not completed in this storage container, force onboarding.
2. Do not let a clean beta install fall through to the built-in Janice demo profile.
3. Manifest start_url is now /?v=90&beta=1&homescreen=1.
4. Beta mode is remembered with cg_beta_mode=1.
5. Existing completed beta/user data remains untouched.

Tester instruction:
- Delete any old V88/V89 Home Screen icon first.
- Open https://childgrowthai.com.au/?v=90&beta=1 in Safari normal mode.
- Add to Home Screen.
- Open the new ChildGrowth AI icon.
- They should see onboarding, not Janice.

Data safety:
- No automatic data deletion for existing completed onboarding.
- It only forces onboarding when beta mode is active and onboarding is not completed in that storage container.
