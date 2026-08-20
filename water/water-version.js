(() => {
  const VERSION = 'water-study-1.0.0';
  const SOURCE_VERSION = '4.7.0';

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
      throw new Error(gl.getShaderInfoLog(shader) || 'Water shader compilation failed');
    }
    return shader;
  };

  const createProgram = (gl, vertexSource, fragmentSource) => {
    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Water shader link failed');
    }
    return program;
  };

  const installWaterSurface = (venueImage) => {
    const venue = venueImage.closest('.venue-photo');
    if (!venue || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'water-ripple-surface';
    canvas.dataset.waterRipple = 'directional-displacement';
    canvas.dataset.reference = 'cargo-ripple-translation';
    canvas.dataset.waveDirection = '245deg';
    canvas.dataset.waveScale = '15x20';
    canvas.dataset.targetSpeed = '9';
    canvas.dataset.pointerSensitivity = '74';
    venue.insertBefore(canvas, venueImage.nextSibling);

    const label = document.createElement('p');
    label.className = 'water-study-label';
    label.textContent = 'water study';
    venue.append(label);

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
      uniform sampler2D u_image;
      uniform float u_time;
      uniform vec2 u_pointer;
      uniform float u_pointer_energy;

      void main() {
        vec2 uv = v_uv;
        vec2 direction = normalize(vec2(-0.4226, -0.9063));
        vec2 cross_direction = vec2(-direction.y, direction.x);
        vec2 field = uv * vec2(15.0, 20.0);

        float primary = sin(dot(field, direction) * 1.08 + u_time * 0.92);
        float secondary = sin(dot(field, cross_direction) * 0.72 - u_time * 0.58 + primary * 0.9);
        float fine = sin((field.x + field.y) * 1.34 + u_time * 1.38);
        float displacement = primary * 0.0105 + secondary * 0.0065 + fine * 0.0024;

        vec2 pointer_delta = uv - u_pointer;
        pointer_delta.x *= 0.75;
        float pointer_distance = length(pointer_delta);
        float pointer_ripple = sin(pointer_distance * 74.0 - u_time * 4.8)
          * exp(-pointer_distance * 7.5)
          * u_pointer_energy
          * 0.012;

        vec2 offset = direction * (displacement + pointer_ripple);
        offset += cross_direction * secondary * 0.0028;
        float prism = 0.0018 + abs(primary) * 0.0014 + u_pointer_energy * 0.0012;

        vec3 colour;
        colour.r = texture2D(u_image, uv + offset + direction * prism).r;
        colour.g = texture2D(u_image, uv + offset).g;
        colour.b = texture2D(u_image, uv + offset - direction * prism).b;

        float luminance = dot(colour, vec3(0.2126, 0.7152, 0.0722));
        vec3 shadow_tint = vec3(0.018, 0.034, 0.105);
        vec3 blue_tint = vec3(0.08, 0.24, 1.0);
        vec3 red_tint = vec3(1.0, 0.035, 0.16);
        vec3 cyan_tint = vec3(0.06, 0.88, 1.0);
        float colour_wave = smoothstep(-0.6, 0.75, primary + secondary * 0.45);
        vec3 neon = mix(red_tint, blue_tint, colour_wave);
        neon = mix(neon, cyan_tint, smoothstep(0.58, 1.0, fine) * 0.42);
        colour = mix(shadow_tint, colour, 0.68);
        colour += neon * (0.055 + luminance * 0.14) * (0.72 + abs(primary) * 0.34);
        colour = pow(max(colour, 0.0), vec3(0.92));

        float edge_x = smoothstep(0.0, 0.045, uv.x) * smoothstep(0.0, 0.045, 1.0 - uv.x);
        float edge_y = smoothstep(0.0, 0.055, uv.y) * smoothstep(0.0, 0.055, 1.0 - uv.y);
        gl_FragColor = vec4(colour, min(edge_x, edge_y) * 0.94);
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
      image: gl.getUniformLocation(program, 'u_image'),
      time: gl.getUniformLocation(program, 'u_time'),
      pointer: gl.getUniformLocation(program, 'u_pointer'),
      pointerEnergy: gl.getUniformLocation(program, 'u_pointer_energy')
    };

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, venueImage);
    gl.uniform1i(uniforms.image, 0);

    let pointerX = 0.5;
    let pointerY = 0.5;
    let pointerTarget = 0;
    let pointerEnergy = 0;
    let visible = true;
    let frame = 0;
    let previousTime = performance.now();
    let frameSamples = 0;
    let frameDuration = 0;

    const resize = () => {
      const imageRect = venueImage.getBoundingClientRect();
      const venueRect = venue.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, innerWidth <= 700 ? 1.35 : 1.7);
      canvas.style.left = `${imageRect.left - venueRect.left}px`;
      canvas.style.top = `${imageRect.top - venueRect.top}px`;
      canvas.style.width = `${imageRect.width}px`;
      canvas.style.height = `${imageRect.height}px`;
      canvas.width = Math.max(1, Math.round(imageRect.width * dpr));
      canvas.height = Math.max(1, Math.round(imageRect.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      canvas.dataset.renderScale = dpr.toFixed(2);
    };

    const move = (event) => {
      const rect = canvas.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      pointerX = (event.clientX - rect.left) / rect.width;
      pointerY = 1 - (event.clientY - rect.top) / rect.height;
      pointerTarget = event.pointerType === 'touch' ? 1 : 0.72;
    };

    const render = (time) => {
      const delta = Math.min(50, time - previousTime);
      previousTime = time;
      pointerEnergy += (pointerTarget - pointerEnergy) * Math.min(1, delta * 0.012);
      pointerTarget *= Math.pow(0.988, delta / 16.67);

      if (visible && !document.hidden) {
        gl.useProgram(program);
        gl.uniform1f(uniforms.time, time * 0.001);
        gl.uniform2f(uniforms.pointer, pointerX, pointerY);
        gl.uniform1f(uniforms.pointerEnergy, pointerEnergy);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        frameSamples += 1;
        frameDuration += delta;
        if (frameDuration >= 1000) {
          canvas.dataset.fps = (frameSamples * 1000 / frameDuration).toFixed(1);
          frameSamples = 0;
          frameDuration = 0;
        }
      }
      frame = requestAnimationFrame(render);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      canvas.dataset.visible = String(visible);
    }, { rootMargin: '25% 0px' });
    observer.observe(canvas);
    new ResizeObserver(resize).observe(venueImage);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', move, { passive: true });
    window.addEventListener('pagehide', () => cancelAnimationFrame(frame), { once: true });
    resize();
    canvas.dataset.webglStatus = 'rendering';
    document.documentElement.classList.add('water-ripple-ready');
    requestAnimationFrame(render);
  };

  const bootstrap = async () => {
    try {
      const response = await fetch(`../index.html?water-source=${SOURCE_VERSION}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Source page returned ${response.status}`);
      const source = new DOMParser().parseFromString(await response.text(), 'text/html');
      source.querySelectorAll('script').forEach((script) => script.remove());
      rewriteBodyAssets(source.body);

      const fragment = document.createDocumentFragment();
      [...source.body.children].forEach((child) => fragment.append(document.importNode(child, true)));
      document.body.querySelector('.water-study-loader')?.remove();
      document.body.append(fragment);
      document.body.dataset.siteVersion = VERSION;
      document.body.classList.remove('water-study-loading');
      document.documentElement.classList.add('water-study-ready');

      const venueImage = document.querySelector('[data-particle-venue]');
      if (!(venueImage instanceof HTMLImageElement)) throw new Error('Venue image missing');
      if (!venueImage.complete) await new Promise((resolve) => venueImage.addEventListener('load', resolve, { once: true }));
      installWaterSurface(venueImage);

      await loadScript(`../commune-organism.js?v=commune-${SOURCE_VERSION}`);
      await loadScript(`../commune-realtime.js?v=commune-${SOURCE_VERSION}`);
      await loadScript('../commune-offer.js?v=commune-4.6.2');
      await loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
      await loadScript('../commune-signup.js?v=commune-4.2.1');
    } catch (error) {
      document.body.dataset.waterStudyError = error.message;
      const loader = document.querySelector('.water-study-loader');
      if (loader) loader.textContent = 'Water study could not load';
    }
  };

  bootstrap();
})();
