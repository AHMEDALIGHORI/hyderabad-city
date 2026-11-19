import './styles.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('scene');
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderPct = document.getElementById('loader-pct');
const speedEl = document.getElementById('speed');
const compassNeedle = document.getElementById('compass-needle');
const clockEl = document.getElementById('clock');
const radar = document.getElementById('radar-canvas');
const radarCtx = radar.getContext('2d');

const MODEL = `${import.meta.env.BASE_URL}models/hyderabad.glb`;

/* ------------------------------------------------------------------ scene */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1026);
scene.fog = new THREE.FogExp2(0x5a2038, 0.0006);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 6000);

// sunset light rig
const hemi = new THREE.HemisphereLight(0xff8fb0, 0x2a1220, 0.85);
const sun = new THREE.DirectionalLight(0xff9a5c, 2.4);
sun.position.set(-180, 90, 120);
const rim = new THREE.DirectionalLight(0x6fa8ff, 0.8);
rim.position.set(160, 60, -140);
scene.add(hemi, sun, rim);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.38,
  0.6,
  0.82,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ----------------------------------------------------------------- player */

const player = {
  pos: new THREE.Vector3(-23, 1.7, 34),
  vel: new THREE.Vector3(),
  yaw: 0.05,
  pitch: -0.04,
  sprint: false,
};
const keys = new Set();
const BOUND = 200;
const intro = { active: true, t: 0 };

/* ------------------------------------------------------------------ input */

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId);
  drag.active = true;
  drag.x = event.clientX;
  drag.y = event.clientY;
});
const drag = { active: false, x: 0, y: 0 };

window.addEventListener('pointerup', () => {
  drag.active = false;
});
window.addEventListener('pointermove', (event) => {
  if (!drag.active) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  drag.x = event.clientX;
  drag.y = event.clientY;
  player.yaw -= dx * 0.0032;
  player.pitch = THREE.MathUtils.clamp(player.pitch - dy * 0.0026, -0.7, 0.6);
});

window.addEventListener('keydown', (event) => {
  const k = event.key.toLowerCase();
  keys.add(k);
  if (k === 'shift') player.sprint = true;
  if (k === 'n') toggleNeon();
  if (k === 'r') resetPlayer();
});
window.addEventListener('keyup', (event) => {
  const k = event.key.toLowerCase();
  keys.delete(k);
  if (k === 'shift') player.sprint = false;
});

function resetPlayer() {
  player.pos.set(-23, 1.7, 34);
  player.yaw = 0.05;
  player.pitch = -0.02;
  player.vel.set(0, 0, 0);
}

/* ------------------------------------------------------------------- neon */

let neonOn = true;
const neonMats = [];

function toggleNeon() {
  neonOn = !neonOn;
  for (const mat of neonMats) {
    mat.emissiveIntensity = neonOn ? mat.userData.base : mat.userData.base * 0.22;
  }
  bloom.strength = neonOn ? 0.38 : 0.16;
  renderer.toneMappingExposure = neonOn ? 1.12 : 1.0;
  scene.fog.color.setHex(neonOn ? 0x4a1a35 : 0x2a1830);
}

/* ------------------------------------------------------------------- load */

const nodes = [];
let model = null;

const gltfLoader = new GLTFLoader();
function setLoader(v) {
  const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
  loaderFill.style.width = `${pct}%`;
  loaderPct.textContent = `${pct}%`;
}

gltfLoader.load(
  MODEL,
  (gltf) => {
    model = gltf.scene;
    model.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!mat) continue;
        if (mat.emissive && (mat.emissiveMap || mat.emissive.getHex() !== 0)) {
          mat.userData.base = mat.emissiveIntensity ?? 1;
          neonMats.push(mat);
        }
        if (mat.map) mat.map.anisotropy = 4;
      }
      nodes.push(child);
      if (child.name === 'SkyDome' || child.name === 'SunDisc') {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) if (m) m.fog = false;
      }
    });

    // the awnings and neon bars read as pure white when bloom hits them
    model.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!m || !m.emissive) continue;
        const name = m.name || '';
        if (name.includes('AwningNeon')) m.emissiveIntensity *= 0.28;
        else if (name.includes('ShopNeon')) m.emissiveIntensity *= 0.55;
        else if (name.includes('ShopInterior')) m.emissiveIntensity *= 0.5;
        else if (name.includes('FoodBulb')) m.emissiveIntensity *= 0.6;
      }
    });
    scene.add(model);
    setLoader(1);
    setTimeout(() => {
      loaderEl.dataset.done = 'true';
    }, 300);
  },
  (event) => {
    if (event.total) setLoader(event.loaded / event.total);
  },
  (error) => {
    console.error('[hyderabad] load failed', error);
    loaderEl.dataset.done = 'true';
  },
);

