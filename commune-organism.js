(() => {
  const canvas = document.querySelector('[data-commune-organism]');
  const logo = document.querySelector('[data-particle-logo]');
  const venue = document.querySelector('[data-particle-venue]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (
    !(canvas instanceof HTMLCanvasElement)
    || !(logo instanceof HTMLImageElement)
    || !(venue instanceof HTMLImageElement)
    || reducedMotion.matches
  ) return;

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    powerPreference: 'high-performance',
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) {
    canvas.dataset.webglStatus = 'unavailable';
    return;
  }

  const vertexShaderSource = `
    precision highp float;

    attribute vec2 a_uv;
    attribute vec3 a_colour;
    attribute float a_seed;
    attribute float a_anchor;

    uniform vec2 u_resolution;
    uniform vec4 u_rect;
    uniform vec2 u_pointer;
    uniform vec2 u_pointer_velocity;
    uniform float u_pointer_active;
    uniform float u_pointer_down;
    uniform float u_time;
    uniform float u_morph;
    uniform float u_mode;
    uniform float u_dpr;

    varying vec3 v_colour;
    varying float v_alpha;

    float hash(float value) {
      return fract(sin(value * 91.733) * 43758.5453);
    }

    void main() {
      vec2 base = u_rect.xy + a_uv * u_rect.zw;
      float freedom = pow(max(0.0, 1.0 - a_anchor), 1.18);
      float pulse = 0.5 + 0.5 * sin(
        u_time * 0.72
        + a_seed * 31.0
        + a_uv.x * 8.0
        + a_uv.y * 5.0
      );
      vec2 position = base;
      float perspective = 1.0;
      float organism_glow = 0.0;

      if (u_mode > 0.5) {
        float floor_presence = smoothstep(0.34, 0.96, a_uv.y);
        perspective = mix(0.28, 1.0, smoothstep(0.35, 1.0, a_uv.y));
        float anatomy = floor(a_seed * 6.0);
        float anatomy_t = hash(a_seed * 43.0 + 2.0);
        float orbit_seed = hash(a_seed * 71.0 + 5.0);
        float sway = sin(u_time * 0.48) * 0.036;
        float turn = sin(u_time * 0.34 + 0.8);
        vec2 centre_uv = vec2(0.5 + sway, 0.71);
        vec2 dancer_uv = centre_uv;

        if (anatomy < 1.0) {
          float angle = anatomy_t * 6.28318 + u_time * 0.34;
          dancer_uv = vec2(
            centre_uv.x + cos(angle) * (0.024 + orbit_seed * 0.014),
            0.575 + sin(angle) * (0.022 + orbit_seed * 0.012)
          );
        } else if (anatomy < 3.0) {
          float side = anatomy < 2.0 ? -1.0 : 1.0;
          float reach = anatomy_t;
          float lift = 0.055
            + sin(u_time * 0.52 + side * 1.4) * 0.035;
          dancer_uv = vec2(
            centre_uv.x
              + side * (0.032 + reach * (0.13 + turn * side * 0.035)),
            0.655
              - sin(reach * 3.14159) * lift
              + reach * side * turn * 0.024
          );
        } else if (anatomy < 4.0) {
          float torso_y = anatomy_t;
          dancer_uv = vec2(
            centre_uv.x
              + sin(u_time * 0.58 + torso_y * 5.4) * (0.012 + torso_y * 0.02),
            0.625 + torso_y * 0.16
          );
        } else {
          float side = anatomy < 5.0 ? -1.0 : 1.0;
          float stride = anatomy_t;
          dancer_uv = vec2(
            centre_uv.x
              + side * (
                0.016
                + stride * (0.052 + abs(turn) * 0.028)
              ),
            0.765 + stride * 0.16
          );
        }

        float orbit_angle = (
          a_seed * 83.0
          + u_time * (0.31 + orbit_seed * 0.56)
        );
        float orbit_radius = 0.003 + orbit_seed * 0.013;
        dancer_uv += vec2(
          cos(orbit_angle) * orbit_radius,
          sin(orbit_angle) * orbit_radius * 1.45
        );
        vec2 organism = u_rect.xy + dancer_uv * u_rect.zw;
        float dancer_mix = (
          u_morph
          * freedom
          * (0.2 + floor_presence * 0.74)
        );
        position = mix(base, organism, dancer_mix * 0.86);
        organism_glow = dancer_mix;

        float architectural_breath = (
          sin(u_time * 0.38 + a_uv.y * 18.0 + a_seed * 8.0)
          + cos(u_time * 0.23 + a_uv.x * 13.0 - a_seed * 5.0)
        );
        position.x += architectural_breath
          * u_morph
          * (0.8 + perspective * 2.8)
          * (0.22 + freedom * 0.78);
        position.y += cos(
          u_time * 0.32
          + a_uv.x * 15.0
          + a_seed * 11.0
        )
          * u_morph
          * (0.5 + perspective * 1.7)
          * (0.18 + freedom * 0.82);
      } else {
        vec2 ribbon_uv = a_uv;
        float field = (
          sin(u_time * 0.36 + a_uv.y * 16.0 + a_seed * 12.0)
          + cos(u_time * 0.25 + a_uv.x * 12.0 - a_seed * 9.0)
        );
        ribbon_uv.x += field * (0.005 + freedom * 0.024) * u_morph;
        ribbon_uv.y += sin(
          u_time * 0.31
          + a_uv.x * 19.0
          + a_seed * 17.0
        ) * (0.003 + freedom * 0.016) * u_morph;
        vec2 ribbon = u_rect.xy + ribbon_uv * u_rect.zw;
        position = mix(base, ribbon, 0.34 + freedom * 0.66);
      }

      float fluid_strength = u_morph
        * mix(1.35, 2.8, u_mode)
        * (0.28 + freedom * 0.72);
      vec2 fluid_field = vec2(
        sin(position.y * 0.018 + u_time * 0.48 + a_seed * 4.0)
          + cos((position.x + position.y) * 0.009 - u_time * 0.31),
        cos(position.x * 0.015 - u_time * 0.42 + a_seed * 3.0)
          - sin((position.x - position.y) * 0.011 + u_time * 0.37)
      );
      position += fluid_field * fluid_strength;

      vec2 pointer_delta = position - u_pointer;
      float pointer_distance = length(pointer_delta) + 0.001;
      float field_radius = mix(138.0, 220.0, u_mode);
      float gravity = (
        1.0 - smoothstep(18.0, field_radius, pointer_distance)
      ) * u_pointer_active;
      vec2 radial = pointer_delta / pointer_distance;
      vec2 tangent = vec2(-radial.y, radial.x);
      float motion = min(1.0, length(u_pointer_velocity) / 54.0);
      float gravity_strength = mix(18.0, 56.0, u_pointer_down);
      position -= radial
        * gravity
        * gravity_strength
        * (0.42 + freedom * 0.58);
      position += tangent
        * gravity
        * (8.0 + motion * 34.0)
        * sin(u_time * 1.8 + a_seed * 24.0);

      vec2 clip = vec2(
        position.x / u_resolution.x * 2.0 - 1.0,
        1.0 - position.y / u_resolution.y * 2.0
      );
      gl_Position = vec4(clip, 0.0, 1.0);

      float base_size = mix(1.02, 1.58, perspective);
      gl_PointSize = u_dpr
        * base_size
        * (1.0 + u_morph * 0.34 + gravity * 0.46);

      float edge_fade = smoothstep(0.0, 0.055, a_uv.x)
        * smoothstep(0.0, 0.055, 1.0 - a_uv.x)
        * smoothstep(0.0, 0.045, a_uv.y)
        * smoothstep(0.0, 0.045, 1.0 - a_uv.y);
      float particle_alpha = mix(0.2, 0.92, u_morph);
      particle_alpha += a_anchor * 0.12 + gravity * 0.12 + organism_glow * 0.08;
      v_alpha = clamp(particle_alpha * edge_fade, 0.0, 0.98);
      vec3 lifted_colour = mix(
        a_colour,
        sqrt(max(a_colour, vec3(0.004))),
        0.32 + u_morph * 0.18
      );
      v_colour = lifted_colour * (
        0.98
        + pulse * 0.18
        + u_morph * 0.16
        + gravity * 0.14
        + organism_glow * 0.24
      );
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    varying vec3 v_colour;
    varying float v_alpha;

    void main() {
      vec2 point = gl_PointCoord * 2.0 - 1.0;
      float radius = dot(point, point);
      if (radius > 1.0) discard;
      float softness = 1.0 - smoothstep(0.16, 1.0, radius);
      gl_FragColor = vec4(v_colour, v_alpha * softness);
    }
  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      canvas.dataset.webglError = gl.getShaderInfoLog(shader) || 'shader-compile';
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) {
    canvas.dataset.webglStatus = 'shader-failed';
    return;
  }

  const program = gl.createProgram();
  if (!program) return;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    canvas.dataset.webglStatus = 'link-failed';
    canvas.dataset.webglError = gl.getProgramInfoLog(program) || 'program-link';
    gl.deleteProgram(program);
    return;
  }

  const attributes = {
    uv: gl.getAttribLocation(program, 'a_uv'),
    colour: gl.getAttribLocation(program, 'a_colour'),
    seed: gl.getAttribLocation(program, 'a_seed'),
    anchor: gl.getAttribLocation(program, 'a_anchor'),
  };
  const uniforms = {
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    rect: gl.getUniformLocation(program, 'u_rect'),
    pointer: gl.getUniformLocation(program, 'u_pointer'),
    pointerVelocity: gl.getUniformLocation(program, 'u_pointer_velocity'),
    pointerActive: gl.getUniformLocation(program, 'u_pointer_active'),
    pointerDown: gl.getUniformLocation(program, 'u_pointer_down'),
    time: gl.getUniformLocation(program, 'u_time'),
    morph: gl.getUniformLocation(program, 'u_morph'),
    mode: gl.getUniformLocation(program, 'u_mode'),
    dpr: gl.getUniformLocation(program, 'u_dpr'),
  };

  const regions = [
    { image: logo, mode: 0, name: 'wordmark', buffers: [], count: 0 },
    { image: venue, mode: 1, name: 'hall', buffers: [], count: 0 },
  ];
  const pointer = {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.4,
    velocityX: 0,
    velocityY: 0,
    active: 0,
    down: false,
    lastMove: 0,
  };
  const analysisCanvas = document.createElement('canvas');
  const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true });
  if (!analysisContext) {
    canvas.dataset.webglStatus = 'analysis-unavailable';
    return;
  }

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = 1;
  let frame = 0;
  let rebuildTimer = 0;
  let particleScale = 1;
  let performanceFrames = 0;
  let performanceStarted = performance.now();
  let degraded = false;
  const cycleSeconds = 14;
  const particleHoldSeconds = 5.6;

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const smoothstep = (minimum, maximum, value) => {
    const normalized = clamp((value - minimum) / Math.max(maximum - minimum, 0.0001), 0, 1);
    return normalized * normalized * (3 - 2 * normalized);
  };
  const hash = (x, y) => {
    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  function targetCount(mode) {
    const compact = width < 700 || window.matchMedia('(pointer: coarse)').matches;
    const cores = navigator.hardwareConcurrency || 6;
    const memory = navigator.deviceMemory || 6;
    const constrained = cores <= 4 || memory <= 4;
    if (compact) return Math.round((mode ? 110000 : 55000) * particleScale);
    if (constrained) return Math.round((mode ? 180000 : 80000) * particleScale);
    return Math.round((mode ? 300000 : 130000) * particleScale);
  }

  function objectFitCoverCrop(image, targetAspect) {
    const sourceAspect = image.naturalWidth / image.naturalHeight;
    if (sourceAspect > targetAspect) {
      const sourceWidth = image.naturalHeight * targetAspect;
      return {
        x: (image.naturalWidth - sourceWidth) * 0.5,
        y: 0,
        width: sourceWidth,
        height: image.naturalHeight,
      };
    }
    const sourceHeight = image.naturalWidth / targetAspect;
    return {
      x: 0,
      y: (image.naturalHeight - sourceHeight) * 0.5,
      width: image.naturalWidth,
      height: sourceHeight,
    };
  }

  function deleteRegionBuffers(region) {
    region.buffers.forEach((buffer) => gl.deleteBuffer(buffer));
    region.buffers.length = 0;
  }

  function createBuffer(data) {
    const buffer = gl.createBuffer();
    if (!buffer) return null;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
  }

  function buildRegion(region) {
    const { image, mode } = region;
    if (!image.complete || !image.naturalWidth || !image.naturalHeight) return;
    const rect = image.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return;

    const aspect = rect.width / rect.height;
    const countGoal = targetCount(mode);
    const gridWidth = Math.max(2, Math.round(Math.sqrt(countGoal * aspect)));
    const gridHeight = Math.max(2, Math.round(gridWidth / aspect));
    analysisCanvas.width = gridWidth;
    analysisCanvas.height = gridHeight;
    analysisContext.clearRect(0, 0, gridWidth, gridHeight);
    const crop = objectFitCoverCrop(image, aspect);
    analysisContext.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      gridWidth,
      gridHeight,
    );
    const pixels = analysisContext.getImageData(0, 0, gridWidth, gridHeight).data;
    const count = gridWidth * gridHeight;
    const uv = new Float32Array(count * 2);
    const colour = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const anchor = new Float32Array(count);
    const luminanceAt = (x, y) => {
      const safeX = clamp(x, 0, gridWidth - 1);
      const safeY = clamp(y, 0, gridHeight - 1);
      const offset = (safeY * gridWidth + safeX) * 4;
      return pixels[offset] * 0.299
        + pixels[offset + 1] * 0.587
        + pixels[offset + 2] * 0.114;
    };

    let index = 0;
    for (let y = 0; y < gridHeight; y += 1) {
      for (let x = 0; x < gridWidth; x += 1) {
        const pixelOffset = (y * gridWidth + x) * 4;
        const brightness = luminanceAt(x, y);
        const gradientX = Math.abs(luminanceAt(x + 1, y) - luminanceAt(x - 1, y));
        const gradientY = Math.abs(luminanceAt(x, y + 1) - luminanceAt(x, y - 1));
        const edge = clamp((gradientX + gradientY) / 96, 0, 1);
        const structure = mode
          ? clamp(Math.pow(edge, 0.68) * 0.92 + (brightness > 186 ? 0.08 : 0), 0, 1)
          : clamp(edge * 0.72 + smoothstep(132, 236, brightness) * 0.72, 0, 1);

        uv[index * 2] = (x + 0.5) / gridWidth;
        uv[index * 2 + 1] = (y + 0.5) / gridHeight;
        colour[index * 3] = pixels[pixelOffset] / 255;
        colour[index * 3 + 1] = pixels[pixelOffset + 1] / 255;
        colour[index * 3 + 2] = pixels[pixelOffset + 2] / 255;
        seed[index] = hash(x + mode * 997, y + mode * 577);
        anchor[index] = structure;
        index += 1;
      }
    }

    deleteRegionBuffers(region);
    const nextBuffers = [
      createBuffer(uv),
      createBuffer(colour),
      createBuffer(seed),
      createBuffer(anchor),
    ];
    if (nextBuffers.some((buffer) => !buffer)) {
      nextBuffers.forEach((buffer) => {
        if (buffer) gl.deleteBuffer(buffer);
      });
      region.count = 0;
      canvas.dataset.webglStatus = 'buffer-allocation-failed';
      return;
    }
    [
      region.uvBuffer,
      region.colourBuffer,
      region.seedBuffer,
      region.anchorBuffer,
    ] = nextBuffers;
    region.buffers.push(...nextBuffers);
    region.count = count;
    region.gridWidth = gridWidth;
    region.gridHeight = gridHeight;
    canvas.dataset[`${region.name}Particles`] = String(count);
    canvas.dataset[`${region.name}Grid`] = `${gridWidth}x${gridHeight}`;
  }

  function rebuildRegions() {
    const wasReady = canvas.dataset.webglReady === 'true';
    regions.forEach(buildRegion);
    const ready = regions.every((region) => region.count > 1000);
    canvas.dataset.webglReady = String(ready);
    canvas.dataset.webglStatus = ready ? 'rendering' : 'waiting-images';
    document.documentElement.classList.toggle('particle-organism-ready', ready);
    if (ready && !wasReady) {
      performanceFrames = 0;
      performanceStarted = performance.now();
    }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const compact = width < 700 || window.matchMedia('(pointer: coarse)').matches;
    dpr = Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.15);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
    rebuildRegions();
  }

  function bindAttribute(location, buffer, size) {
    if (!buffer || location < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  }

  function renderRegion(region, time, baseMorph) {
    if (!region.count) return;
    const rect = region.image.getBoundingClientRect();
    if (rect.bottom < -80 || rect.top > height + 80) return;
    const insidePointer = pointer.x >= rect.left
      && pointer.x <= rect.right
      && pointer.y >= rect.top
      && pointer.y <= rect.bottom;
    const hoverMorph = insidePointer
      ? pointer.active * (pointer.down ? 0.94 : 0.42)
      : 0;
    const morph = clamp(Math.max(baseMorph, hoverMorph), 0, 1);

    bindAttribute(attributes.uv, region.uvBuffer, 2);
    bindAttribute(attributes.colour, region.colourBuffer, 3);
    bindAttribute(attributes.seed, region.seedBuffer, 1);
    bindAttribute(attributes.anchor, region.anchorBuffer, 1);
    gl.uniform2f(uniforms.resolution, width, height);
    gl.uniform4f(uniforms.rect, rect.left, rect.top, rect.width, rect.height);
    gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
    gl.uniform2f(uniforms.pointerVelocity, pointer.velocityX, pointer.velocityY);
    gl.uniform1f(uniforms.pointerActive, pointer.active);
    gl.uniform1f(uniforms.pointerDown, pointer.down ? 1 : 0);
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.morph, morph);
    gl.uniform1f(uniforms.mode, region.mode);
    gl.uniform1f(uniforms.dpr, dpr);
    gl.drawArrays(gl.POINTS, 0, region.count);
  }

  function animate(now) {
    frame = window.requestAnimationFrame(animate);
    if (document.hidden || canvas.dataset.webglReady !== 'true') return;
    const time = now / 1000;
    if (now - pointer.lastMove > 900 && !pointer.down) pointer.active *= 0.965;
    pointer.velocityX *= 0.84;
    pointer.velocityY *= 0.84;

    const cycle = (time % cycleSeconds) / cycleSeconds;
    let baseMorph = 0;
    if (cycle >= 0.18 && cycle < 0.32) {
      baseMorph = smoothstep(0.18, 0.32, cycle) * 0.925;
    } else if (cycle >= 0.32 && cycle < 0.72) {
      baseMorph = 0.925;
    } else if (cycle >= 0.72 && cycle < 0.86) {
      baseMorph = (1 - smoothstep(0.72, 0.86, cycle)) * 0.925;
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    regions.forEach((region) => renderRegion(region, time, baseMorph));

    performanceFrames += 1;
    if (performanceFrames >= 120) {
      const elapsed = now - performanceStarted;
      const fps = 1000 / (elapsed / performanceFrames);
      canvas.dataset.fps = fps.toFixed(1);
      canvas.dataset.particleScale = particleScale.toFixed(2);
      if (fps < 34 && !degraded) {
        degraded = true;
        particleScale = 0.68;
        canvas.dataset.adaptiveReduction = 'true';
        window.setTimeout(rebuildRegions, 0);
      }
      performanceFrames = 0;
      performanceStarted = now;
    }
  }

  function onPointerMove(event) {
    pointer.velocityX = event.clientX - pointer.x;
    pointer.velocityY = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = 1;
    pointer.lastMove = performance.now();
  }

  function onPointerDown(event) {
    if (!event.isPrimary) return;
    pointer.down = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = 1;
    pointer.lastMove = performance.now();
  }

  function onPointerUp() {
    pointer.down = false;
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  window.addEventListener('resize', () => {
    window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(resize, 180);
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    canvas.dataset.webglReady = 'false';
    canvas.dataset.webglStatus = 'context-lost';
    document.documentElement.classList.remove('particle-organism-ready');
  });

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  canvas.dataset.engine = 'webgl-collective-organism';
  canvas.dataset.imageCycleSeconds = String(cycleSeconds);
  canvas.dataset.particleHoldSeconds = String(particleHoldSeconds);
  canvas.dataset.webglStatus = 'initializing';
  resize();
  if (!logo.complete) logo.addEventListener('load', rebuildRegions, { once: true });
  if (!venue.complete) venue.addEventListener('load', rebuildRegions, { once: true });
  frame = window.requestAnimationFrame(animate);
})();
