(() => {
  const VERSION = 'portal-study-1.2.0';
  const SOURCE_VERSION = '4.7.0';
  const params = new URLSearchParams(location.search);
  const DEBUG_MODES = Object.freeze({ final: 0, density: 1, core: 2, depth: 3, 'no-post': 4 });
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
    canvas.dataset.portalField = 'volumetric-dark-mass-shared-flow';
    canvas.dataset.seed = seed.toFixed(2);
    canvas.dataset.debugMode = debugName;
    canvas.dataset.backend = 'webgl-fragment-plane';
    canvas.dataset.referenceMechanism = 'irregular-dark-mass-layered-volumetric-flow';
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

      float dark_mass_sdf(vec2 p, float scale) {
        vec2 q = rotate2d(p - vec2(-0.08, -0.035), -0.24);
        float broad = length(q * vec2(0.66, 1.26)) - scale;
        float shoulder = length((q - vec2(-scale * 0.68, scale * 0.22)) * vec2(0.88, 1.42)) - scale * 0.76;
        float lower = length((q - vec2(scale * 0.48, -scale * 0.36)) * vec2(0.8, 1.08)) - scale * 0.72;
        float wing = length((q - vec2(scale * 0.72, scale * 0.28)) * vec2(1.22, 0.84)) - scale * 0.48;
        float union_shape = min(min(broad, shoulder), min(lower, wing));
        float bite = length((q - vec2(scale * 0.44, scale * 0.46)) * vec2(0.9, 1.36)) - scale * 0.31;
        union_shape = max(union_shape, -bite);
        float boundary = fbm(q * 1.85 + vec2(u_seed * 0.031, -u_time * 0.018)) - 0.5;
        float folds = sin(q.x * 4.2 - q.y * 3.1 + boundary * 4.0) * 0.045;
        return union_shape + boundary * 0.19 + folds;
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
        float mass_scale = mix(0.39, 0.68, smoothstep(0.0, 0.46, u_progress));
        mass_scale *= mix(1.0, 0.78, portrait);
        float core_sdf = dark_mass_sdf(p, mass_scale);
        float core = 1.0 - smoothstep(-0.045, 0.055, core_sdf);
        float edge = 1.0 - smoothstep(0.0, 0.17, abs(core_sdf));

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
          float shell_radius = mass_scale * (1.02 + z * 0.12)
            + (flow - 0.5) * 0.38
            + sin(angle * 3.0 - z * 2.7 + u_time * 0.11) * 0.075;
          float shell = (1.0 - smoothstep(0.045, 0.32, abs(radial - shell_radius)))
            * smoothstep(0.24, 0.62, flow);
          float plume = smoothstep(0.31, 0.68, flow)
            * (1.0 - smoothstep(mass_scale * 0.52, mass_scale + 1.7, radial));
          float filament_field = fbm_fast(rotate2d(q.xy, z * 0.8) * 4.8 + vec2(z * 1.8, -u_time * 0.12));
          float filaments = pow(smoothstep(0.46, 0.73, filament_field), 4.0)
            * pow(smoothstep(0.24, 0.64, flow), 2.0)
            * (1.0 - smoothstep(mass_scale * 0.38, mass_scale + 1.5, radial));
          float diagonal_coordinate = q.y * 0.68 + q.x * 0.22
            + sin(q.x * 1.35 - z * 1.7 + u_time * 0.055) * 0.3;
          float stream = (1.0 - smoothstep(0.08, 0.58, abs(diagonal_coordinate)))
            * smoothstep(0.27, 0.6, flow) * 0.78;
          float density = clamp(shell * (0.18 + flow * 0.66) + plume * 0.68 + filaments * 0.9 + stream, 0.0, 1.0);
          density *= 0.22;

          float colour_phase = smoothstep(0.34, 0.66, 0.5 + 0.5 * sin(angle * 1.35 - z * 2.2 + flow * 4.0 + u_time * 0.075));
          vec3 layer_colour = mix(blue, red, colour_phase);
          layer_colour = mix(layer_colour, cyan, filaments * 0.88 + max(z, 0.0) * 0.16);
          layer_colour = mix(layer_colour, cream, filaments * max(z, 0.0) * 0.52 + shell * smoothstep(0.5, 0.72, flow) * 0.34);
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
        raw_colour += far_colour * 1.18 * (1.0 - core * 0.9);
        raw_colour *= 1.0 - core * 0.93;
        raw_colour += vec3(0.0008, 0.0012, 0.004) * core;
        raw_colour += near_colour * 1.24 * mix(0.2, 1.0, 1.0 - core * 0.78);
        vec2 rim_direction = normalize(rotate2d(p - vec2(-0.08, -0.035), -0.24) + vec2(0.0001));
        float rim_light = smoothstep(-0.35, 0.88, dot(rim_direction, normalize(vec2(-0.72, 0.69))));
        float rim_shadow = 1.0 - rim_light;
        raw_colour *= 1.0 - edge * rim_shadow * 0.1;
        raw_colour += mix(cyan, cream, rim_light * 0.62) * edge * rim_light * 0.22;
        raw_colour += red * edge * rim_shadow * 0.075;

        vec3 final_colour = raw_colour;
        final_colour += near_colour * near_alpha * 0.28;
        final_colour += far_colour * far_alpha * 0.08;
        float vignette = 1.0 - smoothstep(1.0, 2.2, length(p));
        final_colour *= 0.68 + vignette * 0.32;

        if (u_debug == 1) final_colour = vec3(clamp(density_sum * 0.7, 0.0, 1.0));
        if (u_debug == 2) final_colour = vec3(edge, core, max(0.0, core_sdf));
        if (u_debug == 3) final_colour = vec3(far_alpha, near_alpha, depth_sum / max(density_sum, 0.001));
        if (u_debug == 4) final_colour = raw_colour;

        float volume_alpha = clamp(far_alpha * 0.72 + near_alpha + ambient_alpha, 0.0, 0.97);
        float alpha = reveal * max(volume_alpha, core * 0.985);
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
    canvas.dataset.visualContract = 'full-viewport-volumetric-field|irregular-dark-mass|layered-depth-flow|mobile-composed';
    canvas.dataset.debugModes = Object.keys(DEBUG_MODES).join('|');
    canvas.dataset.frameBudgetMs = compact ? '24' : '17';
    canvas.dataset.parallaxMode = 'differential-volume|chromatic-image-depth';
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
