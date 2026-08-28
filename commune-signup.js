(() => {
  const form = document.querySelector('[data-commune-signup="true"]');
  if (!(form instanceof HTMLFormElement)) return;

  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('.form-status');
  const endpoint = document.querySelector('meta[name="commune-signup-endpoint"]')?.content || '';
  const sitekey = document.querySelector('meta[name="commune-turnstile-sitekey"]')?.content || '';
  const widget = form.querySelector('[data-turnstile-widget]');
  const successPanel = form.querySelector('[data-signup-success]');
  let turnstileWidgetId = null;
  let turnstileToken = '';

  const setStatus = (message, state = '') => {
    status.textContent = message;
    status.dataset.state = state;
  };

  const resetVerification = () => {
    turnstileToken = '';
    if (turnstileWidgetId !== null && window.turnstile) {
      window.turnstile.reset(turnstileWidgetId);
    }
  };

  const renderVerification = () => {
    if (!window.turnstile || !widget || !sitekey || sitekey.includes('REQUIRED')) return false;
    turnstileWidgetId = window.turnstile.render(widget, {
      sitekey,
      theme: 'dark',
      size: 'flexible',
      action: 'subscribe',
      callback: token => {
        turnstileToken = token;
        setStatus('');
      },
      'expired-callback': () => { turnstileToken = ''; },
      'error-callback': () => {
        turnstileToken = '';
        setStatus('Verification could not load. Please try again.', 'error');
      },
    });
    return true;
  };

  const waitForTurnstile = () => {
    if (renderVerification()) return;
    window.setTimeout(() => {
      if (!renderVerification()) {
        button.disabled = true;
        setStatus('Signup is being upgraded. Please try again soon.', 'error');
      }
    }, 1_500);
  };

  if (
    !endpoint
    || !endpoint.startsWith('https://')
    || endpoint.includes('REQUIRED')
    || sitekey.includes('REQUIRED')
  ) {
    button.disabled = true;
    setStatus('Signup is being upgraded. Please try again soon.', 'error');
    return;
  }
  waitForTurnstile();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!turnstileToken) {
      setStatus('Please complete the quick verification first.', 'error');
      return;
    }

    button.disabled = true;
    setStatus('Joining...', 'loading');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const data = new FormData(form);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          first_name: String(data.get('first_name') || ''),
          email: String(data.get('email') || ''),
          website: String(data.get('website') || ''),
          consent: true,
          source: 'commune_sound_website',
          turnstile_token: turnstileToken,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error('signup_failed');
      form.reset();
      form.dataset.state = 'success';
      if (successPanel) {
        successPanel.hidden = false;
        const detail = successPanel.querySelector('[data-signup-success-detail]');
        if (detail) {
          detail.textContent = result.confirmation_sent === true
            ? 'We sent a confirmation email. If it is not in your inbox, check spam or promotions.'
            : "Your signup worked, but we couldn't send the confirmation email. You are still on the list.";
        }
        successPanel.focus();
      }
      setStatus(result.confirmation_sent === true ? 'Signup complete.' : 'Signup complete, email not sent.', 'success');
    } catch {
      setStatus('Signup failed. Please try again.', 'error');
    } finally {
      window.clearTimeout(timeout);
      if (form.dataset.state !== 'success') {
        resetVerification();
        button.disabled = false;
      }
    }
  });
})();
