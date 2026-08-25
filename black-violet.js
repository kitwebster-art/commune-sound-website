(async () => {
  const WORDMARKS = [
    { slug: '40', file: 'commune-wordmark-40-20260825.webp' },
    { slug: '24', file: 'commune-wordmark-24-20260825.webp' },
    { slug: '35', file: 'commune-wordmark-35-20260825.webp' },
  ];
  const LAST_WORDMARK_KEY = 'commune-sound:black-violet-wordmark';

  const randomIndex = length => {
    if (globalThis.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      return values[0] % length;
    }
    return Math.floor(Math.random() * length);
  };

  const image = document.querySelector('[data-particle-logo]');
  const section = image?.closest('.wordmark-banner');
  document.documentElement.dataset.visualTheme = 'black-violet';
  document.documentElement.dataset.backgroundTexture = 'holographic-grain-static';
  document.body.dataset.visuals = 'static';

  if (image instanceof HTMLImageElement && section instanceof HTMLElement) {
    let previous = '';
    try { previous = localStorage.getItem(LAST_WORDMARK_KEY) || ''; } catch (_) {}
    const requested = new URLSearchParams(window.location.search).get('wordmark');
    const forced = WORDMARKS.find(({ slug }) => slug === requested);
    const choices = WORDMARKS.filter(({ slug }) => slug !== previous);
    const selected = forced || choices[randomIndex(choices.length)];
    if (!forced) {
      try { localStorage.setItem(LAST_WORDMARK_KEY, selected.slug); } catch (_) {}
    }

    image.src = `assets/selected-wordmarks/${selected.file}`;
    image.removeAttribute('srcset');
    image.className = 'black-violet-wordmark';
    image.alt = 'Commune Sound';
    image.decoding = 'async';
    section.dataset.wordmarkVariant = selected.slug;
    section.dataset.wordmarkSource = selected.file;
    section.dataset.wordmarkSeries = 'selected-20260825';
    section.dataset.wordmarkRotation = 'three-selected-variants-without-immediate-repeat';
    try {
      await image.decode();
    } catch (_) {
      // The HTML fallback is already a current non-liquid wordmark.
    }
  }

  document.body.classList.remove('portal-study-loading');
  document.querySelector('.portal-study-loader')?.remove();
})();
