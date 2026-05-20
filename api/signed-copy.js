// =============================================================================
// /api/signed-copy — Reader requests a signed copy. Stores in sage_analytics.
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

async function sha256Hex(s) {
  const data = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const trim = (v, n) => (v == null ? '' : String(v).slice(0, n).trim());

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

  let b;
  try { b = await req.json(); } catch { return new Response('Bad JSON', { status: 400, headers: cors }); }

  const required = ['book', 'name', 'email', 'address1', 'city', 'postal_code', 'country'];
  for (const k of required) {
    if (!b[k] || !String(b[k]).trim()) {
      return new Response(JSON.stringify({ status: 'missing', field: k }),
        { status: 400, headers: { ...cors, 'content-type': 'application/json' }});
    }
  }
  const email = trim(b.email, 254).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return new Response(JSON.stringify({ status: 'invalid_email' }),
      { status: 400, headers: { ...cors, 'content-type': 'application/json' }});
  }

  const xff = req.headers.get('x-forwarded-for') || '';
  const ip  = xff.split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  const ipHash = ip ? await sha256Hex(ip + IP_HASH_SALT) : null;

  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sage_signed_copy_request`, {
    method : 'POST',
    headers: {
      'content-type' : 'application/json',
      'apikey'       : SUPABASE_ANON_KEY,
      'authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      p_book:        trim(b.book, 60),
      p_name:        trim(b.name, 200),
      p_email:       email,
      p_address1:    trim(b.address1, 200),
      p_address2:    trim(b.address2, 200),
      p_city:        trim(b.city, 100),
      p_region:      trim(b.region, 80),
      p_postal_code: trim(b.postal_code, 20),
      p_country:     trim(b.country, 60),
      p_inscription: trim(b.inscription, 500),
      p_notes:       trim(b.notes, 500),
      p_ip_hash:     ipHash,
      p_ip_country:  req.headers.get('x-vercel-ip-country') || null,
    }),
  });

  if (!rpcRes.ok) {
    const t = await rpcRes.text();
    return new Response(JSON.stringify({ status: 'upstream_error', detail: t.slice(0, 200) }),
      { status: 502, headers: { ...cors, 'content-type': 'application/json' }});
  }
  const id = await rpcRes.json();
  return new Response(JSON.stringify({ status: 'received', id }),
    { status: 200, headers: { ...cors, 'content-type': 'application/json' }});
}
