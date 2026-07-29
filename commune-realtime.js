(() => {
  const canvas = document.querySelector('[data-commune-realtime]');
  const logo = document.querySelector('[data-particle-logo]');
  const venueImage = document.querySelector('[data-particle-venue]');
  const formTitle = document.querySelector('[data-particle-form-title]');
  const formTitleCanvas = document.querySelector('[data-form-title-particles]');
  const soundToggle = document.querySelector('[data-soundscape-toggle]');
  const soundLabel = soundToggle?.querySelector('[data-soundscape-label]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (
    !(canvas instanceof HTMLCanvasElement)
    || !(logo instanceof HTMLImageElement)
    || !(venueImage instanceof HTMLImageElement)
    || !(formTitle instanceof HTMLElement)
    || !(formTitleCanvas instanceof HTMLCanvasElement)
  ) return;

  const preventNativeImageGesture = (event) => event.preventDefault();
  const lockImageRegion = (image, region) => {
    image.addEventListener('dragstart', preventNativeImageGesture);
    image.addEventListener('selectstart', preventNativeImageGesture);
    if (!(region instanceof HTMLElement)) return;
    region.addEventListener('dragstart', preventNativeImageGesture);
    region.addEventListener('selectstart', preventNativeImageGesture);
    region.addEventListener('pointerdown', (event) => {
      if (event.isPrimary && event.button === 0) event.preventDefault();
    }, { passive: false });
  };
  lockImageRegion(logo, logo.closest('[data-particle-region="wordmark"]'));
  lockImageRegion(venueImage, venueImage.closest('[data-particle-region="venue"]'));

  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  let soundscape = null;
  let soundscapeEnabled = false;
  let toneTimer = 0;
  let suspendTimer = 0;
  let soundPointerX = window.innerWidth * 0.5;
  let soundPointerY = window.innerHeight * 0.5;
  let soundPointerTime = performance.now();

  const soundClamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

  function connectWithPan(source, destination, pan = 0) {
    if (!soundscape || typeof soundscape.audio.createStereoPanner !== 'function') {
      source.connect(destination);
      return null;
    }
    const panner = soundscape.audio.createStereoPanner();
    panner.pan.value = soundClamp(pan, -0.9, 0.9);
    source.connect(panner);
    panner.connect(destination);
    return panner;
  }

  function createReverbImpulse(audio, duration = 3.8, decay = 3.2) {
    const length = Math.floor(audio.sampleRate * duration);
    const impulse = audio.createBuffer(2, length, audio.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const data = impulse.getChannelData(channel);
      let previous = 0;
      for (let index = 0; index < length; index += 1) {
        const envelope = Math.pow(1 - index / length, decay);
        const noise = Math.random() * 2 - 1;
        previous = previous * 0.34 + noise * 0.66;
        data[index] = previous * envelope * (channel === 0 ? 0.72 : 0.68);
      }
    }
    return impulse;
  }

  function createAirBuffer(audio, duration = 5) {
    const length = Math.floor(audio.sampleRate * duration);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.018 * white) / 1.018;
      data[index] = brown * 2.4;
    }
    return buffer;
  }

  function createSoundscape() {
    if (soundscape || !AudioContextConstructor) return soundscape;
    const audio = new AudioContextConstructor({ latencyHint: 'interactive' });
    const master = audio.createGain();
    const compressor = audio.createDynamicsCompressor();
    const bus = audio.createGain();
    const dry = audio.createGain();
    const wet = audio.createGain();
    const reverb = audio.createConvolver();
    const droneFilter = audio.createBiquadFilter();
    const droneGain = audio.createGain();
    const airFilter = audio.createBiquadFilter();
    const airGain = audio.createGain();

    master.gain.value = 0;
    compressor.threshold.value = -30;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.025;
    compressor.release.value = 0.7;
    dry.gain.value = 0.58;
    wet.gain.value = 0.72;
    reverb.buffer = createReverbImpulse(audio);

    bus.connect(dry);
    dry.connect(master);
    bus.connect(reverb);
    reverb.connect(wet);
    wet.connect(master);
    master.connect(compressor);
    compressor.connect(audio.destination);

    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 440;
    droneFilter.Q.value = 3.4;
    droneGain.gain.value = 0.026;
    droneFilter.connect(droneGain);
    droneGain.connect(bus);

    const droneNotes = [
      { frequency: 82.41, type: 'sine', gain: 0.42, detune: -7 },
      { frequency: 123.47, type: 'sine', gain: 0.2, detune: 5 },
      { frequency: 164.81, type: 'triangle', gain: 0.06, detune: -3 },
    ];
    const droneOscillators = droneNotes.map((note) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = note.type;
      oscillator.frequency.value = note.frequency;
      oscillator.detune.value = note.detune;
      gain.gain.value = note.gain;
      oscillator.connect(gain);
      gain.connect(droneFilter);
      oscillator.start();
      return oscillator;
    });

    const breathLfo = audio.createOscillator();
    const breathDepth = audio.createGain();
    breathLfo.type = 'sine';
    breathLfo.frequency.value = 75 / 60;
    breathDepth.gain.value = 0.0075;
    breathLfo.connect(breathDepth);
    breathDepth.connect(droneGain.gain);
    breathLfo.start();

    const driftLfo = audio.createOscillator();
    const driftDepth = audio.createGain();
    driftLfo.type = 'sine';
    driftLfo.frequency.value = 0.037;
    driftDepth.gain.value = 190;
    driftLfo.connect(driftDepth);
    driftDepth.connect(droneFilter.frequency);
    driftLfo.start();

    const airSource = audio.createBufferSource();
    airSource.buffer = createAirBuffer(audio);
    airSource.loop = true;
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 740;
    airFilter.Q.value = 0.46;
    airGain.gain.value = 0.012;
    airSource.connect(airFilter);
    airFilter.connect(airGain);
    const airPanner = connectWithPan(airGain, bus, 0);
    airSource.start();

    soundscape = {
      audio,
      master,
      bus,
      dry,
      wet,
      droneFilter,
      droneGain,
      airFilter,
      airGain,
      airPanner,
      droneOscillators,
      breathLfo,
      driftLfo,
      airSource,
    };
    if (soundToggle) soundToggle.dataset.context = audio.state;
    return soundscape;
  }

  function playTone(intensity = 0.5, horizontal = 0.5, bright = false) {
    if (!soundscapeEnabled || !soundscape) return;
    const { audio, bus } = soundscape;
    if (audio.state !== 'running') return;
    const now = audio.currentTime;
    const scale = [164.81, 196, 220, 246.94, 293.66, 329.63, 392];
    const frequency = scale[Math.floor(Math.random() * scale.length)];
    const duration = 3.4 + Math.random() * 2.8;
    const level = soundClamp(intensity, 0.16, 1);
    const envelope = audio.createGain();
    const filter = audio.createBiquadFilter();
    const fundamental = audio.createOscillator();
    const overtone = audio.createOscillator();
    const overtoneGain = audio.createGain();

    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(frequency, now);
    fundamental.detune.setValueAtTime((Math.random() - 0.5) * 9, now);
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(frequency * 2, now);
    overtone.detune.setValueAtTime((Math.random() - 0.5) * 13, now);
    overtoneGain.gain.value = bright ? 0.09 : 0.035;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(bright ? 2800 : 1450, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + duration);
    filter.Q.value = 1.8;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.042 * level, now + 0.08);
    envelope.gain.exponentialRampToValueAtTime(0.011 * level, now + 0.72);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    fundamental.connect(envelope);
    overtone.connect(overtoneGain);
    overtoneGain.connect(envelope);
    envelope.connect(filter);
    connectWithPan(filter, bus, horizontal * 1.8 - 0.9);
    fundamental.start(now);
    overtone.start(now);
    fundamental.stop(now + duration + 0.08);
    overtone.stop(now + duration + 0.08);
  }

  function scheduleTone() {
    window.clearTimeout(toneTimer);
    if (!soundscapeEnabled) return;
    const delay = 3300 + Math.random() * 4700;
    toneTimer = window.setTimeout(() => {
      playTone(0.22 + Math.random() * 0.22, Math.random(), Math.random() > 0.78);
      scheduleTone();
    }, delay);
  }

  function updateSoundscape(horizontal, vertical, speed = 0, isDown = false, scroll = 0) {
    if (!soundscapeEnabled || !soundscape || soundscape.audio.state !== 'running') return;
    const { audio, droneFilter, droneGain, airFilter, airGain, airPanner } = soundscape;
    const now = audio.currentTime;
    const x = soundClamp(horizontal / Math.max(window.innerWidth, 1), 0, 1);
    const y = soundClamp(vertical / Math.max(window.innerHeight, 1), 0, 1);
    const motion = soundClamp(speed / 85, 0, 1);
    const scrollLift = soundClamp(scroll, 0, 1);
    droneFilter.frequency.setTargetAtTime(300 + x * 520 + motion * 260 + scrollLift * 130, now, 0.18);
    droneFilter.Q.setTargetAtTime(2.2 + (1 - y) * 3.6, now, 0.2);
    droneGain.gain.setTargetAtTime(0.025 + motion * 0.005 + (isDown ? 0.004 : 0), now, 0.24);
    airFilter.frequency.setTargetAtTime(430 + (1 - y) * 1150 + motion * 720, now, 0.14);
    airGain.gain.setTargetAtTime(
      0.009 + motion * 0.014 + (isDown ? 0.008 : 0) + scrollLift * 0.005,
      now,
      0.16,
    );
    if (airPanner) airPanner.pan.setTargetAtTime(x * 1.5 - 0.75, now, 0.2);
  }

  function updateFluxSound(logoPresence, venuePresence, breath) {
    if (!soundscapeEnabled || !soundscape || soundscape.audio.state !== 'running') return;
    const {
      audio,
      droneFilter,
      droneGain,
      airFilter,
      airGain,
      dry,
      wet,
    } = soundscape;
    const now = audio.currentTime;
    const particleState = 1 - (logoPresence * 0.46 + venuePresence * 0.54);
    droneFilter.frequency.setTargetAtTime(
      380 + logoPresence * 260 + venuePresence * 170 + breath * 90,
      now,
      0.42,
    );
    droneGain.gain.setTargetAtTime(0.024 + breath * 0.0035, now, 0.48);
    airFilter.frequency.setTargetAtTime(
      520 + particleState * 820 + breath * 180,
      now,
      0.38,
    );
    airGain.gain.setTargetAtTime(0.008 + particleState * 0.008 + breath * 0.002, now, 0.4);
    dry.gain.setTargetAtTime(0.48 + logoPresence * 0.18, now, 0.55);
    wet.gain.setTargetAtTime(0.64 + particleState * 0.3, now, 0.55);
  }

  async function enableSoundscape() {
    const engine = createSoundscape();
    if (!engine) return;
    try {
      window.clearTimeout(suspendTimer);
      await engine.audio.resume();
      soundscapeEnabled = true;
      const now = engine.audio.currentTime;
      engine.master.gain.cancelScheduledValues(now);
      engine.master.gain.setValueAtTime(engine.master.gain.value, now);
      engine.master.gain.linearRampToValueAtTime(0.34, now + 1.35);
      if (soundToggle) {
        soundToggle.dataset.state = 'on';
        soundToggle.dataset.context = engine.audio.state;
        soundToggle.setAttribute('aria-pressed', 'true');
        soundToggle.setAttribute('aria-label', 'Pause generative soundscape');
      }
      if (soundLabel) soundLabel.textContent = 'Sound on';
      playTone(0.38, 0.5);
      scheduleTone();
    } catch {
      soundscapeEnabled = false;
      soundToggle.dataset.state = 'unavailable';
      soundToggle.dataset.context = engine.audio.state;
      soundToggle.setAttribute('aria-pressed', 'false');
      soundToggle.setAttribute('aria-label', 'Soundscape could not start');
      if (soundLabel) soundLabel.textContent = 'Sound unavailable';
    }
  }

  function disableSoundscape() {
    if (!soundscape) return;
    soundscapeEnabled = false;
    window.clearTimeout(toneTimer);
    const now = soundscape.audio.currentTime;
    soundscape.master.gain.cancelScheduledValues(now);
    soundscape.master.gain.setValueAtTime(soundscape.master.gain.value, now);
    soundscape.master.gain.linearRampToValueAtTime(0, now + 0.65);
    if (soundToggle) {
      soundToggle.dataset.state = 'off';
      soundToggle.setAttribute('aria-pressed', 'false');
      soundToggle.setAttribute('aria-label', 'Start generative soundscape');
    }
    if (soundLabel) soundLabel.textContent = 'Sound off';
    suspendTimer = window.setTimeout(async () => {
      if (!soundscapeEnabled && soundscape?.audio.state === 'running') {
        await soundscape.audio.suspend();
        if (soundToggle) soundToggle.dataset.context = soundscape.audio.state;
      }
    }, 780);
  }

  if (!(soundToggle instanceof HTMLButtonElement) || !AudioContextConstructor) {
    if (soundToggle) {
      soundToggle.disabled = true;
      soundToggle.dataset.state = 'unavailable';
      soundToggle.setAttribute('aria-label', 'Soundscape unavailable');
    }
    if (soundLabel) soundLabel.textContent = 'Sound unavailable';
  } else {
    soundToggle.addEventListener('click', () => {
      if (soundscapeEnabled) disableSoundscape();
      else enableSoundscape();
    });

    window.addEventListener('pointermove', (event) => {
      const now = performance.now();
      const elapsed = Math.max(12, now - soundPointerTime);
      const distance = Math.hypot(event.clientX - soundPointerX, event.clientY - soundPointerY);
      const speed = distance / elapsed * 16.67;
      soundPointerX = event.clientX;
      soundPointerY = event.clientY;
      soundPointerTime = now;
      updateSoundscape(event.clientX, event.clientY, speed, event.buttons > 0);
    }, { passive: true });

    window.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || soundToggle.contains(event.target)) return;
      playTone(0.48, event.clientX / Math.max(window.innerWidth, 1), true);
      updateSoundscape(event.clientX, event.clientY, 32, true);
    }, { passive: true });

    window.addEventListener('scroll', () => {
      const scroll = soundClamp(Math.abs(window.scrollY - (soundscape?.lastScroll || 0)) / 260, 0, 1);
      if (soundscape) soundscape.lastScroll = window.scrollY;
      updateSoundscape(soundPointerX, soundPointerY, 0, false, scroll);
    }, { passive: true });

    document.addEventListener('visibilitychange', async () => {
      if (!soundscape) return;
      if (document.hidden && soundscape.audio.state === 'running') {
        await soundscape.audio.suspend();
      } else if (!document.hidden && soundscapeEnabled) {
        await soundscape.audio.resume();
      }
      soundToggle.dataset.context = soundscape.audio.state;
    });
  }

  if (reducedMotion.matches) {
    document.documentElement.classList.add('realtime-ready');
    return;
  }

  const context = canvas.getContext('2d', { alpha: true });
  const maskCanvas = document.createElement('canvas');
  const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
  const logoAnalysisCanvas = document.createElement('canvas');
  const logoAnalysisContext = logoAnalysisCanvas.getContext('2d', { willReadFrequently: true });
  const venueAnalysisCanvas = document.createElement('canvas');
  const venueAnalysisContext = venueAnalysisCanvas.getContext('2d', { willReadFrequently: true });
  const formTitleContext = formTitleCanvas.getContext('2d', { alpha: true });
  const formTitleMaskCanvas = document.createElement('canvas');
  const formTitleMaskContext = formTitleMaskCanvas.getContext('2d', { willReadFrequently: true });
  if (
    !context
    || !maskContext
    || !logoAnalysisContext
    || !venueAnalysisContext
    || !formTitleContext
    || !formTitleMaskContext
  ) return;

  const palette = [18, 34, 178, 194, 310, 328];
  const particles = [];
  const venueParticles = [];
  const ambient = [];
  const gestureTrail = [];
  const particleDesigns = [];
  const targetPoints = [];
  const venueTargetPoints = [];
  const formTitleParticles = [];
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
  let lastFluxSoundUpdate = 0;
  let fluxBurst = 0;
  let imageSuppression = 0;
  let imageSuppressionHoldUntil = 0;
  let performanceFrames = 0;
  let performanceTime = 0;
  let quality = window.innerWidth < 700 ? 0.68 : 1;
  let formTitleDpr = 1;
  let formTitleWidth = 1;
  let formTitleHeight = 1;
  const imageCycleSeconds = 10;
  const imageOpacityFloor = 0.075;
  canvas.dataset.imageCycleSeconds = String(imageCycleSeconds);
  canvas.dataset.imageOpacityFloor = String(imageOpacityFloor);
  canvas.dataset.glitchMode = 'structural-blocks';

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const smoothstep = (minimum, maximum, value) => {
    const normalized = clamp((value - minimum) / Math.max(maximum - minimum, 0.0001), 0, 1);
    return normalized * normalized * (3 - 2 * normalized);
  };
  const hashNoise = (x, y) => {
    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
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

  function objectFitCoverCrop(image, rect) {
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = rect.width / rect.height;
    if (sourceRatio > targetRatio) {
      const sourceWidth = image.naturalHeight * targetRatio;
      return {
        x: (image.naturalWidth - sourceWidth) * 0.5,
        y: 0,
        width: sourceWidth,
        height: image.naturalHeight,
      };
    }
    const sourceHeight = image.naturalWidth / targetRatio;
    return {
      x: 0,
      y: (image.naturalHeight - sourceHeight) * 0.5,
      width: image.naturalWidth,
      height: sourceHeight,
    };
  }

  function inExpandedViewport(rect, expansion = 180) {
    return rect.bottom > -expansion && rect.top < height + expansion;
  }

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
    rebuildFormTitleParticles(compact);
    rebuildTargets();
    rebuildVenueTargets();
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

  function rebuildFormTitleParticles(compact = width < 700) {
    const rect = formTitle.getBoundingClientRect();
    formTitleWidth = Math.max(1, Math.round(rect.width));
    formTitleHeight = Math.max(1, Math.round(rect.height + 16));
    formTitleDpr = Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.6);
    formTitleCanvas.width = Math.max(1, Math.round(formTitleWidth * formTitleDpr));
    formTitleCanvas.height = Math.max(1, Math.round(formTitleHeight * formTitleDpr));
    formTitleCanvas.style.width = `${formTitleWidth}px`;
    formTitleCanvas.style.height = `${formTitleHeight}px`;

    const sampleScale = compact ? 0.78 : 0.9;
    formTitleMaskCanvas.width = Math.max(1, Math.round(formTitleWidth * sampleScale));
    formTitleMaskCanvas.height = Math.max(1, Math.round(formTitleHeight * sampleScale));
    formTitleMaskContext.setTransform(1, 0, 0, 1, 0, 0);
    formTitleMaskContext.clearRect(
      0,
      0,
      formTitleMaskCanvas.width,
      formTitleMaskCanvas.height,
    );
    formTitleMaskContext.setTransform(sampleScale, 0, 0, sampleScale, 0, 0);
    const titleText = formTitle.querySelector('.form-title');
    const style = titleText ? window.getComputedStyle(titleText) : null;
    if (!titleText || !style) return;
    formTitleMaskContext.fillStyle = '#fff';
    formTitleMaskContext.font = style.font;
    formTitleMaskContext.textAlign = 'center';
    formTitleMaskContext.textBaseline = 'middle';
    formTitleMaskContext.fillText(
      titleText.textContent || '',
      formTitleWidth * 0.5,
      formTitleHeight * 0.5,
      formTitleWidth,
    );

    const mask = formTitleMaskContext.getImageData(
      0,
      0,
      formTitleMaskCanvas.width,
      formTitleMaskCanvas.height,
    );
    const candidates = [];
    for (let y = 0; y < formTitleMaskCanvas.height; y += 1) {
      for (let x = 0; x < formTitleMaskCanvas.width; x += 1) {
        const alpha = mask.data[(y * formTitleMaskCanvas.width + x) * 4 + 3];
        if (alpha < 110) continue;
        candidates.push({
          x: (x + 0.5) / sampleScale,
          y: (y + 0.5) / sampleScale,
          rank: hashNoise(x + 91, y + 37),
        });
      }
    }
    candidates.sort((first, second) => second.rank - first.rank);
    const maximum = compact ? 820 : 1450;
    const targets = candidates.slice(0, maximum);
    const initial = formTitleParticles.length === 0;
    targets.forEach((target, index) => {
      const particle = formTitleParticles[index];
      if (particle) {
        particle.targetX = target.x;
        particle.targetY = target.y;
        return;
      }
      const spread = initial ? 1.2 : 9;
      formTitleParticles.push({
        x: target.x + (Math.random() - 0.5) * spread,
        y: target.y + (Math.random() - 0.5) * spread,
        previousX: target.x,
        previousY: target.y,
        targetX: target.x,
        targetY: target.y,
        velocityX: (Math.random() - 0.5) * 0.18,
        velocityY: (Math.random() - 0.5) * 0.18,
        phase: Math.random() * Math.PI * 2,
        hue: palette[index % palette.length],
        size: 0.3 + Math.random() * 0.58,
      });
    });
    formTitleParticles.length = targets.length;
    formTitleCanvas.dataset.maskCandidates = String(candidates.length);
    formTitleCanvas.dataset.particles = String(formTitleParticles.length);
    const ready = formTitleParticles.length > 80;
    formTitleCanvas.dataset.ready = String(ready);
    document.documentElement.classList.toggle('form-title-particles-ready', ready);
  }

  function drawMask() {
    maskContext.setTransform(1, 0, 0, 1, 0, 0);
    maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskContext.setTransform(maskScale, 0, 0, maskScale, 0, 0);

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
    const compact = width < 700;
    const candidates = [];
    const logoRect = logo.getBoundingClientRect();

    if (inExpandedViewport(logoRect, 120)) {
      const analysisWidth = compact ? 420 : 720;
      const analysisHeight = Math.max(
        1,
        Math.round(analysisWidth * logo.naturalHeight / logo.naturalWidth),
      );
      logoAnalysisCanvas.width = analysisWidth;
      logoAnalysisCanvas.height = analysisHeight;
      logoAnalysisContext.clearRect(0, 0, analysisWidth, analysisHeight);
      logoAnalysisContext.drawImage(logo, 0, 0, analysisWidth, analysisHeight);
      const logoImage = logoAnalysisContext.getImageData(0, 0, analysisWidth, analysisHeight);
      const sampleStep = 2;

      for (let y = 0; y < analysisHeight; y += sampleStep) {
        const normalizedY = (y + 0.5) / analysisHeight;
        const insideLetterRows = (
          (normalizedY > 0.105 && normalizedY < 0.47)
          || (normalizedY > 0.525 && normalizedY < 0.925)
        );
        if (!insideLetterRows) continue;

        for (let x = 0; x < analysisWidth; x += sampleStep) {
          const offset = (y * analysisWidth + x) * 4;
          const red = logoImage.data[offset];
          const green = logoImage.data[offset + 1];
          const blue = logoImage.data[offset + 2];
          const alpha = logoImage.data[offset + 3];
          const brightness = red * 0.299 + green * 0.587 + blue * 0.114;
          const channelFloor = Math.min(red, green, blue);
          const channelCeiling = Math.max(red, green, blue);
          const channelSpread = channelCeiling - channelFloor;
          const creamGeometry = brightness > 128
            && channelFloor > 68
            && channelSpread < 102
            && red > blue * 0.88;
          if (alpha < 80 || !creamGeometry) continue;

          const normalizedX = (x + 0.5) / analysisWidth;
          const cssX = logoRect.left + normalizedX * logoRect.width;
          const cssY = logoRect.top + normalizedY * logoRect.height;
          const fallbackHue = palette[
            (Math.floor(normalizedX * 8) + Math.floor(normalizedY * 5)) % palette.length
          ];
          candidates.push({
            x: cssX,
            y: cssY,
            hue: colourHue(red, green, blue, fallbackHue),
            brightness: brightness / 255,
            rank: hashNoise(x, y),
          });
        }
      }
    }

    drawMask();
    const headingImage = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    for (let y = 0; y < maskCanvas.height; y += 2) {
      for (let x = 0; x < maskCanvas.width; x += 2) {
        const offset = (y * maskCanvas.width + x) * 4;
        const alpha = headingImage.data[offset + 3];
        if (alpha < 80) continue;
        const cssX = x / maskScale;
        const cssY = y / maskScale;
        const fallbackHue = palette[
          (Math.floor(cssX / 90) + Math.floor(cssY / 70)) % palette.length
        ];
        candidates.push({
          x: cssX,
          y: cssY,
          hue: fallbackHue,
          brightness: 0.94,
          rank: hashNoise(cssX, cssY),
        });
      }
    }

    canvas.dataset.logoMaskSource = 'source-pixels';
    canvas.dataset.logoMaskCandidates = String(candidates.length);
    const maximum = compact
      ? Math.max(1050, Math.round(1800 * quality))
      : Math.max(3800, Math.round(5000 * quality));
    candidates.sort((first, second) => second.rank - first.rank);
    targetPoints.length = 0;
    for (let index = 0; index < candidates.length && targetPoints.length < maximum; index += 1) {
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
      const spread = initial ? 1.5 : 18;
      particles.push({
        x: target.x + (Math.random() - 0.5) * spread,
        y: target.y + (Math.random() - 0.5) * spread,
        previousX: target.x,
        previousY: target.y,
        targetX: target.x,
        targetY: target.y,
        velocityX: (Math.random() - 0.5) * 0.5,
        velocityY: (Math.random() - 0.5) * 0.5,
        size: 0.28 + Math.random() * 0.72,
        phase: Math.random() * Math.PI * 2,
        hue: target.hue,
        brightness: target.brightness,
      });
    });
    particles.length = targetPoints.length;
    canvas.dataset.logoParticles = String(particles.length);
    if (targetPoints.length > 80) document.documentElement.classList.add('realtime-ready');
  }

  function rebuildVenueTargets() {
    if (!venueImage.complete || !venueImage.naturalWidth) return;
    const rect = venueImage.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40 || !inExpandedViewport(rect, height * 0.75)) {
      venueTargetPoints.length = 0;
      venueParticles.length = 0;
      canvas.dataset.venueParticles = '0';
      return;
    }

    const compact = width < 700;
    const analysisWidth = compact ? 196 : 300;
    const analysisHeight = Math.max(
      1,
      Math.min(compact ? 330 : 450, Math.round(analysisWidth * rect.height / rect.width)),
    );
    venueAnalysisCanvas.width = analysisWidth;
    venueAnalysisCanvas.height = analysisHeight;
    venueAnalysisContext.clearRect(0, 0, analysisWidth, analysisHeight);
    const crop = objectFitCoverCrop(venueImage, rect);
    venueAnalysisContext.drawImage(
      venueImage,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      analysisWidth,
      analysisHeight,
    );

    const image = venueAnalysisContext.getImageData(0, 0, analysisWidth, analysisHeight);
    const candidates = [];
    const luminanceAt = (x, y) => {
      const safeX = clamp(x, 0, analysisWidth - 1);
      const safeY = clamp(y, 0, analysisHeight - 1);
      const offset = (safeY * analysisWidth + safeX) * 4;
      return image.data[offset] * 0.299
        + image.data[offset + 1] * 0.587
        + image.data[offset + 2] * 0.114;
    };

    for (let y = 2; y < analysisHeight - 2; y += 2) {
      for (let x = 2; x < analysisWidth - 2; x += 2) {
        const offset = (y * analysisWidth + x) * 4;
        const red = image.data[offset];
        const green = image.data[offset + 1];
        const blue = image.data[offset + 2];
        const brightness = luminanceAt(x, y);
        const gradientX = Math.abs(luminanceAt(x + 2, y) - luminanceAt(x - 2, y));
        const gradientY = Math.abs(luminanceAt(x, y + 2) - luminanceAt(x, y - 2));
        const edge = Math.min(1, (gradientX + gradientY) / 92);
        const structuralEdge = edge > 0.19;
        const reflectedLight = brightness > 118 && (x * 17 + y * 13) % 19 < 3;
        const darkBeam = brightness < 54 && edge > 0.34 && (x * 11 + y * 7) % 5 === 0;
        if (!structuralEdge && !reflectedLight && !darkBeam) continue;

        const u = x / analysisWidth;
        const v = y / analysisHeight;
        const fallbackHue = u < 0.46 ? 22 + v * 10 : 194 - v * 8;
        candidates.push({
          x: rect.left + u * rect.width,
          y: rect.top + v * rect.height,
          u,
          v,
          hue: colourHue(red, green, blue, fallbackHue),
          brightness: brightness / 255,
          edge,
          rank: edge * 0.72 + brightness / 255 * 0.08 + hashNoise(x, y) * 0.2,
        });
      }
    }

    const maximum = compact
      ? Math.max(650, Math.round(900 * quality))
      : Math.max(1400, Math.round(1800 * quality));
    candidates.sort((first, second) => second.rank - first.rank);
    venueTargetPoints.length = 0;
    for (
      let index = 0;
      index < candidates.length && venueTargetPoints.length < maximum;
      index += 1
    ) {
      venueTargetPoints.push(candidates[index]);
    }

    const initial = venueParticles.length === 0;
    venueTargetPoints.forEach((target, index) => {
      const particle = venueParticles[index];
      if (particle) {
        particle.targetX = target.x;
        particle.targetY = target.y;
        particle.u = target.u;
        particle.v = target.v;
        particle.edge = target.edge;
        particle.brightness = target.brightness;
        particle.hue += (target.hue - particle.hue) * 0.26;
        return;
      }
      const spread = initial ? 9 : 32;
      venueParticles.push({
        x: target.x + (Math.random() - 0.5) * spread,
        y: target.y + (Math.random() - 0.5) * spread,
        previousX: target.x,
        previousY: target.y,
        targetX: target.x,
        targetY: target.y,
        velocityX: (Math.random() - 0.5) * 0.42,
        velocityY: (Math.random() - 0.5) * 0.42,
        u: target.u,
        v: target.v,
        edge: target.edge,
        brightness: target.brightness,
        hue: target.hue,
        phase: Math.random() * Math.PI * 2,
        size: 0.26 + Math.random() * 0.64,
      });
    });
    venueParticles.length = venueTargetPoints.length;
    canvas.dataset.venueParticles = String(venueParticles.length);
    if (venueParticles.length > 100) document.documentElement.classList.add('venue-flux-ready');
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

  function createParticleDesign(x, y) {
    const compact = width < 700;
    const count = compact ? 78 : Math.max(108, Math.round(144 * quality));
    const arms = 5 + Math.floor(Math.random() * 4);
    const spin = Math.random() > 0.5 ? 1 : -1;
    const radius = compact ? 112 : 178;
    const hue = palette[Math.floor(Math.random() * palette.length)];
    const points = [];

    for (let index = 0; index < count; index += 1) {
      const phase = index / count * Math.PI * 2;
      const layer = index % 3;
      points.push({
        phase,
        layer,
        radius: radius * (0.3 + Math.pow(Math.random(), 0.68) * 0.7),
        seed: Math.random() * Math.PI * 2,
        hue: (hue + layer * 42 + Math.random() * 24) % 360,
        size: 0.26 + Math.random() * 0.58,
      });
    }

    particleDesigns.push({
      x,
      y,
      born: performance.now(),
      arms,
      spin,
      points,
    });
    if (particleDesigns.length > (compact ? 2 : 3)) particleDesigns.shift();
    canvas.dataset.particleDesigns = String(particleDesigns.length);
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
    if (pointer.down) {
      imageSuppression = 1;
      imageSuppressionHoldUntil = Math.max(
        imageSuppressionHoldUntil,
        performance.now() + 520,
      );
    }
  }

  function onPointerDown(event) {
    if (!event.isPrimary) return;
    pointer.down = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.burst = 1;
    fluxBurst = 1;
    imageSuppression = 1;
    imageSuppressionHoldUntil = performance.now() + 6000;
    pointer.active = 1;
    addGesturePoint(event.clientX, event.clientY, true);
    createParticleDesign(event.clientX, event.clientY);
  }

  function onPointerUp() {
    pointer.down = false;
    imageSuppression = 1;
    imageSuppressionHoldUntil = Math.max(
      imageSuppressionHoldUntil,
      performance.now() + 2400,
    );
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
    venueParticles.forEach((particle) => {
      particle.y -= delta;
      particle.previousY -= delta;
      particle.targetY -= delta;
    });
    lastScroll = currentScroll;
    window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(() => {
      rebuildTargets();
      rebuildVenueTargets();
    }, 180);
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

  function drawParticleDesigns(now) {
    const lifetime = 4400;
    const previousCount = particleDesigns.length;
    const activeDesigns = particleDesigns.filter((design) => now - design.born < lifetime);
    particleDesigns.length = 0;
    particleDesigns.push(...activeDesigns);
    if (activeDesigns.length !== previousCount) {
      canvas.dataset.particleDesigns = String(activeDesigns.length);
    }
    if (activeDesigns.length === 0) return;

    context.save();
    context.globalCompositeOperation = 'lighter';
    activeDesigns.forEach((design) => {
      const age = (now - design.born) / 1000;
      const life = clamp(1 - smoothstep(0.5, 1, age / (lifetime / 1000)), 0, 1);
      const growth = smoothstep(0, 1, Math.min(age / 1.35, 1));

      design.points.forEach((point, index) => {
        const layerSpeed = 0.46 + point.layer * 0.13;
        const theta = point.phase
          + design.spin * age * layerSpeed
          + Math.sin(age * 1.4 + point.seed) * 0.12;
        const rose = Math.cos(design.arms * theta + age * 0.82 + point.layer * 1.7);
        const ripple = Math.sin(age * 3.1 - point.radius * 0.035 + point.seed);
        const radius = point.radius
          * growth
          * (0.68 + rose * 0.23)
          + ripple * (4 + point.layer * 2.4)
          + age * (1.4 + point.layer * 1.1);
        const curl = age * design.spin * (0.18 + point.layer * 0.04);
        const x = design.x
          + Math.cos(theta + curl) * radius
          + Math.cos(theta * 3 - age + point.seed) * 5.5 * life;
        const y = design.y
          + Math.sin(theta + curl) * radius
          + Math.sin(theta * 2 + age * 0.7 + point.seed) * 5.5 * life;
        const previousAge = Math.max(0, age - 0.035);
        const previousTheta = point.phase
          + design.spin * previousAge * layerSpeed
          + Math.sin(previousAge * 1.4 + point.seed) * 0.12;
        const previousRose = Math.cos(
          design.arms * previousTheta + previousAge * 0.82 + point.layer * 1.7,
        );
        const previousRipple = Math.sin(
          previousAge * 3.1 - point.radius * 0.035 + point.seed,
        );
        const previousRadius = point.radius
          * smoothstep(0, 1, Math.min(previousAge / 1.35, 1))
          * (0.68 + previousRose * 0.23)
          + previousRipple * (4 + point.layer * 2.4)
          + previousAge * (1.4 + point.layer * 1.1);
        const previousCurl = previousAge * design.spin * (0.18 + point.layer * 0.04);
        const previousX = design.x
          + Math.cos(previousTheta + previousCurl) * previousRadius
          + Math.cos(previousTheta * 3 - previousAge + point.seed) * 5.5 * life;
        const previousY = design.y
          + Math.sin(previousTheta + previousCurl) * previousRadius
          + Math.sin(previousTheta * 2 + previousAge * 0.7 + point.seed) * 5.5 * life;
        const shimmer = 0.55 + Math.sin(age * 5.2 + point.seed + index * 0.19) * 0.45;
        const alpha = life * (0.22 + shimmer * 0.5);
        const hue = (point.hue + age * 18 + rose * 34 + 360) % 360;

        context.strokeStyle = `hsla(${hue}, 100%, 72%, ${alpha * 0.42})`;
        context.lineWidth = 0.28 + point.size * 0.32;
        context.beginPath();
        context.moveTo(previousX, previousY);
        context.lineTo(x, y);
        context.stroke();
        context.fillStyle = `hsla(${hue}, 100%, ${72 + shimmer * 16}%, ${alpha})`;
        context.beginPath();
        context.arc(x, y, point.size * (0.72 + shimmer * 0.45), 0, Math.PI * 2);
        context.fill();

        if ((index + Math.floor(age * 12)) % 23 === 0) {
          context.fillStyle = `rgba(255, 249, 238, ${alpha * 0.78})`;
          context.beginPath();
          context.arc(x, y, 0.7 + shimmer * 0.55, 0, Math.PI * 2);
          context.fill();
        }
      });
    });
    context.restore();
  }

  function calculateFluxState(time) {
    const slowBreath = 0.5 + Math.sin(time * 0.43 - 0.8) * 0.5;
    const soundBreath = 0.5 + Math.sin(time * Math.PI * 2 * (75 / 60)) * 0.5;
    const imageWave = 0.5 - Math.cos(time / imageCycleSeconds * Math.PI * 2) * 0.5;
    const imagePresence = smoothstep(0.035, 0.965, imageWave);
    const interactionVisibility = pointer.down || time * 1000 < imageSuppressionHoldUntil
      ? 0
      : 1 - imageSuppression;
    const visiblePresence = imagePresence * interactionVisibility;
    const logoPresence = imageOpacityFloor + visiblePresence * (1 - imageOpacityFloor);
    const venuePresence = imageOpacityFloor + visiblePresence * (1 - imageOpacityFloor);
    return {
      logoPresence,
      venuePresence,
      slowBreath,
      soundBreath,
    };
  }

  function updateImageFluxStyles(time, flux) {
    const rootStyle = document.documentElement.style;
    const logoDistortion = 1 - flux.logoPresence;
    const venueDistortion = 1 - flux.venuePresence;
    const logoOpacity = flux.logoPresence;
    const venueOpacity = flux.venuePresence;

    rootStyle.setProperty('--logo-image-opacity', logoOpacity.toFixed(3));
    if (frame % 6 === 0) canvas.dataset.logoImageOpacity = logoOpacity.toFixed(3);
    rootStyle.setProperty(
      '--logo-flux-x',
      '0px',
    );
    rootStyle.setProperty(
      '--logo-flux-y',
      '0px',
    );
    rootStyle.setProperty(
      '--logo-flux-scale',
      '1',
    );
    rootStyle.setProperty('--logo-flux-blur', `${(logoDistortion * 0.72).toFixed(2)}px`);
    rootStyle.setProperty(
      '--logo-flux-saturate',
      (0.86 + flux.logoPresence * 0.36).toFixed(3),
    );
    rootStyle.setProperty(
      '--logo-flux-contrast',
      (1.04 + logoDistortion * 0.32).toFixed(3),
    );

    rootStyle.setProperty('--venue-image-opacity', venueOpacity.toFixed(3));
    if (frame % 6 === 0) canvas.dataset.venueImageOpacity = venueOpacity.toFixed(3);
    rootStyle.setProperty(
      '--venue-flux-x',
      '0px',
    );
    rootStyle.setProperty(
      '--venue-flux-y',
      '0px',
    );
    rootStyle.setProperty(
      '--venue-flux-scale',
      '1',
    );
    rootStyle.setProperty('--venue-flux-blur', `${(venueDistortion * 0.82).toFixed(2)}px`);
    rootStyle.setProperty(
      '--venue-flux-saturate',
      (0.82 + flux.venuePresence * 0.4).toFixed(3),
    );
    rootStyle.setProperty(
      '--venue-flux-contrast',
      (1.04 + venueDistortion * 0.28).toFixed(3),
    );
  }

  function drawFluxImage(image, rect, time, presence, mode) {
    if (!inExpandedViewport(rect, 40) || rect.width < 4 || rect.height < 4) return;
    const compact = width < 700;
    const transition = 1 - Math.abs(presence - 0.5) * 2;
    const particleReality = 1 - presence;
    const interactionGlitch = clamp(
      imageSuppression * 0.84
        + fluxBurst * 0.9
        + (pointer.down ? 0.46 : 0),
      0,
      1,
    );
    const slowGlitch = 0.5
      + Math.sin(time * 0.31 + (mode === 'venue' ? 1.7 : 0.4)) * 0.5;
    const glitchEnergy = clamp(
      0.12
        + transition * 0.5
        + particleReality * 0.24
        + interactionGlitch * 0.92
        + slowGlitch * 0.1,
      0,
      1.6,
    );
    const sliceCount = compact ? 13 : mode === 'venue' ? 24 : 19;
    const crop = mode === 'venue'
      ? objectFitCoverCrop(image, rect)
      : {
        x: 0,
        y: 0,
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
    const amplitude = (
      3
      + particleReality * (mode === 'venue' ? 14 : 19)
      + transition * 9
      + interactionGlitch * (mode === 'venue' ? 18 : 22)
    );
    const sliceHeight = rect.height / sliceCount;
    const sourceSliceHeight = crop.height / sliceCount;
    const fragmentAlpha = clamp(
      0.018
        + transition * 0.12
        + particleReality * 0.055
        + interactionGlitch * 0.18,
      0.018,
      0.31,
    );

    context.save();
    context.globalCompositeOperation = 'screen';
    context.globalAlpha = fragmentAlpha * (0.46 + glitchEnergy * 0.32);
    context.filter = `saturate(${1.05 + particleReality * 0.6}) contrast(${1.08 + particleReality * 0.35}) blur(${particleReality * 0.42}px)`;
    context.beginPath();
    context.rect(rect.left, rect.top, rect.width, rect.height);
    context.clip();

    for (let slice = 0; slice < sliceCount; slice += 1) {
      const phase = slice * 0.83 + (mode === 'venue' ? 1.7 : 0);
      const wave = Math.sin(time * 0.91 + phase)
        + Math.sin(time * 0.37 - phase * 0.61) * 0.54;
      const ripple = Math.cos(time * 0.62 + phase * 1.37) * 0.42;
      const sourceY = crop.y + slice * sourceSliceHeight;
      const destinationY = rect.top + slice * sliceHeight + ripple * particleReality * 2.4;
      const offsetX = wave * amplitude;
      context.drawImage(
        image,
        crop.x,
        sourceY,
        crop.width,
        sourceSliceHeight + 1,
        rect.left + offsetX,
        destinationY,
        rect.width,
        sliceHeight + 1.4,
      );
    }

    const columnStops = mode === 'venue'
      ? [0, 0.12, 0.27, 0.43, 0.57, 0.73, 0.88, 1]
      : [0, 0.1, 0.21, 0.32, 0.43, 0.55, 0.67, 0.79, 0.9, 1];
    const rowStops = mode === 'venue'
      ? [0, 0.07, 0.15, 0.25, 0.37, 0.5, 0.66, 0.83, 1]
      : [0, 0.18, 0.38, 0.61, 0.8, 1];
    let activeBlocks = 0;
    context.filter = `saturate(${1.2 + glitchEnergy * 0.28}) contrast(${1.08 + glitchEnergy * 0.2})`;

    for (let row = 0; row < rowStops.length - 1; row += 1) {
      const v0 = rowStops[row];
      const v1 = rowStops[row + 1];
      const depth = (v0 + v1) * 0.5;
      for (let column = 0; column < columnStops.length - 1; column += 1) {
        const u0 = columnStops[column];
        const u1 = columnStops[column + 1];
        const centreU = (u0 + u1) * 0.5;
        const seed = hashNoise(
          column + (mode === 'venue' ? 47 : 13),
          row + (mode === 'venue' ? 89 : 29),
        );
        const blockWave = 0.5
          + Math.sin(
            time * (0.42 + seed * 0.34)
              + seed * 18.7
              + row * 0.61
              - column * 0.37,
          ) * 0.5;
        const activation = smoothstep(
          0.42,
          0.98,
          blockWave
            + glitchEnergy * 0.37
            + interactionGlitch * 0.24
            - seed * 0.12,
        );
        if (activation < 0.035) continue;

        const sourceX = crop.x + crop.width * u0;
        const sourceY = crop.y + crop.height * v0;
        const sourceWidth = crop.width * (u1 - u0);
        const sourceHeight = crop.height * (v1 - v0);
        const destinationX = rect.left + rect.width * u0;
        const destinationY = rect.top + rect.height * v0;
        const destinationWidth = rect.width * (u1 - u0);
        const destinationHeight = rect.height * (v1 - v0);
        const perspective = mode === 'venue' ? 0.38 + depth * 0.9 : 0.82;
        const centreBias = Math.abs(centreU - 0.5) * 2;
        const offsetX = (
          Math.sin(time * 0.73 + seed * 15.3 + row)
          * amplitude
          * activation
          * perspective
          * (0.62 + centreBias * 0.52)
        );
        const offsetY = (
          Math.cos(time * 0.51 - seed * 12.8 + column * 0.43)
          * amplitude
          * activation
          * (mode === 'venue' ? 0.18 + depth * 0.34 : 0.28)
        );
        const skewX = Math.sin(time * 0.39 + seed * 9.2) * activation * 0.018;
        const skewY = Math.cos(time * 0.33 - seed * 8.1) * activation * 0.012;
        const blockAlpha = fragmentAlpha * (0.18 + activation * 0.62);

        context.save();
        context.globalAlpha = blockAlpha;
        context.translate(
          destinationX + destinationWidth * 0.5 + offsetX,
          destinationY + destinationHeight * 0.5 + offsetY,
        );
        context.transform(1, skewY, skewX, 1, 0, 0);
        context.drawImage(
          image,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          -destinationWidth * 0.5,
          -destinationHeight * 0.5,
          destinationWidth + 0.8,
          destinationHeight + 0.8,
        );

        if (activation > 0.78 && (row + column) % 3 === 0) {
          context.globalAlpha = blockAlpha * 0.22;
          context.filter = 'saturate(2.1) hue-rotate(152deg) contrast(1.24)';
          context.drawImage(
            image,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            -destinationWidth * 0.5 + amplitude * 0.13,
            -destinationHeight * 0.5,
            destinationWidth + 0.8,
            destinationHeight + 0.8,
          );
        }
        context.restore();

        const edgeParticleCount = compact ? 1 : 2;
        const edgeHue = mode === 'venue'
          ? (centreU < 0.48 ? 24 + depth * 10 : 194 - depth * 12)
          : palette[(row + column) % palette.length];
        for (let edgeParticle = 0; edgeParticle < edgeParticleCount; edgeParticle += 1) {
          const edgeSeed = hashNoise(
            column * 17 + edgeParticle * 5,
            row * 23 + edgeParticle * 7,
          );
          const edgeX = destinationX
            + destinationWidth * edgeSeed
            + offsetX * 1.08;
          const edgeY = edgeParticle % 2 === 0
            ? destinationY + offsetY
            : destinationY + destinationHeight + offsetY;
          context.fillStyle = `hsla(${edgeHue}, 100%, 76%, ${blockAlpha * 1.8})`;
          context.beginPath();
          context.arc(
            edgeX,
            edgeY,
            0.32 + activation * 0.58,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
        activeBlocks += 1;
      }
    }
    canvas.dataset[mode === 'venue' ? 'venueGlitchBlocks' : 'logoGlitchBlocks'] = String(
      activeBlocks,
    );
    context.restore();
  }

  function drawVenueParticles(time, frameStep, flux) {
    if (venueParticles.length === 0) return;
    const rect = venueImage.getBoundingClientRect();
    if (!inExpandedViewport(rect, 80)) return;
    const centreX = rect.left + rect.width * 0.5;
    const vanishingY = rect.top + rect.height * 0.55;
    const particleReality = 1 - flux.venuePresence;
    const renderStride = quality < 0.68 ? 3 : quality < 0.9 ? 2 : 1;
    const renderPhase = Math.floor(time * 60) % renderStride;
    const perspectiveBreath = (
      Math.sin(time * 0.54) * 0.5
      + Math.sin(time * 0.19 + 1.4) * 0.5
    ) * (0.004 + particleReality * 0.012);

    venueParticles.forEach((particle, index) => {
      particle.previousX = particle.x;
      particle.previousY = particle.y;
      const depth = clamp(particle.v, 0, 1);
      const localScale = 1 + perspectiveBreath * (0.24 + depth * 0.95);
      const architecturalWave = Math.sin(
        particle.u * 18
        + particle.v * 11
        + time * 0.48
        + particle.phase,
      );
      const displacement = (1.5 + particleReality * 6.8 + fluxBurst * 7.5)
        * (0.35 + depth * 0.8);
      const animatedX = centreX
        + (particle.targetX - centreX) * localScale
        + architecturalWave * displacement;
      const animatedY = vanishingY
        + (particle.targetY - vanishingY) * localScale
        + Math.cos(time * 0.42 + particle.u * 14 - particle.phase) * displacement * 0.42;

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
        interaction = Math.max(0, 1 - pointerDistance / (pointer.down ? 290 : 220))
          * pointer.active;
        radialX = pointerX / pointerDistance;
        radialY = pointerY / pointerDistance;
        tangentX = -radialY;
        tangentY = radialX;
      }

      const spring = 0.019 + particle.edge * 0.008;
      particle.velocityX += deltaX * spring * frameStep;
      particle.velocityY += deltaY * spring * frameStep;
      particle.velocityX += tangentX * interaction * (pointer.down ? 0.66 : 0.28) * frameStep;
      particle.velocityY += tangentY * interaction * (pointer.down ? 0.66 : 0.28) * frameStep;
      const burstPattern = Math.sin(Math.atan2(radialY, radialX) * 7 + time * 4.2);
      particle.velocityX += (
        radialX * 3.6
        + tangentX * burstPattern * 3.1
      ) * interaction * pointer.burst;
      particle.velocityY += (
        radialY * 3.6
        + tangentY * burstPattern * 3.1
      ) * interaction * pointer.burst;
      particle.velocityX *= Math.pow(0.922, frameStep);
      particle.velocityY *= Math.pow(0.922, frameStep);
      particle.x += particle.velocityX * frameStep;
      particle.y += particle.velocityY * frameStep;

      const speed = Math.hypot(particle.velocityX, particle.velocityY);
      const pulse = 0.5 + Math.sin(time * 1.03 + particle.phase + depth * 5.2) * 0.5;
      const hue = (particle.hue + pulse * 12 + interaction * 64) % 360;
      const alpha = clamp(
        (
          0.035
          + particleReality * 0.64
          + particle.edge * 0.26
          + interaction * 0.22
        ) * (0.56 + pulse * 0.44),
        0.02,
        0.82,
      );
      if (index % renderStride !== renderPhase) return;

      context.strokeStyle = `hsla(${hue}, 96%, ${56 + particle.brightness * 28}%, ${alpha * 0.38})`;
      context.lineWidth = 0.25 + particle.edge * 0.46 + Math.min(speed, 3) * 0.08;
      context.beginPath();
      context.moveTo(particle.previousX, particle.previousY);
      context.lineTo(particle.x, particle.y);
      context.stroke();
      context.fillStyle = `hsla(${hue}, 100%, ${62 + particle.brightness * 28}%, ${alpha})`;
      context.beginPath();
      context.arc(
        particle.x,
        particle.y,
        0.38 + particle.size * 0.44 + particle.edge * 0.3,
        0,
        Math.PI * 2,
      );
      context.fill();

      if ((index + Math.floor(time * 12)) % 43 === 0 && particle.edge > 0.28) {
        context.fillStyle = `rgba(255, 243, 224, ${alpha * 0.62})`;
        context.beginPath();
        context.arc(particle.x, particle.y, 0.72 + pulse * 0.5, 0, Math.PI * 2);
        context.fill();
      }
    });
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
      if (quality < 0.66 && index % 2 !== Math.floor(time * 60) % 2) return;
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

  function drawTargetParticles(time, frameStep, flux) {
    const sweepA = width * (0.5 + Math.sin(time * 0.34 + Math.sin(time * 0.09) * 2.1) * 0.56);
    const sweepB = width * (0.5 + Math.sin(time * 0.23 + 2.4) * 0.58);
    const sweepWidth = Math.max(54, width * 0.09);
    const renderStride = quality < 0.68 ? 3 : quality < 0.9 ? 2 : 1;
    const renderPhase = Math.floor(time * 60) % renderStride;

    particles.forEach((particle, index) => {
      particle.previousX = particle.x;
      particle.previousY = particle.y;
      const waveA = Math.exp(-Math.pow((particle.targetX - sweepA) / sweepWidth, 2));
      const waveB = Math.exp(-Math.pow((particle.targetX - sweepB) / (sweepWidth * 0.72), 2));
      const shimmer = clamp(waveA + waveB * 0.74, 0, 1.4);
      const breath = 0.5 + Math.sin(time * 0.74 + particle.phase + particle.targetY * 0.009) * 0.5;
      const particleReality = 1 - flux.logoPresence;
      const displacement = 0.35
        + breath * 0.6
        + shimmer
        + particleReality * 0.45
        + fluxBurst * 5.8;
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

      const spring = (0.034 + shimmer * 0.01) * (1 - interaction * 0.72);
      particle.velocityX += deltaX * spring * frameStep;
      particle.velocityY += deltaY * spring * frameStep;
      particle.velocityX += tangentX * interaction * (pointer.down ? 0.82 : 0.42) * frameStep;
      particle.velocityY += tangentY * interaction * (pointer.down ? 0.82 : 0.42) * frameStep;
      particle.velocityX += pointer.velocityX * interaction * 0.012;
      particle.velocityY += pointer.velocityY * interaction * 0.012;
      const burstPattern = Math.sin(Math.atan2(radialY, radialX) * 7 + time * 4.8);
      particle.velocityX += (
        radialX * 4.4
        + tangentX * burstPattern * 3.8
      ) * interaction * pointer.burst;
      particle.velocityY += (
        radialY * 4.4
        + tangentY * burstPattern * 3.8
      ) * interaction * pointer.burst;

      const flow = Math.sin(particle.targetY * 0.013 + time * 0.7 + particle.phase)
        + Math.cos(particle.targetX * 0.008 - time * 0.43);
      particle.velocityX += Math.cos(flow) * (0.004 + shimmer * 0.009);
      particle.velocityY += Math.sin(flow) * (0.004 + shimmer * 0.009);
      particle.velocityX *= Math.pow(0.905, frameStep);
      particle.velocityY *= Math.pow(0.905, frameStep);
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
        (
          0.12
          + particle.brightness * 0.24
          + shimmer * 0.14
          + interaction * 0.24
          + particleReality * 0.34
        ) * formation,
        0.05,
        0.92,
      );
      if (index % renderStride !== renderPhase) return;

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

  function drawFormTitleParticles(time, frameStep) {
    const rect = formTitleCanvas.getBoundingClientRect();
    if (rect.bottom < -24 || rect.top > height + 24 || formTitleParticles.length === 0) {
      return;
    }

    formTitleContext.setTransform(
      formTitleDpr,
      0,
      0,
      formTitleDpr,
      0,
      0,
    );
    formTitleContext.globalCompositeOperation = 'destination-out';
    formTitleContext.fillStyle = 'rgba(0, 0, 0, 0.31)';
    formTitleContext.fillRect(0, 0, formTitleWidth, formTitleHeight);
    formTitleContext.globalCompositeOperation = 'lighter';
    formTitleContext.lineCap = 'round';

    const pointerX = pointer.x - rect.left;
    const pointerY = pointer.y - rect.top;
    const pointerNear = pointer.active > 0.015
      && pointerX > -150
      && pointerX < rect.width + 150
      && pointerY > -130
      && pointerY < rect.height + 130;
    const sweep = formTitleWidth * (
      0.5
      + Math.sin(time * 0.46 + Math.sin(time * 0.11) * 1.7) * 0.54
    );
    const sweepWidth = Math.max(34, formTitleWidth * 0.12);

    formTitleParticles.forEach((particle, index) => {
      particle.previousX = particle.x;
      particle.previousY = particle.y;
      const sweepPulse = Math.exp(-Math.pow((particle.targetX - sweep) / sweepWidth, 2));
      const shimmer = clamp(
        0.5
          + Math.sin(time * 0.82 + particle.phase + particle.targetX * 0.018) * 0.34
          + sweepPulse * 0.56,
        0,
        1.35,
      );
      const displacement = 0.28 + shimmer * 0.78 + fluxBurst * 2.8;
      const animatedX = particle.targetX
        + Math.sin(time * 0.62 + particle.targetY * 0.048 + particle.phase) * displacement;
      const animatedY = particle.targetY
        + Math.cos(time * 0.54 + particle.targetX * 0.022 - particle.phase) * displacement * 0.58;

      let interaction = 0;
      let radialX = 0;
      let radialY = 0;
      let tangentX = 0;
      let tangentY = 0;
      if (pointerNear) {
        const deltaPointerX = particle.x - pointerX;
        const deltaPointerY = particle.y - pointerY;
        const pointerDistance = Math.hypot(deltaPointerX, deltaPointerY) + 0.001;
        interaction = Math.max(
          0,
          1 - pointerDistance / (pointer.down ? 150 : 105),
        ) * pointer.active;
        radialX = deltaPointerX / pointerDistance;
        radialY = deltaPointerY / pointerDistance;
        tangentX = -radialY;
        tangentY = radialX;
      }

      const spring = 0.058 * (1 - interaction * 0.78);
      particle.velocityX += (animatedX - particle.x) * spring * frameStep;
      particle.velocityY += (animatedY - particle.y) * spring * frameStep;
      particle.velocityX += tangentX * interaction * (pointer.down ? 0.72 : 0.28) * frameStep;
      particle.velocityY += tangentY * interaction * (pointer.down ? 0.72 : 0.28) * frameStep;
      particle.velocityX += radialX * interaction * pointer.burst * 3.2;
      particle.velocityY += radialY * interaction * pointer.burst * 3.2;
      particle.velocityX += pointer.velocityX * interaction * 0.01;
      particle.velocityY += pointer.velocityY * interaction * 0.01;
      particle.velocityX *= Math.pow(0.88, frameStep);
      particle.velocityY *= Math.pow(0.88, frameStep);
      const speed = Math.hypot(particle.velocityX, particle.velocityY);
      if (speed > 10) {
        particle.velocityX = particle.velocityX / speed * 10;
        particle.velocityY = particle.velocityY / speed * 10;
      }
      particle.x += particle.velocityX * frameStep;
      particle.y += particle.velocityY * frameStep;

      const hue = (particle.hue + shimmer * 28 + interaction * 72 + time * 3) % 360;
      const alpha = clamp(0.34 + shimmer * 0.38 + interaction * 0.22, 0.28, 0.94);
      if (index % 3 === 0) {
        formTitleContext.strokeStyle = `hsla(${hue}, 100%, 76%, ${alpha * 0.3})`;
        formTitleContext.lineWidth = 0.3 + particle.size * 0.24;
        formTitleContext.beginPath();
        formTitleContext.moveTo(particle.previousX, particle.previousY);
        formTitleContext.lineTo(particle.x, particle.y);
        formTitleContext.stroke();
      }
      formTitleContext.fillStyle = `hsla(${hue}, 100%, ${74 + shimmer * 10}%, ${alpha})`;
      formTitleContext.beginPath();
      formTitleContext.arc(
        particle.x,
        particle.y,
        0.3 + particle.size * 0.42 + shimmer * 0.16,
        0,
        Math.PI * 2,
      );
      formTitleContext.fill();

      if ((index + Math.floor(time * 12)) % 31 === 0) {
        formTitleContext.fillStyle = `rgba(255, 250, 238, ${alpha * 0.82})`;
        formTitleContext.beginPath();
        formTitleContext.arc(particle.x, particle.y, 0.62 + shimmer * 0.28, 0, Math.PI * 2);
        formTitleContext.fill();
      }
    });
    formTitleCanvas.dataset.rendering = 'true';
  }

  function animate(now) {
    frame = window.requestAnimationFrame(animate);
    if (document.hidden) {
      previousTime = now;
      return;
    }
    const rawFrameTime = Math.max(0.1, now - previousTime);
    const frameTime = clamp(rawFrameTime, 8, 40);
    previousTime = now;
    const frameStep = frameTime / 16.67;
    const time = now / 1000;
    const flux = calculateFluxState(time);
    if (frameTime > 27) quality = Math.max(0.56, quality - 0.006);
    if (frameTime < 18) quality = Math.min(1, quality + 0.001);
    performanceFrames += 1;
    performanceTime += rawFrameTime;
    if (performanceFrames >= 60) {
      canvas.dataset.fps = (1000 / (performanceTime / performanceFrames)).toFixed(1);
      canvas.dataset.quality = quality.toFixed(3);
      performanceFrames = 0;
      performanceTime = 0;
    }
    updateImageFluxStyles(time, flux);
    if (now - lastFluxSoundUpdate > 120) {
      updateFluxSound(flux.logoPresence, flux.venuePresence, flux.soundBreath);
      lastFluxSoundUpdate = now;
    }

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
    fluxBurst *= 0.94;
    if (now >= imageSuppressionHoldUntil) {
      imageSuppression *= Math.pow(0.978, frameStep);
      if (imageSuppression < 0.002) imageSuppression = 0;
    }
    scrollEnergy *= 0.94;

    const fragmentInterval = quality < 0.72 ? 3 : 2;
    if (frame % fragmentInterval === 0) {
      drawFluxImage(logo, logo.getBoundingClientRect(), time, flux.logoPresence, 'logo');
      drawFluxImage(
        venueImage,
        venueImage.getBoundingClientRect(),
        time,
        flux.venuePresence,
        'venue',
      );
    }
    drawAmbient(time, frameStep);
    drawVenueParticles(time, frameStep, flux);
    drawTargetParticles(time, frameStep, flux);
    drawGestureTrails(now);
    drawParticleDesigns(now);
    drawFormTitleParticles(time, frameStep);
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
  if (!venueImage.complete || !venueImage.naturalWidth) {
    venueImage.addEventListener('load', resize, { once: true });
  }
  frame = window.requestAnimationFrame(animate);
})();
