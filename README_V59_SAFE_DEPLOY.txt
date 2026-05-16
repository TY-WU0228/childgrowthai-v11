ChildGrowth AI V59 - Safe Deploy Package

Purpose:
- This package is a minimal safe deploy version after the V58 update error.
- It removes old README/test files from the deploy package so GitHub/Netlify has fewer files to process.
- It keeps the actual app features and functions.

Kept from V58:
- Activity Progress final cleanup:
  Photo = upload photo only
  Short video = upload video only
  Voice note = voice-to-text only
  Coach comment = voice-to-text / text only
  Only one Analyze Activity button
- V57 Universal Capture
- V57 Calendar export
- Neutral splash screen
- Teacher Comment Voice
- School Notice AI
- Homework AI
- Existing data is not deleted.

Added:
- netlify.toml with publish='.' and no build requirement.
- _redirects fallback to index.html.

How to update:
1. Extract this zip.
2. Upload/replace these files into the repository root.
3. Do not upload the zip file itself to the repo.
4. Wait for Netlify deploy to show Published.
5. Open: https://childgrowthai.com.au/?v=59

If GitHub shows "Error - Request ID":
- That is usually the GitHub upload page failing, not the ChildGrowth AI app itself.
- Try uploading from desktop Chrome/Edge, or upload fewer files at a time:
  first index.html, manifest/icons, netlify.toml, _redirects;
  then netlify/functions folder.
