(() => {
  window.installPortalParticleWordmark = async ({ seed = 17 } = {}) => {
    const image = document.querySelector('[data-particle-logo]');
    const section = image?.closest('.wordmark-banner');
    if (!(image instanceof HTMLImageElement) || !(section instanceof HTMLElement)) {
      throw new Error('Portal particle wordmark anchor missing');
    }
    if (!window.CommuneWordmarkParticles) {
      throw new Error('Exact wordmark particle engine missing');
    }

    image.classList.add('portal-wordmark-placeholder');
    image.setAttribute('aria-hidden', 'true');
    const result = await window.CommuneWordmarkParticles.create({
      container: section,
      anchor: image,
      imageSrc: '../assets/commune-wordmark-cropped.jpeg',
      variant: 'prismatic-edge',
      seed,
      particleClass: 'portal-wordmark-particles',
      maskClass: 'portal-wordmark-mask'
    });

    result.canvas.dataset.runtimeBitmap = 'hidden-reference-only';
    result.canvas.dataset.visibleJpeg = 'no-rectangular-jpeg-layer';
    result.canvas.dataset.typographyFidelity = 'original-banner-measured-vector-trace';
    result.canvas.dataset.portalTreatment = 'prismatic-edge';
    section.dataset.wordmarkSource = 'commune-wordmark-cropped.jpeg';
    section.dataset.wordmarkPalette = 'website-violet|acid-green|mint|pearl';
    document.documentElement.classList.add('portal-particle-wordmark-ready');
    return result;
  };
})();
