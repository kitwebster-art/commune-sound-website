(() => {
  const STUDIES = Object.freeze({
    'magnetic-dust': Object.freeze({ label: 'Magnetic Dust', audio: 'rising-spark', colourShift: 0 }),
    'neon-swarm': Object.freeze({ label: 'Neon Swarm', audio: 'syncopated-swarm', colourShift: 34 }),
    'prismatic-shatter': Object.freeze({ label: 'Prismatic Shatter', audio: 'percussive-shards', colourShift: 68 }),
    'sonic-wave': Object.freeze({ label: 'Sonic Wave', audio: 'double-pulse', colourShift: 104 }),
    'vortex-portal': Object.freeze({ label: 'Vortex Portal', audio: 'spiral-arp', colourShift: 142 })
  });
  const params = new URLSearchParams(location.search);
  const slug = params.get('particle-study');
  const study = STUDIES[slug];
  if (!study) return;

  const debugMode = ['final', 'source', 'field', 'particles', 'no-post'].includes(params.get('particle-debug'))
    ? params.get('particle-debug')
    : 'final';
  const parsedSeed = Number.parseInt(params.get('particle-seed'), 10);
  const seed = Number.isFinite(parsedSeed) ? parsedSeed >>> 0 : 413;
  const requestedQuality = params.get('particle-quality');
  const compact = innerWidth < 700 || matchMedia('(pointer: coarse)').matches;
  const quality = requestedQuality === 'low' || requestedQuality === 'high'
    ? requestedQuality
    : (compact ? 'low' : 'high');
  const particleLimit = quality === 'high' ? 2800 : 1250;
  const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
  const mix = (from, to, amount) => from + (to - from) * amount;

  const hash = (value) => {
    let state = (value + seed * 374761393) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 1274126177);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967295;
  };

  const sampleImage = (image) => {
    const width = Math.min(760, image.naturalWidth);
    const height = Math.max(1, Math.round(width * image.naturalHeight / image.naturalWidth));
    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    const context = source.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Particle source canvas unavailable');
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const step = quality === 'high' ? 3 : 5;
    const candidates = [];
    let sampleIndex = 0;
    for (let y = Math.floor(step / 2); y < height; y += step) {
      for (let x = Math.floor(step / 2); x < width; x += step) {
        const pixel = (y * width + x) * 4;
        const alpha = pixels[pixel + 3];
        if (alpha < 54) continue;
        const red = pixels[pixel];
        const green = pixels[pixel + 1];
        const blue = pixels[pixel + 2];
        const random = hash(sampleIndex * 11 + x * 3 + y * 7);
        candidates.push({
          u: x / width,
          v: y / height,
          red,
          green,
          blue,
          alpha: alpha / 255,
          random,
          randomB: hash(sampleIndex * 17 + 29),
          randomC: hash(sampleIndex * 23 + 71),
          groupX: Math.floor(x / Math.max(18, width / 16)),
          groupY: Math.floor(y / Math.max(18, height / 7))
        });
        sampleIndex += 1;
      }
    }
    if (candidates.length <= particleLimit) return candidates;
    candidates.sort((a, b) => a.random - b.random);
    return candidates.slice(0, particleLimit);
  };

  const install = async ({ stage, float, image }) => {
    if (!(stage instanceof HTMLElement) || !(float instanceof HTMLElement) || !(image instanceof HTMLImageElement)) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stage.dataset.particleStudy = `${slug}-reduced-motion-static`;
      return;
    }

    try {
      if (!image.complete || !image.naturalWidth) await image.decode();
      const particles = sampleImage(image);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
      if (!context) throw new Error('Particle render canvas unavailable');
      canvas.className = 'portal-wordmark-particle-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.dataset.particleStudy = slug;
      canvas.dataset.particleLabel = study.label;
      canvas.dataset.particleSeed = String(seed);
      canvas.dataset.particleQuality = quality;
      canvas.dataset.particleCount = String(particles.length);
      canvas.dataset.particleDebug = debugMode;
      canvas.dataset.particlePool = 'fixed-capacity-analytic';
      canvas.dataset.particleAllocation = 'zero-per-frame';
      canvas.dataset.particleFrameBudgetMs = quality === 'high' ? '8' : '5';
      float.append(canvas);

      let width = 1;
      let height = 1;
      let pixelRatio = 1;
      let pointerX = 0.5;
      let pointerY = 0.5;
      let targetHover = debugMode === 'particles' || debugMode === 'field' ? 1 : 0;
      let hover = targetHover;
      let clickX = 0.5;
      let clickY = 0.5;
      let clickTime = -100000;
      let running = false;
      let frame = 0;
      let lastFrame = performance.now();
      let sampleFrames = 0;
      let sampleElapsed = 0;

      const resize = () => {
        const rect = stage.getBoundingClientRect();
        width = Math.max(1, rect.width);
        height = Math.max(1, width * image.naturalHeight / image.naturalWidth);
        pixelRatio = Math.min(devicePixelRatio || 1, quality === 'high' ? 1.5 : 1.05);
        canvas.width = Math.max(1, Math.round(width * pixelRatio));
        canvas.height = Math.max(1, Math.round(height * pixelRatio));
        canvas.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      };

      const updatePointer = (event) => {
        const rect = stage.getBoundingClientRect();
        pointerX = clamp((event.clientX - rect.left) / Math.max(rect.width, 1));
        pointerY = clamp((event.clientY - rect.top) / Math.max(rect.height, 1));
      };

      const particlePosition = (particle, now, clickAge, clickEnergy) => {
        const homeX = particle.u * width;
        const homeY = particle.v * height;
        const focusX = pointerX * width;
        const focusY = pointerY * height;
        const deltaX = homeX - focusX;
        const deltaY = homeY - focusY;
        const distance = Math.max(1, Math.hypot(deltaX, deltaY));
        const directionX = deltaX / distance;
        const directionY = deltaY / distance;
        const tangentX = -directionY;
        const tangentY = directionX;
        const localRadius = Math.max(42, width * 0.2);
        const influence = Math.exp(-(distance * distance) / (localRadius * localRadius));
        const clickDeltaX = homeX - clickX * width;
        const clickDeltaY = homeY - clickY * height;
        const clickDistance = Math.max(1, Math.hypot(clickDeltaX, clickDeltaY));
        const clickDirectionX = clickDeltaX / clickDistance;
        const clickDirectionY = clickDeltaY / clickDistance;
        const time = now * 0.001;
        let offsetX = 0;
        let offsetY = 0;
        let scale = 1;
        let alpha = 0.76 + particle.alpha * 0.24;
        let rotation = 0;

        if (slug === 'magnetic-dust') {
          const globalAngle = particle.randomB * Math.PI * 2;
          const globalScatter = hover * (9 + particle.random * 28);
          const repel = influence * hover * (28 + particle.random * 92);
          const burst = clickEnergy * (52 + particle.randomB * 190);
          offsetX = Math.cos(globalAngle) * globalScatter + directionX * repel + clickDirectionX * burst;
          offsetY = Math.sin(globalAngle) * globalScatter + directionY * repel + clickDirectionY * burst + Math.sin(time * 3 + particle.random * 12) * hover * 5;
          scale = 0.72 + particle.random * 1.25 + clickEnergy * 0.8;
        } else if (slug === 'neon-swarm') {
          const globalAngle = particle.random * Math.PI * 2 + time * (0.28 + particle.randomB * 0.24);
          const globalDrift = hover * (14 + particle.randomB * 30);
          const orbit = influence * hover * (46 + particle.random * 86);
          const spiral = clickEnergy * (80 + particle.randomB * 150);
          offsetX = Math.cos(globalAngle) * globalDrift + tangentX * orbit + directionX * orbit * 0.25 + (-clickDirectionY) * spiral;
          offsetY = Math.sin(globalAngle) * globalDrift + tangentY * orbit + directionY * orbit * 0.25 + clickDirectionX * spiral;
          offsetX += Math.cos(time * 4.2 + particle.random * 18) * hover * 12;
          offsetY += Math.sin(time * 3.6 + particle.randomB * 18) * hover * 12;
          scale = 0.62 + particle.random * 1.1 + influence * 0.65;
        } else if (slug === 'prismatic-shatter') {
          const groupSeed = hash(particle.groupX * 97 + particle.groupY * 193);
          const angle = groupSeed * Math.PI * 2;
          const fracture = hover * ((12 + groupSeed * 28) + influence * (38 + groupSeed * 96));
          const burst = clickEnergy * (70 + groupSeed * 210);
          offsetX = Math.cos(angle) * fracture + clickDirectionX * burst;
          offsetY = Math.sin(angle) * fracture + clickDirectionY * burst;
          rotation = angle + clickAge * 0.004 * (groupSeed - 0.5);
          scale = 0.9 + groupSeed * 1.7;
        } else if (slug === 'sonic-wave') {
          const broadWave = Math.sin(particle.u * 24 - time * 4.5 + particle.random * 2) * hover * (8 + particle.randomB * 14);
          const hoverWave = Math.sin(distance * 0.08 - time * 7.5 + particle.random * 1.4) * influence * hover * 34;
          const ringRadius = clickAge * 0.23;
          const ring = Math.exp(-Math.pow((clickDistance - ringRadius) / Math.max(14, width * 0.025), 2));
          const clickWave = ring * (48 + particle.random * 64) * clickEnergy;
          offsetX = directionX * hoverWave + clickDirectionX * clickWave;
          offsetY = broadWave + directionY * hoverWave + clickDirectionY * clickWave;
          scale = 0.65 + particle.random * 1.05 + ring * 1.2;
          alpha *= 0.78 + ring * 0.44;
        } else {
          const phase = clamp(clickAge / 1450);
          const inward = Math.sin(phase * Math.PI) * clickEnergy;
          const globalVortex = hover * (12 + particle.random * 30);
          const vortex = globalVortex + influence * hover * (58 + particle.random * 100) + inward * (100 + particle.randomB * 180);
          offsetX = tangentX * vortex - directionX * vortex * 0.36;
          offsetY = tangentY * vortex - directionY * vortex * 0.36;
          offsetX += clickDirectionX * clickEnergy * Math.max(0, phase - 0.55) * 260;
          offsetY += clickDirectionY * clickEnergy * Math.max(0, phase - 0.55) * 260;
          scale = 0.62 + particle.random * 1.2 + inward * 0.7;
        }
        return { x: homeX + offsetX, y: homeY + offsetY, scale, alpha, rotation, influence };
      };

      const render = (now) => {
        const delta = Math.min(48, now - lastFrame);
        lastFrame = now;
        hover += (targetHover - hover) * (1 - Math.exp(-delta / 120));
        const clickAge = now - clickTime;
        const clickEnergy = clickAge >= 0 ? Math.exp(-clickAge / 920) : 0;
        const breakup = debugMode === 'source' ? 0 : clamp(hover * 0.74 + clickEnergy * 0.96);
        stage.style.setProperty('--particle-breakup', breakup.toFixed(3));
        context.clearRect(0, 0, width, height);
        if (debugMode !== 'source') {
          context.save();
          context.globalCompositeOperation = debugMode === 'no-post' ? 'source-over' : 'lighter';
          for (let index = 0; index < particles.length; index += 1) {
            const particle = particles[index];
            const position = particlePosition(particle, now, clickAge, clickEnergy);
            const size = (0.78 + particle.random * 1.55) * position.scale * (quality === 'high' ? 1 : 1.12);
            context.globalAlpha = clamp(position.alpha * (0.38 + breakup * 0.74));
            const warm = particle.randomB > 0.5;
            const red = clamp(particle.red * 1.28 + (warm ? 48 : 18), 0, 255);
            const green = clamp(particle.green * 1.24 + (warm ? 10 : 42), 0, 255);
            const blue = clamp(particle.blue * 1.3 + 50, 0, 255);
            context.fillStyle = debugMode === 'no-post'
              ? `rgb(${particle.red} ${particle.green} ${particle.blue})`
              : `rgb(${red} ${green} ${blue})`;
            if (slug === 'prismatic-shatter') {
              context.save();
              context.translate(position.x, position.y);
              context.rotate(position.rotation);
              context.fillRect(-size, -size * 0.58, size * 2.2, size * 1.16);
              context.restore();
            } else {
              context.beginPath();
              context.arc(position.x, position.y, Math.max(0.45, size), 0, Math.PI * 2);
              context.fill();
            }
          }
          context.restore();
        }

        if (debugMode === 'field') {
          context.save();
          context.strokeStyle = 'rgba(112, 255, 224, 0.72)';
          context.lineWidth = 1;
          context.beginPath();
          context.arc(pointerX * width, pointerY * height, Math.max(42, width * 0.2), 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }

        sampleFrames += 1;
        sampleElapsed += delta;
        if (sampleElapsed >= 1000) {
          canvas.dataset.particleFps = String(Math.round(sampleFrames * 1000 / sampleElapsed));
          sampleFrames = 0;
          sampleElapsed = 0;
        }
        const active = targetHover > 0 || hover > 0.004 || clickEnergy > 0.008 || debugMode === 'particles' || debugMode === 'field';
        if (active) {
          frame = requestAnimationFrame(render);
        } else {
          running = false;
          stage.style.setProperty('--particle-breakup', '0');
          context.clearRect(0, 0, width, height);
        }
      };

      const start = () => {
        if (running) return;
        running = true;
        lastFrame = performance.now();
        frame = requestAnimationFrame(render);
      };
      const emitAudio = (kind, intensity) => {
        document.dispatchEvent(new CustomEvent('commune:wordmark-particle', {
          detail: { study: slug, audio: study.audio, kind, intensity, x: pointerX }
        }));
      };

      stage.addEventListener('pointerenter', (event) => {
        updatePointer(event);
        targetHover = 1;
        start();
        emitAudio('hover', 0.34);
      }, { passive: true });
      stage.addEventListener('pointermove', (event) => {
        updatePointer(event);
        targetHover = 1;
        start();
      }, { passive: true });
      stage.addEventListener('pointerleave', () => {
        targetHover = debugMode === 'particles' || debugMode === 'field' ? 1 : 0;
        start();
      }, { passive: true });
      stage.addEventListener('pointerdown', (event) => {
        updatePointer(event);
        clickX = pointerX;
        clickY = pointerY;
        clickTime = performance.now();
        start();
        emitAudio('click', 1);
      }, { passive: true });
      addEventListener('resize', resize, { passive: true });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          cancelAnimationFrame(frame);
          running = false;
        } else if (targetHover > 0) {
          start();
        }
      });

      resize();
      stage.classList.add('portal-wordmark-particle-active');
      stage.dataset.particleStudy = slug;
      stage.dataset.particleStudyLabel = study.label;
      stage.dataset.particleDebug = debugMode;
      stage.dataset.particleInteraction = 'hover-breakup|pointer-field|click-burst|soundscape-accent';
      stage.dataset.particleDebugModes = 'final|source|field|particles|no-post';
      stage.dataset.particleVisualContract = 'source-silhouette-at-rest|local-pointer-breakup|click-event-envelope|full-reassembly|mobile-touch-burst';
      document.documentElement.dataset.wordmarkParticleStudy = slug;
      document.documentElement.classList.add('portal-wordmark-particle-study');
      if (debugMode === 'particles' || debugMode === 'field') start();
    } catch (error) {
      stage.dataset.particleStudy = `${slug}-error`;
      stage.dataset.particleStudyError = error.message;
    }
  };

  document.addEventListener('commune:wordmark-ready', (event) => install(event.detail), { once: true });
})();
