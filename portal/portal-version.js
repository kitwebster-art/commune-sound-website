(() => {
  const VERSION = 'portal-study-2.19.1';
  const SOURCE_VERSION = '4.9.1';
  const params = new URLSearchParams(location.search);
  const BACKGROUNDS = Object.freeze([
    Object.freeze({ name: 'velvet-interference', label: 'Velvet Interference', mode: 0, seed: 17 }),
    Object.freeze({ name: 'liquid-chrome', label: 'Liquid Chrome', mode: 1, seed: 29 }),
    Object.freeze({ name: 'holographic-grain', label: 'Holographic Grain', mode: 2, seed: 43 })
  ]);
  const now = new Date();
  const localDayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  const scheduledBackground = BACKGROUNDS[((localDayNumber % BACKGROUNDS.length) + BACKGROUNDS.length) % BACKGROUNDS.length];
  const backgroundOverride = BACKGROUNDS.find(({ name }) => name === params.get('background'));
  const background = backgroundOverride || scheduledBackground;
  const localDateKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
  document.documentElement.dataset.portalBackground = background.name;
  const DEBUG_MODES = Object.freeze({ final: 0, density: 1, volume: 2, depth: 3, 'no-post': 4, liquid: 5, contrast: 6, 'logo-edges': 7, 'logo-depth': 8 });
  const debugName = DEBUG_MODES[params.get('debug')] === undefined ? 'final' : params.get('debug');
  const debugMode = DEBUG_MODES[debugName];
  const fixedTime = Number.parseFloat(params.get('time'));
  const seedOverride = Number.parseFloat(params.get('seed'));
  const fieldSeed = Number.isFinite(seedOverride) ? seedOverride : background.seed;
  const wordmarkSeed = Number.isFinite(seedOverride) ? seedOverride : 17.0;
  const requestedQuality = params.get('quality');

  const scheduleDailyBackgroundRefresh = () => {
    if (backgroundOverride) return;
    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 250);
    setTimeout(() => location.reload(), Math.max(1000, nextMidnight.getTime() - Date.now()));
  };

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.append(script);
  });

  const rewriteBodyAssets = (body) => {
    body.querySelectorAll('[src]').forEach((node) => {
      const src = node.getAttribute('src');
      if (src && !/^(?:[a-z]+:|\/|#)/i.test(src)) node.setAttribute('src', `../${src}`);
    });
    body.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (href?.startsWith('#')) return;
      if (href && !/^(?:[a-z]+:|\/|#)/i.test(href)) anchor.setAttribute('href', `../${href}`);
    });
  };

  const installImageDepth = () => {
    const venue = document.querySelector('[data-particle-venue]');
    if (!(venue instanceof HTMLImageElement)) {
      throw new Error('Portal venue anchor missing');
    }

    const createEcho = (source, className) => {
      const echo = source.cloneNode(false);
      echo.removeAttribute('data-particle-logo');
      echo.removeAttribute('data-particle-venue');
      echo.removeAttribute('alt');
      echo.className = className;
      echo.setAttribute('aria-hidden', 'true');
      echo.setAttribute('draggable', 'false');
      return echo;
    };

    const venueEcho = createEcho(venue, 'portal-venue-echo');
    venue.before(venueEcho);
    venue.closest('.venue-photo')?.classList.add('portal-image-depth');
    document.documentElement.classList.add('portal-image-depth-ready');
  };

  const createShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Portal shader compilation failed');
    }
    return shader;
  };

  const createProgram = (gl, vertexSource, fragmentSource) => {
    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Portal shader link failed');
    }
    return program;
  };

  const smoothstep = (edge0, edge1, value) => {
    const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(0.0001, edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  const installPortal = () => {
    const wordmark = document.querySelector('.wordmark-banner');
    const eventSection = document.querySelector('.current-event');
    const realtimeVignette = document.querySelector('.commune-realtime-vignette');
    if (!wordmark || !eventSection || !realtimeVignette) throw new Error('Portal anchors missing');

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const fallback = document.createElement('div');
      fallback.className = 'portal-static-field';
      fallback.setAttribute('aria-hidden', 'true');
      realtimeVignette.after(fallback);
      document.documentElement.classList.add('portal-field-ready');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'portal-field';
    canvas.dataset.portalField = `full-frame-${background.name}`;
    canvas.dataset.backgroundName = background.name;
    canvas.dataset.backgroundLabel = background.label;
    canvas.dataset.backgroundMode = String(background.mode);
    canvas.dataset.rotationDate = localDateKey;
    canvas.dataset.rotationSchedule = 'velvet-interference|liquid-chrome|holographic-grain';
    canvas.dataset.rotationSource = backgroundOverride ? 'query-override' : 'local-calendar-day';
    canvas.dataset.seed = fieldSeed.toFixed(2);
    canvas.dataset.debugMode = debugName;
    canvas.dataset.backend = 'webgl-fragment-plane';
    canvas.dataset.referenceMechanism = 'shared-low-frequency-warp|daily-material-mode|distributed-black-negative-space|interactive-folded-wordmark';
    canvas.setAttribute('aria-hidden', 'true');
    realtimeVignette.after(canvas);

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance'
    });
    if (!gl) {
      canvas.dataset.webglStatus = 'unavailable';
      return;
    }

    const vertexSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision highp float;
      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform vec2 u_pointer;
      uniform float u_pointer_energy;
      uniform float u_time;
      uniform float u_progress;
      uniform float u_seed;
      uniform int u_mode;
      uniform int u_debug;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32 + u_seed * 0.013);
        return fract(p.x * p.y);
      }

      float value_noise(vec2 p) {
        vec2 cell = floor(p);
        vec2 local = fract(p);
        vec2 blend = local * local * (3.0 - 2.0 * local);
        float a = hash21(cell);
        float b = hash21(cell + vec2(1.0, 0.0));
        float c = hash21(cell + vec2(0.0, 1.0));
        float d = hash21(cell + vec2(1.0, 1.0));
        return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.52;
        mat2 rotation = mat2(0.84, -0.54, 0.54, 0.84);
        for (int octave = 0; octave < 5; octave++) {
          value += value_noise(p) * amplitude;
          p = rotation * p * 2.03 + vec2(17.1, 9.2);
          amplitude *= 0.5;
        }
        return value;
      }

      float fbm_fast(vec2 p) {
        float value = 0.0;
        float amplitude = 0.58;
        mat2 rotation = mat2(0.82, -0.57, 0.57, 0.82);
        for (int octave = 0; octave < 2; octave++) {
          value += value_noise(p) * amplitude;
          p = rotation * p * 2.07 + vec2(11.4, 6.8);
          amplitude *= 0.48;
        }
        return value;
      }

      vec2 rotate2d(vec2 p, float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return mat2(c, -s, s, c) * p;
      }

      vec3 palette(float phase) {
        vec3 hot_pink = vec3(1.0, 0.045, 0.62);
        vec3 violet = vec3(0.32, 0.075, 1.0);
        vec3 cyan = vec3(0.12, 0.82, 1.0);
        vec3 pearl = vec3(1.0, 0.84, 0.96);
        vec3 colour = mix(violet, hot_pink, smoothstep(0.08, 0.72, phase));
        colour = mix(colour, cyan, smoothstep(0.68, 0.96, phase));
        return mix(colour, pearl, pow(max(0.0, phase - 0.78) / 0.22, 3.0) * 0.58);
      }

      float field3d(vec3 p) {
        vec2 layer_a = rotate2d(p.xy, p.z * 0.62 + u_time * 0.035);
        vec2 layer_b = rotate2d(p.yx, -p.z * 0.41 - u_time * 0.024);
        float broad = fbm_fast(layer_a * 0.94 + vec2(p.z * 0.43, -p.z * 0.27));
        float detail = fbm_fast(layer_b * 2.1 + vec2(-p.z * 0.74, p.z * 0.39));
        return broad * 0.68 + detail * 0.32;
      }

      vec4 liquid_fold(vec2 p, float rotation, float offset, float phase, float width, float shared_warp) {
        vec2 q = rotate2d(p, rotation);
        float centre = q.y
          + sin(q.x * 1.28 + phase + u_time * 0.038) * 0.24
          + sin(q.x * 0.57 - phase * 1.4 - u_time * 0.022) * 0.13
          + (shared_warp - 0.5) * 0.24
          - offset;
        float sdf = abs(centre) - width;
        float inside = 1.0 - smoothstep(-0.026, 0.035, sdf);
        float magenta_edge = exp(-abs(sdf + 0.019) * 46.0);
        float pearl_edge = exp(-abs(sdf) * 54.0);
        float cyan_edge = exp(-abs(sdf - 0.019) * 46.0);
        vec3 spectral_edge = vec3(magenta_edge, pearl_edge * 0.72 + cyan_edge * 0.22, cyan_edge);

        float inner_rim = exp(-abs(sdf + 0.058) * 31.0) * inside;
        float travelling_glint = exp(-abs(sdf + 0.024) * 68.0)
          * (0.54 + 0.46 * sin(q.x * 1.7 - u_time * 0.07 + phase)) * inside;
        float inner_coordinate = centre + sin(q.x * 1.9 + phase) * 0.052;
        float caustic_a = exp(-abs(inner_coordinate + width * 0.34) * 31.0) * inside;
        float caustic_b = exp(-abs(inner_coordinate - width * 0.21) * 38.0) * inside;

        vec3 contribution = spectral_edge * 0.68;
        contribution += vec3(1.0, 0.88, 0.97) * (inner_rim * 0.18 + travelling_glint * 0.48);
        contribution += vec3(1.0, 0.12, 0.68) * caustic_a * 0.24;
        contribution += vec3(0.2, 0.88, 1.0) * caustic_b * 0.24;
        contribution += vec3(0.74, 0.3, 1.0) * caustic_a * caustic_b * 0.22;
        float optical_mask = inside * 0.11 + max(max(magenta_edge, pearl_edge), cyan_edge) * 0.25;
        return vec4(contribution, optical_mask);
      }

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        float aspect = u_resolution.x / u_resolution.y;
        float portrait = 1.0 - smoothstep(0.72, 0.92, aspect);
        p.y -= mix(0.02, -0.08, portrait);
        vec2 pointer = (u_pointer - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
        vec2 parallax = pointer * u_pointer_energy;
        p -= parallax * 0.028;

        vec2 warp_a = vec2(
          fbm(p * 0.56 + vec2(u_time * 0.045, -u_time * 0.032) + u_seed * 0.013),
          fbm(p * 0.56 + vec2(8.1 - u_time * 0.026, 3.7 + u_time * 0.045) + u_seed * 0.019)
        );
        vec2 q = p * mix(0.82, 0.92, portrait) + (warp_a - 0.5) * 1.15 + parallax * 0.08;
        float primary = fbm(q * 1.12 - vec2(u_time * 0.014, u_time * 0.007));
        float detail = 0.0;
        float highlight = 0.0;
        vec3 raw_colour = vec3(0.0);

        if (u_mode == 0) {
          float fold = 0.5 + 0.5 * sin((q.x * 1.1 + q.y * 0.62 + primary * 2.5) * 5.2);
          float warp_thread = 0.5 + 0.5 * sin(q.x * 92.0 + q.y * 10.0 + primary * 8.0);
          float weft_thread = 0.5 + 0.5 * sin(q.y * 104.0 - q.x * 8.0 - primary * 7.0);
          detail = pow(warp_thread * weft_thread, 3.4);
          highlight = pow(smoothstep(0.66, 0.96, fold), 3.0) + detail * 0.34;
          raw_colour = palette(fold * 0.76 + primary * 0.22) * (0.18 + fold * 0.72);
          raw_colour += vec3(0.22, 0.18, 0.42) * detail;
        } else if (u_mode == 1) {
          float marble = 0.5 + 0.5 * sin(
            q.x * 3.4 - q.y * 2.2 + primary * 8.8 + sin(q.y * 2.4) * 1.4
          );
          float specular_edge = 1.0 - smoothstep(0.025, 0.14, abs(marble - 0.58));
          detail = marble;
          highlight = pow(specular_edge, 2.2);
          raw_colour = palette(marble) * (0.14 + marble * 0.5);
          raw_colour += vec3(0.88, 0.92, 1.0) * highlight * 0.92;
        } else {
          float cloud = fbm(q * 0.68 + vec2(u_time * 0.0045, -u_time * 0.0063));
          float grain = hash21(gl_FragCoord.xy + floor(u_time * 12.0));
          float glint = pow(max(0.0, grain - 0.986) / 0.014, 2.0);
          detail = grain;
          highlight = glint;
          raw_colour = palette(fract(cloud * 1.45 + q.x * 0.12 - q.y * 0.08));
          raw_colour *= 0.23 + smoothstep(0.18, 0.9, cloud) * 0.72;
          raw_colour += (grain - 0.5) * 0.11 + vec3(1.0, 0.76, 0.96) * glint;
        }

        float black_field = fbm(rotate2d(p * 0.42 + vec2(7.3, -2.6), 0.28) - vec2(u_time * 0.01, u_time * 0.006));
        float black_pockets = smoothstep(0.48, 0.74, black_field);
        float centre_guard = smoothstep(0.08, 0.56, length(p * vec2(0.72, 1.0)));
        black_pockets *= mix(0.34, 1.0, centre_guard);
        vec3 no_post = raw_colour * (1.0 - black_pockets * 0.8);
        vec3 final_colour = no_post + palette(primary) * highlight * 0.17;
        float vignette = 1.0 - smoothstep(0.76, 1.85, length(p));
        final_colour *= 0.55 + vignette * 0.45;

        if (u_debug == 1) final_colour = vec3(primary, detail, highlight);
        if (u_debug == 2) final_colour = vec3(warp_a, primary);
        if (u_debug == 3) final_colour = vec3(detail);
        if (u_debug == 4) final_colour = no_post;
        if (u_debug == 5) final_colour = vec3(highlight);
        if (u_debug == 6) final_colour = vec3(1.0 - black_pockets);
        if (u_debug == 7 || u_debug == 8) final_colour *= 0.2;

        gl_FragColor = vec4(max(final_colour, 0.0), 0.97);
      }
    `;

    let program;
    try {
      program = createProgram(gl, vertexSource, fragmentSource);
    } catch (error) {
      canvas.dataset.webglStatus = 'shader-failed';
      canvas.dataset.webglError = error.message;
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      pointer: gl.getUniformLocation(program, 'u_pointer'),
      pointerEnergy: gl.getUniformLocation(program, 'u_pointer_energy'),
      time: gl.getUniformLocation(program, 'u_time'),
      progress: gl.getUniformLocation(program, 'u_progress'),
      seed: gl.getUniformLocation(program, 'u_seed'),
      mode: gl.getUniformLocation(program, 'u_mode'),
      debug: gl.getUniformLocation(program, 'u_debug')
    };

    const compact = innerWidth <= 700 || matchMedia('(pointer: coarse)').matches;
    const constrained = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    const quality = requestedQuality === 'low' || requestedQuality === 'high'
      ? requestedQuality
      : compact || constrained ? 'low' : 'high';
    const particleCanvas = document.createElement('canvas');
    particleCanvas.className = 'portal-particle-depth';
    particleCanvas.dataset.particleBackend = 'canvas2d-perspective';
    particleCanvas.dataset.particleDepthPlanes = 'far|middle|near';
    particleCanvas.dataset.particleMotion = 'projected-flow-trails';
    particleCanvas.dataset.seed = wordmarkSeed.toFixed(2);
    particleCanvas.setAttribute('aria-hidden', 'true');
    canvas.after(particleCanvas);
    const particleContext = particleCanvas.getContext('2d', { alpha: true });

    const seededRandom = (() => {
      let state = (Math.floor(wordmarkSeed * 1009) ^ 0x6d2b79f5) >>> 0;
      return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      };
    })();
    const particlePalette = [
      [255, 62, 198],
      [119, 79, 255],
      [74, 225, 255],
      [210, 92, 255],
      [255, 228, 246]
    ];
    const particleCount = compact ? 150 : 260;
    const particles = Array.from({ length: particleCount }, (_, index) => ({
      x: seededRandom() * 2.0 - 1.0,
      y: seededRandom() * 2.0 - 1.0,
      z: seededRandom(),
      speed: 0.025 + seededRandom() * 0.055,
      phase: seededRandom() * Math.PI * 2,
      phase2: seededRandom() * Math.PI * 2,
      size: 0.55 + seededRandom() * 1.45,
      colour: particlePalette[index % particlePalette.length]
    }));
    particleCanvas.dataset.particleCount = String(particleCount);
    let renderScale = quality === 'low' ? 0.56 : 0.74;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let pointerTarget = 0;
    let pointerEnergy = 0;
    let progress = 0;
    let progressTarget = 0;
    let previousTime = performance.now();
    let samples = 0;
    let elapsed = 0;
    let active = true;
    let adaptiveStage = 0;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, renderScale);
      canvas.width = Math.max(1, Math.round(innerWidth * dpr));
      canvas.height = Math.max(1, Math.round(innerHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      if (particleContext) {
        const particleDpr = Math.min(devicePixelRatio || 1, compact ? 1.2 : 1.5);
        particleCanvas.width = Math.max(1, Math.round(innerWidth * particleDpr));
        particleCanvas.height = Math.max(1, Math.round(innerHeight * particleDpr));
        particleCanvas.style.width = `${innerWidth}px`;
        particleCanvas.style.height = `${innerHeight}px`;
        particleContext.setTransform(particleDpr, 0, 0, particleDpr, 0, 0);
        particleCanvas.dataset.renderScale = particleDpr.toFixed(2);
      }
      canvas.dataset.renderScale = dpr.toFixed(2);
      canvas.dataset.qualityTier = quality;
    };

    const updateProgress = () => {
      const heroRect = wordmark.getBoundingClientRect();
      const eventRect = eventSection.getBoundingClientRect();
      const start = scrollY + heroRect.top + heroRect.height * 0.08;
      const end = scrollY + eventRect.top + eventRect.height * 0.34;
      progressTarget = Math.max(0, Math.min(1, (scrollY - start) / Math.max(1, end - start)));
      active = true;
      canvas.dataset.active = 'true';
      canvas.dataset.animationScope = 'full-page';
    };

    const move = (event) => {
      pointerX = event.clientX / Math.max(innerWidth, 1);
      pointerY = 1 - event.clientY / Math.max(innerHeight, 1);
      pointerTarget = event.pointerType === 'touch' ? 0.7 : 0.38;
    };

    const projectParticle = (particle, seconds, offset = 0) => {
      const travel = particle.z + seconds * particle.speed + offset;
      const depthPhase = travel - Math.floor(travel);
      const depth = 7.4 - depthPhase * 6.05;
      const perspective = 1 / depth;
      const flowTime = seconds * 0.16;
      const bendX = Math.sin(particle.y * 2.8 + particle.phase + flowTime) * (0.18 + depthPhase * 0.34);
      const bendY = Math.cos(particle.x * 2.2 + particle.phase2 - flowTime * 0.78) * (0.14 + depthPhase * 0.28);
      const aspect = innerWidth / Math.max(innerHeight, 1);
      const worldX = particle.x * (2.8 + depth * 0.52) * aspect + bendX;
      const worldY = particle.y * (2.6 + depth * 0.5) + bendY;
      const pointerDepth = (depthPhase - 0.5) * pointerEnergy;
      return {
        x: innerWidth * 0.5 + (worldX * perspective + (pointerX - 0.5) * pointerDepth * 0.42) * innerHeight * 0.5,
        y: innerHeight * 0.5 - (worldY * perspective + (pointerY - 0.5) * pointerDepth * 0.34) * innerHeight * 0.5,
        depthPhase,
        wrapped: depthPhase < 0.018
      };
    };

    const drawParticles = (seconds) => {
      if (!particleContext) return;
      particleContext.clearRect(0, 0, innerWidth, innerHeight);
      particleContext.globalCompositeOperation = 'lighter';
      const reveal = 0.28 + progress * 0.72;
      for (const particle of particles) {
        const current = projectParticle(particle, seconds);
        if (current.x < -40 || current.x > innerWidth + 40 || current.y < -40 || current.y > innerHeight + 40) continue;
        const previous = projectParticle(particle, seconds, -particle.speed * 1.4);
        const near = smoothstep(0.05, 0.98, current.depthPhase);
        const alpha = (0.1 + near * 0.64) * reveal;
        const radius = particle.size * (0.4 + near * near * (compact ? 3.0 : 4.2));
        const [red, green, blue] = particle.colour;
        particleContext.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${alpha * 0.42})`;
        particleContext.lineWidth = Math.max(0.45, radius * 0.46);
        particleContext.beginPath();
        particleContext.moveTo(current.wrapped ? current.x : previous.x, current.wrapped ? current.y : previous.y);
        particleContext.lineTo(current.x, current.y);
        particleContext.stroke();
        if (near > 0.62) {
          particleContext.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha * 0.12})`;
          particleContext.beginPath();
          particleContext.arc(current.x, current.y, radius * 2.5, 0, Math.PI * 2);
          particleContext.fill();
        }
        particleContext.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
        particleContext.beginPath();
        particleContext.arc(current.x, current.y, radius, 0, Math.PI * 2);
        particleContext.fill();
      }
      particleContext.globalCompositeOperation = 'source-over';
    };

    const render = (time) => {
      const delta = Math.min(50, time - previousTime);
      previousTime = time;
      progress += (progressTarget - progress) * Math.min(1, delta * 0.0065);
      pointerEnergy += (pointerTarget - pointerEnergy) * Math.min(1, delta * 0.009);
      pointerTarget *= Math.pow(0.99, delta / 16.67);
      document.documentElement.style.setProperty('--portal-progress', progress.toFixed(4));
      const parallaxX = (pointerX - 0.5) * pointerEnergy;
      const parallaxY = (0.5 - pointerY) * pointerEnergy;
      document.documentElement.style.setProperty('--portal-parallax-x', `${(parallaxX * 34).toFixed(2)}px`);
      document.documentElement.style.setProperty('--portal-parallax-y', `${(parallaxY * 24).toFixed(2)}px`);

      if (active && !document.hidden) {
        gl.useProgram(program);
        gl.uniform1f(uniforms.time, Number.isFinite(fixedTime) ? fixedTime : time * 0.001);
        gl.uniform1f(uniforms.progress, progress);
        gl.uniform1f(uniforms.seed, fieldSeed);
        gl.uniform1i(uniforms.mode, background.mode);
        gl.uniform1i(uniforms.debug, debugMode);
        gl.uniform2f(uniforms.pointer, pointerX, pointerY);
        gl.uniform1f(uniforms.pointerEnergy, pointerEnergy);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        drawParticles(Number.isFinite(fixedTime) ? fixedTime : time * 0.001);
        samples += 1;
        elapsed += delta;
        if (elapsed >= 1200) {
          const fps = samples * 1000 / elapsed;
          canvas.dataset.fps = fps.toFixed(1);
          if (fps < 31 && renderScale > 0.5 && adaptiveStage === 0) {
            renderScale = 0.48;
            adaptiveStage = 1;
            canvas.dataset.adaptiveReduction = 'stage-1';
            resize();
          } else if (fps < 32 && renderScale > 0.4 && adaptiveStage === 1) {
            renderScale = 0.38;
            adaptiveStage = 2;
            canvas.dataset.adaptiveReduction = 'stage-2';
            resize();
          }
          samples = 0;
          elapsed = 0;
        }
      }
      requestAnimationFrame(render);
    };

    if (debugMode !== 0) {
      const hud = document.createElement('div');
      hud.className = 'portal-debug-hud';
      hud.textContent = `Portal debug: ${debugName} | ${background.label} | seed ${fieldSeed} | ${quality} tier`;
      document.body.append(hud);
    }

    addEventListener('resize', resize, { passive: true });
    addEventListener('scroll', updateProgress, { passive: true });
    addEventListener('pointermove', move, { passive: true });
    addEventListener('pointerdown', move, { passive: true });
    resize();
    updateProgress();
    canvas.dataset.webglStatus = 'rendering';
    canvas.dataset.visualContract = 'daily-three-background-rotation|distributed-black-negative-space|no-central-void|liquid-chrome-weighted-transparent-wordmark-rotation|pointer-responsive-depth|full-page-continuous-motion|mobile-composed';
    canvas.dataset.backgroundMechanism = 'shared-low-frequency-warp|woven-interference-or-marble-or-chromatic-grain|pointer-parallax';
    canvas.dataset.contrastMechanism = 'shared-low-frequency-shadow-field|off-centre-black-pockets|centre-guard';
    canvas.dataset.liquidDivergence = 'stylised-screen-space-optics-not-physical-raytraced-transmission';
    canvas.dataset.debugModes = Object.keys(DEBUG_MODES).join('|');
    canvas.dataset.frameBudgetMs = compact ? '24' : '17';
    canvas.dataset.parallaxMode = 'rotating-material-field|projected-particle-depth|rotating-wordmark-tilt';
    document.documentElement.classList.add('portal-field-ready');
    requestAnimationFrame(render);
  };

  const bootstrap = async () => {
    try {
      const response = await fetch(`../index.html?portal-source=${SOURCE_VERSION}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Source page returned ${response.status}`);
      const source = new DOMParser().parseFromString(await response.text(), 'text/html');
      source.querySelectorAll('script').forEach((script) => script.remove());
      rewriteBodyAssets(source.body);
      const sourceLogo = source.querySelector('[data-particle-logo]');
      if (!(sourceLogo instanceof HTMLImageElement)) throw new Error('Portal source wordmark missing');
      sourceLogo.removeAttribute('srcset');
      sourceLogo.classList.add('portal-folded-wordmark');

      const fragment = document.createDocumentFragment();
      [...source.body.children].forEach((child) => fragment.append(document.importNode(child, true)));
      document.body.replaceChildren(fragment);
      const eventDescription = document.querySelector('.event-description');
      if (!eventDescription) throw new Error('Portal event description missing');
      eventDescription.textContent = 'For two hours, the hall comes alive with an eclectic mix of electronic and acoustic music from around the world, with space to listen, move and follow your own rhythm.';
      document.body.dataset.siteVersion = VERSION;
      document.body.dataset.portalBackground = background.name;
      document.body.dataset.portalBackgroundDate = localDateKey;
      document.documentElement.classList.add('portal-study-ready');
      await loadScript(`../commune-realtime.js?v=commune-${SOURCE_VERSION}-audio-signal-1`);
      document.body.classList.remove('portal-study-loading');

      if (typeof window.installPortalFoldedWordmark !== 'function') {
        throw new Error('Folded wordmark renderer missing');
      }
      await window.installPortalFoldedWordmark();
      installImageDepth();
      installPortal();
      await loadScript('../commune-offer.js?v=commune-4.7.3');
      await loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
      await loadScript('../commune-signup.js?v=commune-4.2.1');
      scheduleDailyBackgroundRefresh();
    } catch (error) {
      document.body.dataset.portalStudyError = error.message;
      const loader = document.querySelector('.portal-study-loader');
      if (loader) loader.remove();
      document.body.classList.remove('portal-study-loading');
    }
  };

  bootstrap();
})();
