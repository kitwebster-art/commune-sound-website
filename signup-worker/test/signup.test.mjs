import assert from 'node:assert/strict';
import test from 'node:test';

import { handleRequest } from '../src/index.js';

const origin = 'https://communesound.com.au';
const baseEnv = overrides => ({
  ALLOWED_ORIGINS: `${origin},https://www.communesound.com.au`,
  TURNSTILE_HOSTNAMES: 'communesound.com.au,www.communesound.com.au',
  TURNSTILE_SECRET: 'turnstile-secret',
  RESEND_API_KEY: 'resend-secret',
  RESEND_SEGMENT_ID: 'segment-123',
  HUMANITIX_SHARED_SECRET: 'humanitix-secret',
  SIGNUP_RATE_LIMITER: { limit: async () => ({ success: true }) },
  HUMANITIX_RATE_LIMITER: { limit: async () => ({ success: true }) },
  ...overrides,
});

const request = (body, overrides = {}) => new Request('https://signup.communesound.com.au/subscribe', {
  method: 'POST',
  headers: {
    Origin: origin,
    'Content-Type': 'application/json',
    'CF-Connecting-IP': '203.0.113.10',
    ...(overrides.headers || {}),
  },
  body: JSON.stringify({
    email: 'person@example.com',
    first_name: 'Person',
    consent: true,
    source: 'commune_sound_website',
    website: '',
    turnstile_token: 'valid-token',
    ...body,
  }),
});

const turnstileSuccess = () => new Response(JSON.stringify({
  success: true,
  action: 'subscribe',
  hostname: 'communesound.com.au',
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

const humanitixRequest = (body, overrides = {}) => new Request('https://signup.communesound.com.au/humanitix-opt-in', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer humanitix-secret',
    'Content-Type': 'application/json',
    ...(overrides.headers || {}),
  },
  body: JSON.stringify({
    email: 'buyer@example.com',
    first_name: 'Buyer',
    last_name: 'Person',
    marketing_opt_in: true,
    source: 'humanitix',
    order_id: 'ORDER_1234',
    consent_at: '2026-08-11T04:30:00Z',
    ...body,
  }),
});

test('allows a preflight only for an approved origin', async () => {
  const response = await handleRequest(new Request('https://signup.communesound.com.au/subscribe', {
    method: 'OPTIONS',
    headers: { Origin: origin },
  }), baseEnv());
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
});

test('rejects an unapproved origin before any provider request', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error('should not fetch'); };
  const response = await handleRequest(request({}, { headers: { Origin: 'https://attacker.example' } }), baseEnv());
  assert.equal(response.status, 403);
});

test('rejects invalid email or missing consent', async () => {
  assert.equal((await handleRequest(request({ email: 'not-an-email' }), baseEnv())).status, 400);
  assert.equal((await handleRequest(request({ consent: false }), baseEnv())).status, 400);
});

test('quietly accepts a honeypot without calling Turnstile or Resend', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error('should not fetch'); };
  const response = await handleRequest(request({ website: 'bot-filled' }), baseEnv());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('rejects a failed Turnstile check before Resend', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async url => {
    calls += 1;
    assert.equal(String(url), 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    return new Response(JSON.stringify({ success: false }), { status: 200 });
  };
  const response = await handleRequest(request({}), baseEnv());
  assert.equal(response.status, 403);
  assert.equal(calls, 1);
});

test('creates a new subscribed contact directly in the Commune segment', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('turnstile')) return turnstileSuccess();
    if (options.method === 'GET') return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ id: 'contact-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const response = await handleRequest(request({}), baseEnv());
  assert.equal(response.status, 200);
  const create = calls.find(call => call.url.endsWith('/contacts') && call.options.method === 'POST');
  assert.ok(create);
  const payload = JSON.parse(create.options.body);
  assert.equal(payload.email, 'person@example.com');
  assert.equal(payload.unsubscribed, false);
  assert.deepEqual(payload.segments, [{ id: 'segment-123' }]);
  assert.equal(payload.properties.consent_source, 'commune_sound_website');
  assert.equal(payload.properties.consent_version, 'commune-website-v1-2026-08-11');
  assert.match(payload.properties.consent_at, /^\d{4}-\d{2}-\d{2}T/);
});

