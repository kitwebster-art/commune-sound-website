(() => {
  const VERSION = 'portal-study-1.0.0';
  const SOURCE_VERSION = '4.7.0';
  const params = new URLSearchParams(location.search);
  const DEBUG_MODES = Object.freeze({ final: 0, density: 1, rim: 2, flow: 3, 'no-post': 4 });
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
    canvas.dataset.portalField = 'dark-core-shared-flow';
    canvas.dataset.seed = seed.toFixed(2);
    canvas.dataset.debugMode = debugName;
    canvas.dataset.backend = 'webgl-fragment-plane';
    canvas.dataset.referenceMechanism = 'stable-core-turbulent-luminous-edge';
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

      vec2 rotate2d(vec2 p, float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return mat2(c, -s, s, c) * p;
      }

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        p.y -= mix(0.19, -0.04, u_progress);
        vec2 pointer = (u_pointer - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
        p -= pointer * u_pointer_energy * 0.055;

        float reveal = smoothstep(0.035, 0.24, u_progress) * (1.0 - smoothstep(0.82, 1.0, u_progress));
        float event_envelope = sin(clamp(u_progress, 0.0, 1.0) * 3.14159265);
        float core_radius = mix(0.095, 0.19, pow(event_envelope, 0.72));
        vec2 shaped_position = vec2(p.x * 0.86, p.y * 1.08);
        float angle = atan(shaped_position.y, shaped_position.x);
        float radius = length(shaped_position);
        float spin = u_time * 0.16 + u_progress * 2.4;

        vec2 stable_coordinate = rotate2d(p, spin * 0.18);
        float macro_flow = fbm(stable_coordinate * 1.65 + vec2(u_time * 0.055, -u_time * 0.038));
        vec2 warped_coordinate = rotate2d(stable_coordinate, (macro_flow - 0.5) * 1.15 + spin * 0.08);
        float meso_flow = fbm(warped_coordinate * 3.4 + vec2(-u_time * 0.13, u_time * 0.09));
        float filament_field = fbm(warped_coordinate * 7.2 + vec2(u_time * 0.19, -u_time * 0.15));

        float angular_lobe = sin(angle * 3.0 - spin * 1.7 + macro_flow * 3.2) * 0.026;
        float radial_warp = (macro_flow - 0.5) * 0.2 + (meso_flow - 0.5) * 0.086 + angular_lobe;
        float warped_radius = radius + radial_warp;
        float rim_distance = abs(radius + radial_warp * 0.28 - core_radius);
        float inner_rim = 1.0 - smoothstep(0.004, 0.066, rim_distance);
        float outer_cloud = (1.0 - smoothstep(core_radius + 0.08, core_radius + 0.7, warped_radius))
          * smoothstep(core_radius - 0.02, core_radius + 0.075, warped_radius);
        float lobe_structure = 0.68 + 0.32 * sin(angle * 2.0 - spin * 0.9 + macro_flow * 4.1);
        float cloud_density = outer_cloud * (0.3 + meso_flow * 0.94) * lobe_structure;
        float filaments = pow(smoothstep(0.46, 0.88, filament_field), 1.85) * outer_cloud;
        float density = clamp(cloud_density + inner_rim * 0.82 + filaments * 0.86, 0.0, 1.45);
        float core = 1.0 - smoothstep(core_radius - 0.012, core_radius + 0.018, radius);

        float colour_phase = 0.5 + 0.5 * sin(angle * 1.25 - spin + macro_flow * 2.8);
        vec3 red = vec3(1.0, 0.035, 0.16);
        vec3 blue = vec3(0.055, 0.18, 1.0);
        vec3 cyan = vec3(0.04, 0.86, 1.0);
        vec3 cream = vec3(0.96, 0.84, 0.68);
        vec3 cloud_colour = mix(red, blue, colour_phase);
        cloud_colour = mix(cloud_colour, cyan, filaments * 0.58);
        cloud_colour = mix(cloud_colour, cream, inner_rim * smoothstep(0.62, 0.95, meso_flow) * 0.62);

        vec3 raw_colour = cloud_colour * density * (0.5 + inner_rim * 0.62);
        vec3 final_colour = raw_colour;
        float soft_glow = (1.0 - smoothstep(0.0, 0.34, rim_distance)) * 0.16;
        final_colour += cloud_colour * soft_glow;
        final_colour *= 1.0 - core * 0.995;
        final_colour += vec3(0.001, 0.002, 0.007) * core;
        float vignette = 1.0 - smoothstep(0.72, 1.48, length(p));
        final_colour *= 0.48 + vignette * 0.52;

        if (u_debug == 1) final_colour = vec3(clamp(density, 0.0, 1.0));
        if (u_debug == 2) final_colour = vec3(inner_rim, filaments, core);
        if (u_debug == 3) final_colour = vec3(macro_flow, meso_flow, filament_field);
        if (u_debug == 4) final_colour = raw_colour * (1.0 - core);

        float alpha = reveal * clamp(density * 0.9 + core * 0.995, 0.0, 0.995);
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
    let renderScale = quality === 'low' ? 0.62 : 1.05;
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
    let adaptiveReduced = false;

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
          if (fps < 34 && renderScale > 0.54 && !adaptiveReduced) {
            renderScale = 0.52;
            adaptiveReduced = true;
            canvas.dataset.adaptiveReduction = 'true';
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
    canvas.dataset.visualContract = 'stable-dark-core|turbulent-shared-flow-edge|scroll-event-envelope';
    canvas.dataset.debugModes = Object.keys(DEBUG_MODES).join('|');
    canvas.dataset.frameBudgetMs = compact ? '24' : '17';
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
