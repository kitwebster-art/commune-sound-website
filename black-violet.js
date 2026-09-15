(async () => {
  const WORDMARKS = [
    { slug: 'gradient-monoliths', file: '02-gradient-monoliths-alpha-v2.webp' },
    { slug: 'folded-ribbons', file: '06-folded-ribbons-alpha-v2.webp' },
    { slug: 'isometric-lattice', file: '05-isometric-lattice-alpha-v2.webp' },
    { slug: 'technical-instruments', file: '07-technical-instruments-alpha-v2.webp' },
    { slug: 'kinetic-fragments', file: '09-kinetic-fragments-alpha-v2.webp' },
    { slug: 'geometric-27', file: '../commune-geometric-27-wide-v2.svg', mobile: 'assets/commune-geometric-27-stacked-v2.svg' },
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

  if (image instanceof HTMLImageElement && section instanceof HTMLElement && !image.hasAttribute('data-wordmark-fixed')) {
    let previous = '';
    try { previous = localStorage.getItem(LAST_WORDMARK_KEY) || ''; } catch (_) {}
    const choices = WORDMARKS.filter(({ slug }) => slug !== previous);
    const selected = choices[randomIndex(choices.length)];
    try { localStorage.setItem(LAST_WORDMARK_KEY, selected.slug); } catch (_) {}

    const desktopSource = `assets/gpt-wordmark-studies/${selected.file}?v=rotation-20260915`;
    const mobileSource = image.closest('picture')?.querySelector('source');
    if (mobileSource) mobileSource.srcset = selected.mobile || desktopSource;
    image.src = desktopSource;
    image.removeAttribute('srcset');
    image.className = 'black-violet-wordmark';
    image.alt = 'Commune Sound';
    image.decoding = 'async';
    section.dataset.wordmarkVariant = selected.slug;
    section.dataset.wordmarkSource = selected.file;
    section.dataset.wordmarkRotation = 'six-variants-without-immediate-repeat';
    try {
      await image.decode();
    } catch (_) {
      // The HTML fallback is already a current non-liquid wordmark.
    }
  }

  document.body.classList.remove('portal-study-loading');
  document.querySelector('.portal-study-loader')?.remove();
})();
