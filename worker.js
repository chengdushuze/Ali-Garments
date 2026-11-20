// Cloudflare Worker for ALI Garments D1 API
// Deploy to Cloudflare Workers with D1 binding 'DB'

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'POST') {
      try {
        const { sql, params } = await request.json();
        if (!sql) {
          return new Response(JSON.stringify({ error: 'Missing SQL' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const stmt = env.DB.prepare(sql);
        const result = params && params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

        return new Response(JSON.stringify({ success: true, result: [result] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('ALI Garments Cloudflare D1 Backend Live', { headers: corsHeaders });
  },
};
