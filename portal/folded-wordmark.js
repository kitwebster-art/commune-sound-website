(() => {
  const WORDMARKS = [
    { slug: 'gradient-monoliths', label: 'Gradient Monoliths', file: '02-gradient-monoliths-alpha-v2.webp' },
    { slug: 'perspective-extrusion', label: 'Perspective Extrusion', file: '04-perspective-extrusion-alpha-v2.webp' },
    { slug: 'folded-ribbons', label: 'Folded Ribbons', file: '06-folded-ribbons-alpha-v2.webp' },
    { slug: 'isometric-lattice', label: 'Isometric Lattice', file: '05-isometric-lattice-alpha-v2.webp' },
    { slug: 'technical-instruments', label: 'Technical Instruments', file: '07-technical-instruments-alpha-v2.webp' },
    { slug: 'kinetic-fragments', label: 'Kinetic Fragments', file: '09-kinetic-fragments-alpha-v2.webp' },
    { slug: 'liquid-chrome', label: 'Liquid Chrome', file: '10-liquid-chrome-alpha-v2.webp' }
  ];
  const LAST_WORDMARK_KEY = 'commune-sound:last-wordmark';
  const FAVOURITE_SLUG = 'liquid-chrome';
  const FAVOURITE_CHANCE = 0.9;

  const randomIndex = (length) => {
    if (globalThis.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      return values[0] % length;
    }
    return Math.floor(Math.random() * length);
  };

  const selectWordmark = () => {
    const requested = new URLSearchParams(location.search).get('wordmark');
    const forced = WORDMARKS.find(({ slug }) => slug === requested);
    if (forced) return forced;

    let previous = '';
    try {
      previous = localStorage.getItem(LAST_WORDMARK_KEY) || '';
    } catch (_) {
      // The rotation still works when browser storage is unavailable.
    }

    const favourite = WORDMARKS.find(({ slug }) => slug === FAVOURITE_SLUG);
    let selected;
    if (previous !== FAVOURITE_SLUG && randomIndex(100) < FAVOURITE_CHANCE * 100) {
      selected = favourite;
    } else {
      const choices = WORDMARKS.filter(({ slug }) => (
        slug !== previous && slug !== FAVOURITE_SLUG
      ));
      selected = choices[randomIndex(choices.length)];
    }
    try {
      localStorage.setItem(LAST_WORDMARK_KEY, selected.slug);
    } catch (_) {
      // Storage is only used to prevent an immediate repeat.
    }
    return selected;
  };

  window.installPortalFoldedWordmark = async () => {
    const image = document.querySelector('[data-particle-logo]');
    const section = image?.closest('.wordmark-banner');
    if (!(image instanceof HTMLImageElement) || !(section instanceof HTMLElement)) {
      throw new Error('Portal folded wordmark anchor missing');
    }

    const wordmark = selectWordmark();
    image.src = `../assets/gpt-wordmark-studies/${wordmark.file}?v=wordmark-webp-2.1.0`;
    image.removeAttribute('srcset');
    image.className = 'portal-folded-wordmark';
    image.alt = 'Commune Sound';
    image.draggable = false;
    image.decoding = 'async';

    const stage = document.createElement('div');
    stage.className = 'portal-folded-stage';
    stage.dataset.interaction = 'pointer-tilt|touch-tilt|spectral-sheen|press-pulse|audio-reactive-depth';
    stage.dataset.audioReactive = 'ready';
    stage.dataset.audioState = 'off';
    stage.dataset.wordmarkVariant = wordmark.slug;
    stage.dataset.wordmarkBackground = 'transparent-alpha';
    stage.dataset.wordmarkFormat = 'lossless-webp';
    stage.setAttribute('aria-label', `Commune Sound wordmark, ${wordmark.label} edition`);
    const float = document.createElement('div');
    float.className = 'portal-folded-float';

    const glow = image.cloneNode(false);
    glow.removeAttribute('data-particle-logo');
    glow.removeAttribute('alt');
    glow.className = 'portal-folded-layer portal-folded-glow';
    glow.setAttribute('aria-hidden', 'true');

    const sheen = image.cloneNode(false);
    sheen.removeAttribute('data-particle-logo');
    sheen.removeAttribute('alt');
    sheen.className = 'portal-folded-layer portal-folded-sheen';
    sheen.setAttribute('aria-hidden', 'true');

    image.before(stage);
    stage.append(float);
    float.append(glow, image, sheen);

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) {
      let targetX = 0;
      let targetY = 0;
      let currentX = 0;
      let currentY = 0;
      let frame = 0;

      const render = () => {
        currentX += (targetX - currentX) * 0.1;
        currentY += (targetY - currentY) * 0.1;
        stage.style.setProperty('--fold-x', currentX.toFixed(3));
        stage.style.setProperty('--fold-y', currentY.toFixed(3));
        stage.style.setProperty('--fold-shine', `${(50 + currentX * 34).toFixed(2)}%`);
        if (Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > 0.002) {
          frame = requestAnimationFrame(render);
        } else {
          frame = 0;
        }
      };

      const setTarget = (event) => {
        const rect = stage.getBoundingClientRect();
        targetX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
        targetY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
        if (!frame) frame = requestAnimationFrame(render);
      };

      const reset = () => {
        targetX = 0;
        targetY = 0;
        if (!frame) frame = requestAnimationFrame(render);
      };

      stage.addEventListener('pointermove', setTarget, { passive: true });
      stage.addEventListener('pointerleave', reset, { passive: true });
      stage.addEventListener('pointercancel', reset, { passive: true });
      stage.addEventListener('pointerdown', (event) => {
        setTarget(event);
        stage.classList.remove('is-pressed');
        requestAnimationFrame(() => stage.classList.add('is-pressed'));
        setTimeout(() => stage.classList.remove('is-pressed'), 620);
      }, { passive: true });

      document.addEventListener('commune:soundscape-frame', (event) => {
        const { bass = 0, mid = 0, air = 0, energy = 0 } = event.detail || {};
        stage.style.setProperty('--fold-audio', Math.max(0, Math.min(1, energy)).toFixed(3));
        stage.style.setProperty('--fold-bass', Math.max(0, Math.min(1, bass)).toFixed(3));
        stage.style.setProperty('--fold-mid', Math.max(0, Math.min(1, mid)).toFixed(3));
        stage.style.setProperty('--fold-air', Math.max(0, Math.min(1, air)).toFixed(3));
        stage.dataset.audioState = 'on';
      });

      document.addEventListener('commune:soundscape-state', (event) => {
        const enabled = Boolean(event.detail?.enabled);
        stage.dataset.audioState = enabled ? 'on' : 'off';
        if (!enabled) {
          stage.style.setProperty('--fold-audio', '0');
          stage.style.setProperty('--fold-bass', '0');
          stage.style.setProperty('--fold-mid', '0');
          stage.style.setProperty('--fold-air', '0');
        }
      });
    } else {
      stage.dataset.audioReactive = 'reduced-motion-static';
    }

    section.dataset.wordmarkSource = wordmark.file;
    section.dataset.wordmarkVariant = wordmark.slug;
    section.dataset.wordmarkBackground = 'transparent-alpha';
    section.dataset.wordmarkFormat = 'lossless-webp';
    section.dataset.wordmarkRotation = 'random-every-visit-without-immediate-repeat';
    section.dataset.wordmarkFavourite = 'liquid-chrome-nearly-every-other-visit';
    section.dataset.wordmarkPalette = 'violet|ultraviolet|hot-magenta|cyan-mint|pearl';
    section.dataset.wordmarkInteraction = stage.dataset.interaction;
    document.documentElement.classList.add('portal-folded-wordmark-ready');
    document.dispatchEvent(new CustomEvent('commune:wordmark-ready', {
      detail: { stage, float, image, wordmark }
    }));
    return stage;
  };
})();
