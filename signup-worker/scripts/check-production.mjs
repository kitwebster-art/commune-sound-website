import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const client = await readFile(new URL('../../commune-signup.js', import.meta.url), 'utf8');
const failures = [];

const endpointMatch = index.match(/<meta\s+name="commune-signup-endpoint"\s+content="([^"]+)"/i);
const endpoint = endpointMatch?.[1] || '';
let endpointValid = false;
try {
  const url = new URL(endpoint);
  endpointValid = (
    url.protocol === 'https:'
    && url.pathname === '/subscribe'
    && !url.search
    && !url.hash
    && (
      url.hostname === 'signup.communesound.com.au'
      || url.hostname.endsWith('.workers.dev')
    )
  );
} catch {
  endpointValid = false;
}

if (index.includes('TURNSTILE_SITE_KEY_REQUIRED')) {
  failures.push('Replace TURNSTILE_SITE_KEY_REQUIRED with the verified production Turnstile site key.');
}
if (!endpointValid) {
  failures.push('Replace WORKER_ENDPOINT_REQUIRED with the verified HTTPS Worker /subscribe endpoint.');
}
if (/list-manage|data-mailchimp|kitwebster\.us2|mc_signupsource/i.test(`${index}\n${client}`)) {
  failures.push('A Mailchimp delivery path remains in the active website files.');
}

if (failures.length) {
  for (const failure of failures) process.stderr.write(`Production gate failed: ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('Production signup gate passed.\n');
}
