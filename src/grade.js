import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * A photographic grade: warm shadows, cool highlights, slight radial
 * aberration at the edges, vignette and fine grain. Sits after bloom so the
 * neon is graded, not the other way round.
 */
export function createGradePass() {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uVignette: { value: 0.42 },
      uGrain: { value: 0.028 },
      uWarmth: { value: 0.16 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uVignette;
      uniform float uGrain;
      uniform float uWarmth;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec2 uv = vUv;
        vec2 centred = uv - 0.5;
        float r2 = dot(centred, centred);

        // radial aberration, strongest at the corners
        float ca = 0.0016 * r2;
        vec3 col;
        col.r = texture2D(tDiffuse, uv + centred * ca).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uv - centred * ca).b;

        float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));

        // split tone: warm in the shadows, cool in the highlights
        col.r += uWarmth * (1.0 - luma) * 0.5;
        col.b += uWarmth * luma * 0.35;
        col.g += uWarmth * 0.08;

        // filmic S-curve
        col = clamp(col, 0.0, 1.4);
        col = col * col * (3.0 - 2.0 * col) * 0.35 + col * 0.65;

        // vignette
        float vig = smoothstep(0.85, 0.18, r2 * (1.0 + uVignette));
        col *= mix(1.0, vig, 0.75);

        // fine grain, animated
        float grain = hash(uv * 1000.0 + uTime * 37.0) - 0.5;
        col += grain * uGrain;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}
