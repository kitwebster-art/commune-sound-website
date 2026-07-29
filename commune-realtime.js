(() => {
  const canvas = document.querySelector('[data-commune-realtime]');
  const logo = document.querySelector('[data-particle-logo]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!(canvas instanceof HTMLCanvasElement) || !(logo instanceof HTMLImageElement)) return;
  if (reducedMotion.matches) {
    document.documentElement.classList.add('realtime-ready');
    return;
  }

  const context = canvas.getContext('2d', { alpha: true });
  const maskCanvas = document.createElement('canvas');
  const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!context || !maskContext) return;

  const palette = [18, 34, 178, 194, 310, 328];
  const particles = [];
  const ambient = [];
  const gestureTrail = [];
  const targetPoints = [];
  const pointer = {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.34,
    previousX: window.innerWidth * 0.5,
    previousY: window.innerHeight * 0.34,
    velocityX: 0,
    velocityY: 0,
    active: 0,
    down: false,
    burst: 0,
    lastMove: 0,
  };

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = 1;
  let maskScale = 0.5;
  let previousTime = performance.now();
  let frame = 0;
  let scrollEnergy = 0;
  let lastScroll = window.scrollY;
  let rebuildTimer = 0;
  let resizeFrame = 0;
  let quality = window.innerWidth < 700 ? 0.68 : 1;

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const colourHue = (red, green, blue, fallback) => {
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const delta = maximum - minimum;
    if (delta < 18) return fallback;
    let hue = 0;
    if (maximum === red) hue = ((green - blue) / delta) % 6;
    if (maximum === green) hue = (blue - red) / delta + 2;
    if (maximum === blue) hue = (red - green) / delta + 4;
    return (hue * 60 + 360) % 360;
  };

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const compact = width < 700 || window.matchMedia('(pointer: coarse)').matches;
    dpr = Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.35);
    maskScale = compact ? 0.42 : 0.5;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    maskCanvas.width = Math.max(1, Math.round(width * maskScale));
    maskCanvas.height = Math.max(1, Math.round(height * maskScale));
    rebuildAmbient(compact);
    rebuildTargets();
  }

  function rebuildAmbient(compact = width < 700) {
    const count = compact ? 95 : 280;
    ambient.length = 0;
    for (let index = 0; index < count; index += 1) {
      ambient.push({
        x: Math.random() * width,
        y: Math.random() * height,
        previousX: 0,
        previousY: 0,
        velocityX: (Math.random() - 0.5) * 0.3,
        velocityY: (Math.random() - 0.5) * 0.3,
        size: 0.28 + Math.random() * 0.72,
        phase: Math.random() * Math.PI * 2,
        hue: palette[index % palette.length] + Math.random() * 16,
      });
    }
  }

  function drawMask() {
    maskContext.setTransform(1, 0, 0, 1, 0, 0);
    maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskContext.setTransform(maskScale, 0, 0, maskScale, 0, 0);

    const logoRect = logo.getBoundingClientRect();
    if (logoRect.bottom > -100 && logoRect.top < height + 100) {
      maskContext.globalAlpha = 1;
      maskContext.drawImage(
        logo,
        logoRect.left,
        logoRect.top,
        logoRect.width,
        logoRect.height,
      );
    }

    document.querySelectorAll('[data-particle-heading]').forEach((heading) => {
      const rect = heading.getBoundingClientRect();
      if (rect.bottom < -80 || rect.top > height + 80) return;
      const style = window.getComputedStyle(heading);
      maskContext.save();
      maskContext.fillStyle = '#f8efe2';
      maskContext.font = style.font;
      maskContext.textAlign = 'center';
      maskContext.textBaseline = 'middle';
      maskContext.fillText(
        heading.textContent || '',
        rect.left + rect.width * 0.5,
        rect.top + rect.height * 0.5,
        rect.width,
      );
      maskContext.restore();
    });
  }

  function rebuildTargets() {
    if (!logo.complete || !logo.naturalWidth) return;
    drawMask();
    const image = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const compact = width < 700;
    const sampleStep = compact ? 3 : 2;
    const candidates = [];

    for (let y = 0; y < maskCanvas.height; y += sampleStep) {
      for (let x = 0; x < maskCanvas.width; x += sampleStep) {
        const offset = (y * maskCanvas.width + x) * 4;
        const red = image.data[offset];
        const green = image.data[offset + 1];
        const blue = image.data[offset + 2];
        const alpha = image.data[offset + 3];
        const brightness = red * 0.299 + green * 0.587 + blue * 0.114;
        if (alpha < 48 || brightness < 104) continue;
        const cssX = x / maskScale;
        const cssY = y / maskScale;
        const fallbackHue = palette[(Math.floor(cssX / 90) + Math.floor(cssY / 70)) % palette.length];
        candidates.push({
          x: cssX,
          y: cssY,
          hue: colourHue(red, green, blue, fallbackHue),
          brightness: brightness / 255,
        });
      }
    }

    const maximum = compact
      ? Math.max(720, Math.round(1250 * quality))
      : Math.max(1800, Math.round(3600 * quality));
    const stride = Math.max(1, Math.ceil(candidates.length / maximum));
    targetPoints.length = 0;
    for (let index = 0; index < candidates.length && targetPoints.length < maximum; index += stride) {
      targetPoints.push(candidates[index]);
    }

    const initial = particles.length === 0;
    targetPoints.forEach((target, index) => {
      const particle = particles[index];
      if (particle) {
        particle.targetX = target.x;
        particle.targetY = target.y;
        particle.hue += (target.hue - particle.hue) * 0.24;
        particle.brightness = target.brightness;
        return;
      }
      const spread = initial ? 8 : 28;
      particles.push({
        x: target.x + (Math.random() - 0.5) * spread,
        y: target.y + (Math.random() - 0.5) * spread,
        previousX: target.x,
        previousY: target.y,
        targetX: target.x,
        targetY: target.y,
        velocityX: (Math.random() - 0.5) * 0.5,
        velocityY: (Math.random() - 0.5) * 0.5,
        size: 0.38 + Math.random() * 0.88,
        phase: Math.random() * Math.PI * 2,
        hue: target.hue,
        brightness: target.brightness,
      });
    });
    particles.length = targetPoints.length;
    if (targetPoints.length > 80) document.documentElement.classList.add('realtime-ready');
  }

  function addGesturePoint(x, y, force = false) {
    const previous = gestureTrail[gestureTrail.length - 1];
    const distance = previous ? Math.hypot(x - previous.x, y - previous.y) : 99;
    if (!force && distance < 7) return;
    gestureTrail.push({
      x,
      y,
      born: performance.now(),
      hue: palette[gestureTrail.length % palette.length],
      strength: clamp(Math.hypot(pointer.velocityX, pointer.velocityY) / 28, 0.25, 1),
    });
    if (gestureTrail.length > (width < 700 ? 75 : 150)) gestureTrail.shift();
  }

  function onPointerMove(event) {
    pointer.velocityX = event.clientX - pointer.x;
    pointer.velocityY = event.clientY - pointer.y;
    pointer.previousX = pointer.x;
    pointer.previousY = pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = 1;
    pointer.lastMove = performance.now();
    document.documentElement.style.setProperty('--commune-pointer-x', `${event.clientX}px`);
    document.documentElement.style.setProperty('--commune-pointer-y', `${event.clientY}px`);
    if (pointer.down || Math.hypot(pointer.velocityX, pointer.velocityY) > 13) {
      addGesturePoint(event.clientX, event.clientY);
    }
  }

  function onPointerDown(event) {
    if (!event.isPrimary) return;
    pointer.down = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.burst = 1;
    pointer.active = 1;
    addGesturePoint(event.clientX, event.clientY, true);
  }

  function onPointerUp() {
    pointer.down = false;
  }

  function onScroll() {
    const currentScroll = window.scrollY;
    const delta = currentScroll - lastScroll;
    scrollEnergy = clamp(scrollEnergy + Math.abs(delta) / 360, 0, 1);
    particles.forEach((particle) => {
      particle.y -= delta;
      particle.previousY -= delta;
      particle.targetY -= delta;
    });
    lastScroll = currentScroll;
    window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(rebuildTargets, 180);
  }

  function drawGestureTrails(now) {
    const livePoints = gestureTrail.filter((point) => now - point.born < 2600);
    gestureTrail.length = 0;
    gestureTrail.push(...livePoints);
    if (livePoints.length < 2) return;

    const drawPass = (blur, widthScale, alphaScale) => {
      context.save();
      context.globalCompositeOperation = 'lighter';
      context.filter = `blur(${blur}px)`;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(livePoints[0].x, livePoints[0].y);
      for (let index = 1; index < livePoints.length - 1; index += 1) {
        const point = livePoints[index];
        const next = livePoints[index + 1];
        context.quadraticCurveTo(
          point.x,
          point.y,
          (point.x + next.x) * 0.5,
          (point.y + next.y) * 0.5,
        );
      }
      const finalPoint = livePoints[livePoints.length - 1];
      const life = clamp(1 - (now - finalPoint.born) / 2600, 0, 1);
      context.strokeStyle = `hsla(${(finalPoint.hue + now * 0.025) % 360}, 100%, 68%, ${life * alphaScale})`;
      context.lineWidth = widthScale * (0.7 + finalPoint.strength);
      context.stroke();
      context.restore();
    };

    drawPass(10, 13, 0.08);
    drawPass(2.4, 4.8, 0.16);
    drawPass(0, 0.75, 0.42);

    const filamentPoint = (index, filament) => {
      const point = livePoints[index];
      const previous = livePoints[Math.max(0, index - 1)];
      const next = livePoints[Math.min(livePoints.length - 1, index + 1)];
      const tangentX = next.x - previous.x;
      const tangentY = next.y - previous.y;
      const tangentLength = Math.hypot(tangentX, tangentY) + 0.001;
      const normalX = -tangentY / tangentLength;
      const normalY = tangentX / tangentLength;
      const age = (now - point.born) / 1000;
      const wave = Math.sin(index * 0.82 + filament * 1.7 + now * 0.0012)
        * (2.4 + Math.abs(filament) * 1.5 + age * 1.2);
      const offset = filament * 2.2 + wave;
      return {
        x: point.x + normalX * offset,
        y: point.y + normalY * offset,
      };
    };

    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (let filament = -3; filament <= 3; filament += 1) {
      const first = filamentPoint(0, filament);
      const latest = livePoints[livePoints.length - 1];
      const life = clamp(1 - (now - latest.born) / 2600, 0, 1);
      context.strokeStyle = `hsla(${(latest.hue + filament * 28 + 360) % 360}, 100%, ${filament === 0 ? 84 : 70}%, ${life * (filament === 0 ? 0.24 : 0.115)})`;
      context.lineWidth = filament === 0 ? 0.74 : 0.42;
      context.beginPath();
      context.moveTo(first.x, first.y);
      for (let index = 1; index < livePoints.length - 1; index += 1) {
        const point = filamentPoint(index, filament);
        const next = filamentPoint(index + 1, filament);
        context.quadraticCurveTo(
          point.x,
          point.y,
          (point.x + next.x) * 0.5,
          (point.y + next.y) * 0.5,
        );
      }
      const final = filamentPoint(livePoints.length - 1, filament);
      context.lineTo(final.x, final.y);
      context.stroke();
    }

    livePoints.forEach((point, index) => {
      if (index % 2 !== 0) return;
      const age = now - point.born;
      const life = clamp(1 - age / 2600, 0, 1);
      for (let droplet = 0; droplet < 3; droplet += 1) {
        const seed = index * 2.399 + droplet * 4.17;
        const reach = 5 + (index % 7) * 1.8 + droplet * 4.6 + age * 0.006;
        const x = point.x + Math.cos(seed + now * 0.00018) * reach;
        const y = point.y + Math.sin(seed - now * 0.00016) * reach;
        context.fillStyle = `hsla(${(point.hue + droplet * 34) % 360}, 100%, 78%, ${life * 0.22})`;
        context.beginPath();
        context.arc(x, y, 0.34 + droplet * 0.16, 0, Math.PI * 2);
        context.fill();
      }
    });
    context.restore();
  }

  function drawAmbient(time, frameStep) {
    const vortexX = width * (0.5 + Math.sin(time * 0.14) * 0.34);
    const vortexY = height * (0.46 + Math.cos(time * 0.11) * 0.3);
    const radius = Math.max(180, Math.min(width, height) * 0.52);
    ambient.forEach((particle, index) => {
      particle.previousX = particle.x;
      particle.previousY = particle.y;
      const flow = (
        Math.sin(particle.y * 0.007 + time * 0.36 + particle.phase)
        + Math.cos(particle.x * 0.005 - time * 0.24)
        + Math.sin((particle.x + particle.y) * 0.0027 + time * 0.17)
      ) * Math.PI;
      particle.velocityX += Math.cos(flow) * (0.025 + scrollEnergy * 0.055) * frameStep;
      particle.velocityY += Math.sin(flow) * (0.025 + scrollEnergy * 0.055) * frameStep;

      const deltaX = particle.x - vortexX;
      const deltaY = particle.y - vortexY;
      const distance = Math.hypot(deltaX, deltaY) + 0.001;
      const influence = Math.max(0, 1 - distance / radius);
      particle.velocityX += -deltaY / distance * influence * 0.024 * frameStep;
      particle.velocityY += deltaX / distance * influence * 0.024 * frameStep;

      if (pointer.active > 0.02) {
        const pointerX = particle.x - pointer.x;
        const pointerY = particle.y - pointer.y;
        const pointerDistance = Math.hypot(pointerX, pointerY) + 0.001;
        const pointerInfluence = Math.max(0, 1 - pointerDistance / 230) * pointer.active;
        particle.velocityX += -pointerY / pointerDistance * pointerInfluence * 0.22;
        particle.velocityY += pointerX / pointerDistance * pointerInfluence * 0.22;
      }

      particle.velocityX *= Math.pow(0.982, frameStep);
      particle.velocityY *= Math.pow(0.982, frameStep);
      particle.x += particle.velocityX * frameStep;
      particle.y += particle.velocityY * frameStep;
      if (particle.x < -20) particle.x = width + 20;
      if (particle.x > width + 20) particle.x = -20;
      if (particle.y < -20) particle.y = height + 20;
      if (particle.y > height + 20) particle.y = -20;

      const speed = Math.hypot(particle.velocityX, particle.velocityY);
      const shimmer = 0.52 + Math.sin(time * 1.7 + particle.phase + index * 0.13) * 0.48;
      const alpha = 0.1 + shimmer * 0.18 + scrollEnergy * 0.1;
      context.strokeStyle = `hsla(${(particle.hue + time * 8) % 360}, 100%, 70%, ${alpha * 0.26})`;
      context.lineWidth = 0.28 + speed * 0.15;
      context.beginPath();
      context.moveTo(particle.previousX, particle.previousY);
      context.lineTo(particle.x, particle.y);
      context.stroke();
      context.fillStyle = `hsla(${(particle.hue + time * 8) % 360}, 100%, 76%, ${alpha})`;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size * (0.48 + shimmer * 0.42), 0, Math.PI * 2);
      context.fill();
    });
  }

  function drawTargetParticles(time, frameStep) {
    const sweepA = width * (0.5 + Math.sin(time * 0.34 + Math.sin(time * 0.09) * 2.1) * 0.56);
    const sweepB = width * (0.5 + Math.sin(time * 0.23 + 2.4) * 0.58);
    const sweepWidth = Math.max(54, width * 0.09);

    particles.forEach((particle, index) => {
      particle.previousX = particle.x;
      particle.previousY = particle.y;
      const waveA = Math.exp(-Math.pow((particle.targetX - sweepA) / sweepWidth, 2));
      const waveB = Math.exp(-Math.pow((particle.targetX - sweepB) / (sweepWidth * 0.72), 2));
      const shimmer = clamp(waveA + waveB * 0.74, 0, 1.4);
      const breath = 0.5 + Math.sin(time * 0.74 + particle.phase + particle.targetY * 0.009) * 0.5;
      const displacement = 1.2 + breath * 2 + shimmer * 3.2;
      const animatedX = particle.targetX
        + Math.sin(time * 0.55 + particle.targetY * 0.011 + particle.phase) * displacement;
      const animatedY = particle.targetY
        + Math.cos(time * 0.48 + particle.targetX * 0.008 - particle.phase) * displacement * 0.62;

      const deltaX = animatedX - particle.x;
      const deltaY = animatedY - particle.y;
      let interaction = 0;
      let radialX = 0;
      let radialY = 0;
      let tangentX = 0;
      let tangentY = 0;
      if (pointer.active > 0.01) {
        const pointerX = particle.x - pointer.x;
        const pointerY = particle.y - pointer.y;
        const pointerDistance = Math.hypot(pointerX, pointerY) + 0.001;
        interaction = Math.max(0, 1 - pointerDistance / (pointer.down ? 260 : 190)) * pointer.active;
        radialX = pointerX / pointerDistance;
        radialY = pointerY / pointerDistance;
        tangentX = -radialY;
        tangentY = radialX;
      }

      const spring = (0.022 + shimmer * 0.006) * (1 - interaction * 0.72);
      particle.velocityX += deltaX * spring * frameStep;
      particle.velocityY += deltaY * spring * frameStep;
      particle.velocityX += tangentX * interaction * (pointer.down ? 0.82 : 0.42) * frameStep;
      particle.velocityY += tangentY * interaction * (pointer.down ? 0.82 : 0.42) * frameStep;
      particle.velocityX += pointer.velocityX * interaction * 0.012;
      particle.velocityY += pointer.velocityY * interaction * 0.012;
      particle.velocityX += radialX * interaction * pointer.burst * 5.4;
      particle.velocityY += radialY * interaction * pointer.burst * 5.4;

      const flow = Math.sin(particle.targetY * 0.013 + time * 0.7 + particle.phase)
        + Math.cos(particle.targetX * 0.008 - time * 0.43);
      particle.velocityX += Math.cos(flow) * (0.008 + shimmer * 0.018);
      particle.velocityY += Math.sin(flow) * (0.008 + shimmer * 0.018);
      particle.velocityX *= Math.pow(0.928, frameStep);
      particle.velocityY *= Math.pow(0.928, frameStep);
      const speed = Math.hypot(particle.velocityX, particle.velocityY);
      if (speed > 13) {
        particle.velocityX = particle.velocityX / speed * 13;
        particle.velocityY = particle.velocityY / speed * 13;
      }
      particle.x += particle.velocityX * frameStep;
      particle.y += particle.velocityY * frameStep;

      const formation = 0.48
        + shimmer * 0.42
        + (0.5 + Math.sin(time * 0.5 + particle.phase) * 0.5) * 0.16;
      const hue = (particle.hue + shimmer * 24 + interaction * 84 + time * 4) % 360;
      const alpha = clamp(
        (0.22 + particle.brightness * 0.26 + shimmer * 0.15 + interaction * 0.24) * formation,
        0.05,
        0.92,
      );

      context.strokeStyle = `hsla(${hue}, 100%, ${68 + shimmer * 13}%, ${alpha * 0.48})`;
      context.lineWidth = 0.28 + particle.size * 0.28 + Math.min(speed, 3) * 0.1;
      context.beginPath();
      context.moveTo(particle.previousX, particle.previousY);
      context.lineTo(particle.x, particle.y);
      context.stroke();
      context.fillStyle = `hsla(${hue}, 100%, ${72 + shimmer * 12}%, ${alpha})`;
      context.beginPath();
      context.arc(
        particle.x,
        particle.y,
        0.34 + particle.size * 0.4 + shimmer * 0.22,
        0,
        Math.PI * 2,
      );
      context.fill();

      if ((index + Math.floor(time * 15)) % 29 === 0 && formation > 0.55) {
        context.fillStyle = `rgba(255, 250, 238, ${alpha * 0.78})`;
        context.beginPath();
        context.arc(particle.x, particle.y, 0.8 + shimmer * 0.5, 0, Math.PI * 2);
        context.fill();
      }
    });
  }

  function animate(now) {
    frame = window.requestAnimationFrame(animate);
    if (document.hidden) {
      previousTime = now;
      return;
    }
    const frameTime = clamp(now - previousTime, 8, 40);
    previousTime = now;
    const frameStep = frameTime / 16.67;
    const time = now / 1000;
    if (frameTime > 27) quality = Math.max(0.56, quality - 0.006);
    if (frameTime < 18) quality = Math.min(1, quality + 0.001);

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = 'rgba(0, 0, 0, 0.19)';
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    context.lineJoin = 'round';

    if (now - pointer.lastMove > 1200 && !pointer.down) pointer.active *= 0.965;
    pointer.velocityX *= 0.82;
    pointer.velocityY *= 0.82;
    pointer.burst *= 0.91;
    scrollEnergy *= 0.94;

    drawAmbient(time, frameStep);
    drawTargetParticles(time, frameStep);
    drawGestureTrails(now);
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(resize);
  });

  if (logo.complete && logo.naturalWidth) resize();
  else logo.addEventListener('load', resize, { once: true });
  frame = window.requestAnimationFrame(animate);
})();
