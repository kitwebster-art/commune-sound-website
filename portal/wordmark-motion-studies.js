(() => {
  const STUDIES = {
    'breathing-bulge': { index: 1, label: 'Breathing Bulge', period: 24 },
    'liquid-ripple': { index: 2, label: 'Liquid Ripple', period: 28 },
    'twin-pinch': { index: 3, label: 'Twin Pinch', period: 26 },
    'ribbon-wave': { index: 4, label: 'Ribbon Wave', period: 30 },
    'chromatic-refraction': { index: 5, label: 'Chromatic Refraction', period: 22 }
  };

  const requestedStudy = new URLSearchParams(location.search).get('motion-study');
  const slug = requestedStudy === 'off'
    ? null
    : (STUDIES[requestedStudy] ? requestedStudy : 'liquid-ripple');
  const study = STUDIES[slug];
  if (!study) return;

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
    uniform sampler2D u_image;
    uniform float u_time;
    uniform float u_effect;
    uniform float u_aspect;
    uniform vec2 u_pointer;
    varying vec2 v_uv;

    float falloff(vec2 point, vec2 centre, float scale) {
      vec2 delta = point - centre;
      delta.x *= u_aspect;
      return exp(-dot(delta, delta) * scale);
    }

    vec4 sourceAt(vec2 uv) {
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
      return texture2D(u_image, uv);
    }

    void main() {
      vec2 uv = v_uv;
      vec2 centre = vec2(
        0.5 + sin(u_time * 0.19) * 0.055 + u_pointer.x * 0.018,
        0.5 + cos(u_time * 0.15) * 0.035 + u_pointer.y * 0.014
      );
      vec2 p = uv - centre;
      p.x *= u_aspect;
      float radius = length(p);

      if (u_effect < 0.5) {
        float breath = 0.028 + 0.009 * sin(u_time * 0.28);
        float lens = exp(-radius * radius * 6.3);
        p *= 1.0 - breath * lens;
        p.x /= u_aspect;
        uv = centre + p;
      } else if (u_effect < 1.5) {
        float envelope = smoothstep(0.02, 0.22, v_uv.x) * smoothstep(0.02, 0.22, 1.0 - v_uv.x);
        uv.x += (sin(v_uv.y * 12.0 + u_time * 0.34) + 0.45 * sin(v_uv.y * 23.0 - u_time * 0.21)) * 0.0068 * envelope;
        uv.y += sin(v_uv.x * 8.0 - u_time * 0.18) * 0.0028;
      } else if (u_effect < 2.5) {
        vec2 first = vec2(0.34 + sin(u_time * 0.17) * 0.05, 0.48 + cos(u_time * 0.13) * 0.04);
        vec2 second = vec2(0.68 + cos(u_time * 0.14) * 0.05, 0.53 + sin(u_time * 0.16) * 0.04);
        vec2 d1 = uv - first;
        vec2 d2 = uv - second;
        float w1 = falloff(uv, first, 22.0);
        float w2 = falloff(uv, second, 22.0);
        uv += d1 * w1 * (0.034 + 0.009 * sin(u_time * 0.24));
        uv -= d2 * w2 * (0.027 + 0.008 * cos(u_time * 0.21));
      } else if (u_effect < 3.5) {
        float wide = sin(v_uv.y * 10.5 + u_time * 0.25);
        float detail = sin(v_uv.y * 21.0 - u_time * 0.14);
        uv.x += (wide + detail * 0.28) * 0.0082;
        uv.y += sin(v_uv.x * 7.0 - u_time * 0.16) * 0.0022;
      } else {
        float lens = exp(-radius * radius * 8.0);
        vec2 direction = p / max(radius, 0.0001);
        direction.x /= u_aspect;
        vec2 warped = uv - direction * lens * (0.007 + sin(u_time * 0.27) * 0.0015);
        vec2 split = direction * (0.0028 + lens * 0.0034);
        vec4 redSample = sourceAt(warped + split);
        vec4 greenSample = sourceAt(warped);
        vec4 blueSample = sourceAt(warped - split);
        float alpha = max(redSample.a, max(greenSample.a, blueSample.a));
        vec3 colour = vec3(redSample.r * redSample.a, greenSample.g * greenSample.a, blueSample.b * blueSample.a) / max(alpha, 0.001);
        gl_FragColor = vec4(colour, alpha);
        return;
      }
      gl_FragColor = sourceAt(uv);
    }
  `;

  const compile = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
    return shader;
  };

  const install = ({ stage, float, image }) => {
    if (!(stage instanceof HTMLElement) || !(float instanceof HTMLElement) || !(image instanceof HTMLImageElement)) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stage.dataset.motionStudy = `${slug}-reduced-motion-static`;
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'portal-wordmark-motion-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.dataset.motionStudy = slug;
    canvas.dataset.motionLabel = study.label;
    canvas.dataset.motionPeriodSeconds = String(study.period);

    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!gl) {
      stage.dataset.motionStudy = `${slug}-webgl-unavailable`;
      return;
    }

    try {
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Shader linking failed');
      gl.useProgram(program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      const locations = {
        image: gl.getUniformLocation(program, 'u_image'),
        time: gl.getUniformLocation(program, 'u_time'),
        effect: gl.getUniformLocation(program, 'u_effect'),
        aspect: gl.getUniformLocation(program, 'u_aspect'),
        pointer: gl.getUniformLocation(program, 'u_pointer')
      };
      let pointerX = 0;
      let pointerY = 0;
      let targetX = 0;
      let targetY = 0;
      let frame = 0;
      let running = false;
      let installed = false;
      const started = performance.now();
      const effectIndex = Object.keys(STUDIES).indexOf(slug);

      const resize = () => {
        if (!image.naturalWidth) return;
        const aspect = image.naturalWidth / image.naturalHeight;
        const cssWidth = Math.max(1, stage.getBoundingClientRect().width);
        const pixelRatio = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.25 : 1.6);
        canvas.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
        canvas.width = Math.max(1, Math.round(cssWidth * pixelRatio));
        canvas.height = Math.max(1, Math.round((cssWidth / aspect) * pixelRatio));
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform1f(locations.aspect, aspect);
      };

      const render = (now) => {
        if (!running) return;
        pointerX += (targetX - pointerX) * 0.035;
        pointerY += (targetY - pointerY) * 0.035;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1i(locations.image, 0);
        gl.uniform1f(locations.time, ((now - started) / 1000) * (24 / study.period));
        gl.uniform1f(locations.effect, effectIndex);
        gl.uniform2f(locations.pointer, pointerX, pointerY);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        frame = requestAnimationFrame(render);
      };

      const start = () => {
        if (running) return;
        running = true;
        frame = requestAnimationFrame(render);
      };
      const stop = () => {
        running = false;
        cancelAnimationFrame(frame);
      };
      const move = (event) => {
        const rect = stage.getBoundingClientRect();
        targetX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
        targetY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * -2));
      };
      const reveal = () => {
        if (installed || !image.complete || !image.naturalWidth) return;
        installed = true;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        resize();
        float.append(canvas);
        stage.classList.add('portal-wordmark-motion-ready');
        stage.dataset.motionStudy = slug;
        stage.dataset.motionStudyStatus = 'rendering';
        document.documentElement.dataset.wordmarkMotionStudy = slug;
        document.documentElement.classList.add('portal-wordmark-motion-study');
        start();
      };

      image.addEventListener('load', reveal, { once: true });
      reveal();
      addEventListener('resize', resize, { passive: true });
      stage.addEventListener('pointermove', move, { passive: true });
      stage.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; }, { passive: true });
      document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        stop();
        stage.classList.remove('portal-wordmark-motion-ready');
        stage.dataset.motionStudyStatus = 'context-lost-original-restored';
      });
    } catch (error) {
      canvas.remove();
      stage.dataset.motionStudy = `${slug}-shader-error`;
      stage.dataset.motionStudyError = error.message;
    }
  };

  document.addEventListener('commune:wordmark-ready', (event) => install(event.detail), { once: true });
})();
