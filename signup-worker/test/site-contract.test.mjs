import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const index = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const client = await readFile(new URL('../../commune-signup.js', import.meta.url), 'utf8');
const blackViolet = await readFile(new URL('../../black-violet.js', import.meta.url), 'utf8');
const horizonDrift = await readFile(new URL('../../horizon-drift.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const pilotCheck = await readFile(new URL('../scripts/check-pilot.mjs', import.meta.url), 'utf8');

test('the staged website contains no Mailchimp delivery path', () => {
  assert.doesNotMatch(index, /list-manage|data-mailchimp|kitwebster\.us2|mc_signupsource/i);
  assert.doesNotMatch(client, /list-manage|data-mailchimp|kitwebster\.us2|mc_signupsource/i);
});

test('the website is configured for only the approved signup bridge', () => {
  assert.match(index, /name="commune-signup-endpoint" content="https:\/\/commune-sound-signup\.commune-sound-signup-worker\.workers\.dev\/subscribe"/);
  assert.match(index, /name="commune-turnstile-sitekey" content="0x4AAAAAAEMwO4bk4jEHgDVY"/);
  assert.match(index, /data-commune-signup="true"/);
  assert.match(index, /commune-signup\.js/);
  assert.match(index, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(client, /endpoint\.includes\('REQUIRED'\)/);
});

test('the client retains fail-closed guards for any future missing configuration', () => {
  assert.doesNotMatch(index, /WORKER_ENDPOINT_REQUIRED/);
  assert.doesNotMatch(index, /TURNSTILE_SITE_KEY_REQUIRED/);
  assert.match(client, /endpoint\.includes\('REQUIRED'\)/);
  assert.match(client, /sitekey\.includes\('REQUIRED'\)/);
  assert.match(client, /button\.disabled = true/);
});

test('the signup form states the mailing purpose and withdrawal right', () => {
  assert.match(index, /Ticket links, future dates and occasional Commune Sound updates\./);
  assert.match(index, /Unsubscribe anytime\./);
});

test('the deployment has a no-contact pilot verification path', () => {
  assert.equal(packageJson.scripts['check:pilot'], 'node scripts/check-pilot.mjs');
  assert.match(pilotCheck, /missing consent fails before provider use/);
  assert.match(pilotCheck, /No contact was submitted\./);
  assert.doesNotMatch(pilotCheck, /person@example\.com|buyer@example\.com/);
});

test('the Black Violet wordmark cannot flash the retired banner while loading', () => {
  assert.doesNotMatch(index, /src="assets\/commune-wordmark-cropped\.jpeg"/);
  assert.match(index, /src="assets\/gpt-wordmark-studies\/02-gradient-monoliths-alpha-v2\.webp\?v=black-violet-2"/);
  assert.ok(blackViolet.indexOf('await image.decode()') < blackViolet.indexOf("classList.remove('portal-study-loading')"));
});

test('Horizon Drift is the restrained production background', () => {
  assert.match(index, /data-horizon-drift/);
  assert.match(index, /horizon-drift\.js\?v=commune-4\.12\.0/);
  assert.match(horizonDrift, /fragcoord-ribbons-lnbg0175-adaptation/);
  assert.match(horizonDrift, /const SPEED = 0\.042/);
  assert.match(horizonDrift, /const FRAME_RATE_CAP = 22/);
  assert.match(horizonDrift, /prefers-reduced-motion: reduce/);
  assert.match(horizonDrift, /--horizon-drift-scroll-factor/);
});

test('the production page does not restore retired particle or liquid effects', () => {
  assert.doesNotMatch(index, /portal-particles\.js|portal-version\.js|liquid-chrome/i);
  assert.match(blackViolet, /document\.body\.dataset\.visuals = 'static'/);
});
