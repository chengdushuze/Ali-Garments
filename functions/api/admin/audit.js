import { verifySessionToken, getSessionTokenFromRequest, verifyPassword, getSessionSecret, getCorsHeaders } from '../_auth.js';

async function getAdminSession(request, env) {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;
  const secret = getSessionSecret(env);
  return await verifySessionToken(token, secret);
}

// GET /api/admin/audit - Retrieve user activity and security audit trail
export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);
  const session = await getAdminSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Session required.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Forbidden. Admin privileges required.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    let logs = [];

    if (env.DB) {
      // Auto-create audit_logs table if not exists
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          user_email TEXT,
          action TEXT NOT NULL,
          details TEXT,
          ip_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      const res = await env.DB.prepare(
        'SELECT id, user_id, user_email, action, details, ip_address, created_at FROM audit_logs ORDER BY id DESC LIMIT 200'
      ).all();

      logs = res.results || [];
    } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'SELECT id, user_id, user_email, action, details, ip_address, created_at FROM audit_logs ORDER BY id DESC LIMIT 200',
        }),
      });
      const data = await res.json();
      logs = data?.result?.[0]?.results || [];
    }

    // If regular admin (not super_admin), filter out all Super Admin audit trails
    const SUPER_ADMIN_EMAIL = 'admin@chengdushuze.com';
    if (session.role !== 'super_admin') {
      logs = logs.filter(l => 
        l.user_email?.toLowerCase() !== SUPER_ADMIN_EMAIL &&
        !l.details?.toLowerCase().includes('super admin') &&
        !l.action?.toLowerCase().includes('super_admin')
      );
    }

    // If empty, supply an initial system status audit entry
    if (logs.length === 0) {
      logs = [
        {
          id: 1,
          user_id: session.userId || 1,
          user_email: session.email || 'admin@ali-garments.com',
          action: 'SYSTEM_READY',
          details: 'Audit logging engine active for ALI Garments portal.',
          ip_address: '127.0.0.1',
          created_at: new Date().toISOString(),
        },
      ];
    }

    return new Response(JSON.stringify({ logs }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Audit fetch error:', error);
    return new Response(JSON.stringify({ error: 'Failed to retrieve audit log.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// DELETE /api/admin/audit - Remove specific audit trail or purge all records
export async function onRequestDelete(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);
  const session = await getAdminSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized. Session required.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Must be super_admin to delete or purge audit records
  if (session.role !== 'super_admin') {
    return new Response(
      JSON.stringify({ success: false, error: 'Access Denied. Only Super Admin has authority to delete or clear audit records.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const auditId = body.auditId || url.searchParams.get('id');
    const purgeAll = body.purgeAll || (!auditId && body.superAdminPassword);
    const password = body.adminPassword || body.superAdminPassword || body.password;

    if (!password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Administrator password is required to authorize audit record deletion.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify requesting administrator's password against D1
    let adminUser = null;
    if (env.DB) {
      adminUser = await env.DB.prepare("SELECT id, email, role, password_hash FROM users WHERE id = ? LIMIT 1")
        .bind(session.userId)
        .first();
    } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: "SELECT id, email, role, password_hash FROM users WHERE id = ? LIMIT 1",
          params: [session.userId],
        }),
      });
      const data = await res.json();
      adminUser = data?.result?.[0]?.results?.[0];
    }

    if (!adminUser) {
      return new Response(JSON.stringify({ success: false, error: 'Admin account not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isValid = await verifyPassword(password, adminUser.password_hash);
    if (!isValid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Incorrect administrator password. Deletion authorization rejected.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientIp = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('x-real-ip') || 
                     request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     'client';

    // 1. DELETE SPECIFIC AUDIT TRAIL RECORD
    if (auditId) {
      const numericAuditId = parseInt(auditId, 10);
      if (isNaN(numericAuditId)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid audit record ID.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (env.DB) {
        await env.DB.prepare('DELETE FROM audit_logs WHERE id = ?').bind(numericAuditId).run();
        await env.DB.prepare(
          'INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          adminUser.id,
          adminUser.email,
          'AUDIT_RECORD_DELETED',
          `Specific audit trail record #${numericAuditId} was deleted by ${adminUser.role}: ${adminUser.email}`,
          clientIp
        ).run().catch(() => {});
      } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
        const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: "DELETE FROM audit_logs WHERE id = ?",
            params: [numericAuditId],
          }),
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: `Audit record #${numericAuditId} successfully removed.` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. PURGE ALL AUDIT TRAILS (Super Admin Only)
    if (purgeAll) {
      if (session.role !== 'super_admin') {
        return new Response(
          JSON.stringify({ success: false, error: 'Access Denied. Only Super Admin is authorized to purge the entire audit trail.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (env.DB) {
        await env.DB.prepare('DELETE FROM audit_logs').run();
        await env.DB.prepare(
          'INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          adminUser.id,
          adminUser.email,
          'AUDIT_TRAILS_PURGED',
          'All previous activity audit logs were permanently purged by Super Admin.',
          clientIp
        ).run().catch(() => {});
      } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
        const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: "DELETE FROM audit_logs",
          }),
        });
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: "INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES (?, ?, ?, ?, ?)",
            params: [adminUser.id, adminUser.email, 'AUDIT_TRAILS_PURGED', 'All previous activity audit logs were permanently purged by Super Admin.', clientIp],
          }),
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: 'All audit trails successfully cleared by Super Admin.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Please specify an audit ID to delete or request a full purge.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Audit delete error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Server error while deleting audit log.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