/* ----------------------------------------------------------------- render */

const clock = new THREE.Clock();
let elapsed = 0;

function updatePlayer(dt) {
  if (intro.active) {
    intro.t += dt;
    const k = Math.min(1, intro.t / 3.6);
    const ease = 1 - Math.pow(1 - k, 3);
    camera.position.set(
      THREE.MathUtils.lerp(150, player.pos.x, ease),
      THREE.MathUtils.lerp(95, player.pos.y, ease),
      THREE.MathUtils.lerp(-175, player.pos.z, ease),
    );
    camera.lookAt(0, 18 * (1 - ease) + 2, 0);
    if (k >= 1) {
      intro.active = false;
      document.getElementById('intro-note').hidden = true;
    }
    return;
  }

  const speed = player.sprint ? 26 : 11;
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const dir = new THREE.Vector3();
  if (keys.has('w') || keys.has('arrowup')) dir.add(forward);
  if (keys.has('s') || keys.has('arrowdown')) dir.sub(forward);
  if (keys.has('a') || keys.has('arrowleft')) dir.sub(right);
  if (keys.has('d') || keys.has('arrowright')) dir.add(right);
  if (dir.lengthSq() > 0) dir.normalize();

  player.vel.lerp(dir.multiplyScalar(speed), 1 - Math.pow(0.001, dt));
  player.pos.addScaledVector(player.vel, dt);
  player.pos.x = THREE.MathUtils.clamp(player.pos.x, -BOUND, BOUND);
  player.pos.z = THREE.MathUtils.clamp(player.pos.z, -BOUND, BOUND);

  // gentle head bob
  const moving = player.vel.length() > 0.4;
  const bob = moving ? Math.sin(elapsed * (player.sprint ? 13 : 8)) * 0.045 : 0;
  player.pos.y = 1.7 + bob;

  camera.position.copy(player.pos);
  const look = new THREE.Vector3(
    -Math.sin(player.yaw) * Math.cos(player.pitch),
    Math.sin(player.pitch),
    -Math.cos(player.yaw) * Math.cos(player.pitch),
  );
  camera.lookAt(player.pos.clone().add(look));

  const kmh = Math.round(player.vel.length() * 3.6 * 1.6);
  speedEl.textContent = moving ? `${kmh} KM/H` : '';
  compassNeedle.style.transform = `rotate(${-player.yaw}rad)`;
}

function drawRadar() {
  const w = radar.width;
  const cx = w / 2;
  radarCtx.clearRect(0, 0, w, w);
  radarCtx.save();
  radarCtx.translate(cx, cx);
  radarCtx.rotate(player.yaw);

  // block grid (GTA-style)
  const blockPx = 9;
  const pitchPx = 13;
  radarCtx.fillStyle = 'rgba(255, 79, 163, 0.16)';
  radarCtx.strokeStyle = 'rgba(255, 206, 106, 0.22)';
  radarCtx.lineWidth = 1;
  for (let i = -6; i <= 6; i += 1) {
    for (let j = -6; j <= 6; j += 1) {
      const x = i * pitchPx - blockPx / 2;
      const y = j * pitchPx - blockPx / 2;
      if (Math.hypot(x, y) > w * 0.46) continue;
      radarCtx.fillRect(x, y, blockPx, blockPx);
      radarCtx.strokeRect(x, y, blockPx, blockPx);
    }
  }

  // main avenues
  radarCtx.strokeStyle = 'rgba(79, 227, 255, 0.35)';
  radarCtx.lineWidth = 2;
  radarCtx.beginPath();
  radarCtx.moveTo(-w, 0);
  radarCtx.lineTo(w, 0);
  radarCtx.moveTo(0, -w);
  radarCtx.lineTo(0, w);
  radarCtx.stroke();
  radarCtx.restore();

  // player arrow
  radarCtx.save();
  radarCtx.translate(cx, cx);
  radarCtx.fillStyle = '#4fe3ff';
  radarCtx.beginPath();
  radarCtx.moveTo(0, -8);
  radarCtx.lineTo(6, 7);
  radarCtx.lineTo(0, 4);
  radarCtx.lineTo(-6, 7);
  radarCtx.closePath();
  radarCtx.fill();
  radarCtx.restore();
}

function tickClock() {
  const now = new Date();
  clockEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

setInterval(tickClock, 15000);
tickClock();

function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  updatePlayer(dt);
  drawRadar();
  composer.render();
  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  composer.setSize(window.innerWidth, window.innerHeight);
});

camera.position.set(150, 95, -175);
camera.lookAt(0, 18, 0);
loop();
