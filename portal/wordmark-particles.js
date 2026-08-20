(() => {
  const SOURCE_WIDTH = 1204;
  const SOURCE_HEIGHT = 488;

  const circle = (x, y, cx, cy, radius) => {
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  };

  const ellipse = (x, y, cx, cy, radiusX, radiusY) => {
    const dx = (x - cx) / radiusX;
    const dy = (y - cy) / radiusY;
    return dx * dx + dy * dy <= 1;
  };

  const rectangle = (x, y, left, top, right, bottom) => (
    x >= left && x <= right && y >= top && y <= bottom
  );

  const polygon = (x, y, points) => {
    let inside = false;
    for (let current = 0, previous = points.length - 1; current < points.length; previous = current++) {
      const [currentX, currentY] = points[current];
      const [previousX, previousY] = points[previous];
      const crosses = (currentY > y) !== (previousY > y)
        && x < (previousX - currentX) * (y - currentY) / (previousY - currentY) + currentX;
      if (crosses) inside = !inside;
    }
    return inside;
  };

  const roundedBottom = (x, y, left, top, right, shoulderY) => {
    const radius = (right - left) * 0.5;
    const centreX = (left + right) * 0.5;
    return rectangle(x, y, left, top, right, shoulderY)
      || (y >= shoulderY && circle(x, y, centreX, shoulderY, radius));
  };

  const uShape = (x, y, left, top, right, shoulderY, innerLeft, innerRight, innerBottom) => {
    if (!roundedBottom(x, y, left, top, right, shoulderY)) return false;
    const innerRadius = (innerRight - innerLeft) * 0.5;
    const innerCentreX = (innerLeft + innerRight) * 0.5;
    const insideOpening = rectangle(x, y, innerLeft, top - 2, innerRight, innerBottom)
      || (y >= innerBottom && circle(x, y, innerCentreX, innerBottom, innerRadius));
    return !insideOpening;
  };

  const topC = (x, y) => {
    if (!circle(x, y, 105, 140, 84)) return false;
    return !polygon(x, y, [[104, 140], [178, 70], [178, 210]]);
  };

  const topE = (x, y) => (
    rectangle(x, y, 1042, 58, 1084, 222)
    || polygon(x, y, [[1082, 58], [1182, 58], [1082, 140]])
    || polygon(x, y, [[1082, 140], [1182, 140], [1082, 222]])
  );

  const bottomS = (x, y) => {
    const split = -x + 570;
    const top = circle(x, y, 235, 332, 75) && y < split - 4;
    const bottom = circle(x, y, 231, 385, 67) && y > split + 4;
    return top || bottom;
  };

  const shapeIndexAt = (x, y) => {
    if (topC(x, y)) return 0;
    if (circle(x, y, 264, 140, 83)) return 1;
    if (polygon(x, y, [[353, 58], [432, 135], [507, 58], [507, 222], [353, 222]])) return 2;
    if (polygon(x, y, [[530, 58], [609, 135], [685, 58], [685, 222], [530, 222]])) return 3;
    if (uShape(x, y, 708, 58, 851, 139, 752, 807, 134)) return 4;
    if (rectangle(x, y, 872, 58, 1022, 222)) return 5;
    if (topE(x, y)) return 6;
    if (bottomS(x, y)) return 7;
    if (ellipse(x, y, 411, 351, 93, 92)) return 8;
    if (uShape(x, y, 520, 259, 683, 350, 568, 635, 342)) return 9;
    if (rectangle(x, y, 708, 259, 870, 443)) return 10;
    if (rectangle(x, y, 891, 259, 960, 443) || ellipse(x, y, 960, 351, 84, 92)) return 11;
    return -1;
  };

  const hash = (x, y, seed) => {
    const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 19.19) * 43758.5453;
    return value - Math.floor(value);
  };

  const createShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Particle wordmark shader failed');
    }
    return shader;
  };

  const createProgram = (gl, vertex, fragment) => {
    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Particle wordmark link failed');
    }
    return program;
  };

  const buildPointData = (compact, seed) => {
    const spacing = compact ? 5 : 3;
    const edgeRadius = spacing * 1.15;
    const values = [];
    let edgeCount = 0;
    for (let y = spacing * 0.5; y < SOURCE_HEIGHT; y += spacing) {
      for (let x = spacing * 0.5; x < SOURCE_WIDTH; x += spacing) {
        const shape = shapeIndexAt(x, y);
        if (shape < 0) continue;
        const edge = (
          shapeIndexAt(x - edgeRadius, y) !== shape
          || shapeIndexAt(x + edgeRadius, y) !== shape
          || shapeIndexAt(x, y - edgeRadius) !== shape
          || shapeIndexAt(x, y + edgeRadius) !== shape
        ) ? 1 : 0;
        edgeCount += edge;
        const pointSeed = hash(x, y, seed);
        const diagonal = (x / SOURCE_WIDTH) * 0.68 + (1 - y / SOURCE_HEIGHT) * 0.32;
        const shapePhase = (shape % 4) / 3;
        const tone = (diagonal * 0.62 + shapePhase * 0.25 + pointSeed * 0.13) % 1;
        values.push(x / SOURCE_WIDTH, y / SOURCE_HEIGHT, pointSeed, edge, tone);
      }
    }
    return { data: new Float32Array(values), count: values.length / 5, edgeCount, spacing };
  };

  window.installPortalParticleWordmark = ({ seed = 17 } = {}) => {
    const image = document.querySelector('[data-particle-logo]');
    const section = image?.closest('.wordmark-banner');
    if (!(image instanceof HTMLImageElement) || !(section instanceof HTMLElement)) {
      throw new Error('Particle wordmark anchor missing');
    }

    image.removeAttribute('srcset');
    image.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1204" height="488" viewBox="0 0 1204 488"/%3E';
    image.classList.add('portal-wordmark-placeholder');

    const canvas = document.createElement('canvas');
    canvas.className = 'portal-wordmark-particles';
    canvas.dataset.wordmarkSource = 'analytic-vector-primitives';
    canvas.dataset.runtimeBitmap = 'none';
    canvas.dataset.renderMode = 'single-draw-webgl-points';
    canvas.dataset.depthModel = 'anchored-edge|shallow-interior-parallax';
    canvas.dataset.seed = Number(seed).toFixed(2);
    canvas.setAttribute('aria-hidden', 'true');
    image.after(canvas);

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
      precision highp float;
      attribute vec2 a_position;
      attribute float a_seed;
      attribute float a_edge;
      attribute float a_tone;
      uniform vec2 u_pointer;
      uniform float u_time;
      uniform float u_dpr;
      uniform float u_compact;
      uniform int u_debug;
      varying vec3 v_colour;
      varying float v_alpha;

      void main() {
        float depth = 0.18 + a_seed * 0.82;
        float edgeAnchor = mix(1.0, 0.12, a_edge);
        vec2 drift = vec2(
          sin(u_time * 0.42 + a_seed * 38.0),
          cos(u_time * 0.37 + a_seed * 29.0)
        ) * 0.00135 * edgeAnchor;
        vec2 parallax = (u_pointer - 0.5) * (depth - 0.5) * 0.012 * edgeAnchor;
        vec2 position = a_position + drift + parallax;
        gl_Position = vec4(position.x * 2.0 - 1.0, 1.0 - position.y * 2.0, 0.0, 1.0);

        float baseSize = mix(1.7, 1.5, u_compact);
        float edgeSize = mix(2.35, 2.1, u_compact);
        gl_PointSize = mix(baseSize, edgeSize, a_edge) * u_dpr * mix(0.9, 1.18, depth);

        vec3 pearl = vec3(1.0, 0.9, 0.98);
        vec3 violet = vec3(0.42, 0.23, 1.0);
        vec3 cyan = vec3(0.22, 0.88, 1.0);
        vec3 pink = vec3(1.0, 0.2, 0.72);
        vec3 accent = mix(violet, pink, smoothstep(0.08, 0.7, a_tone));
        accent = mix(accent, cyan, smoothstep(0.68, 0.96, a_tone));
        v_colour = mix(pearl, accent, mix(0.1, 0.22, depth));
        v_colour = mix(v_colour, vec3(1.0), a_edge * 0.48);
        v_alpha = mix(0.88, 1.0, a_edge) * mix(0.94, 1.0, depth);

        if (u_debug == 1) {
          v_colour = mix(vec3(0.12, 0.18, 0.34), vec3(1.0, 0.15, 0.7), a_edge);
          v_alpha = 1.0;
        } else if (u_debug == 2) {
          v_colour = mix(vec3(0.16, 0.12, 0.42), vec3(0.2, 0.95, 1.0), depth);
          v_alpha = 1.0;
        }
      }
    `;
    const fragment = `
      precision highp float;
      varying vec3 v_colour;
      varying float v_alpha;
      void main() {
        vec2 point = gl_PointCoord * 2.0 - 1.0;
        float distanceToCentre = dot(point, point);
        if (distanceToCentre > 1.0) discard;
        float alpha = (1.0 - smoothstep(0.62, 1.0, distanceToCentre)) * v_alpha;
        gl_FragColor = vec4(v_colour * alpha, alpha);
      }
    `;

    let program;
    try {
      program = createProgram(gl, vertex, fragment);
    } catch (error) {
      canvas.dataset.webglStatus = 'shader-failed';
      canvas.dataset.webglError = error.message;
      return;
    }

    const compact = innerWidth <= 700 || matchMedia('(pointer: coarse)').matches;
    const pointData = buildPointData(compact, Number(seed));
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, pointData.data, gl.STATIC_DRAW);
    gl.useProgram(program);
    const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
    const bindAttribute = (name, size, offset) => {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * Float32Array.BYTES_PER_ELEMENT);
    };
    bindAttribute('a_position', 2, 0);
    bindAttribute('a_seed', 1, 2);
    bindAttribute('a_edge', 1, 3);
    bindAttribute('a_tone', 1, 4);
    const uniforms = {
      pointer: gl.getUniformLocation(program, 'u_pointer'),
      time: gl.getUniformLocation(program, 'u_time'),
      dpr: gl.getUniformLocation(program, 'u_dpr'),
      compact: gl.getUniformLocation(program, 'u_compact'),
      debug: gl.getUniformLocation(program, 'u_debug')
    };

    const debugName = new URLSearchParams(location.search).get('debug');
    const debugMode = debugName === 'logo-edges' ? 1 : debugName === 'logo-depth' ? 2 : 0;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let previousTime = performance.now();
    let samples = 0;
    let elapsed = 0;
    let active = true;

    const resize = () => {
      const sectionRect = section.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.style.left = `${imageRect.left - sectionRect.left}px`;
      canvas.style.top = `${imageRect.top - sectionRect.top}px`;
      canvas.style.width = `${imageRect.width}px`;
      canvas.style.height = `${imageRect.height}px`;
      canvas.width = Math.max(1, Math.round(imageRect.width * dpr));
      canvas.height = Math.max(1, Math.round(imageRect.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uniforms.dpr, dpr);
      canvas.dataset.renderSize = `${canvas.width}x${canvas.height}`;
    };
    const updateActive = () => {
      const rect = section.getBoundingClientRect();
      active = rect.bottom > -80 && rect.top < innerHeight + 80;
      canvas.dataset.active = String(active);
    };
    const move = (event) => {
      pointerX = event.clientX / Math.max(innerWidth, 1);
      pointerY = 1 - event.clientY / Math.max(innerHeight, 1);
    };
    const render = (time) => {
      const delta = Math.min(50, time - previousTime);
      previousTime = time;
      if (active && !document.hidden) {
        gl.useProgram(program);
        gl.uniform2f(uniforms.pointer, reducedMotion ? 0.5 : pointerX, reducedMotion ? 0.5 : pointerY);
        gl.uniform1f(uniforms.time, reducedMotion ? 0 : time * 0.001);
        gl.uniform1f(uniforms.compact, compact ? 1 : 0);
        gl.uniform1i(uniforms.debug, debugMode);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.POINTS, 0, pointData.count);
        samples += 1;
        elapsed += delta;
        if (elapsed >= 1200) {
          canvas.dataset.fps = (samples * 1000 / elapsed).toFixed(1);
          samples = 0;
          elapsed = 0;
        }
      }
      requestAnimationFrame(render);
    };

    addEventListener('resize', resize, { passive: true });
    addEventListener('scroll', updateActive, { passive: true });
    addEventListener('pointermove', move, { passive: true });
    new ResizeObserver(resize).observe(section);
    canvas.dataset.pointCount = String(pointData.count);
    canvas.dataset.edgePointCount = String(pointData.edgeCount);
    canvas.dataset.sourceSpacing = String(pointData.spacing);
    canvas.dataset.debugModes = 'final|logo-edges|logo-depth';
    canvas.dataset.webglStatus = 'rendering';
    resize();
    updateActive();
    requestAnimationFrame(render);
  };
})();
