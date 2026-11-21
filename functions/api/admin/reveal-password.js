import { getCorsHeaders } from '../_auth.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * SEC-VULN-01 Remediation:
 * Plaintext password storage and retrieval has been permanently retired
 * to protect enterprise credentials. Super Admin can reset/change passwords directly.
 */
export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);
  return new Response(
    JSON.stringify({
      error: 'Viewing stored passwords has been permanently deprecated for enterprise security compliance. Please use the "Change Password" feature to assign a new secure password.',
      isRetired: true,
    }),
    {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
