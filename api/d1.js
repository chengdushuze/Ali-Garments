// Vercel Serverless Function to communicate with Cloudflare D1
// Closed multi-user security: prevents modifying or querying users table via application API

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-CF-Account-Id, X-CF-Database-Id, X-CF-Api-Token, Cookie'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { sql, params } = req.body || {};
  if (!sql) {
    return res.status(400).json({ error: 'Missing SQL query' });
  }

  // Strict Security: Block ANY modification or access to users table from application API!
  // The users table can ONLY be created/managed via D1 Dashboard console or closed admin endpoints.
  if (/\busers\b/i.test(sql)) {
    console.warn('[Security Alert] Blocked direct query targeting users table from application API');
    return res.status(403).json({
      error: 'Access denied: The users table can only be edited directly from the Cloudflare D1 dashboard console.'
    });
  }

  const accountId = req.headers['x-cf-account-id'] || process.env.CF_ACCOUNT_ID;
  const databaseId = req.headers['x-cf-database-id'] || process.env.CF_DATABASE_ID;
  const apiToken = req.headers['x-cf-api-token'] || process.env.CF_API_TOKEN;

  if (!accountId || !databaseId || !apiToken) {
    console.error('Vercel D1 error: Missing CF_ACCOUNT_ID, CF_DATABASE_ID, or CF_API_TOKEN in environment variables.');
    return res.status(500).json({
      error: 'Something went wrong. Please try again.'
    });
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  try {
    const cfResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sql,
        params: params || []
      })
    });

    const data = await cfResponse.json();

    if (!cfResponse.ok || !data.success) {
      console.error('Cloudflare D1 query error:', data.errors || cfResponse.statusText);
      return res.status(cfResponse.status).json({
        success: false,
        error: 'Something went wrong. Please try again.'
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Vercel D1 proxy technical error:', error);
    return res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again.'
    });
  }
}
