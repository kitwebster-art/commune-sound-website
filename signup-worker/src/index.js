const RESEND_BASE_URL = 'https://api.resend.com';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_BODY_BYTES = 8_192;
const WEBSITE_CONSENT_VERSION = 'commune-website-v1-2026-08-11';
const HUMANITIX_CONSENT_VERSION = 'humanitix-default-host-opt-in-2025';

const json = (body, status, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  },
});

const splitList = value => String(value || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

const allowedOrigin = (request, env) => {
  const origin = request.headers.get('Origin') || '';
  return splitList(env.ALLOWED_ORIGINS).includes(origin) ? origin : '';
};

const corsHeaders = origin => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});

const validEmail = value => {
  const email = String(value || '').trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || /[\s\r\n]/.test(email)) return '';
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1] || !parts[1].includes('.')) return '';
  return email;
};

const cleanName = value => String(value || '')
  .replace(/[\u0000-\u001f\u007f]/g, '')
  .trim()
  .slice(0, 80);

async function readJsonBody(request) {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_BODY_BYTES) return { error: 'invalid_request', status: 413 };
  if (!String(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
    return { error: 'invalid_request', status: 415 };
  }

  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return { error: 'invalid_request', status: 400 };
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return { error: 'invalid_request', status: 413 };
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { error: 'invalid_request', status: 400 };
  }
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    return { error: 'invalid_request', status: 400 };
  }
  return { body };
}

async function hashedKey(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function secretMatches(provided, expected) {
  if (!provided || !expected) return false;
  const [providedHash, expectedHash] = await Promise.all([
    hashedKey(provided),
    hashedKey(expected),
  ]);
  let difference = providedHash.length ^ expectedHash.length;
  for (let index = 0; index < Math.max(providedHash.length, expectedHash.length); index += 1) {
    difference |= (providedHash.charCodeAt(index) || 0) ^ (expectedHash.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function verifyTurnstile(request, env, token) {
  const expectedHostnames = splitList(env.TURNSTILE_HOSTNAMES);
  if (!env.TURNSTILE_SECRET || !expectedHostnames.length || !token || String(token).length > 2_048) {
    return false;
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET,
      response: String(token),
      remoteip: request.headers.get('CF-Connecting-IP') || '',
    }),
  });
  if (!response.ok) return false;
  const result = await response.json();
  const accepted = Boolean(
    result.success
    && result.action === 'subscribe'
    && expectedHostnames.includes(result.hostname),
  );
  if (!accepted) {
    console.warn('Turnstile verification rejected', JSON.stringify({
      success: Boolean(result.success),
      action: String(result.action || ''),
      hostname: String(result.hostname || ''),
      error_codes: Array.isArray(result['error-codes']) ? result['error-codes'] : [],
    }));
  }
  return accepted;
}

async function resendRequest(env, path, options = {}) {
  if (!env.RESEND_API_KEY || !env.RESEND_SEGMENT_ID) {
    throw new Error('provider_not_configured');
  }
  const response = await fetch(`${RESEND_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'CommuneSoundSignup/1.0',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function upsertResendContact(env, { email, firstName, lastName = '', consentProperties }) {
  const encodedEmail = encodeURIComponent(email);
  const current = await resendRequest(env, `/contacts/${encodedEmail}`, { method: 'GET' });
  if (current.response.status === 404) {
    const created = await resendRequest(env, '/contacts', {
      method: 'POST',
      body: JSON.stringify({
        email,
        ...(firstName ? { first_name: firstName } : {}),
        ...(lastName ? { last_name: lastName } : {}),
        unsubscribed: false,
        properties: consentProperties,
        segments: [{ id: env.RESEND_SEGMENT_ID }],
      }),
    });
    if (!created.response.ok && created.response.status !== 409) {
      throw new Error('provider_create_failed');
    }
    if (created.response.ok) return;
  } else if (!current.response.ok) {
    throw new Error('provider_lookup_failed');
  }

  const updated = await resendRequest(env, `/contacts/${encodedEmail}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
      unsubscribed: false,
      properties: consentProperties,
    }),
  });
  if (!updated.response.ok) throw new Error('provider_update_failed');

  const segmented = await resendRequest(
    env,
    `/contacts/${encodedEmail}/segments/${encodeURIComponent(env.RESEND_SEGMENT_ID)}`,
    { method: 'POST', body: '{}' },
  );
  if (!segmented.response.ok && segmented.response.status !== 409) {
    throw new Error('provider_segment_failed');
  }
}

