const RESEND_BASE_URL = 'https://api.resend.com';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_BODY_BYTES = 8_192;
const WEBSITE_CONSENT_VERSION = 'commune-website-v1-2026-08-11';
const HUMANITIX_CONSENT_VERSION = 'humanitix-default-host-opt-in-2025';
const CONTACT_ID_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

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

const escapeHtml = value => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const html = (body, status = 200) => new Response(body, {
  status,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  },
});

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

async function unsubscribeSignature(env, contactId) {
  if (!env.UNSUBSCRIBE_SECRET || !CONTACT_ID_PATTERN.test(contactId)) return '';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.UNSUBSCRIBE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(contactId));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
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
    if (created.response.ok && created.data.id) return String(created.data.id);
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

  if (current.data.id) return String(current.data.id);
  const refreshed = await resendRequest(env, `/contacts/${encodedEmail}`, { method: 'GET' });
  if (!refreshed.response.ok || !refreshed.data.id) throw new Error('provider_contact_id_failed');
  return String(refreshed.data.id);
}

async function sendWelcomeEmail(request, env, { email, firstName, contactId }) {
  if (
    !env.WELCOME_FROM
    || !env.WELCOME_REPLY_TO
    || !env.UNSUBSCRIBE_SECRET
    || !CONTACT_ID_PATTERN.test(contactId)
  ) {
    throw new Error('welcome_not_configured');
  }

  const signature = await unsubscribeSignature(env, contactId);
  const unsubscribeUrl = new URL('/unsubscribe', request.url);
  unsubscribeUrl.searchParams.set('id', contactId);
  unsubscribeUrl.searchParams.set('sig', signature);
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi,';
  const plainGreeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const emailHtml = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#08070d;color:#e5e4e8;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Future dates, ticket links and occasional Commune Sound updates.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#08070d;">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #2b2638;background:#0d0b14;">
            <tr>
              <td style="padding:38px 34px;">
                <p style="margin:0 0 24px;color:#a18bc9;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Commune Sound</p>
                <h1 style="margin:0 0 24px;color:#f0edf5;font-size:30px;line-height:1.15;">You're on the list.</h1>
                <p style="margin:0 0 18px;color:#d8d3df;font-size:16px;line-height:1.6;">${greeting}</p>
                <p style="margin:0 0 18px;color:#d8d3df;font-size:16px;line-height:1.6;">We'll email you about future dates, ticket links and occasional Commune Sound updates.</p>
                <p style="margin:0;color:#d8d3df;font-size:16px;line-height:1.6;">See you on the dancefloor.</p>
                <div style="margin-top:30px;color:#9f9f9f;font-family:'Times New Roman',serif;font-size:13px;font-style:italic;line-height:1.5;">
                  <strong><em>Sincerely,</em></strong><br>
                  Kit Webster<br>
                  <strong><em>STUDIO KIT WEBSTER</em></strong><br>
                  web: <a href="https://kitwebster.com" style="color:#1656e7;">kitwebster.com</a><br>
                  insta: <a href="https://www.instagram.com/iikit/" style="color:#1656e7;">@iikit</a>
                </div>
                <p style="margin:34px 0 0;color:#77717f;font-size:11px;line-height:1.5;">You received this because you joined the Commune Sound mailing list. <a href="${escapeHtml(unsubscribeUrl.toString())}" style="color:#a18bc9;">Unsubscribe</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const emailText = `${plainGreeting}\n\nYou're on the Commune Sound list. We'll email you about future dates, ticket links and occasional Commune Sound updates.\n\nSee you on the dancefloor.\n\nSincerely,\nKit Webster\nSTUDIO KIT WEBSTER\nweb: kitwebster.com\ninsta: @iikit\n\nUnsubscribe: ${unsubscribeUrl}`;
  const dateBucket = new Date().toISOString().slice(0, 10);
  const sent = await resendRequest(env, '/emails', {
    method: 'POST',
    headers: { 'Idempotency-Key': `commune-welcome/${contactId}/${dateBucket}` },
    body: JSON.stringify({
      from: env.WELCOME_FROM,
      to: [email],
      reply_to: env.WELCOME_REPLY_TO,
      subject: "You're on the Commune Sound list",
      html: emailHtml,
      text: emailText,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      tags: [{ name: 'message_type', value: 'commune_signup_welcome' }],
    }),
  });
  if (!sent.response.ok) throw new Error('welcome_send_failed');
  return String(sent.data.id || '');
}

async function handleUnsubscribe(request, env, url) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'not_found' }, 404);
  }
  const contactId = String(url.searchParams.get('id') || '');
  const providedSignature = String(url.searchParams.get('sig') || '');
  const expectedSignature = await unsubscribeSignature(env, contactId);
  if (!expectedSignature || !(await secretMatches(providedSignature, expectedSignature))) {
    return html('<!doctype html><title>Invalid link</title><p>This unsubscribe link is invalid.</p>', 400);
  }

  if (request.method === 'GET') {
    const action = escapeHtml(`${url.pathname}${url.search}`);
    return html(`<!doctype html>
<html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe from Commune Sound</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#08070d;color:#e5e4e8;font-family:Arial,sans-serif;">
  <main style="width:min(520px,calc(100% - 40px));padding:36px;border:1px solid #2b2638;background:#0d0b14;box-sizing:border-box;">
    <p style="color:#a18bc9;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Commune Sound</p>
    <h1 style="font-size:28px;">Leave the mailing list?</h1>
    <p style="color:#d8d3df;line-height:1.6;">You will stop receiving Commune Sound event emails.</p>
    <form method="post" action="${action}"><button type="submit" style="margin-top:12px;padding:13px 20px;border:0;background:#a18bc9;color:#08070d;font-weight:700;cursor:pointer;">Unsubscribe</button></form>
  </main>
</body></html>`);
  }

  const updated = await resendRequest(env, `/contacts/${encodeURIComponent(contactId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ unsubscribed: true }),
  });
  if (!updated.response.ok) return html('<!doctype html><title>Try again</title><p>Unsubscribe failed. Please try again.</p>', 502);
  return html(`<!doctype html>
<html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed from Commune Sound</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#08070d;color:#e5e4e8;font-family:Arial,sans-serif;">
  <main style="width:min(520px,calc(100% - 40px));padding:36px;border:1px solid #2b2638;background:#0d0b14;box-sizing:border-box;">
    <p style="color:#a18bc9;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Commune Sound</p>
    <h1 style="font-size:28px;">You're unsubscribed.</h1>
    <p style="color:#d8d3df;line-height:1.6;">You will not receive any more Commune Sound mailing-list emails.</p>
  </main>
</body></html>`);
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
  if (url.pathname === '/unsubscribe') {
    return handleUnsubscribe(request, env, url);
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
    const contactId = await upsertResendContact(env, {
      email,
      firstName,
      consentProperties: {
        consent_source: 'commune_sound_website',
        consent_at: new Date().toISOString(),
        consent_version: WEBSITE_CONSENT_VERSION,
      },
    });
    let confirmationSent = false;
    try {
      await sendWelcomeEmail(request, env, { email, firstName, contactId });
      confirmationSent = true;
    } catch (error) {
      console.error('Commune welcome email failure', String(error?.message || 'unknown'));
    }
    return json({ ok: true, confirmation_sent: confirmationSent }, 200, cors);
  } catch (error) {
    console.error('Commune signup provider failure', String(error?.message || 'unknown'));
    return json({ error: 'temporarily_unavailable' }, 502, cors);
  }
}

export default {
  fetch: handleRequest,
};
