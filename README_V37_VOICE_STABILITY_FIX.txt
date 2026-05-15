ChildGrowth AI V37 - Voice Stability Fix

Based on V36.

Problem fixed:
- On iPhone/Safari, after microphone permission, voice routine input could freeze.
- After reopening the app, 管理固定行程 could stop responding because older modal state / JS error blocked it.

Fixes:
1. Stable Routine Manager opener:
   - Overrides v35OpenRoutineManager with v37OpenRoutineManager.
   - Adds event delegation so any 管理固定行程 button opens the manager.

2. Safer voice input:
   - Uses try/catch.
   - 8.5 second timeout.
   - Calls abort on error/end.
   - Re-enables the button after failure.
   - Does not leave modal in frozen state.

3. Text fallback:
   - Manager now tells users they can type the sentence and press 讀取文字.
   - This is more reliable on iPhone.

4. Emergency reset:
   - Adds 重置語音 button inside manager.

5. No data deletion:
   - Existing routines and records are preserved.

Testing:
- Go to 我的 > 管理固定行程.
- The manager should open.
- Press 開始語音輸入.
- If mic fails or times out, the app should not freeze.
- Try typed input:
  Sunday 9am to 12pm QS school 準備功課同水樽
