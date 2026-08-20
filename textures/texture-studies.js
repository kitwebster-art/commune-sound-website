(() => {
  const VERSION = 'texture-studies-1.0.0';
  const SOURCE_VERSION = '4.7.0';
  const PRESETS = Object.freeze({
    'velvet-interference': { number: '01', label: 'Velvet Interference', mode: 0, seed: 17 },
    'liquid-chrome': { number: '02', label: 'Liquid Chrome', mode: 1, seed: 29 },
    'holographic-grain': { number: '03', label: 'Holographic Grain', mode: 2, seed: 43 },
    'topographic-silk': { number: '04', label: 'Topographic Silk', mode: 3, seed: 61 },
    'cosmic-lacquer': { number: '05', label: 'Cosmic Lacquer', mode: 4, seed: 79 }
  });
  const study = document.body.dataset.textureStudy;
  const preset = PRESETS[study] || PRESETS['velvet-interference'];
  const params = new URLSearchParams(location.search);
  const fixedTime = Number.parseFloat(params.get('time'));
  const seedParam = Number.parseFloat(params.get('seed'));
  const seed = Number.isFinite(seedParam) ? seedParam : preset.seed;
  const debug = params.get('debug') === 'field' ? 1 : params.get('debug') === 'no-post' ? 2 : 0;

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
      if (src && !/^(?:[a-z]+:|\/|#)/i.test(src)) node.setAttribute('src', `../../${src}`);
    });
    body.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (href?.startsWith('#')) return;
      if (href && !/^(?:[a-z]+:|\/|#)/i.test(href)) anchor.setAttribute('href', `../../${href}`);
    });
  };

  const installImageDepth = () => {
    const logo = document.querySelector('[data-particle-logo]');
    const venue = document.querySelector('[data-particle-venue]');
    if (!(logo instanceof HTMLImageElement) || !(venue instanceof HTMLImageElement)) {
      throw new Error('Texture study image anchors missing');
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
    logo.before(
      createEcho(logo, 'portal-wordmark-echo portal-wordmark-echo--far'),
      createEcho(logo, 'portal-wordmark-echo portal-wordmark-echo--near')
    );
    venue.before(createEcho(venue, 'portal-venue-echo'));
    document.documentElement.classList.add('portal-image-depth-ready');
  };

  const compile = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };

  const link = (gl, vertex, fragment) => {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  };

  const installTexture = () => {
    const anchor = document.querySelector('.commune-realtime-vignette');
    if (!anchor) throw new Error('Texture study anchor missing');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const fallback = document.createElement('div');
      fallback.className = 'texture-static-fallback';
      anchor.after(fallback);
      document.documentElement.classList.add('texture-study-field-ready');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'texture-study-field';
    canvas.dataset.textureStudy = study;
    canvas.dataset.textureMechanism = ['woven-interference', 'warped-specular-marble', 'chromatic-clouds-film-grain', 'shared-height-contours', 'cellular-pearlescent-rims'][preset.mode];
    canvas.dataset.seed = seed.toFixed(2);
    canvas.dataset.debugModes = 'final|field|no-post';
    canvas.dataset.frameBudgetMs = innerWidth <= 700 ? '24' : '17';
    canvas.setAttribute('aria-hidden', 'true');
    anchor.after(canvas);

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

    const vertex = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    const fragment = `
      precision highp float;
      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform vec2 u_pointer;
      uniform float u_time;
      uniform float u_seed;
      uniform float u_scroll;
      uniform int u_mode;
      uniform int u_debug;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32 + u_seed * 0.017);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), u.x), u.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.54;
        mat2 rotation = mat2(0.82, -0.57, 0.57, 0.82);
        for (int i = 0; i < 5; i++) {
          value += noise2(p) * amplitude;
          p = rotation * p * 2.03 + vec2(13.7, 8.4);
          amplitude *= 0.49;
        }
        return value;
      }

      vec2 warp(vec2 p, float t) {
        vec2 a = vec2(fbm(p * 0.72 + vec2(t, -t * 0.7)), fbm(p * 0.72 + vec2(8.1 - t * 0.5, 3.7 + t)));
        return p + (a - 0.5) * 1.15;
      }

      float cells(vec2 p) {
        vec2 cell = floor(p);
        vec2 local = fract(p);
        float nearest = 2.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y));
            vec2 id = cell + offset;
            vec2 point = vec2(hash21(id), hash21(id + 19.37));
            point = 0.5 + 0.44 * sin(u_time * 0.08 + 6.2831 * point);
            nearest = min(nearest, length(offset + point - local));
          }
        }
        return nearest;
      }

      vec3 palette(float phase) {
        vec3 pink = vec3(1.0, 0.045, 0.62);
        vec3 violet = vec3(0.32, 0.075, 1.0);
        vec3 cyan = vec3(0.12, 0.82, 1.0);
        vec3 pearl = vec3(1.0, 0.84, 0.96);
        vec3 colour = mix(violet, pink, smoothstep(0.08, 0.72, phase));
        colour = mix(colour, cyan, smoothstep(0.68, 0.96, phase));
        return mix(colour, pearl, pow(max(0.0, phase - 0.78) / 0.22, 3.0) * 0.58);
      }

      void main() {
        vec2 uv = v_uv;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / max(u_resolution.y, 1.0);
        vec2 pointer = (u_pointer - 0.5) * vec2(0.16, -0.12);
        float t = u_time * 0.045;
        vec2 q = warp(p * 0.78 + pointer + vec2(0.0, u_scroll * 0.08), t);
        float primary = fbm(q * 1.12 - vec2(t * 0.32, t * 0.16));
        float detail = 0.0;
        float highlight = 0.0;
        vec3 colour = vec3(0.0);

        if (u_mode == 0) {
          float fold = 0.5 + 0.5 * sin((q.x * 1.1 + q.y * 0.62 + primary * 2.5) * 5.2);
          float warpThread = 0.5 + 0.5 * sin(q.x * 118.0 + q.y * 12.0 + primary * 8.0);
          float weftThread = 0.5 + 0.5 * sin(q.y * 132.0 - q.x * 9.0 - primary * 7.0);
          detail = pow(warpThread * weftThread, 3.4);
          highlight = pow(smoothstep(0.66, 0.96, fold), 3.0) + detail * 0.34;
          colour = palette(fold * 0.76 + primary * 0.22) * (0.18 + fold * 0.72);
          colour += vec3(0.22, 0.18, 0.42) * detail;
        } else if (u_mode == 1) {
          float marble = 0.5 + 0.5 * sin(q.x * 3.4 - q.y * 2.2 + primary * 8.8 + sin(q.y * 2.4) * 1.4);
          float edge = 1.0 - smoothstep(0.025, 0.14, abs(marble - 0.58));
          detail = marble;
          highlight = pow(edge, 2.2);
          colour = palette(marble) * (0.14 + marble * 0.5);
          colour += vec3(0.88, 0.92, 1.0) * highlight * 0.92;
        } else if (u_mode == 2) {
          float cloud = fbm(q * 0.68 + vec2(t * 0.1, -t * 0.14));
          float grain = hash21(gl_FragCoord.xy + floor(u_time * 12.0));
          float glint = pow(max(0.0, grain - 0.986) / 0.014, 2.0);
          detail = grain;
          highlight = glint;
          colour = palette(fract(cloud * 1.45 + q.x * 0.12 - q.y * 0.08));
          colour *= 0.23 + smoothstep(0.18, 0.9, cloud) * 0.72;
          colour += (grain - 0.5) * 0.11 + vec3(1.0, 0.76, 0.96) * glint;
        } else if (u_mode == 3) {
          float height = primary * 0.76 + fbm(q * 2.1) * 0.24;
          float contour = abs(fract(height * 14.0 + q.y * 0.7) - 0.5);
          float line = 1.0 - smoothstep(0.025, 0.085, contour);
          float fold = 0.5 + 0.5 * sin(q.x * 2.0 + q.y * 1.2 + height * 6.0);
          detail = line;
          highlight = line * (0.3 + fold * 0.7);
          colour = palette(height) * (0.16 + fold * 0.62);
          colour += vec3(0.72, 0.78, 1.0) * highlight * 0.68;
        } else {
          float cell = cells(q * 2.35 + vec2(t * 0.18, -t * 0.11));
          float rim = 1.0 - smoothstep(0.035, 0.14, abs(cell - 0.5));
          float core = 1.0 - smoothstep(0.18, 0.62, cell);
          detail = cell;
          highlight = pow(rim, 1.8);
          colour = palette(fract(cell * 1.35 + primary * 0.44)) * (0.13 + (1.0 - core) * 0.47);
          colour += vec3(0.8, 0.9, 1.0) * highlight * 0.78;
          colour *= 1.0 - core * 0.7;
        }

        float blackField = fbm(warp(p * 0.42 + vec2(7.3, -2.6), -t * 0.22));
        float blackPockets = smoothstep(0.48, 0.74, blackField);
        float centreGuard = smoothstep(0.08, 0.56, length(p * vec2(0.72, 1.0)));
        blackPockets *= mix(0.34, 1.0, centreGuard);
        vec3 noPost = colour * (1.0 - blackPockets * 0.8);
        colour = noPost;
        colour += palette(primary) * highlight * 0.17;
        float vignette = 1.0 - smoothstep(0.76, 1.85, length(p));
        colour *= 0.55 + vignette * 0.45;
        if (u_debug == 1) colour = vec3(primary, detail, highlight);
        if (u_debug == 2) colour = noPost;
        gl_FragColor = vec4(max(colour, 0.0), 0.97);
      }
    `;

    let program;
    try {
      program = link(gl, vertex, fragment);
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
      time: gl.getUniformLocation(program, 'u_time'),
      seed: gl.getUniformLocation(program, 'u_seed'),
      scroll: gl.getUniformLocation(program, 'u_scroll'),
      mode: gl.getUniformLocation(program, 'u_mode'),
      debug: gl.getUniformLocation(program, 'u_debug')
    };
    let pointerX = 0.5;
    let pointerY = 0.5;
    let scrollProgress = 0;
    let previous = performance.now();
    let sampleFrames = 0;
    let sampleTime = 0;
    let renderScale = innerWidth <= 700 ? 0.66 : 0.78;

    const resize = () => {
      const scale = Math.min(devicePixelRatio || 1, renderScale);
      canvas.width = Math.max(1, Math.round(innerWidth * scale));
      canvas.height = Math.max(1, Math.round(innerHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      canvas.dataset.renderScale = scale.toFixed(2);
    };
    const updateScroll = () => {
      scrollProgress = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight);
    };
    const move = (event) => {
      pointerX = event.clientX / Math.max(innerWidth, 1);
      pointerY = 1.0 - event.clientY / Math.max(innerHeight, 1);
    };
    const render = (time) => {
      const delta = Math.min(50, time - previous);
      previous = time;
      gl.useProgram(program);
      gl.uniform2f(uniforms.pointer, pointerX, pointerY);
      gl.uniform1f(uniforms.time, Number.isFinite(fixedTime) ? fixedTime : time * 0.001);
      gl.uniform1f(uniforms.seed, seed);
      gl.uniform1f(uniforms.scroll, scrollProgress);
      gl.uniform1i(uniforms.mode, preset.mode);
      gl.uniform1i(uniforms.debug, debug);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      sampleFrames += 1;
      sampleTime += delta;
      if (sampleTime >= 1200) {
        canvas.dataset.fps = (sampleFrames * 1000 / sampleTime).toFixed(1);
        sampleFrames = 0;
        sampleTime = 0;
      }
      requestAnimationFrame(render);
    };
    addEventListener('resize', resize, { passive: true });
    addEventListener('scroll', updateScroll, { passive: true });
    addEventListener('pointermove', move, { passive: true });
    resize();
    updateScroll();
    canvas.dataset.webglStatus = 'rendering';
    document.documentElement.classList.add('texture-study-field-ready');
    requestAnimationFrame(render);
  };

  const bootstrap = async () => {
    try {
      const response = await fetch(`../../index.html?texture-source=${SOURCE_VERSION}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Source page returned ${response.status}`);
      const source = new DOMParser().parseFromString(await response.text(), 'text/html');
      source.querySelectorAll('script').forEach((script) => script.remove());
      rewriteBodyAssets(source.body);
      const fragment = document.createDocumentFragment();
      [...source.body.children].forEach((child) => fragment.append(document.importNode(child, true)));
      document.body.querySelector('.portal-study-loader')?.remove();
      document.body.append(fragment);
      const eventDescription = document.querySelector('.event-description');
      if (eventDescription) eventDescription.textContent = 'For two hours, the hall comes alive with an eclectic mix of electronic and acoustic music from around the world, with space to listen, move and follow your own rhythm.';
      document.body.dataset.siteVersion = VERSION;
      document.body.classList.remove('portal-study-loading');
      document.documentElement.classList.add('portal-study-ready', 'texture-study-ready');
      installImageDepth();
      installTexture();
      await loadScript(`../../commune-organism.js?v=commune-${SOURCE_VERSION}`);
      await loadScript(`../../commune-realtime.js?v=commune-${SOURCE_VERSION}`);
      await loadScript('../../commune-offer.js?v=commune-4.6.2');
    } catch (error) {
      document.body.dataset.textureStudyError = error.message;
      const loader = document.querySelector('.portal-study-loader');
      if (loader) loader.textContent = 'Texture study could not load';
    }
  };

  bootstrap();
})();
