ChildGrowth AI V12 Production Beta

Included:
- V11 UI bug soft patch
- GPT-4.1 Vision as default backend model
- Teacher Comment AI analysis
- Local parent dashboard
- 7-day activity trend graph
- Parent report print/export button
- Production banner
- Netlify credit saving: max 3 images per AI run

Deploy:
1. Upload all files to GitHub repo.
2. Netlify auto deploys from GitHub.
3. Required environment variables:
   OPENAI_API_KEY
   SUPABASE_URL
   SUPABASE_ANON_KEY
   NEXT_PUBLIC_POSTHOG_KEY
   NEXT_PUBLIC_POSTHOG_HOST
4. Test:
   /.netlify/functions/debug-openai
   Then one clear homework photo.
