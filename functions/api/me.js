import { verifySessionToken, getSessionTokenFromRequest, getSessionSecret, getCorsHeaders, isVpnOrProxy } from './_auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  const token = getSessionTokenFromRequest(request);

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const secret = getSessionSecret(env);
  const session = await verifySessionToken(token, secret);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session expired or invalid' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let liveUser = null;
  if (env.DB) {
    try {
      liveUser = await env.DB.prepare(
        `SELECT id, name, email, role, COALESCE(status, 'active') as status, suspended_until, 
                COALESCE(token_version, 1) as token_version, 
                COALESCE(allow_vpn, 0) as allow_vpn,
                COALESCE(allow_foreign_access, 0) as allow_foreign_access 
         FROM users WHERE id = ?`
      )
        .bind(session.userId)
        .first();
    } catch (e) {}
  } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
    try {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sql: `SELECT id, name, email, role, COALESCE(status, 'active') as status, suspended_until, 
                       COALESCE(token_version, 1) as token_version, 
                       COALESCE(allow_vpn, 0) as allow_vpn,
                       COALESCE(allow_foreign_access, 0) as allow_foreign_access 
                FROM users WHERE id = ?`, 
          params: [session.userId] 
        }),
      });
      const data = await res.json();
      liveUser = data?.result?.[0]?.results?.[0];
    } catch (e) {}
  }

  // Account Deleted check: if user was deleted in D1, kick out immediately!
  if (!liveUser) {
    return new Response(
      JSON.stringify({
        error: 'Your user account has been removed by an administrator.',
        isDeleted: true
      }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Set-Cookie': 'session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
        },
      }
    );
  }

  // Multi-device logout invalidation: check token_version
  if (session.ver && liveUser.token_version && session.ver !== liveUser.token_version) {
    return new Response(
      JSON.stringify({
        error: 'Session invalidated by an administrative update or logout. Please sign in again.',
        isLoggedOut: true
      }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Set-Cookie': 'session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
        },
      }
    );
  }

  // Strict Geo Restriction check
  const clientCountry = request.cf?.country;
  if (clientCountry && clientCountry !== 'PK' && liveUser.allow_foreign_access !== 1) {
    return new Response(
      JSON.stringify({
        error: `Access restricted to Pakistan (PK). Your detected location is ${clientCountry}. Please contact Super Admin for foreign access authorization.`,
        code: 'GEO_BLOCKED',
        isGeoBlocked: true,
        country: clientCountry
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Strict VPN / Proxy check
  if (isVpnOrProxy(request) && liveUser.allow_vpn !== 1) {
    return new Response(
      JSON.stringify({
        error: 'VPN or Proxy connection detected. Security policy blocks VPN/Proxy access until authorized by Administrator in the Admin Panel.',
        code: 'VPN_BLOCKED',
        isVpnBlocked: true
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Real-time suspension check: immediately kick out suspended users with exact duration
  if (liveUser.status === 'suspended' && liveUser.role !== 'super_admin') {
    if (liveUser.suspended_until && Date.now() >= liveUser.suspended_until) {
      // Auto-reactivate expired suspension
      if (env.DB) {
        await env.DB.prepare("UPDATE users SET status = 'active', suspended_until = NULL WHERE id = ?").bind(liveUser.id).run().catch(() => {});
      }
      liveUser.status = 'active';
    } else {
      const remainingDays = liveUser.suspended_until ? Math.max(1, Math.ceil((liveUser.suspended_until - Date.now()) / (24 * 60 * 60 * 1000))) : null;
      const untilText = remainingDays ? ` for ${remainingDays} day(s)` : '';
      return new Response(
        JSON.stringify({
          error: `Your account has been temporarily suspended by an administrator${untilText}. Please contact management.`,
          isSuspended: true,
          suspendedDays: remainingDays,
          suspendedUntil: liveUser.suspended_until,
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Set-Cookie': 'session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
          },
        }
      );
    }
  }

  return new Response(
    JSON.stringify({
      user: {
        id: liveUser.id,
        name: liveUser.name,
        email: liveUser.email,
        role: liveUser.role || 'user',
        status: liveUser.status,
        allow_vpn: liveUser.allow_vpn || 0,
        allow_foreign_access: liveUser.allow_foreign_access || 0,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
