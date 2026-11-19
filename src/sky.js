import * as THREE from 'three';

/**
 * A real sunset sky: gradient, sun disc with glow, drifting cloud bands.
 * Replaces the baked dome from the glTF so the horizon can breathe.
 */
export function createSky(scene, { sunDirection = new THREE.Vector3(-0.85, 0.18, 0.5) } = {}) {
  const uniforms = {
    uSunDir: { value: sunDirection.clone().normalize() },
    uTime: { value: 0 },
    uZenith: { value: new THREE.Color(0x2a0b33) },
    uMid: { value: new THREE.Color(0x8a1f5c) },
    uHorizon: { value: new THREE.Color(0xff7043) },
    uSunColour: { value: new THREE.Color(0xffd08a) },
    uCloud: { value: new THREE.Color(0x3a1030) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vDir;
      uniform vec3 uSunDir;
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uSunColour;
      uniform vec3 uCloud;
      uniform float uTime;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.02;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.15, 1.0);

        // vertical gradient: horizon → mid → zenith
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.32, h));
        col = mix(col, uZenith, smoothstep(0.28, 0.95, h));

        // horizon haze band
        col += uHorizon * 0.25 * exp(-abs(d.y) * 12.0);

        // sun disc + bloom-ish glow
        float cosA = max(dot(d, uSunDir), 0.0);
        col += uSunColour * pow(cosA, 900.0) * 12.0;
        col += uSunColour * pow(cosA, 18.0) * 0.55;
        col += uSunColour * pow(cosA, 3.0) * 0.10;

        // cloud bands drifting across the mid sky
        vec2 p = d.xz / max(0.15, d.y + 0.35) * 1.6 + vec2(uTime * 0.012, 0.0);
        float clouds = fbm(p * 1.7);
        float mask = smoothstep(0.46, 0.82, clouds) * smoothstep(0.02, 0.5, d.y);
        col = mix(col, uCloud + uHorizon * 0.35, mask * 0.55);

        // slightly crush the very top so text stays readable
        col *= 1.0 - smoothstep(0.75, 1.0, d.y) * 0.25;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(2600, 48, 32), material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  return {
    mesh,
    update(t) {
      uniforms.uTime.value = t;
    },
  };
}