test('fresh explicit signup resubscribes an existing contact and restores segment membership', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('turnstile')) return turnstileSuccess();
    if (options.method === 'GET') {
      return new Response(JSON.stringify({ id: 'contact-1', unsubscribed: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ id: 'contact-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const response = await handleRequest(request({}), baseEnv());
  assert.equal(response.status, 200);
  const patch = calls.find(call => call.options.method === 'PATCH');
  assert.equal(JSON.parse(patch.options.body).unsubscribed, false);
  assert.ok(calls.some(call => call.url.includes('/segments/segment-123') && call.options.method === 'POST'));
});

test('rate limiting uses a non-PII key after Turnstile and before Resend', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let rateKey = '';
  globalThis.fetch = async url => {
    assert.ok(String(url).includes('turnstile'));
    return turnstileSuccess();
  };
  const env = baseEnv({
    SIGNUP_RATE_LIMITER: {
      limit: async ({ key }) => {
        rateKey = key;
        return { success: false };
      },
    },
  });
  assert.equal((await handleRequest(request({}), env)).status, 429);
  assert.match(rateKey, /^[a-f0-9]{64}$/);
  assert.equal(rateKey.includes('person@example.com'), false);
});

test('rejects an oversized body even when Content-Length is absent', async () => {
  const oversized = request({ first_name: 'A'.repeat(9_000) });
  assert.equal((await handleRequest(oversized, baseEnv())).status, 413);
});

test('does not erase an existing first name when the optional field is blank', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('turnstile')) return turnstileSuccess();
    if (options.method === 'GET') {
      return new Response(JSON.stringify({ id: 'contact-1' }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: 'contact-1' }), { status: 200 });
  };
  assert.equal((await handleRequest(request({ first_name: '' }), baseEnv())).status, 200);
  const patch = calls.find(call => call.options.method === 'PATCH');
  const payload = JSON.parse(patch.options.body);
  assert.equal(payload.first_name, undefined);
  assert.equal(payload.unsubscribed, false);
  assert.equal(payload.properties.consent_source, 'commune_sound_website');
});

test('provider failures remain generic and do not leak contact data', async t => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  });
  console.error = () => {};
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('turnstile')) return turnstileSuccess();
    if (options.method === 'GET') return new Response('{}', { status: 500, headers: { 'Content-Type': 'application/json' } });
    throw new Error('unexpected');
  };
  const response = await handleRequest(request({}), baseEnv());
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'temporarily_unavailable' });
});

test('Humanitix intake rejects a missing bearer secret before reading contact data', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error('should not fetch'); };
  const response = await handleRequest(humanitixRequest({}, { headers: { Authorization: '' } }), baseEnv());
  assert.equal(response.status, 401);
});

test('Humanitix intake rejects non-opt-in orders', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error('should not fetch'); };
  assert.equal((await handleRequest(humanitixRequest({ marketing_opt_in: false }), baseEnv())).status, 400);
});

test('Humanitix intake creates a consent-traceable Resend contact without Turnstile', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    assert.equal(String(url).includes('turnstile'), false);
    if (options.method === 'GET') return new Response('{}', { status: 404 });
    return new Response(JSON.stringify({ id: 'contact-humanitix' }), { status: 200 });
  };
  const response = await handleRequest(humanitixRequest({}), baseEnv());
  assert.equal(response.status, 200);
  const create = calls.find(call => call.url.endsWith('/contacts') && call.options.method === 'POST');
  const payload = JSON.parse(create.options.body);
  assert.equal(payload.email, 'buyer@example.com');
  assert.equal(payload.first_name, 'Buyer');
  assert.equal(payload.last_name, 'Person');
  assert.equal(payload.properties.consent_source, 'humanitix_host_marketing_opt_in');
  assert.equal(payload.properties.consent_at, '2026-08-11T04:30:00.000Z');
  assert.equal(payload.properties.consent_version, 'humanitix-default-host-opt-in-2025');
  assert.equal(payload.properties.consent_reference, 'ORDER_1234');
});

test('Humanitix intake rejects invalid consent time and rate limits on a hashed order reference', async t => {
  assert.equal((await handleRequest(humanitixRequest({ consent_at: 'not-a-date' }), baseEnv())).status, 400);
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error('should not fetch'); };
  let rateKey = '';
  const env = baseEnv({
    HUMANITIX_RATE_LIMITER: {
      limit: async ({ key }) => {
        rateKey = key;
        return { success: false };
      },
    },
  });
  assert.equal((await handleRequest(humanitixRequest({}), env)).status, 429);
  assert.match(rateKey, /^[a-f0-9]{64}$/);
  assert.equal(rateKey.includes('ORDER_1234'), false);
});
