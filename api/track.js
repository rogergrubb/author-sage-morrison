// =============================================================================
// /api/track — Records visitor events to the sage_analytics schema.
// Runs on Vercel Edge Runtime for low latency and built-in geo headers.
//
// Public Supabase URL + anon key are embedded by design: the security boundary
// is Row Level Security + the SECURITY DEFINER function that validates inputs.
// The anon key is meant to be exposed to clients — see Supabase docs.
//
// The IP hash salt is also embedded; the worst case (someone learning the salt)
// is that a known IP can be checked for presence — low impact for an author site.
// =============================================================================

export const config = { runtime: 'edge' };

const SUPABASE_URL      = 'https://vskvejzvfdqxqionhfmk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZza3Zlanp2ZmRxeHFpb25oZm1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODMzMDEsImV4cCI6MjA5MTE1OTMwMX0.1HWfcbT8F6xKD2AH6nM4xdoGcnlzl7HFl-Xui4-fvr8';
const IP_HASH_SALT      = 'sage-morrison-analytics-v1-7e9c4d3a';

const ALLOWED_EVENTS = new Set([
  'page_view', 'book_click', 'link_click',
  'amazon_click', 'contact_click', 'about_view',
  'consent_accept', 'consent_decline', 'scroll_depth',
]);

const corsHeaders = {
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

function asNumber(s) {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400, headers: corsHeaders });
  }

  const eventType  = String(body.event_type  || '').slice(0, 50);
  const sessionId  = String(body.session_id  || '').slice(0, 100);
  if (!sessionId || !ALLOWED_EVENTS.has(eventType)) {
    return new Response('Bad event', { status: 400, headers: corsHeaders });
  }

  const eventLabel = body.event_label ? String(body.event_label).slice(0, 200) : null;
  const pagePath   = body.page_path   ? String(body.page_path).slice(0, 200)   : null;
  const referrer   = body.referrer    ? String(body.referrer).slice(0, 500)    : null;
  const userAgent  = (req.headers.get('user-agent') || '').slice(0, 500) || null;

  // IP geolocation from Vercel Edge headers (no external API call, no quota).
  const ip       = clientIp(req);
  const ipHash   = ip ? await sha256Hex(ip + IP_HASH_SALT) : null;
  const country  = req.headers.get('x-vercel-ip-country')         || null;
  const region   = req.headers.get('x-vercel-ip-country-region')  || null;
  const city     = req.headers.get('x-vercel-ip-city');
  const cityDec  = city ? decodeURIComponent(city) : null;
  const lat      = asNumber(req.headers.get('x-vercel-ip-latitude'));
  const lon      = asNumber(req.headers.get('x-vercel-ip-longitude'));
  const timezone = req.headers.get('x-vercel-ip-timezone')        || null;

  // Call the SECURITY DEFINER RPC. Anon key only allows EXECUTE on this function.
  const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/track_event`;
  const rpcRes = await fetch(rpcUrl, {
    method : 'POST',
    headers: {
      'content-type' : 'application/json',
      'accept'       : 'application/json',
      'apikey'       : SUPABASE_ANON_KEY,
      'authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'content-profile': 'sage_analytics',
    },
    body: JSON.stringify({
      p_session_id  : sessionId,
      p_event_type  : eventType,
      p_event_label : eventLabel,
      p_page_path   : pagePath,
      p_referrer    : referrer,
      p_user_agent  : userAgent,
      p_ip_hash     : ipHash,
      p_country     : country,
      p_region      : region,
      p_city        : cityDec,
      p_latitude    : lat,
      p_longitude   : lon,
      p_timezone    : timezone,
    }),
  });

  if (!rpcRes.ok) {
    const errText = await rpcRes.text();
    return new Response(`Upstream ${rpcRes.status}: ${errText}`, {
      status: 502,
      headers: corsHeaders,
    });
  }

  return new Response(null, { status: 204, headers: corsHeaders });
}
