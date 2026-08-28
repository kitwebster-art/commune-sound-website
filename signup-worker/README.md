# Commune Sound signup Worker

This Worker is the server-side bridge between the public Commune Sound signup form and the existing Resend `Commune Sound Community` segment.

New website signups receive one immediate welcome email from `hello@communesound.com.au`. The message uses a daily contact-scoped idempotency key to prevent duplicates, includes a signed unsubscribe link, and returns a separate `confirmation_sent` result so the website never confuses a successful signup with a welcome-email delivery problem.

The approved Free-plan service is deployed at `https://commune-sound-signup.commune-sound-signup-worker.workers.dev`. Commune Sound website version 4.1.0 began using it on 12 August 2026 after Kit approved publication. DNS was not changed. Humanitix remains on Mailchimp until its separate consent tests pass.

## Security and consent contract

- Accept requests only from `communesound.com.au` and `www.communesound.com.au`.
- Require JSON, explicit signup consent, the exact website source marker and a valid single-use Turnstile token.
- After Turnstile succeeds, apply Cloudflare's rate-limit binding to a one-way hash of the normalised email before calling Resend. This avoids storing the email itself as a limiter key and avoids penalising unrelated people on shared Wi-Fi.
- Keep the Resend key, segment ID and Turnstile secret in Worker secrets, never HTML, Git or Mission Control records.
- Do not log email addresses or names.
- A person submitting the form is making a new explicit opt-in. Existing contacts are updated and added to the segment. A previously unsubscribed contact is resubscribed only through this fresh form submission.
- Store `consent_source`, `consent_at` and `consent_version` on the Resend contact so a fresh website opt-in remains auditable after it leaves the browser.
- Honeypot submissions return a generic success without touching Resend.
- Public responses never expose Resend errors or contact identifiers.

The separate `/humanitix-opt-in` route is prepared for a future Humanitix automation. It has no browser CORS path, requires a private bearer secret, accepts only an explicit order-level marketing opt-in with a valid order reference and consent timestamp, uses a separate hashed rate limit, and records `consent_reference` alongside the consent properties. Do not connect it until a controlled Humanitix order proves the exact field mapping and the automation filters out every non-opt-in order.

## Local checks

```bash
npm install
npm run check
```

`npm run check:production` must pass immediately before publishing so the static site cannot be activated in a half-configured state.

## Approval-gated production activation

1. Completed: Resend string contact properties `consent_source`, `consent_at`, `consent_version` and `consent_reference` exist.
2. Completed: the Free-plan Worker and Managed Turnstile widget are deployed for both Commune Sound hostnames.
3. Completed: `RESEND_API_KEY`, `RESEND_SEGMENT_ID`, `TURNSTILE_SECRET`, `HUMANITIX_SHARED_SECRET` and `UNSUBSCRIBE_SECRET` are stored as Worker secrets.
4. Completed: the no-contact pilot passed health, cache, exact CORS and missing-consent checks.
5. Completed: the staged site contains the verified Worker endpoint and public Turnstile site key.
6. Completed: controlled new and duplicate signups passed and their consent properties were verified in Resend and Mission Control.
7. Remaining: prove explicit re-opt-in safely, without changing a real subscriber unexpectedly.
8. Completed 12 August 2026: Kit approved publication, website version 4.1.0 was published, GitHub Pages completed successfully, and the live form loaded the approved endpoint, email field, verification response field and enabled submit button without a Mailchimp delivery path or browser error.
9. Keep Humanitix connected to Mailchimp until its private replacement path is independently verified.

The local Wrangler client is authenticated with least-privilege OAuth and encrypted credential storage. The pilot remains on the Free plan. Do not enable a paid plan, change DNS or publish the website automatically. Measure the pilot before deciding whether the signup bridge needs Workers Paid or a Cloudflare DNS migration.

## Humanitix cutover gate

Humanitix currently has no direct Resend integration. Its verified native Mailchimp bridge must remain connected while the replacement is tested.

1. Use the order-level `New Contact` Humanitix trigger, not the ticket-level `New Attendee` trigger.
2. Create a controlled order and confirm the trigger exposes the default host marketing opt-in, buyer email, buyer names, order reference and order timestamp.
3. Add a fail-closed filter that continues only when the marketing opt-in value is exactly affirmative.
4. POST only the bounded fields documented above to `/humanitix-opt-in` with the private bearer secret.
5. Confirm a new opted-in contact reaches Resend with all four consent properties, and a non-opt-in order produces no request and no contact.
6. Confirm retrying the same order is idempotent and Mission Control's Resend sync sees the result.
7. Disconnect Humanitix from Mailchimp only after all controlled checks pass.
