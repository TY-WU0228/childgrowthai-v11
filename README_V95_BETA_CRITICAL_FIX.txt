ChildGrowth AI V95 - Beta Critical Fix (Security + Privacy + Resilience)

Based on V93.

========================================
1. V95 SUMMARY
========================================
V95 is a targeted hardening pass for the parent beta. It closes two open
serverless endpoints, removes the hardcoded demo child name ("Janice") from
parent-facing report output, protects the app against device storage failures,
and makes partial multi-photo uploads honest about how many pages were actually
analysed. No app rebuild, no data migration, no schema change. Changes are
additive and backwards compatible.

The five fixes are tracked as A1-A5 below.

========================================
2. FILES CHANGED
========================================
- netlify/functions/debug-openai.js      (A1)
- netlify/functions/cloud-save.js         (A2)
- netlify/functions/analyze-homework.js   (A3 - backend prompt label)
- index.html                              (A3, A4, A5 - parent app)

NOT changed:
- Root-level legacy duplicates (debug-openai.js, cloud-save.js at repo root)
  are NOT the deployed copies. netlify.toml points the functions directory at
  netlify/functions only, so these were intentionally left untouched.
- No manifest / icon / redirect / header changes.
- No existing data removed.

========================================
3. FUNCTIONS CHANGED
========================================
netlify/functions/debug-openai.js
- handler(): now gated behind env flag ENABLE_DEBUG_ENDPOINTS. Returns
  404 Not found unless ENABLE_DEBUG_ENDPOINTS === '1' is explicitly set.

netlify/functions/cloud-save.js
- handler(): added shared-secret auth check at top. Requires CLOUD_SAVE_TOKEN
  env var, supplied by caller via "x-cg-save-token" header or
  "Authorization: Bearer <token>". Returns 403 CLOUD_SAVE_DISABLED when no
  token configured, 401 UNAUTHORIZED on mismatch.

netlify/functions/analyze-homework.js
- Reading-comprehension prompt label changed from "Janice answer" to
  "Student answer" so the model stops emitting the demo name for every child.

index.html
- save(): wrapped localStorage.setItem in try/catch.
- mirrorLegacy(): wrapped all localStorage writes in try/catch.
- cgShowStorageWarning(): NEW. Dismissible parent-friendly banner shown when a
  storage write fails (Safari Private mode / quota full).
- v92ChildLabel() now used in ~13 parent-facing report strings that previously
  hardcoded "Janice" (teacher-comment placeholder, reading/evidence lines,
  review list, insight, next-step, "wow" summaries, V85 narratives, admin
  reading/evidence tables).
- v95PartialState(): NEW. Computes analysed vs failed page counts from debug.
- v93IncompleteReportHTML(): added a partial-success branch that clearly labels
  "X / Y 張已完成分析" and states the upload is NOT a complete report.
- Homework hwStatus inline message: shows partial page counts when partial.

========================================
4. A1-A5 CONFIRMATION
========================================
A1  debug-openai endpoint           DONE - disabled by default; returns 404
                                            unless ENABLE_DEBUG_ENDPOINTS=1.
A2  cloud-save anonymous write hole  DONE - shared-secret token required.
A3  hardcoded "Janice" in reports    DONE - dynamic child name via v92ChildLabel()
                                            + backend prompt label fixed.
A4  storage failure crash            DONE - try/catch + parent warning banner.
A5  partial multi-photo upload UX    DONE - partial success labelled, never
                                            shown as a complete report.

========================================
5. REMAINING RISKS
========================================
- cloud-save callers must now send CLOUD_SAVE_TOKEN. The current app UI does
  NOT call cloud-save, so there is no live UI regression, but any future or
  external caller must be updated to send the token, and the env var must be
  set in the deploy environment before relying on cloud save.
- debug-openai stays OFF (returns 404) unless ENABLE_DEBUG_ENDPOINTS=1 is set.
  Remember to set it temporarily if you need to debug the OpenAI key, then unset it.
- v95PartialState() infers analysed/failed counts from the debug payload
  (frontendBatches / errors[]). If the backend debug shape changes, the partial
  branch falls back to the generic "AI incomplete" card (safe default, never a
  false "complete report").
- Remaining "Janice" strings in index.html are intentional and NOT parent
  report copy: the demo profile default, demo-restore helpers
  (v60RestoreJaniceRoutines, syncJanice) gated to the demo child, and parser
  regexes that tolerate legacy "Janice"/"Student" labels in AI output.
- Not yet verified on a physical iPhone (see section 6).

========================================
6. MANUAL QA CHECKLIST - iPhone Safari + Home Screen PWA
========================================
iPhone Safari (normal tab):
[ ] Open the beta URL in Safari. App loads, no blank screen.
[ ] Onboard a NEW child with a non-demo name (e.g. "Sophie").
[ ] Upload 1 homework photo. Confirm the report uses "Sophie", never "Janice".
[ ] Confirm green "分析完成" only appears when analysis is complete.
[ ] Upload 4-6 photos where 1-2 are blurry/unreadable. Confirm the partial card
    shows "X / Y 張已完成分析" and says it is NOT a complete report.
[ ] Teacher-comment box placeholder shows the child's name, not "Janice".
[ ] Reading/evidence rows label answers with the child's name.

iPhone Safari Private Browsing (storage failure path):
[ ] Open the app in a Private tab.
[ ] Enter data / run an analysis to trigger a save.
[ ] Confirm the red storage-warning banner appears (Safari Private blocks
    localStorage writes) and the app does NOT crash / freeze.
[ ] Tap "知道了" and confirm the banner dismisses and the app stays usable.

Home Screen PWA (Add to Home Screen):
[ ] Add the app to Home Screen, launch from the icon.
[ ] Confirm onboarding / data persists across an app close + relaunch.
[ ] Repeat the 1-photo and multi-photo report checks above from the PWA.
[ ] Confirm the storage banner logic still behaves (normal launch = no banner).

Endpoint security (optional, admin/dev):
[ ] Without ENABLE_DEBUG_ENDPOINTS=1 set, hit /debug-openai -> expect 404.
[ ] Without CLOUD_SAVE_TOKEN / wrong token, hit /cloud-save -> expect 403/401.

========================================
7. STATUS
========================================
*** THIS IS A v0 WORKING COPY ONLY. ***
These changes have NOT been pushed to the GitHub branch v95-beta-critical-fix.
No publish, no deploy, no commit to main. The sandbox has no git remote
configured, so the GitHub push must be done by the reviewer via the v0
Settings -> Git panel after review.