async function handleHumanitixOptIn(request, env) {
  if (request.method !== 'POST') return json({ error: 'not_found' }, 404);
  const authorization = String(request.headers.get('Authorization') || '');
  const providedSecret = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!(await secretMatches(providedSecret, env.HUMANITIX_SHARED_SECRET))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const parsed = await readJsonBody(request);
  if (parsed.error) return json({ error: parsed.error }, parsed.status);
  const { body } = parsed;
  const email = validEmail(body.email);
  const firstName = cleanName(body.first_name);
  const lastName = cleanName(body.last_name);
  const orderId = String(body.order_id || '').trim();
  const consentAt = String(body.consent_at || '').trim();
  const consentTime = Date.parse(consentAt);
  const consentTimeValid = Number.isFinite(consentTime)
    && consentTime >= Date.parse('2015-01-01T00:00:00Z')
    && consentTime <= Date.now() + 300_000;
  if (
    !email
    || body.marketing_opt_in !== true
    || body.source !== 'humanitix'
    || !/^[A-Za-z0-9_-]{4,100}$/.test(orderId)
    || !consentTimeValid
  ) {
    return json({ error: 'invalid_request' }, 400);
  }

  if (!env.HUMANITIX_RATE_LIMITER || typeof env.HUMANITIX_RATE_LIMITER.limit !== 'function') {
    return json({ error: 'temporarily_unavailable' }, 503);
  }
  const rateKey = await hashedKey(`humanitix:${orderId}`);
  const rate = await env.HUMANITIX_RATE_LIMITER.limit({ key: rateKey });
  if (!rate.success) return json({ error: 'too_many_requests' }, 429);

  try {
    await upsertResendContact(env, {
      email,
      firstName,
      lastName,
      consentProperties: {
        consent_source: 'humanitix_host_marketing_opt_in',
        consent_at: new Date(consentTime).toISOString(),
        consent_version: HUMANITIX_CONSENT_VERSION,
        consent_reference: orderId,
      },
    });
    return json({ ok: true }, 200);
  } catch (error) {
    console.error('Commune Humanitix provider failure', String(error?.message || 'unknown'));
    return json({ error: 'temporarily_unavailable' }, 502);
  }
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/health') {
    return json({ ok: true }, 200);
  }
  if (url.pathname === '/humanitix-opt-in') {
    return handleHumanitixOptIn(request, env);
  }

  const origin = allowedOrigin(request, env);
  if (!origin) return json({ error: 'forbidden' }, 403);
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST' || url.pathname !== '/subscribe') {
    return json({ error: 'not_found' }, 404, cors);
  }

  const parsed = await readJsonBody(request);
  if (parsed.error) return json({ error: parsed.error }, parsed.status, cors);
  const { body } = parsed;

  // Quietly accept bot-filled honeypots without touching Turnstile or Resend.
  if (String(body.website || '').trim()) return json({ ok: true }, 200, cors);

  const email = validEmail(body.email);
  const firstName = cleanName(body.first_name);
  if (!email || body.consent !== true || body.source !== 'commune_sound_website') {
    return json({ error: 'invalid_request' }, 400, cors);
  }

  let verified = false;
  try {
    verified = await verifyTurnstile(request, env, body.turnstile_token);
  } catch {
    verified = false;
  }
  if (!verified) return json({ error: 'verification_failed' }, 403, cors);

  if (!env.SIGNUP_RATE_LIMITER || typeof env.SIGNUP_RATE_LIMITER.limit !== 'function') {
    return json({ error: 'temporarily_unavailable' }, 503, cors);
  }
  const rateKey = await hashedKey(`commune-signup:${email}`);
  const rate = await env.SIGNUP_RATE_LIMITER.limit({ key: rateKey });
  if (!rate.success) return json({ error: 'too_many_requests' }, 429, cors);

  try {
    await upsertResendContact(env, {
      email,
      firstName,
      consentProperties: {
        consent_source: 'commune_sound_website',
        consent_at: new Date().toISOString(),
        consent_version: WEBSITE_CONSENT_VERSION,
      },
    });
    return json({ ok: true }, 200, cors);
  } catch (error) {
    console.error('Commune signup provider failure', String(error?.message || 'unknown'));
    return json({ error: 'temporarily_unavailable' }, 502, cors);
  }
}

export default {
  fetch: handleRequest,
};
