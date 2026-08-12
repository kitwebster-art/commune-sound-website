const rawEndpoint = process.env.COMMUNE_SIGNUP_ENDPOINT || process.argv[2] || '';
let endpoint;
try {
  endpoint = new URL(rawEndpoint);
} catch {
  process.stderr.write('Pilot check requires the deployed HTTPS /subscribe endpoint.\n');
  process.exit(2);
}

if (
  endpoint.protocol !== 'https:'
  || endpoint.pathname !== '/subscribe'
  || endpoint.search
  || endpoint.hash
  || !(
    endpoint.hostname === 'signup.communesound.com.au'
    || endpoint.hostname.endsWith('.workers.dev')
  )
) {
  process.stderr.write('Pilot endpoint must be the exact approved HTTPS Worker /subscribe URL.\n');
  process.exit(2);
}

const approvedOrigin = 'https://communesound.com.au';
const rejectedOrigin = 'https://unapproved.example';
const checks = [];

const record = (name, condition, detail) => {
  checks.push({ name, ok: Boolean(condition), detail });
};

const healthUrl = new URL('/health', endpoint);
const health = await fetch(healthUrl, { redirect: 'error' });
const healthBody = await health.json().catch(() => ({}));
record('health route', health.status === 200 && healthBody.ok === true, `HTTP ${health.status}`);
record('health is not cached', health.headers.get('cache-control') === 'no-store', health.headers.get('cache-control') || 'missing');

const preflight = await fetch(endpoint, {
  method: 'OPTIONS',
  redirect: 'error',
  headers: {
    Origin: approvedOrigin,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type',
  },
});
record('approved-origin preflight', preflight.status === 204, `HTTP ${preflight.status}`);
record(
  'approved-origin CORS echo',
  preflight.headers.get('access-control-allow-origin') === approvedOrigin,
  preflight.headers.get('access-control-allow-origin') || 'missing',
);

const rejected = await fetch(endpoint, {
  method: 'OPTIONS',
  redirect: 'error',
  headers: { Origin: rejectedOrigin },
});
record('unapproved origin rejected', rejected.status === 403, `HTTP ${rejected.status}`);
record(
  'unapproved origin gets no CORS permission',
  !rejected.headers.get('access-control-allow-origin'),
  rejected.headers.get('access-control-allow-origin') || 'none',
);

const invalidConsent = await fetch(endpoint, {
  method: 'POST',
  redirect: 'error',
  headers: { Origin: approvedOrigin, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'non-contact@example.invalid',
    first_name: '',
    website: '',
    consent: false,
    source: 'commune_sound_website',
    turnstile_token: '',
  }),
});
record('missing consent fails before provider use', invalidConsent.status === 400, `HTTP ${invalidConsent.status}`);

const failures = checks.filter(check => !check.ok);
for (const check of checks) {
  process.stdout.write(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}\n`);
}
if (failures.length) {
  process.stderr.write(`Pilot check failed: ${failures.length} of ${checks.length} checks failed.\n`);
  process.exit(1);
}
process.stdout.write(`Pilot check passed: ${checks.length} of ${checks.length}. No contact was submitted.\n`);
