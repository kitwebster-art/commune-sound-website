(() => {
  const VERSION = 'portal-study-1.3.0';
  const SOURCE_VERSION = '4.7.0';
  const params = new URLSearchParams(location.search);
  const DEBUG_MODES = Object.freeze({ final: 0, density: 1, volume: 2, depth: 3, 'no-post': 4 });
  const debugName = DEBUG_MODES[params.get('debug')] === undefined ? 'final' : params.get('debug');
  const debugMode = DEBUG_MODES[debugName];
  const fixedTime = Number.parseFloat(params.get('time'));
  const seed = Number.isFinite(Number.parseFloat(params.get('seed'))) ? Number.parseFloat(params.get('seed')) : 17.0;
  const requestedQuality = params.get('quality');

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
    const logo = document.querySelector('[data-particle-logo]');
    const venue = document.querySelector('[data-particle-venue]');
    if (!(logo instanceof HTMLImageElement) || !(venue instanceof HTMLImageElement)) {
      throw new Error('Portal image anchors missing');
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

    const logoFar = createEcho(logo, 'portal-wordmark-echo portal-wordmark-echo--far');
    const logoNear = createEcho(logo, 'portal-wordmark-echo portal-wordmark-echo--near');
    logo.before(logoFar, logoNear);

    const venueEcho = createEcho(venue, 'portal-venue-echo');
    venue.before(venueEcho);
    logo.closest('.wordmark-banner')?.classList.add('portal-image-depth');
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
    canvas.dataset.portalField = 'full-frame-volumetric-shared-flow';
    canvas.dataset.seed = seed.toFixed(2);
    canvas.dataset.debugMode = debugName;
    canvas.dataset.backend = 'webgl-fragment-plane';
    canvas.dataset.referenceMechanism = 'layered-volumetric-field-with-projected-particle-depth';
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

      float field3d(vec3 p) {
        vec2 layer_a = rotate2d(p.xy, p.z * 0.62 + u_time * 0.035);
        vec2 layer_b = rotate2d(p.yx, -p.z * 0.41 - u_time * 0.024);
        float broad = fbm_fast(layer_a * 0.94 + vec2(p.z * 0.43, -p.z * 0.27));
        float detail = fbm_fast(layer_b * 2.1 + vec2(-p.z * 0.74, p.z * 0.39));
        return broad * 0.68 + detail * 0.32;
      }

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        float aspect = u_resolution.x / u_resolution.y;
        float portrait = 1.0 - smoothstep(0.72, 0.92, aspect);
        p.y -= mix(0.02, -0.10, portrait);
        vec2 pointer = (u_pointer - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
        vec2 parallax = pointer * u_pointer_energy;
        p -= parallax * 0.018;

        float reveal = mix(0.36, 1.0, smoothstep(0.015, 0.28, u_progress));
        vec3 red = vec3(1.0, 0.035, 0.16);
        vec3 blue = vec3(0.055, 0.18, 1.0);
        vec3 cyan = vec3(0.04, 0.86, 1.0);
        vec3 cream = vec3(0.96, 0.84, 0.68);
        vec3 far_colour = vec3(0.0);
        vec3 near_colour = vec3(0.0);
        float far_alpha = 0.0;
        float near_alpha = 0.0;
        float density_sum = 0.0;
        float depth_sum = 0.0;

        for (int step_index = 0; step_index < 10; step_index++) {
          float layer = (float(step_index) + 0.5) / 10.0;
          float z = mix(-1.35, 1.35, layer);
          float perspective = 1.0 + z * 0.18;
          vec2 sample_p = p / perspective;
          sample_p += parallax * mix(-0.19, 0.24, layer);
          sample_p = rotate2d(sample_p, z * 0.27 + u_time * 0.014);
          vec3 q = vec3(sample_p * mix(1.06, 1.28, portrait), z);
          q.xy += vec2(z * 0.12, -z * 0.055);

          float flow = field3d(q + vec3(0.0, 0.0, u_seed * 0.017));
          float angle = atan(q.y, q.x);
          float radial = length(q.xy * vec2(0.74, 1.12));
          float plume = smoothstep(0.31, 0.68, flow)
            * (1.0 - smoothstep(0.38, 2.32, radial));
          float filament_field = fbm_fast(rotate2d(q.xy, z * 0.8) * 4.8 + vec2(z * 1.8, -u_time * 0.12));
          float filaments = pow(smoothstep(0.46, 0.73, filament_field), 4.0)
            * pow(smoothstep(0.24, 0.64, flow), 2.0)
            * (1.0 - smoothstep(0.24, 2.05, radial));
          float diagonal_coordinate = q.y * 0.68 + q.x * 0.22
            + sin(q.x * 1.35 - z * 1.7 + u_time * 0.055) * 0.3;
          float stream = (1.0 - smoothstep(0.08, 0.58, abs(diagonal_coordinate)))
            * smoothstep(0.27, 0.6, flow) * 0.78;
          float haze = smoothstep(0.22, 0.64, flow) * (1.0 - smoothstep(0.55, 2.55, radial));
          float density = clamp(plume * 0.76 + filaments * 0.92 + stream * 0.86 + haze * 0.24, 0.0, 1.0);
          density *= 0.205;

          float colour_phase = smoothstep(0.34, 0.66, 0.5 + 0.5 * sin(angle * 1.35 - z * 2.2 + flow * 4.0 + u_time * 0.075));
          vec3 layer_colour = mix(blue, red, colour_phase);
          layer_colour = mix(layer_colour, cyan, filaments * 0.88 + max(z, 0.0) * 0.16);
          layer_colour = mix(layer_colour, cream, filaments * max(z, 0.0) * 0.52 + haze * smoothstep(0.5, 0.72, flow) * 0.16);
          layer_colour *= mix(0.48, 1.32, layer);

          if (step_index < 5) {
            far_colour += (1.0 - far_alpha) * layer_colour * density;
            far_alpha += (1.0 - far_alpha) * density;
          } else {
            near_colour += (1.0 - near_alpha) * layer_colour * density;
            near_alpha += (1.0 - near_alpha) * density;
          }
          density_sum += density;
          depth_sum += density * layer;
        }

        vec2 ambient_coordinate = rotate2d(p, -0.31);
        float ambient_field = fbm(ambient_coordinate * 0.74 + vec2(u_time * 0.018, -u_time * 0.012));
        float sweep = smoothstep(-1.3, 0.9, ambient_coordinate.x + ambient_coordinate.y * 0.48);
        vec3 ambient_colour = mix(blue * 0.42, red * 0.36, smoothstep(0.38, 0.62, sweep)) * (0.28 + ambient_field * 0.62);
        ambient_colour += cyan * pow(smoothstep(0.48, 0.76, ambient_field), 2.2) * 0.2;
        float ambient_alpha = smoothstep(0.18, 0.65, ambient_field) * 0.5 + 0.09;

        vec3 raw_colour = ambient_colour;
        raw_colour += far_colour * 1.14;
        raw_colour += near_colour * 1.28;

        vec3 final_colour = raw_colour;
        final_colour += near_colour * near_alpha * 0.28;
        final_colour += far_colour * far_alpha * 0.08;
        float vignette = 1.0 - smoothstep(1.0, 2.2, length(p));
        final_colour *= 0.68 + vignette * 0.32;

        if (u_debug == 1) final_colour = vec3(clamp(density_sum * 0.7, 0.0, 1.0));
        if (u_debug == 2) final_colour = vec3(far_alpha, ambient_alpha, near_alpha);
        if (u_debug == 3) final_colour = vec3(far_alpha, near_alpha, depth_sum / max(density_sum, 0.001));
        if (u_debug == 4) final_colour = raw_colour;

        float volume_alpha = clamp(far_alpha * 0.72 + near_alpha + ambient_alpha, 0.0, 0.97);
        float alpha = reveal * volume_alpha;
        if (u_debug > 0) alpha = max(alpha, reveal * 0.92);
        gl_FragColor = vec4(final_colour, alpha);
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
    particleCanvas.dataset.seed = seed.toFixed(2);
    particleCanvas.setAttribute('aria-hidden', 'true');
    canvas.after(particleCanvas);
    const particleContext = particleCanvas.getContext('2d', { alpha: true });

    const seededRandom = (() => {
      let state = (Math.floor(seed * 1009) ^ 0x6d2b79f5) >>> 0;
      return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      };
    })();
    const particlePalette = [
      [36, 77, 255],
      [33, 220, 255],
      [255, 39, 77],
      [245, 222, 194]
    ];
    const particleCount = compact ? 180 : 320;
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
    let renderScale = quality === 'low' ? 0.6 : 0.86;
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
      active = eventRect.bottom > -innerHeight * 0.35 && heroRect.top < innerHeight * 1.2;
      canvas.dataset.active = String(active);
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
        gl.uniform1f(uniforms.seed, seed);
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
      hud.textContent = `Portal debug: ${debugName} | seed ${seed} | ${quality} tier`;
      document.body.append(hud);
    }

    addEventListener('resize', resize, { passive: true });
    addEventListener('scroll', updateProgress, { passive: true });
    addEventListener('pointermove', move, { passive: true });
    addEventListener('pointerdown', move, { passive: true });
    resize();
    updateProgress();
    canvas.dataset.webglStatus = 'rendering';
    canvas.dataset.visualContract = 'full-viewport-volumetric-field|no-central-void|projected-3d-particle-depth|mobile-composed';
    canvas.dataset.debugModes = Object.keys(DEBUG_MODES).join('|');
    canvas.dataset.frameBudgetMs = compact ? '24' : '17';
    canvas.dataset.parallaxMode = 'differential-volume|projected-particle-depth|chromatic-image-depth';
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

      const fragment = document.createDocumentFragment();
      [...source.body.children].forEach((child) => fragment.append(document.importNode(child, true)));
      document.body.querySelector('.portal-study-loader')?.remove();
      document.body.append(fragment);
      document.body.dataset.siteVersion = VERSION;
      document.body.classList.remove('portal-study-loading');
      document.documentElement.classList.add('portal-study-ready');

      installImageDepth();
      installPortal();
      await loadScript(`../commune-organism.js?v=commune-${SOURCE_VERSION}`);
      await loadScript(`../commune-realtime.js?v=commune-${SOURCE_VERSION}`);
      await loadScript('../commune-offer.js?v=commune-4.6.2');
      await loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
      await loadScript('../commune-signup.js?v=commune-4.2.1');
    } catch (error) {
      document.body.dataset.portalStudyError = error.message;
      const loader = document.querySelector('.portal-study-loader');
      if (loader) loader.textContent = 'Portal study could not load';
    }
  };

  bootstrap();
})();
