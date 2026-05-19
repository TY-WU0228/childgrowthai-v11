exports.handler = async function() {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.POSTHOG_KEY || '',
      posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST || process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
    })
  };
};