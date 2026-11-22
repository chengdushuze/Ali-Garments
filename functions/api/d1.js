import { verifySessionToken, getSessionTokenFromRequest, getSessionSecret, getCorsHeaders, isVpnOrProxy } from './_auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // 1. Session verification (Cookie or Bearer token)
    const token = getSessionTokenFromRequest(request);
    const secret = getSessionSecret(env);
    const session = token ? await verifySessionToken(token, secret) : null;

    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Please sign in.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Real-time suspension, deletion, and multi-device session revocation check
    let dbUser = null;
    if (env.DB) {
      try {
        dbUser = await env.DB.prepare(
          'SELECT status, suspended_until, role, COALESCE(token_version, 1) as token_version, COALESCE(allow_vpn, 0) as allow_vpn, COALESCE(allow_foreign_access, 0) as allow_foreign_access FROM users WHERE id = ?'
        ).bind(session.userId).first();

        // If user was deleted from database, revoke immediately!
        if (!dbUser) {
          return new Response(
            JSON.stringify({ error: 'Your user account has been removed by an administrator.', isDeleted: true }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Token version check (revoked if session.ver is outdated)
        if (session.ver && dbUser.token_version && session.ver !== dbUser.token_version) {
          return new Response(
            JSON.stringify({ error: 'Session invalidated. Please sign in again.', isLoggedOut: true }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Strict Geo Restriction check
        const clientCountry = request.cf?.country;
        if (clientCountry && clientCountry !== 'PK' && dbUser.allow_foreign_access !== 1) {
          return new Response(
            JSON.stringify({
              error: `Access restricted to Pakistan (PK). Your detected location is ${clientCountry}. Please contact Super Admin for foreign access authorization.`,
              code: 'GEO_BLOCKED',
              isGeoBlocked: true,
              country: clientCountry
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Strict VPN / Proxy check
        if (isVpnOrProxy(request) && dbUser.allow_vpn !== 1) {
          return new Response(
            JSON.stringify({
              error: 'VPN or Proxy connection detected. Security policy blocks VPN/Proxy access until authorized by Administrator in the Admin Panel.',
              code: 'VPN_BLOCKED',
              isVpnBlocked: true
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Active suspension check
        if (dbUser.status === 'suspended' && dbUser.role !== 'super_admin') {
          if (dbUser.suspended_until && Date.now() >= dbUser.suspended_until) {
            await env.DB.prepare("UPDATE users SET status = 'active', suspended_until = NULL WHERE id = ?").bind(session.userId).run().catch(() => {});
          } else {
            const remainingDays = dbUser.suspended_until ? Math.max(1, Math.ceil((dbUser.suspended_until - Date.now()) / (24 * 60 * 60 * 1000))) : null;
            const untilMsg = remainingDays ? ` for ${remainingDays} day(s)` : '';
            return new Response(JSON.stringify({
              error: `Your account has been temporarily suspended by an administrator${untilMsg}.`,
              isSuspended: true,
              suspendedDays: remainingDays,
              suspendedUntil: dbUser.suspended_until
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (e) {}
    }

    const { sql, params } = await request.json().catch(() => ({}));

    if (!sql || typeof sql !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid SQL query' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (sql.length > 200000) {
      return new Response(JSON.stringify({ error: 'Query payload exceeds maximum permitted length.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (params && !Array.isArray(params)) {
      return new Response(JSON.stringify({ error: 'Query parameters must be formatted as an array.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanSql = sql.trim();
    const isAdmin = session.role === 'admin' || session.role === 'super_admin';

    // 2. Strict Security: Block sensitive table access and internal schema tampering
    if (/\b(users|login_attempts|audit_logs|sqlite_master|sqlite_schema|sqlite_temp_master|pragma)\b/i.test(cleanSql)) {
      console.warn(`[Security Alert] Blocked unauthorized query attempt by userId=${session.userId}`);
      return new Response(
        JSON.stringify({
          error: 'Access denied: Unauthorized table access blocked by security rules.'
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Block destructive schema statements from non-administrators
    if (!isAdmin && /\b(DROP\s+TABLE|ALTER\s+TABLE|TRUNCATE|ATTACH|DETACH)\b/i.test(cleanSql)) {
      return new Response(
        JSON.stringify({
          error: 'Access denied: Schema modification commands require Administrator privileges.'
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3.5 Block non-admin blanket deletes without WHERE clause
    if (!isAdmin && /\bDELETE\s+FROM\s+(customers|customer_chunks|settings)\b/i.test(cleanSql) && !/\bWHERE\b/i.test(cleanSql)) {
      return new Response(
        JSON.stringify({
          error: 'Access denied: Blanket table wiping requires Administrator authorization.'
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (env.DB) {
      // Native Cloudflare D1 binding
      // Support multi-statement queries seamlessly by splitting on semicolon
      const rawStatements = cleanSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      let batchResults;
      if (rawStatements.length <= 1) {
        const stmt = env.DB.prepare(rawStatements[0] || cleanSql);
        const queryRes = params && params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
        batchResults = [queryRes];
      } else {
        // Execute multi-query batch in Cloudflare D1 with parameters bound appropriately
        let paramIndex = 0;
        const preparedBatch = rawStatements.map(s => {
          const stmt = env.DB.prepare(s);
          const placeholderCount = (s.match(/\?/g) || []).length;
          if (placeholderCount > 0 && params && params.length >= paramIndex + placeholderCount) {
            const stmtParams = params.slice(paramIndex, paramIndex + placeholderCount);
            paramIndex += placeholderCount;
            return stmt.bind(...stmtParams);
          }
          return stmt;
        });
        batchResults = await env.DB.batch(preparedBatch);
      }

      return new Response(JSON.stringify({ success: true, result: batchResults }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Direct REST API fallback
    const accountId = env.CF_ACCOUNT_ID;
    const databaseId = env.CF_DATABASE_ID;
    const apiToken = env.CF_API_TOKEN;

    if (!accountId || !databaseId || !apiToken) {
      return new Response(JSON.stringify({ error: 'D1 not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const cfRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: cleanSql, params: params || [] }),
    });

    const data = await cfRes.json();
    return new Response(JSON.stringify(data), {
      status: cfRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('D1 execution error:', error);
    const rawMsg = error?.message ? String(error.message).replace(/\./g, '') : 'Database execution failed';
    return new Response(JSON.stringify({ success: false, error: `D1 operation failed: ${rawMsg}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
