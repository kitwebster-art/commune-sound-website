(() => {
  const canvas = document.querySelector('[data-horizon-drift]');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const SPEED = 0.042;
  const FRAME_RATE_CAP = 22;
  const DESKTOP_SCALE = 0.5;
  const MOBILE_SCALE = 0.38;
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    powerPreference: 'low-power',
  });

  if (!gl) {
    canvas.dataset.shaderStatus = 'webgl-unavailable';
    return;
  }

  const vertexSource = `
    attribute vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;

    void main() {
      vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
      vec3 ray = normalize(vec3(uv, 1.12));
      float z = 0.0;
      float distanceField = 0.0;
      vec4 accumulation = vec4(0.0);

      for (int step = 0; step < 72; step++) {
        vec3 p = z * ray;
        float frequency = 2.0;
        for (int fold = 0; fold < 6; fold++) {
          frequency /= 0.9;
          p = p.zxy + sin(p * frequency + frequency + u_time * 0.5) / frequency;
        }
        distanceField = 0.001 + abs(2.0 - mix(z, p.z, 0.4)) / 9.0;
        z += distanceField;
        vec4 phase = vec4(0.0, 1.0, 2.0, 3.0);
        accumulation += (sin(z + float(step) * 0.06 + phase) + 1.0) / distanceField;
      }

      vec3 ribbons = accumulation.rgb / 15000.0;
      ribbons = ribbons / (1.0 + ribbons);
      float light = dot(ribbons, vec3(0.26, 0.5, 0.24));
      vec3 colour = ribbons.bgr * vec3(0.42, 0.68, 0.78) + light * vec3(0.18, 0.08, 0.34);
      float edgeFade = 1.0 - smoothstep(0.68, 1.75, length(uv));
      float alpha = clamp((light - 0.08) * 1.45, 0.0, 0.82) * edgeFade;
      gl_FragColor = vec4(colour * 0.9 * edgeFade, alpha);
    }
  `;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile failed');
    }
    return shader;
  };

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Shader link failed');
    }
  } catch (error) {
    canvas.dataset.shaderStatus = 'compile-failed';
    canvas.dataset.shaderError = error.message;
    return;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.useProgram(program);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const resolution = gl.getUniformLocation(program, 'u_resolution');
  const time = gl.getUniformLocation(program, 'u_time');

  const resize = () => {
    const scale = innerWidth <= 700 ? MOBILE_SCALE : DESKTOP_SCALE;
    canvas.width = Math.max(1, Math.round(innerWidth * scale));
    canvas.height = Math.max(1, Math.round(innerHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolution, canvas.width, canvas.height);
    canvas.dataset.renderScale = scale.toFixed(2);
  };

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frameInterval = 1000 / FRAME_RATE_CAP;
  const startedAt = performance.now();
  let lastFrame = -Infinity;
  const render = now => {
    if (now - lastFrame >= frameInterval) {
      lastFrame = now;
      const elapsed = reducedMotion ? 18 : (now - startedAt) * 0.001 * SPEED;
      gl.uniform1f(time, elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (!reducedMotion) requestAnimationFrame(render);
  };

  addEventListener('resize', resize, { passive: true });
  resize();
  canvas.dataset.shaderStatus = 'rendering';
  canvas.dataset.shaderSource = 'fragcoord-ribbons-lnbg0175-adaptation';
  canvas.dataset.motion = `ambient-${SPEED}`;
  canvas.dataset.frameRateCap = String(FRAME_RATE_CAP);
  render(performance.now());
})();
