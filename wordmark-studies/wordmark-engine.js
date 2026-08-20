(() => {
  const SOURCE_WIDTH = 1204;
  const SOURCE_HEIGHT = 488;
  const TAU = Math.PI * 2;

  const VARIANTS = Object.freeze({
    'prismatic-edge': Object.freeze({ mode: 0, label: 'Prismatic Edge', maskOpacity: 0 }),
    'orbital-bloom': Object.freeze({ mode: 1, label: 'Orbital Bloom', maskOpacity: 0 }),
    'signal-scan': Object.freeze({ mode: 2, label: 'Signal Scan', maskOpacity: 0 }),
    'deep-field': Object.freeze({ mode: 3, label: 'Deep Field', maskOpacity: 0 }),
    'living-weave': Object.freeze({ mode: 4, label: 'Living Weave', maskOpacity: 0 })
  });

  const LETTER_REGIONS = Object.freeze([
    [18, 43, 175, 232], [166, 44, 347, 232], [343, 45, 516, 230],
    [514, 44, 696, 230], [698, 45, 862, 231], [861, 43, 1034, 230],
    [1031, 44, 1177, 230], [151, 247, 317, 459], [305, 247, 518, 453],
    [511, 247, 697, 453], [697, 247, 884, 453], [881, 247, 1064, 453]
  ]);

  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const smoothstep = (edge0, edge1, value) => {
    const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
    return t * t * (3 - 2 * t);
  };
  const hash = (x, y, seed) => {
    let value = Math.imul(x + 374761393, y + 668265263) ^ Math.imul(seed + 1442695041, 1274126177);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  };

  const circle = (x, y, cx, cy, radiusX, radiusY = radiusX) => {
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
  const roundedBottom = (x, y, left, top, right, shoulderY, bottomY) => {
    const radiusX = (right - left) * 0.5;
    const radiusY = bottomY - shoulderY;
    const centreX = (left + right) * 0.5;
    return rectangle(x, y, left, top, right, shoulderY)
      || (y >= shoulderY && circle(x, y, centreX, shoulderY, radiusX, radiusY));
  };
  const uShape = (x, y, outer, inner) => {
    if (!roundedBottom(x, y, ...outer)) return false;
    const [left, top, right, shoulderY, bottomY] = inner;
    return !roundedBottom(x, y, left, top, right, shoulderY, bottomY);
  };

  // Pixel coordinates traced against commune-wordmark-cropped.jpeg at its
  // native 1204 x 488 resolution. These are the banner's original silhouettes,
  // not a replacement typeface or a font approximation.
  const shapeIndexAt = (x, y) => {
    if (circle(x, y, 105, 140, 80, 85)
      && !polygon(x, y, [[102, 140], [190, 47], [190, 233]])) return 0;
    if (circle(x, y, 260, 139, 78, 84)) return 1;
    if (polygon(x, y, [[353, 56], [431, 137], [508, 56], [508, 221], [353, 221]])) return 2;
    if (polygon(x, y, [[530, 56], [608, 137], [685, 56], [685, 221], [530, 221]])) return 3;
    if (uShape(x, y, [708, 58, 854, 145, 221], [773, 54, 800, 142, 172])) return 4;
    if (rectangle(x, y, 873, 58, 1018, 221)) return 5;
    if (rectangle(x, y, 1043, 58, 1082, 221)
      || polygon(x, y, [[1081, 58], [1149, 58], [1081, 139]])
      || polygon(x, y, [[1081, 139], [1149, 139], [1081, 221]])) return 6;
    const sSplit = -x + 569;
    if ((circle(x, y, 237, 331, 75, 73) && y < sSplit - 3)
      || (circle(x, y, 230, 386, 68, 65) && y > sSplit + 3)) return 7;
    if (circle(x, y, 410, 351, 93, 93)) return 8;
    if (uShape(x, y, [520, 259, 684, 350, 444], [573, 254, 632, 344, 386])) return 9;
    if (rectangle(x, y, 708, 259, 870, 444)) return 10;
    if (rectangle(x, y, 891, 259, 958, 444) || circle(x, y, 958, 351, 84, 93)) return 11;
    return -1;
  };

  const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new Error(`Wordmark source failed to load: ${src}`)), { once: true });
    image.src = src;
  });

  const createShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Wordmark study shader failed');
    }
    return shader;
  };

  const createProgram = (gl, vertexSource, fragmentSource) => {
    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Wordmark study link failed');
    }
    return program;
  };

  const buildLetterMask = (image, spacing, seed) => {
    const source = document.createElement('canvas');
    source.width = SOURCE_WIDTH;
    source.height = SOURCE_HEIGHT;
    const context = source.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, SOURCE_WIDTH, SOURCE_HEIGHT);
    const pixels = context.getImageData(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT);
    const strength = new Float32Array(SOURCE_WIDTH * SOURCE_HEIGHT);
    const region = new Uint8Array(SOURCE_WIDTH * SOURCE_HEIGHT);

    for (const [x0, y0, x1, y1] of LETTER_REGIONS) {
      for (let y = y0; y <= y1; y += 1) {
        region.fill(1, y * SOURCE_WIDTH + x0, y * SOURCE_WIDTH + x1 + 1);
      }
    }

    for (let index = 0; index < strength.length; index += 1) {
      if (!region[index] || shapeIndexAt(index % SOURCE_WIDTH, Math.floor(index / SOURCE_WIDTH)) < 0) continue;
      const pixel = index * 4;
      const red = pixels.data[pixel] / 255;
      const green = pixels.data[pixel + 1] / 255;
      const blue = pixels.data[pixel + 2] / 255;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const saturation = maximum > 0.001 ? (maximum - minimum) / maximum : 0;
      const luminance = red * 0.24 + green * 0.68 + blue * 0.08;
      // Preserve a subtle amount of the source shading as particle density,
      // while the vector-traced silhouette guarantees complete letterforms.
      const pale = 1 - smoothstep(0.17, 0.34, saturation);
      const warmNeutral = smoothstep(-0.025, 0.085, red - blue);
      const creamBalance = smoothstep(0.68, 0.91, blue / Math.max(0.001, green));
      const light = smoothstep(0.34, 0.72, luminance);
      const sourceTone = clamp(light * pale * warmNeutral * creamBalance);
      strength[index] = 0.78 + sourceTone * 0.22;
    }

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = SOURCE_WIDTH;
    maskCanvas.height = SOURCE_HEIGHT;
    const maskContext = maskCanvas.getContext('2d');
    const maskImage = maskContext.createImageData(SOURCE_WIDTH, SOURCE_HEIGHT);
    for (let y = 0; y < SOURCE_HEIGHT; y += 1) {
      for (let x = 0; x < SOURCE_WIDTH; x += 1) {
        const index = y * SOURCE_WIDTH + x;
        const amount = smoothstep(0.08, 0.7, strength[index]);
        if (amount <= 0.002) continue;
        const wave = 0.5 + 0.5 * Math.sin(x * 0.013 + y * 0.021);
        const pixel = index * 4;
        maskImage.data[pixel] = Math.round(103 + wave * 88);
        maskImage.data[pixel + 1] = Math.round(72 + wave * 183);
        maskImage.data[pixel + 2] = Math.round(255 - wave * 96);
        maskImage.data[pixel + 3] = Math.round(amount * 255);
      }
    }
    maskContext.putImageData(maskImage, 0, 0);

    const values = [];
    let edgeCount = 0;
    const neighbour = Math.max(2, spacing * 2);
    for (let y = spacing; y < SOURCE_HEIGHT - spacing; y += spacing) {
      for (let x = spacing; x < SOURCE_WIDTH - spacing; x += spacing) {
        const index = y * SOURCE_WIDTH + x;
        const amount = strength[index];
        if (amount < 0.08 || hash(x, y, seed) > clamp(amount * 1.18)) continue;
        const left = strength[index - neighbour];
        const right = strength[index + neighbour];
        const up = strength[index - neighbour * SOURCE_WIDTH];
        const down = strength[index + neighbour * SOURCE_WIDTH];
        const minimumNeighbour = Math.min(left, right, up, down);
        const edge = amount > 0.22 && minimumNeighbour < amount * 0.48 ? 1 : 0;
        let normalX = left - right;
        let normalY = down - up;
        const normalLength = Math.hypot(normalX, normalY) || 1;
        normalX /= normalLength;
        normalY /= normalLength;
        edgeCount += edge;
        values.push(
          x / SOURCE_WIDTH * 2 - 1,
          1 - y / SOURCE_HEIGHT * 2,
          edge,
          hash(x + 91, y + 47, seed),
          amount,
          normalX,
          normalY
        );
      }
    }

    return {
      maskCanvas,
      pointData: new Float32Array(values),
      pointCount: values.length / 7,
      edgeCount,
      spacing
    };
  };

  const create = async ({
    container,
    anchor = container,
    imageSrc,
    variant = 'prismatic-edge',
    seed = 17,
    particleClass = 'wordmark-study-particles',
    maskClass = 'wordmark-study-mask'
  }) => {
    if (!(container instanceof HTMLElement) || !(anchor instanceof HTMLElement)) {
      throw new Error('Wordmark study container missing');
    }
    const preset = VARIANTS[variant] || VARIANTS['prismatic-edge'];
    const params = new URLSearchParams(location.search);
    const fixedTime = Number.parseFloat(params.get('time'));
    const seedOverride = Number.parseFloat(params.get('seed'));
    const resolvedSeed = Number.isFinite(seedOverride) ? seedOverride : seed;
    const debugName = ['edges', 'mask', 'no-post'].includes(params.get('debug')) ? params.get('debug') : 'final';
    const compact = innerWidth <= 700 || matchMedia('(pointer: coarse)').matches;
    const spacing = compact ? 4 : 3;
    const image = await loadImage(imageSrc);
    const geometry = buildLetterMask(image, spacing, Math.floor(resolvedSeed));

    const maskCanvas = geometry.maskCanvas;
    maskCanvas.className = maskClass;
    maskCanvas.dataset.sourceAsset = imageSrc;
    maskCanvas.dataset.maskSource = 'original-banner-vector-trace';
    maskCanvas.dataset.visibleTreatment = 'debug-only';
    maskCanvas.setAttribute('aria-hidden', 'true');
    maskCanvas.style.opacity = debugName === 'no-post' ? '0' : debugName === 'mask' ? '1' : String(preset.maskOpacity);
    container.append(maskCanvas);

    const canvas = document.createElement('canvas');
    canvas.className = particleClass;
    canvas.dataset.variant = variant;
    canvas.dataset.variantLabel = preset.label;
    canvas.dataset.sourceAsset = imageSrc;
    canvas.dataset.sourceGeometry = 'original-banner-vector-trace';
    canvas.dataset.palette = 'website-violet|acid-green|mint|pearl';
    canvas.dataset.pointCount = String(geometry.pointCount);
    canvas.dataset.edgePointCount = String(geometry.edgeCount);
    canvas.dataset.sourceSpacing = String(spacing);
    canvas.dataset.seed = String(resolvedSeed);
    canvas.dataset.debugMode = debugName;
    canvas.dataset.debugModes = 'final|edges|mask|no-post';
    canvas.dataset.renderMode = 'single-draw-webgl-points';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.opacity = debugName === 'mask' ? '0' : '1';
    container.append(canvas);

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance'
    });
    if (!gl) {
      canvas.dataset.webglStatus = 'unavailable';
      return { canvas, maskCanvas };
    }

    const vertexSource = `
      precision highp float;
      attribute vec2 a_position;
      attribute float a_edge;
      attribute float a_random;
      attribute float a_strength;
      attribute vec2 a_normal;
      uniform float u_time;
      uniform vec2 u_pointer;
      uniform float u_dpr;
      uniform int u_mode;
      uniform int u_debug;
      varying vec3 v_colour;
      varying float v_alpha;
      varying float v_edge;
      varying float v_mode;

      void main() {
        vec2 p = a_position;
        float pulse = 0.5 + 0.5 * sin(u_time * 0.82 + a_random * 18.0 + p.x * 3.0);
        float depth = 0.14 + a_random * 0.86;
        float size = mix(1.15, 2.6, a_strength);
        vec3 violet = vec3(0.40, 0.24, 1.0);
        vec3 purple = vec3(0.73, 0.24, 1.0);
        vec3 acid = vec3(0.83, 1.0, 0.49);
        vec3 mint = vec3(0.34, 1.0, 0.72);
        vec3 colour = mix(violet, purple, 0.5 + 0.5 * sin(p.x * 5.0 + a_random * 4.0));

        if (u_mode == 0) {
          p += (1.0 - a_edge) * vec2(sin(u_time * 0.28 + a_random * 11.0), cos(u_time * 0.24 + a_random * 9.0)) * 0.0024;
          size *= mix(0.9, 1.55, a_edge);
          colour = mix(colour, acid, a_edge * (0.72 + pulse * 0.28));
        } else if (u_mode == 1) {
          float release = a_edge * (0.007 + pulse * 0.024);
          p += a_normal * release;
          p += vec2(-a_normal.y, a_normal.x) * a_edge * sin(u_time * 0.65 + a_random * 22.0) * 0.006;
          size *= mix(0.72, 2.25, a_edge * pulse);
          colour = mix(colour, mix(acid, mint, pulse), a_edge);
        } else if (u_mode == 2) {
          float scan = 0.5 + 0.5 * sin((p.y * 0.5 + 0.5) * 82.0 - u_time * 4.2);
          float glitchGate = smoothstep(0.92, 1.0, sin(p.y * 46.0 - u_time * 2.1) * 0.5 + 0.5);
          p.x += (a_random - 0.5) * glitchGate * 0.032;
          p.x += sin(p.y * 34.0 + u_time * 1.2) * 0.0025;
          size *= 0.78 + scan * 1.35;
          colour = mix(violet, acid, scan);
        } else if (u_mode == 3) {
          float perspective = mix(0.985, 1.035, depth);
          p *= perspective;
          p += u_pointer * (depth - 0.5) * 0.052;
          p += vec2(sin(u_time * 0.24 + a_random * 12.0), cos(u_time * 0.19 + a_random * 10.0)) * depth * 0.003;
          size *= mix(0.62, 2.15, depth);
          colour = mix(violet, mix(acid, mint, pulse), depth);
        } else {
          float warp = sin(p.x * 52.0 + u_time * 0.62) * cos(p.y * 46.0 - u_time * 0.48);
          p += vec2(0.0, warp * 0.0045 * (1.0 - a_edge));
          p += vec2(sin(p.y * 68.0 - u_time * 0.4), 0.0) * 0.002;
          size *= mix(0.78, 1.32, pulse);
          colour = mix(purple, acid, step(0.5, fract((p.x + p.y) * 22.0 + a_random)));
        }

        if (u_debug == 1) colour = mix(vec3(0.18, 0.04, 0.28), acid, a_edge);
        v_colour = colour;
        v_alpha = mix(0.36, 0.98, a_strength) * mix(0.76, 1.0, a_edge);
        v_edge = a_edge;
        v_mode = float(u_mode);
        gl_PointSize = clamp(size * u_dpr, 1.0, 9.0 * u_dpr);
        gl_Position = vec4(p, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision highp float;
      varying vec3 v_colour;
      varying float v_alpha;
      varying float v_edge;
      varying float v_mode;

      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float radial = length(q) * 2.0;
        float alpha = 1.0 - smoothstep(0.64, 1.0, radial);
        if (v_mode > 1.5 && v_mode < 2.5) {
          alpha = 1.0 - smoothstep(0.58, 0.98, max(abs(q.x), abs(q.y)) * 2.0);
        } else if (v_mode > 3.5) {
          float diamond = (abs(q.x) + abs(q.y)) * 2.0;
          alpha = 1.0 - smoothstep(0.62, 1.0, diamond);
        } else if (v_mode > 0.5 && v_mode < 1.5 && v_edge > 0.5) {
          float ring = abs(radial - 0.58);
          alpha = 1.0 - smoothstep(0.13, 0.34, ring);
        }
        if (alpha <= 0.01) discard;
        gl_FragColor = vec4(v_colour, alpha * v_alpha);
      }
    `;

    let program;
    try {
      program = createProgram(gl, vertexSource, fragmentSource);
    } catch (error) {
      canvas.dataset.webglStatus = 'shader-failed';
      canvas.dataset.webglError = error.message;
      throw error;
    }

    const stride = 7 * Float32Array.BYTES_PER_ELEMENT;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.pointData, gl.STATIC_DRAW);
    gl.useProgram(program);
    const bindAttribute = (name, size, offset) => {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * Float32Array.BYTES_PER_ELEMENT);
    };
    bindAttribute('a_position', 2, 0);
    bindAttribute('a_edge', 1, 2);
    bindAttribute('a_random', 1, 3);
    bindAttribute('a_strength', 1, 4);
    bindAttribute('a_normal', 2, 5);

    const uniforms = {
      time: gl.getUniformLocation(program, 'u_time'),
      pointer: gl.getUniformLocation(program, 'u_pointer'),
      dpr: gl.getUniformLocation(program, 'u_dpr'),
      mode: gl.getUniformLocation(program, 'u_mode'),
      debug: gl.getUniformLocation(program, 'u_debug')
    };
    let pointerX = 0;
    let pointerY = 0;
    let active = true;
    let sampleFrames = 0;
    let sampleTime = 0;
    let previous = performance.now();

    const syncBounds = () => {
      const containerRect = container.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const left = anchorRect.left - containerRect.left;
      const top = anchorRect.top - containerRect.top;
      for (const layer of [maskCanvas, canvas]) {
        layer.style.left = `${left}px`;
        layer.style.top = `${top}px`;
        layer.style.width = `${anchorRect.width}px`;
        layer.style.height = `${anchorRect.height}px`;
      }
      const dpr = Math.min(devicePixelRatio || 1, compact ? 1.35 : 1.65);
      canvas.width = Math.max(1, Math.round(anchorRect.width * dpr));
      canvas.height = Math.max(1, Math.round(anchorRect.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uniforms.dpr, dpr);
      canvas.dataset.renderSize = `${canvas.width}x${canvas.height}`;
      canvas.dataset.dpr = dpr.toFixed(2);
    };

    const move = (event) => {
      pointerX = (event.clientX / Math.max(innerWidth, 1) - 0.5) * 2;
      pointerY = (0.5 - event.clientY / Math.max(innerHeight, 1)) * 2;
    };
    const observer = new IntersectionObserver(([entry]) => {
      active = entry.isIntersecting;
      canvas.dataset.active = String(active);
    }, { rootMargin: '20% 0px' });
    observer.observe(container);
    const resizeObserver = new ResizeObserver(syncBounds);
    resizeObserver.observe(anchor);
    addEventListener('resize', syncBounds, { passive: true });
    addEventListener('pointermove', move, { passive: true });
    syncBounds();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    canvas.dataset.webglStatus = 'rendering';
    const render = (time) => {
      const delta = Math.min(50, time - previous);
      previous = time;
      if (active && !document.hidden) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.uniform1f(uniforms.time, Number.isFinite(fixedTime) ? fixedTime : time * 0.001);
        gl.uniform2f(uniforms.pointer, pointerX, pointerY);
        gl.uniform1i(uniforms.mode, preset.mode);
        gl.uniform1i(uniforms.debug, debugName === 'edges' ? 1 : 0);
        gl.drawArrays(gl.POINTS, 0, geometry.pointCount);
        sampleFrames += 1;
        sampleTime += delta;
        if (sampleTime >= 1200) {
          canvas.dataset.fps = (sampleFrames * 1000 / sampleTime).toFixed(1);
          sampleFrames = 0;
          sampleTime = 0;
        }
      }
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
    return { canvas, maskCanvas, preset, geometry };
  };

  window.CommuneWordmarkParticles = Object.freeze({ create, variants: VARIANTS });
})();
