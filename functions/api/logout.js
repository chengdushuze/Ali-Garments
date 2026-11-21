import { verifySessionToken, getSessionTokenFromRequest, getSessionSecret, getCorsHeaders } from './_auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Invalidate session in D1 by incrementing token_version
  try {
    const token = getSessionTokenFromRequest(request);
    const secret = getSessionSecret(env);
    const session = token ? await verifySessionToken(token, secret) : null;

    if (session && session.userId && env.DB) {
      await env.DB.prepare('UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?')
        .bind(session.userId)
        .run()
        .catch(() => {});
    }
  } catch (e) {}

  const cookieHeader = 'session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';

  return new Response(JSON.stringify({ success: true, message: 'Logged out successfully' }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Set-Cookie': cookieHeader,
    },
  });
}

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
