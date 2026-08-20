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
    uniform vec2 u_trail_points[24];
    uniform float u_trail_weights[24];
    uniform float u_pointer_active;
    uniform float u_pointer_down;
    uniform float u_time;
    uniform float u_morph;
    uniform float u_mode;
    uniform float u_dpr;
    uniform float u_flock_pass;
    uniform float u_detail;
    uniform float u_trail_count;
    uniform float u_compact;
    uniform float u_cycle_seconds;

    varying vec3 v_colour;
    varying float v_alpha;

    float hash(float value) {
      return fract(sin(value * 91.733) * 43758.5453);
    }

    mat2 rotate_field(float angle) {
      float cosine = cos(angle);
      float sine = sin(angle);
      return mat2(cosine, -sine, sine, cosine);
    }

    vec2 curl_layer(
      vec2 point,
      float frequency,
      float phase,
      float aspect
    ) {
      float wave_x = point.x * frequency + phase;
      float wave_y = point.y * frequency * aspect - phase * 0.73;
      vec2 flow = vec2(
        frequency * aspect * sin(wave_x) * cos(wave_y),
        -frequency * cos(wave_x) * sin(wave_y)
      );
      return flow / max(frequency * aspect, 0.001);
    }

    vec2 fractal_curl(
      vec2 point,
      float time,
      float phase,
      float detail
    ) {
      vec2 slow_point = point + vec2(time * 0.035, -time * 0.024);
      vec2 medium_point = rotate_field(0.67) * point
        + vec2(-time * 0.052, time * 0.041);
      vec2 fine_point = rotate_field(-0.43) * point
        + vec2(time * 0.076, time * 0.058);
      vec2 flow = curl_layer(
        slow_point,
        2.35,
        phase + time * 0.21,
        0.78
      );
      flow += curl_layer(
        medium_point,
        5.4,
        phase * 1.37 - time * 0.29,
        1.16
      ) * 0.52;
      if (detail > 0.72) {
        flow += curl_layer(
          fine_point,
          11.7,
          phase * 1.91 + time * 0.37,
          0.91
        ) * 0.23 * smoothstep(0.72, 0.98, detail);
      }
      return flow / 1.75;
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
      float luminance_wave = clamp(
        0.5
          + sin(
            a_uv.x * 11.0
            - u_time * 0.48
            + sin(a_uv.y * 7.0 + u_time * 0.24) * 1.25
          ) * 0.32
          + cos(
            (a_uv.x + a_uv.y) * 7.0
            + u_time * 0.31
            + sin(a_uv.x * 5.0 - u_time * 0.19)
          ) * 0.18,
        0.0,
        1.0
      );
      vec2 position = base;
      vec2 flock_position = base;
      float perspective = 1.0;
      float flow_glow = 0.0;
      float flow_progress = 0.0;
      float flow_variation = 0.0;
      float murmuration_energy = 0.0;
      float collective_arrival = 0.0;
      float collective_identity = 0.0;
      float glint = 0.0;
      float mobile_opening = 0.0;
      float mobile_reach = 0.0;
      float mobile_brightness_wave = 0.0;

      if (u_mode > 0.5) {
        perspective = mix(0.28, 1.0, smoothstep(0.35, 1.0, a_uv.y));
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
      if (u_flock_pass > 0.5) {
        if (u_mode < 0.5 || u_morph < 0.12) {
          gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
          gl_PointSize = 0.0;
          v_colour = vec3(0.0);
          v_alpha = 0.0;
          return;
        }
        flow_progress = hash(a_seed * 43.0 + 2.0);
        flow_variation = hash(a_seed * 71.0 + 5.0);
        float mobile_population = hash(a_seed * 157.0 + 19.0);
        float mobile_lobe_id = mobile_population < 0.46
          ? 0.0
          : mobile_population < 0.8 ? 1.0 : 2.0;
        float collective_id = u_compact > 0.5
          ? mobile_lobe_id
          : floor(a_seed * 5.0);
        collective_identity = collective_id
          / mix(4.0, 2.0, u_compact);
        float lane_seed = hash(a_seed * 113.0 + 17.0);
        float collective_random = hash(collective_id * 17.0 + 3.0);
        float collective_phase = (
          collective_id * 1.763
          + collective_random * 2.7
        );
        float drift_phase = (
          u_time * (0.11 + collective_random * 0.065)
          + collective_phase
        );
        vec2 dance_floor = vec2(0.5, 0.715);
        vec2 leader = dance_floor + vec2(
          sin(drift_phase) * (0.115 + collective_random * 0.055)
            + sin(u_time * 0.27 + collective_phase * 1.7) * 0.032,
          cos(drift_phase * 0.79 + collective_phase * 0.41) * 0.052
            + sin(u_time * 0.19 + collective_phase * 1.23) * 0.032
        );
        float heading = (
          drift_phase * 0.84
          + sin(u_time * 0.23 + collective_phase) * 0.72
        );
        vec2 direction = normalize(vec2(
          cos(heading),
          sin(heading) * 0.68
        ));
        vec2 normal = vec2(-direction.y, direction.x);
        float rank = flow_progress * 2.0 - 1.0;
        float wing = flow_variation - 0.5;
        float band_envelope = pow(
          max(0.0, 1.0 - abs(rank)),
          0.42
        );
        float inhale = 0.5 + 0.5 * sin(
          u_time * 0.34
          + collective_phase
          + rank * 1.8
        );
        float cohesion = 0.72 + inhale * 0.34;
        float broad_curve = sin(
          rank * 3.7
          + u_time * (0.31 + collective_random * 0.12)
          + collective_phase
        );
        float fine_curve = sin(
          rank * 9.4
          - u_time * 0.47
          + collective_phase * 1.61
        );
        vec2 collective_uv = leader
          + direction
            * rank
            * (0.105 + collective_random * 0.055)
            * cohesion
          + normal
            * (
              broad_curve * (0.028 + band_envelope * 0.026)
              + fine_curve * (0.007 + band_envelope * 0.009)
            );
        float band_width = (
          0.012
          + band_envelope * (0.038 + inhale * 0.016)
        );
        collective_uv += normal * wing * band_width * 2.0;
        float lane = floor(lane_seed * 9.0) / 8.0 - 0.5;
        collective_uv += normal
          * lane
          * (0.006 + band_envelope * 0.016);
        collective_uv += direction
          * sin(
            rank * 14.0
            + lane * 8.0
            + u_time * 0.39
            + collective_phase
          )
          * (0.003 + band_envelope * 0.005);

        if (u_compact > 0.5) {
          float score_phase = fract(u_time / u_cycle_seconds);
          float gather_stage = smoothstep(0.0625, 0.1875, score_phase);
          float split_stage = smoothstep(0.1875, 0.325, score_phase);
          float recohere_stage = smoothstep(0.59375, 0.78125, score_phase);
          mobile_opening = split_stage * (1.0 - recohere_stage);
          mobile_reach = smoothstep(0.5125, 0.535, score_phase)
            * (1.0 - smoothstep(0.575, 0.59375, score_phase));

          float stream_id = floor(hash(a_seed * 191.0 + 23.0) * 4.0);
          vec2 stream_origin = stream_id < 0.5
            ? vec2(0.22, 0.76)
            : stream_id < 1.5
              ? vec2(0.38, 0.69)
              : stream_id < 2.5
                ? vec2(0.62, 0.70)
                : vec2(0.79, 0.77);
          vec2 gathered_ribbon = vec2(
            0.5 + rank * 0.23,
            0.73
              + sin(rank * 3.14159265) * 0.042
              + wing * 0.022
          );
          vec2 stream_uv = stream_origin + vec2(
            rank * 0.026,
            wing * 0.018
          );
          vec2 mobile_uv = mix(
            stream_uv,
            gathered_ribbon,
            gather_stage
          );

          vec2 lobe_centre = mobile_lobe_id < 0.5
            ? vec2(0.36, 0.70)
            : mobile_lobe_id < 1.5
              ? vec2(0.64, 0.74)
              : vec2(0.5, 0.72);
          float dance_window = smoothstep(0.29, 0.37, score_phase)
            * (1.0 - smoothstep(0.56, 0.64, score_phase));
          lobe_centre += vec2(
            sin(
              u_time * 0.32
              + collective_phase
            ) * 0.035 * dance_window,
            cos(
              u_time * 0.27
              + collective_phase * 1.3
            ) * 0.018 * dance_window
          );

          float base_heading = mobile_lobe_id < 0.5
            ? 0.16
            : mobile_lobe_id < 1.5 ? 2.96 : -0.55;
          float turn_amount = mobile_lobe_id < 0.5
            ? 2.387
            : mobile_lobe_id < 1.5 ? -1.948 : 0.44;
          float propagated_phase = score_phase
            - (rank + 1.0) * 0.0125;
          float turn_stage = smoothstep(
            0.325,
            0.5125,
            propagated_phase
          );
          float mobile_heading = base_heading + turn_amount * turn_stage;
          vec2 mobile_direction = normalize(vec2(
            cos(mobile_heading),
            sin(mobile_heading) * 0.62
          ));
          vec2 mobile_normal = vec2(
            -mobile_direction.y,
            mobile_direction.x
          );
          float lobe_extent = mobile_lobe_id < 0.5
            ? 0.115
            : mobile_lobe_id < 1.5 ? 0.102 : 0.12;
          float lobe_width = mobile_lobe_id < 0.5
            ? 0.035
            : mobile_lobe_id < 1.5 ? 0.03 : 0.018;
          vec2 lobe_uv = lobe_centre
            + mobile_direction
              * rank
              * lobe_extent
              * (0.88 + inhale * 0.12)
            + mobile_normal
              * (
                wing * lobe_width * 2.0
                + sin(
                  rank * 5.8
                  + u_time * 0.36
                  + collective_phase
                ) * lobe_width * 0.52
              );
          mobile_uv = mix(mobile_uv, lobe_uv, split_stage);

          float reach_particle = step(
            0.93,
            hash(a_seed * 211.0 + 41.0)
          ) * (1.0 - step(1.5, mobile_lobe_id));
          float reach_t = hash(a_seed * 229.0 + 13.0);
          vec2 reach_root = lobe_centre + (
            mobile_lobe_id < 0.5
              ? vec2(0.045, -0.028)
              : vec2(-0.045, -0.032)
          );
          vec2 reach_tip = mobile_lobe_id < 0.5
            ? vec2(0.485, 0.625)
            : vec2(0.515, 0.615);
          vec2 reach_control = mix(
            reach_root,
            reach_tip,
            0.5
          ) + (
            mobile_lobe_id < 0.5
              ? vec2(0.026, -0.026)
              : vec2(-0.026, -0.024)
          );
          vec2 reach_first = mix(
            reach_root,
            reach_control,
            reach_t
          );
          vec2 reach_second = mix(
            reach_control,
            reach_tip,
            reach_t
          );
          vec2 reach_uv = mix(
            reach_first,
            reach_second,
            reach_t
          );
          vec2 reach_delta = reach_tip - reach_root;
          vec2 reach_normal = normalize(vec2(
            -reach_delta.y,
            reach_delta.x
          ));
          float reach_width = mix(0.013, 0.003, reach_t);
          reach_uv += reach_normal
            * wing
            * reach_width
            * 2.0;
          mobile_uv = mix(
            mobile_uv,
            reach_uv,
            reach_particle * mobile_reach
          );

          vec2 recohere_centre = vec2(0.51, 0.72);
          float recohere_heading = (
            sin(u_time * 0.28) * 0.11
            + sin(score_phase * 6.2831853) * 0.07
          );
          vec2 recohere_direction = normalize(vec2(
            cos(recohere_heading),
            sin(recohere_heading) * 0.62
          ));
          vec2 recohere_normal = vec2(
            -recohere_direction.y,
            recohere_direction.x
          );
          float recohere_breath = 1.0 + sin(
            u_time * 0.43
            + rank * 1.7
          ) * 0.07;
          vec2 recohere_uv = recohere_centre
            + recohere_direction
              * rank
              * 0.17
              * recohere_breath
            + recohere_normal
              * (
                wing
                  * (0.078 - abs(rank) * 0.035)
                + sin(
                  rank * 6.2
                  + u_time * 0.31
                ) * 0.009
              );
          mobile_uv = mix(
            mobile_uv,
            recohere_uv,
            recohere_stage
          );

          leader = mix(
            mix(vec2(0.5, 0.73), lobe_centre, split_stage),
            recohere_centre,
            recohere_stage
          );
          heading = mix(
            mix(0.0, mobile_heading, split_stage),
            recohere_heading,
            recohere_stage
          );
          direction = normalize(vec2(
            cos(heading),
            sin(heading) * 0.62
          ));
          normal = vec2(-direction.y, direction.x);
          collective_uv = mobile_uv;
          mobile_brightness_wave = 1.0 - smoothstep(
            0.035,
            0.18,
            abs(
              fract(
                flow_progress
                - fract(u_time / 4.6)
                + 0.5
              ) - 0.5
            )
          );
        }

        vec2 folded_local = collective_uv - leader;
        float fold = sin(
          u_time * 0.43
          + collective_phase
          + rank * 4.8
        ) * (0.13 + band_envelope * 0.29)
          * mix(1.0, 0.58, u_compact);
        collective_uv = leader + rotate_field(fold) * folded_local;

        vec2 curl = fractal_curl(
          (collective_uv - leader) * 6.2,
          u_time,
          collective_phase + rank * 1.4,
          u_detail
        );
        float curl_strength = (
          0.008
          + band_envelope * (0.013 + inhale * 0.009)
        ) * mix(1.0, 1.12, u_compact);
        collective_uv += rotate_field(heading * 0.24)
          * curl
          * curl_strength;

        float gesture_pulse = pow(
          max(0.0, sin(u_time * 0.29 + collective_phase)),
          4.0
        ) * mix(1.0, 0.38, u_compact);
        float gesture_side = flow_variation < 0.5 ? -1.0 : 1.0;
        collective_uv += normal
          * gesture_side
          * gesture_pulse
          * band_envelope
          * (0.009 + abs(rank) * 0.017);
        collective_uv += direction
          * gesture_pulse
          * sin(rank * 3.14159265)
          * 0.012;
        if (u_compact > 0.5) {
          collective_uv.x = clamp(collective_uv.x, 0.17, 0.83);
          collective_uv.y = clamp(collective_uv.y, 0.57, 0.85);
        }

        murmuration_energy = clamp(
          length(curl) * 0.62
          + abs(broad_curve) * 0.18
          + inhale * 0.2,
          0.0,
          1.0
        );
        glint = pow(
          max(
            0.0,
            sin(
              a_seed * 173.0
              + u_time * 1.28
              + collective_phase
              + flow_progress * 17.0
            )
          ),
          mix(18.0, 28.0, u_compact)
        ) * (0.3 + murmuration_energy * 0.7)
          * mix(1.0, 0.7, u_compact);
        flock_position = u_rect.xy + collective_uv * u_rect.zw;
        collective_arrival = smoothstep(0.08, 0.78, u_morph);
        position = mix(base, flock_position, collective_arrival);
        position += fluid_field
          * fluid_strength
          * (0.34 + murmuration_energy * 0.42);
        perspective = mix(0.58, 1.0, flow_variation);
        flow_glow = 0.58 + murmuration_energy * 0.34;
      } else {
        position += fluid_field * fluid_strength;
      }

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
      float coherent_spin = sin(u_time * 0.23 + u_mode * 1.7);
      position += tangent
        * gravity
        * (10.0 + motion * 38.0)
        * (
          coherent_spin * 0.78
          + sin(u_time * 1.1 + a_seed * 18.0) * 0.22
        );

      float trail_energy = 0.0;
      vec2 trail_shift = vec2(0.0);
      if (u_trail_count > 0.5) {
        for (int trail_index = 0; trail_index < 24; trail_index++) {
          vec2 trail_delta = position - u_trail_points[trail_index];
          float trail_distance = length(trail_delta) + 0.001;
          float trail_influence = (
            1.0 - smoothstep(7.0, 92.0, trail_distance)
          ) * u_trail_weights[trail_index];
          vec2 trail_radial = trail_delta / trail_distance;
          vec2 trail_tangent = vec2(-trail_radial.y, trail_radial.x);
          trail_shift -= trail_radial
            * trail_influence
            * (7.0 + u_pointer_down * 7.0);
          trail_shift += trail_tangent
            * trail_influence
            * (
              coherent_spin * 0.72
              + sin(a_seed * 21.0 + u_time * 1.1) * 0.28
            )
            * 4.4;
          trail_energy = max(trail_energy, trail_influence);
        }
      }
      float trail_shift_length = length(trail_shift);
      if (trail_shift_length > 38.0) {
        trail_shift *= 38.0 / trail_shift_length;
      }
      position += trail_shift * (0.48 + freedom * 0.52);
      float spatial_luminance_wave = clamp(
        0.5
          + sin(
            position.x * 0.012
            - u_time * 0.46
            + sin(position.y * 0.01 + u_time * 0.22) * 1.2
          ) * 0.34
          + cos(
            (position.x - position.y) * 0.007
            + u_time * 0.27
          ) * 0.16,
        0.0,
        1.0
      );
      luminance_wave = mix(
        luminance_wave,
        spatial_luminance_wave,
        mix(0.35, 0.62, u_mode)
      );

      vec2 clip = vec2(
        position.x / u_resolution.x * 2.0 - 1.0,
        1.0 - position.y / u_resolution.y * 2.0
      );
      gl_Position = vec4(clip, 0.0, 1.0);

      float base_size = mix(1.08, 1.72, perspective);
      gl_PointSize = u_dpr
        * base_size
        * (
          1.0
          + u_morph * 0.5
          + gravity * 0.46
          + trail_energy * 0.68
          + u_flock_pass * 0.1
          + murmuration_energy * u_flock_pass * 0.13
          + glint * u_flock_pass * 0.18
          + u_compact
            * u_flock_pass
            * (0.06 + mobile_brightness_wave * 0.08)
        );

      float edge_fade = smoothstep(0.0, 0.055, a_uv.x)
        * smoothstep(0.0, 0.055, 1.0 - a_uv.x)
        * smoothstep(0.0, 0.045, a_uv.y)
        * smoothstep(0.0, 0.045, 1.0 - a_uv.y);
      edge_fade = mix(edge_fade, 1.0, u_flock_pass);
      float particle_alpha = mix(0.32, 0.98, u_morph);
      particle_alpha += (
        a_anchor * 0.12
        + gravity * 0.12
        + trail_energy * 0.18
        + flow_glow * 0.08
        + luminance_wave * u_morph * 0.04
      );
      v_alpha = clamp(particle_alpha * edge_fade, 0.0, 0.98);
      vec3 lifted_colour = pow(
        max(a_colour, vec3(0.008)),
        vec3(0.58)
      );
      lifted_colour = mix(
        a_colour,
        lifted_colour,
        0.7 + u_morph * 0.18
      );
      lifted_colour += vec3(0.045 + u_morph * 0.07);
      vec3 image_colour = lifted_colour * (
        1.07
        + pulse * 0.12
        + u_morph * 0.18
        + gravity * 0.14
        + flow_glow * 0.18
      );
      image_colour *= (
        0.94
        + luminance_wave * mix(0.12, 0.23, u_morph)
      );
      vec3 neon_blue = vec3(0.016, 0.29, 1.0);
      vec3 neon_cyan = vec3(0.0, 0.91, 1.0);
      vec3 neon_red = vec3(1.0, 0.015, 0.16);
      vec3 neon_white = vec3(0.95, 0.98, 1.0);
      float neon_band = 0.5 + 0.5 * sin(
        position.x * 0.018
        + position.y * 0.011
        - u_time * 0.64
        + a_seed * 7.0
      );
      float neon_red_mix = smoothstep(0.38, 0.78, neon_band);
      vec3 neon_colour = mix(neon_blue, neon_red, neon_red_mix);
      float cyan_glint = pow(
        max(
          0.0,
          sin(
            a_seed * 127.0
            + u_time * 1.14
            + position.x * 0.009
          )
        ),
        12.0
      );
      neon_colour = mix(neon_colour, neon_cyan, cyan_glint * 0.82);
      float neon_strength = u_morph
        * (0.5 + freedom * 0.34)
        * (0.84 + luminance_wave * 0.16);
      image_colour = mix(
        image_colour,
        neon_colour * (0.88 + luminance_wave * 0.34 + pulse * 0.18),
        clamp(neon_strength, 0.0, 0.82)
      );
      vec3 flock_ember = vec3(0.831, 0.31, 0.141);
      vec3 flock_apricot = vec3(0.941, 0.631, 0.424);
      vec3 flock_cream = vec3(0.961, 0.871, 0.761);
      vec3 flock_blue = vec3(0.133, 0.282, 0.431);
      vec3 flock_slate = vec3(0.557, 0.592, 0.584);
      float warm_wave = 0.5 + 0.5 * sin(
        flow_progress * 9.0
        - u_time * 0.34
        + collective_identity * 5.7
      );
      float cool_wave = 0.5 + 0.5 * cos(
        flow_progress * 6.0
        + u_time * 0.23
        + collective_identity * 7.1
      );
      vec3 flock_colour = mix(
        flock_ember,
        flock_apricot,
        warm_wave
      );
      flock_colour = mix(
        flock_colour,
        flock_slate,
        cool_wave * 0.13 * mix(1.0, 0.78, u_compact)
      );
      flock_colour = mix(
        flock_colour,
        flock_blue,
        cool_wave
          * (0.08 + (1.0 - warm_wave) * 0.16)
          * mix(1.0, 0.42, u_compact)
      );
      flock_colour = mix(
        flock_colour,
        flock_cream,
        clamp(
          glint * 0.92
          + pow(luminance_wave, 3.0) * 0.24,
          0.0,
          0.92
        )
      );
      flock_colour = mix(
        flock_colour,
        flock_cream,
        u_compact
          * (
            0.055
            + mobile_reach * 0.055
            + mobile_brightness_wave * 0.11
          )
      );
      flock_colour *= (
        0.98
        + luminance_wave * 0.32
        + pulse * 0.14
        + gravity * 0.08
        + murmuration_energy * 0.13
        + mobile_brightness_wave * u_compact * 0.18
      );
      v_colour = mix(image_colour, flock_colour, u_flock_pass * 0.96);
      vec3 trail_colour = mix(neon_cyan, neon_white, pulse * 0.42);
      v_colour = mix(v_colour, trail_colour, trail_energy * 0.48);
      if (u_flock_pass > 0.5) {
        v_alpha = clamp(
          collective_arrival
            * (
              0.16
              + pulse * 0.055
              + luminance_wave * 0.07
              + murmuration_energy * 0.055
              + glint * 0.14
              + u_compact
                * (
                  mobile_opening * 0.014
                  + mobile_brightness_wave * 0.04
                )
            ),
          0.0,
          mix(0.42, 0.46, u_compact)
        );
      }
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
    trailPoints: gl.getUniformLocation(program, 'u_trail_points[0]'),
    trailWeights: gl.getUniformLocation(program, 'u_trail_weights[0]'),
    pointerActive: gl.getUniformLocation(program, 'u_pointer_active'),
    pointerDown: gl.getUniformLocation(program, 'u_pointer_down'),
    time: gl.getUniformLocation(program, 'u_time'),
    morph: gl.getUniformLocation(program, 'u_morph'),
    mode: gl.getUniformLocation(program, 'u_mode'),
    dpr: gl.getUniformLocation(program, 'u_dpr'),
    flockPass: gl.getUniformLocation(program, 'u_flock_pass'),
    detail: gl.getUniformLocation(program, 'u_detail'),
    trailCount: gl.getUniformLocation(program, 'u_trail_count'),
    compact: gl.getUniformLocation(program, 'u_compact'),
    cycleSeconds: gl.getUniformLocation(program, 'u_cycle_seconds'),
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
  const touchTap = {
    pointerId: -1,
    startX: 0,
    startY: 0,
    startedAt: 0,
    moved: false,
  };
  const pointerTrail = [];
  const trailCoordinates = new Float32Array(48);
  const trailWeights = new Float32Array(24);
  const analysisCanvas = document.createElement('canvas');
  const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true });
  if (!analysisContext) {
    canvas.dataset.webglStatus = 'analysis-unavailable';
    return;
  }

  let width = window.innerWidth;
  let height = window.innerHeight;
  let compactMode = width <= 700 || window.matchMedia('(pointer: coarse)').matches;
  let mobileViewportMode = width <= 700;
  let dpr = 1;
  let frame = 0;
  let rebuildTimer = 0;
  let particleScale = 1;
  let detailLevel = 1;
  let trailUniformCount = 0;
  let regionBuildWidth = 0;
  let performanceFrames = 0;
  let performanceStarted = performance.now();
  let pausedCanvasCleared = false;
  const desktopCycleSeconds = 22;
  const mobileCycleSeconds = 16;
  const particleHoldSeconds = 11;
  let venueInView = false;
  let mobileCycleOrigin = performance.now();
  canvas.dataset.mobileCycleOriginMs = String(mobileCycleOrigin);

  if ('IntersectionObserver' in window) {
    const venueObserver = new IntersectionObserver(([entry]) => {
      const nextVenueInView = entry.isIntersecting && entry.intersectionRatio >= 0.35;
      if (nextVenueInView && !venueInView) {
        mobileCycleOrigin = performance.now();
        performanceFrames = 0;
        performanceStarted = mobileCycleOrigin;
        canvas.dataset.mobileCycleOriginMs = String(mobileCycleOrigin);
      }
      venueInView = nextVenueInView;
      canvas.dataset.venueInView = String(venueInView);
    }, { threshold: [0, 0.35, 0.75] });
    venueObserver.observe(venue);
  } else {
    venueInView = true;
    canvas.dataset.mobileCycleOriginMs = String(mobileCycleOrigin);
    canvas.dataset.venueInView = 'true';
  }

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const smoothstep = (minimum, maximum, value) => {
    const normalized = clamp((value - minimum) / Math.max(maximum - minimum, 0.0001), 0, 1);
    return normalized * normalized * (3 - 2 * normalized);
  };
  const hash = (x, y) => {
    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  const greatestCommonDivisor = (left, right) => {
    let a = Math.abs(left);
    let b = Math.abs(right);
    while (b) {
      const remainder = a % b;
      a = b;
      b = remainder;
    }
    return a;
  };
  const stratifiedStride = (count) => {
    let stride = Math.max(1, Math.floor(count * 0.61803398875));
    while (stride > 1 && greatestCommonDivisor(stride, count) !== 1) {
      stride -= 1;
    }
    return stride;
  };

  function targetCount(mode) {
    const cores = navigator.hardwareConcurrency || 6;
    const memory = navigator.deviceMemory || 6;
    const constrained = cores <= 4 || memory <= 4;
    if (compactMode) return Math.round((mode ? 110000 : 55000) * particleScale);
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

    const stride = stratifiedStride(count);
    for (let index = 0; index < count; index += 1) {
      const sourceIndex = (index * stride) % count;
      const x = sourceIndex % gridWidth;
      const y = Math.floor(sourceIndex / gridWidth);
      const pixelOffset = sourceIndex * 4;
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
    compactMode = width <= 700 || window.matchMedia('(pointer: coarse)').matches;
    mobileViewportMode = width <= 700;
    const cores = navigator.hardwareConcurrency || 6;
    const memory = navigator.deviceMemory || 6;
    const constrained = cores <= 4 || memory <= 4;
    const baseDetail = compactMode ? 0.62 : constrained ? 0.78 : 1;
    detailLevel = particleScale <= 0.51
      ? 0.28
      : particleScale < 0.9
        ? Math.min(baseDetail, 0.48)
        : baseDetail;
    dpr = Math.min(window.devicePixelRatio || 1, compactMode ? 1 : 1.15);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
    canvas.dataset.mobileChoreographyActive = String(mobileViewportMode);
    canvas.dataset.imageCycleSeconds = String(
      mobileViewportMode ? mobileCycleSeconds : desktopCycleSeconds,
    );
    const needsRegionBuild = regions.some((region) => region.count < 1000)
      || Math.abs(width - regionBuildWidth) > 6;
    if (needsRegionBuild) {
      regionBuildWidth = width;
      rebuildRegions();
    }
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
    gl.uniform2fv(uniforms.trailPoints, trailCoordinates);
    gl.uniform1fv(uniforms.trailWeights, trailWeights);
    gl.uniform1f(uniforms.pointerActive, pointer.active);
    gl.uniform1f(uniforms.pointerDown, pointer.down ? 1 : 0);
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.morph, morph);
    gl.uniform1f(uniforms.mode, region.mode);
    gl.uniform1f(uniforms.dpr, dpr);
    gl.uniform1f(uniforms.detail, detailLevel);
    gl.uniform1f(uniforms.trailCount, trailUniformCount);
    gl.uniform1f(uniforms.compact, mobileViewportMode ? 1 : 0);
    gl.uniform1f(
      uniforms.cycleSeconds,
      mobileViewportMode ? mobileCycleSeconds : desktopCycleSeconds,
    );
    gl.uniform1f(uniforms.flockPass, 0);
    gl.drawArrays(gl.POINTS, 0, region.count);
    canvas.dataset.flockParticles = '0';
  }

  function addTrailPoint(x, y, force = false) {
    const previous = pointerTrail[pointerTrail.length - 1];
    if (
      !force
      && previous
      && Math.hypot(x - previous.x, y - previous.y) < 12
    ) return;
    pointerTrail.push({ x, y, born: performance.now() });
    const maximumPoints = compactMode ? 140 : 240;
    if (pointerTrail.length > maximumPoints) pointerTrail.shift();
  }

  function updateTrail(now) {
    const artworkHoldMs = 8000;
    const artworkFadeMs = 6000;
    const artworkLifetimeMs = artworkHoldMs + artworkFadeMs;
    const livePoints = pointerTrail.filter(
      (point) => now - point.born < artworkLifetimeMs,
    );
    pointerTrail.length = 0;
    pointerTrail.push(...livePoints);
    trailCoordinates.fill(-1000);
    trailWeights.fill(0);
    trailUniformCount = Math.min(24, livePoints.length);
    for (let index = 0; index < trailUniformCount; index += 1) {
      const sourceIndex = trailUniformCount === 1
        ? livePoints.length - 1
        : Math.round(index * (livePoints.length - 1) / (trailUniformCount - 1));
      const point = livePoints[sourceIndex];
      const age = now - point.born;
      trailCoordinates[index * 2] = point.x;
      trailCoordinates[index * 2 + 1] = point.y;
      trailWeights[index] = age <= artworkHoldMs
        ? 1
        : Math.pow(
          Math.max(0, 1 - (age - artworkHoldMs) / artworkFadeMs),
          0.82,
        );
    }
    canvas.dataset.particleTrailPoints = String(livePoints.length);
    canvas.dataset.particleTrailUniforms = String(trailUniformCount);
  }

  function animate(now) {
    frame = window.requestAnimationFrame(animate);
    if (document.hidden || canvas.dataset.webglReady !== 'true') return;
    if (mobileViewportMode && !venueInView) {
      if (!pausedCanvasCleared) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        pausedCanvasCleared = true;
      }
      return;
    }
    pausedCanvasCleared = false;
    const cycleSeconds = mobileViewportMode ? mobileCycleSeconds : desktopCycleSeconds;
    const time = mobileViewportMode
      ? Math.max(0, now - mobileCycleOrigin) / 1000
      : now / 1000;
    if (now - pointer.lastMove > 900 && !pointer.down) pointer.active *= 0.965;
    pointer.velocityX *= 0.84;
    pointer.velocityY *= 0.84;
    updateTrail(now);

    const cycle = (time % cycleSeconds) / cycleSeconds;
    let baseMorph = 0;
    if (mobileViewportMode) {
      if (cycle >= 0.0625 && cycle < 0.1875) {
        baseMorph = smoothstep(0.0625, 0.1875, cycle) * 0.94;
      } else if (cycle >= 0.1875 && cycle < 0.78125) {
        baseMorph = 0.94;
      } else if (cycle >= 0.78125) {
        baseMorph = (1 - smoothstep(0.78125, 1, cycle)) * 0.94;
      }
    } else if (cycle >= 0.14 && cycle < 0.28) {
      baseMorph = smoothstep(0.14, 0.28, cycle) * 0.94;
    } else if (cycle >= 0.28 && cycle < 0.78) {
      baseMorph = 0.94;
    } else if (cycle >= 0.78 && cycle < 0.92) {
      baseMorph = (1 - smoothstep(0.78, 0.92, cycle)) * 0.94;
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
      if (fps < 34 && particleScale > 0.69) {
        particleScale = 0.68;
        detailLevel = Math.min(detailLevel, 0.48);
        canvas.dataset.adaptiveReduction = 'true';
        canvas.dataset.qualityTier = 'recovery';
        window.setTimeout(rebuildRegions, 0);
      } else if (fps < 28 && particleScale > 0.51) {
        particleScale = 0.5;
        detailLevel = 0.28;
        canvas.dataset.adaptiveReduction = 'true';
        canvas.dataset.qualityTier = 'minimum';
        window.setTimeout(rebuildRegions, 0);
      }
      performanceFrames = 0;
      performanceStarted = now;
    }
  }

  function activatePointer(x, y) {
    pointer.down = true;
    pointer.x = x;
    pointer.y = y;
    pointer.active = 1;
    pointer.lastMove = performance.now();
    addTrailPoint(x, y, true);
  }

  function onPointerMove(event) {
    if (event.pointerType === 'touch') {
      if (
        event.pointerId === touchTap.pointerId
        && Math.hypot(
          event.clientX - touchTap.startX,
          event.clientY - touchTap.startY,
        ) > 12
      ) touchTap.moved = true;
      return;
    }
    pointer.velocityX = event.clientX - pointer.x;
    pointer.velocityY = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = 1;
    pointer.lastMove = performance.now();
    if (pointer.down) addTrailPoint(event.clientX, event.clientY);
  }

  function onPointerDown(event) {
    if (!event.isPrimary) return;
    if (event.pointerType === 'touch') {
      touchTap.pointerId = event.pointerId;
      touchTap.startX = event.clientX;
      touchTap.startY = event.clientY;
      touchTap.startedAt = performance.now();
      touchTap.moved = false;
      pointer.down = false;
      return;
    }
    activatePointer(event.clientX, event.clientY);
  }

  function onPointerUp(event) {
    if (event.pointerType === 'touch') {
      if (
        event.pointerId === touchTap.pointerId
        && !touchTap.moved
        && performance.now() - touchTap.startedAt < 650
      ) {
        activatePointer(event.clientX, event.clientY);
      }
      touchTap.pointerId = -1;
      pointer.down = false;
      return;
    }
    pointer.down = false;
  }

  function onPointerCancel(event) {
    if (event.pointerType === 'touch' && event.pointerId === touchTap.pointerId) {
      touchTap.pointerId = -1;
    }
    pointer.down = false;
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerCancel, { passive: true });
  window.addEventListener('resize', () => {
    window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(resize, 180);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      performanceFrames = 0;
      performanceStarted = performance.now();
    }
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    canvas.dataset.webglReady = 'false';
    canvas.dataset.webglStatus = 'context-lost';
    document.documentElement.classList.remove('particle-organism-ready');
  });

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  canvas.dataset.engine = 'webgl-neon-fractal-flow';
  canvas.dataset.interactionMode = 'particle-trail-curl-wake';
  canvas.dataset.particleTrailHoldSeconds = '8';
  canvas.dataset.particleTrailFadeSeconds = '6';
  canvas.dataset.mobileTouchMode = 'tap-particles-pan-scroll';
  canvas.dataset.brightnessMode = 'neon-blue-red-cyan-wave';
  canvas.dataset.figureMode = 'none';
  canvas.dataset.fractalOctaves = 'responsive-two-to-three';
  canvas.dataset.sampleOrder = 'golden-coprime-stride';
  canvas.dataset.qualityTier = 'adaptive';
  canvas.dataset.mobileChoreography = 'none';
  canvas.dataset.mobileCollectives = 'disabled';
  canvas.dataset.desktopCycleSeconds = String(desktopCycleSeconds);
  canvas.dataset.mobileCycleSeconds = String(mobileCycleSeconds);
  canvas.dataset.mobileClock = 'visibility-local';
  canvas.dataset.particleHoldSeconds = String(particleHoldSeconds);
  canvas.dataset.webglStatus = 'initializing';
  resize();
  if (!logo.complete) logo.addEventListener('load', rebuildRegions, { once: true });
  if (!venue.complete) venue.addEventListener('load', rebuildRegions, { once: true });
  frame = window.requestAnimationFrame(animate);
})();
