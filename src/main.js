import './styles.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createSky } from './sky.js';
import { createTraffic, createPedestrians, createTrafficLights } from './life.js';
import { createProps } from './props.js';
import { createSoundscape } from './audio.js';
import { DISTRICTS, createDistrictSigns } from './districts.js';

/**
 * A cinematic fly-through of Hyderabad, Sindh — no controls, no gameplay.
 * The camera drifts between the eleven towns while the district cards change.
 */

const canvas = document.getElementById('scene');
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderPct = document.getElementById('loader-pct');
const clockEl = document.getElementById('clock');
const cardEl = document.getElementById('district-card');
const dName = document.getElementById('d-name');
const dUrdu = document.getElementById('d-urdu');
const dNote = document.getElementById('d-note');
const progressFill = document.getElementById('progress-fill');
const soundBtn = document.getElementById('sound-btn');

const MODEL = `${import.meta.env.BASE_URL}models/hyderabad.glb`;

/* ------------------------------------------------------------------ scene */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a0b18);
scene.fog = new THREE.FogExp2(0x5a2038, 0.0007);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 6000);

const hemi = new THREE.HemisphereLight(0xff8fb0, 0x2a1220, 0.7);
const sun = new THREE.DirectionalLight(0xff9a5c, 2.6);
sun.position.set(-180, 70, 120);
const rim = new THREE.DirectionalLight(0x7fa8ff, 0.7);
rim.position.set(160, 50, -140);
scene.add(hemi, sun, rim);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.34, 0.6, 0.84);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const sky = createSky(scene);
const trafficLights = createTrafficLights(scene);
const traffic = createTraffic(scene, { count: 20, lights: trafficLights });
const pedestrians = createPedestrians(scene, { count: 26 });
const props = createProps(scene);
createDistrictSigns(scene);
const sound = createSoundscape();

/* ------------------------------------------------------------------- load */

function setLoader(v) {
  const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
  loaderFill.style.width = `${pct}%`;
  loaderPct.textContent = `${pct}%`;
}

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
dracoLoader.setDecoderConfig({ type: 'js' });

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load(
  MODEL,
  (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (!child.isMesh) return;
      if (child.name === 'SkyDome' || child.name === 'SunDisc') child.visible = false;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!m) continue;
        if (m.name?.includes('AwningNeon')) m.emissiveIntensity *= 0.28;
        else if (m.name?.includes('ShopNeon')) m.emissiveIntensity *= 0.55;
        if (m.map) m.map.anisotropy = 4;
      }
    });
    scene.add(model);
    setLoader(1);
    setTimeout(() => {
      loaderEl.dataset.done = 'true';
    }, 400);
  },
  (event) => {
    if (event.total) setLoader(event.loaded / event.total);
  },
  (error) => {
    console.error('[hyderabad] model failed', error);
    loaderEl.dataset.done = 'true';
  },
);

/* ------------------------------------------------------------------- tour */

// one waypoint per district: a camera perch looking across that town
const waypoints = DISTRICTS.map((d, i) => {
  const angle = (i / DISTRICTS.length) * Math.PI * 2;
  const radius = 78;
  return {
    district: d,
    position: new THREE.Vector3(
      d.at.x + Math.cos(angle) * radius,
      26 + (i % 3) * 12,
      d.at.z + Math.sin(angle) * radius,
    ),
    look: new THREE.Vector3(d.at.x, 8, d.at.z),
  };
});

const pathCurve = new THREE.CatmullRomCurve3(waypoints.map((w) => w.position), true, 'catmullrom', 0.4);
const lookCurve = new THREE.CatmullRomCurve3(waypoints.map((w) => w.look), true, 'catmullrom', 0.4);

const tour = {
  t: 0,
  duration: 96,           // seconds for the whole loop
  paused: false,
  currentDistrict: null,
};

let elapsed = 0;

function districtForProgress(t) {
  const index = Math.floor(t * DISTRICTS.length) % DISTRICTS.length;
  return DISTRICTS[index];
}

function showDistrict(district) {
  if (tour.currentDistrict === district.id) return;
  tour.currentDistrict = district.id;
  dName.textContent = district.name;
  dUrdu.textContent = district.urdu;
  dNote.textContent = district.note;
  cardEl.dataset.show = 'true';
  clearTimeout(cardEl._t);
  cardEl._t = setTimeout(() => {
    cardEl.dataset.show = 'false';
  }, 5200);
}

function updateTour(dt) {
  if (!tour.paused) tour.t = (tour.t + dt / tour.duration) % 1;
  const t = tour.t;

  const pos = pathCurve.getPointAt(t);
  const look = lookCurve.getPointAt(t);

  // gentle handheld drift so it feels photographed, not rigged
  const drift = 0.35;
  pos.x += Math.sin(elapsed * 0.31) * drift;
  pos.y += Math.cos(elapsed * 0.24) * drift * 0.6;
  pos.z += Math.sin(elapsed * 0.19 + 1.1) * drift;

  camera.position.lerp(pos, 1 - Math.pow(0.0015, dt));
  camera.lookAt(look);

  progressFill.style.width = `${Math.round(t * 100)}%`;
  showDistrict(districtForProgress(t));
}

/* ------------------------------------------------------------------- hud */

function tickClock() {
  const now = new Date();
  clockEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
setInterval(tickClock, 15000);
tickClock();

let audioOn = false;
soundBtn.addEventListener('click', async () => {
  audioOn = !audioOn;
  if (audioOn) await sound.enable();
  else sound.disable();
  soundBtn.textContent = audioOn ? 'Sound on' : 'Sound off';
});

// the very first click also arms the city mix
window.addEventListener('pointerdown', () => {
  if (!audioOn) {
    audioOn = true;
    sound.enable().catch(() => {});
    soundBtn.textContent = 'Sound on';
  }
}, { once: true });

/* ------------------------------------------------------------------ loop */

const clock = new THREE.Clock();

function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;

  updateTour(dt);
  sky.update(elapsed);
  trafficLights.update(dt);
  traffic.update(dt);
  pedestrians.update(dt, elapsed);
  props.update(dt, elapsed);
  sound.update(dt);

  composer.render();
  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  composer.setSize(window.innerWidth, window.innerHeight);
});

camera.position.set(120, 90, 120);
camera.lookAt(0, 10, 0);
loop();

/* test hook: jump the film to a moment */
window.__seek = (t) => {
  tour.t = t % 1;
  const pos = pathCurve.getPointAt(tour.t);
  camera.position.copy(pos);
  camera.lookAt(lookCurve.getPointAt(tour.t));
};
