(() => {
  const ASSET = '../assets/commune-sound-folded-banner-v1.png?v=folded-banner-1.0.0';

  window.installPortalFoldedWordmark = async () => {
    const image = document.querySelector('[data-particle-logo]');
    const section = image?.closest('.wordmark-banner');
    if (!(image instanceof HTMLImageElement) || !(section instanceof HTMLElement)) {
      throw new Error('Portal folded wordmark anchor missing');
    }

    image.src = ASSET;
    image.removeAttribute('srcset');
    image.className = 'portal-folded-wordmark';
    image.alt = 'Commune Sound';
    image.draggable = false;

    const stage = document.createElement('div');
    stage.className = 'portal-folded-stage';
    stage.dataset.interaction = 'pointer-tilt|touch-tilt|spectral-sheen|press-pulse';
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
    }

    section.dataset.wordmarkSource = 'commune-sound-folded-banner-v1.png';
    section.dataset.wordmarkPalette = 'violet|ultraviolet|hot-magenta|cyan-mint|pearl';
    section.dataset.wordmarkInteraction = stage.dataset.interaction;
    document.documentElement.classList.add('portal-folded-wordmark-ready');
    return stage;
  };
})();
