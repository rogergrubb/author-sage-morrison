// =============================================================================
// /api/subscribe — Newsletter signup. Stores email in sage_analytics.subscribers.
// Vercel Edge runtime; geo from Vercel headers; IP hashed before storage.
// =============================================================================
export const config = { runtime: 'edge' };

const SUPABASE_URL      = 'https://vskvejzvfdqxqionhfmk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZza3Zlanp2ZmRxeHFpb25oZm1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODMzMDEsImV4cCI6MjA5MTE1OTMwMX0.1HWfcbT8F6xKD2AH6nM4xdoGcnlzl7HFl-Xui4-fvr8';
const IP_HASH_SALT      = 'sage-morrison-analytics-v1-7e9c4d3a';

const cors = {
  'access-control-allow-origin' : '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function clientIp(req) {
  const xff = req.headers.get('x-forwarded-for') || '';
  return xff.split(',')[0].trim() || req.headers.get('x-real-ip') || '';
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

  let body;
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400, headers: cors }); }

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return new Response(JSON.stringify({ status: 'invalid' }), {
      status: 400, headers: { ...cors, 'content-type': 'application/json' },
    });
  }

  const source  = String(body.source || 'newsletter_page').slice(0, 50);
  const ip      = clientIp(req);
  const ipHash  = ip ? await sha256Hex(ip + IP_HASH_SALT) : null;
  const country = req.headers.get('x-vercel-ip-country') || null;

  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sage_add_subscriber`, {
    method : 'POST',
    headers: {
      'content-type' : 'application/json',
      'apikey'       : SUPABASE_ANON_KEY,
      'authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_email: email, p_source: source, p_country: country, p_ip_hash: ipHash }),
  });

  if (!rpcRes.ok) {
    return new Response(`Upstream ${rpcRes.status}`, { status: 502, headers: cors });
  }
  const result = await rpcRes.json();  // 'subscribed' / 'already_subscribed' / 'invalid'

  return new Response(JSON.stringify({ status: result }), {
    status: 200, headers: { ...cors, 'content-type': 'application/json' },
  });
}
