import * as THREE from 'three';

/**
 * Play systems: collision, a drivable rickshaw, photo mode, day/night, weather,
 * radio and the chai-spot hunt.
 */

const PITCH = 60;
const BLOCK_HALF = 23;
const ROAD_OFFSET = -23;

function aabb(x, z, halfX, halfZ) {
  return { minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ };
}

export function createSystems({ scene, camera, player, keys, sky, sound, radio, onToast, onHud }) {
  /* ------------------------------------------------------------ colliders */
  const colliders = [];
  for (let bx = -3; bx <= 3; bx += 1) {
    for (let by = -3; by <= 3; by += 1) {
      if (bx === 0 && by === 0) continue;
      colliders.push(aabb(bx * PITCH, by * PITCH, BLOCK_HALF, BLOCK_HALF));
    }
  }
  // destinations + tower
  colliders.push(aabb(96, 40, 23, 17));    // mall
  colliders.push(aabb(-96, -40, 10, 7));   // dhaba base
  colliders.push(aabb(96, -96, 11, 9));    // gym
  colliders.push(aabb(-96, 96, 8, 7));     // shoes
  colliders.push(aabb(0, 0, 4, 4));        // clock tower

  const RADIUS = 0.55;

  function resolveCollisions(pos) {
    for (const c of colliders) {
      if (pos.x > c.minX - RADIUS && pos.x < c.maxX + RADIUS && pos.z > c.minZ - RADIUS && pos.z < c.maxZ + RADIUS) {
        const dxl = Math.abs(pos.x - (c.minX - RADIUS));
        const dxr = Math.abs(c.maxX + RADIUS - pos.x);
        const dzl = Math.abs(pos.z - (c.minZ - RADIUS));
        const dzr = Math.abs(c.maxZ + RADIUS - pos.z);
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) pos.x = c.minX - RADIUS;
        else if (m === dxr) pos.x = c.maxX + RADIUS;
        else if (m === dzl) pos.z = c.minZ - RADIUS;
        else pos.z = c.maxZ + RADIUS;
      }
    }
  }

  /* ------------------------------------------------------------- rickshaw */
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c12e, roughness: 0.4, metalness: 0.25 });
  const black = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.7, metalness: 0.3 });
  const rick = new THREE.Group();
  const rBody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.25, 1.35), yellow);
  rBody.position.y = 0.95;
  rick.add(rBody);
  const rRoof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 1.3), black);
  rRoof.position.y = 1.85;
  rick.add(rRoof);
  for (const [x, z] of [[-1, 0.62], [1, 0.62], [-1, -0.62], [1, -0.62]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.16, 12), black);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.32, z);
    rick.add(w);
  }
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff3d0, emissive: 0xfff0c0, emissiveIntensity: 6 }),
  );
  lamp.position.set(1.36, 0.8, 0);
  rick.add(lamp);
  rick.position.set(-23, 0.16, 34);
  scene.add(rick);

  const drive = { on: false, speed: 0, heading: 0.05 };

  /* --------------------------------------------------------- photo mode */
  const photo = { on: false, yaw: 0, pitch: 0, dist: 6 };

  /* ------------------------------------------------------- day / night */
  const phases = [
    { name: 'sunset', sun: new THREE.Color(0xff7043), zenith: new THREE.Color(0x2a0b33), mid: new THREE.Color(0x8a1f5c), horizon: new THREE.Color(0xff7043), sunElev: 0.18, fog: 0.0006, exposure: 1.12, sunLight: 2.4 },
    { name: 'night', sun: new THREE.Color(0x2a2a5a), zenith: new THREE.Color(0x05060f), mid: new THREE.Color(0x12132a), horizon: new THREE.Color(0x2a1a3a), sunElev: -0.2, fog: 0.0009, exposure: 1.0, sunLight: 0.35 },
    { name: 'dawn', sun: new THREE.Color(0xffb38a), zenith: new THREE.Color(0x24304f), mid: new THREE.Color(0x8a6a7a), horizon: new THREE.Color(0xffb38a), sunElev: 0.08, fog: 0.0007, exposure: 1.16, sunLight: 1.6 },
  ];
  let phaseIndex = 0;

  function applyPhase() {
    const p = phases[phaseIndex];
    if (sky && sky.uniforms) {
      sky.uniforms.uSunDir.value.set(-0.85, p.sunElev, 0.5).normalize();
      sky.uniforms.uZenith.value.copy(p.zenith);
      sky.uniforms.uMid.value.copy(p.mid);
      sky.uniforms.uHorizon.value.copy(p.horizon);
      sky.uniforms.uSunColour.value.copy(p.sun);
    }
    scene.fog.density = p.fog;
    scene.fog.color.copy(p.horizon);
    return p;
  }

  /* ------------------------------------------------------------ weather */
  const weatherStates = ['clear', 'rain', 'dust'];
  let weatherIndex = 0;

  const rainCount = 2600;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i += 1) {
    rainPos[i * 3] = (Math.random() - 0.5) * 90;
    rainPos[i * 3 + 1] = Math.random() * 40;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(
    rainGeo,
    new THREE.PointsMaterial({ color: 0xaac8e0, size: 0.09, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  rain.visible = false;
  scene.add(rain);

  const dustCount = 1200;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) {
    dustPos[i * 3] = (Math.random() - 0.5) * 140;
    dustPos[i * 3 + 1] = Math.random() * 18;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 140;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: 0xd8a86a, size: 0.35, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  dust.visible = false;
  scene.add(dust);

  /* --------------------------------------------------------------- chai */
  const chaiSpots = [
    { x: -23, z: 74, name: 'Chai Khana, Latifabad' },
    { x: 37, z: -23, name: 'Dhaba on the highway' },
    { x: -83, z: -60, name: 'Corner stall, Unit 7' },
    { x: 97, z: 40, name: 'Mall food court' },
    { x: 0, z: -83, name: 'Clock tower tea stand' },
  ];
  const found = new Set();

  const markerMat = new THREE.MeshStandardMaterial({
    color: 0x8fe9ff,
    emissive: 0x4fe3ff,
    emissiveIntensity: 3,
    transparent: true,
    opacity: 0.9,
  });
  const markers = chaiSpots.map((spot) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 20), markerMat);
    m.position.set(spot.x, 0.3, spot.z);
    scene.add(m);
    return m;
  });

  /* ------------------------------------------------------------- public */
  const api = {
    get driving() { return drive.on; },
    get photo() { return photo.on; },

    toggleDrive() {
      drive.on = !drive.on;
      if (drive.on) {
        drive.heading = player.yaw;
        rick.position.set(player.pos.x, 0.16, player.pos.z);
        rick.rotation.y = drive.heading;
        onToast?.('Rickshaw stolen. W/S throttle, A/D steer, E to get out.');
      } else {
        player.pos.set(rick.position.x + 2, 1.7, rick.position.z);
        onToast?.('Back on foot.');
      }
      return drive.on;
    },

    togglePhoto() {
      photo.on = !photo.on;
      photo.yaw = player.yaw;
      photo.pitch = player.pitch;
      photo.dist = 7;
      document.body.dataset.photo = String(photo.on);
      onToast?.(photo.on ? 'Photo mode: drag to orbit, wheel to zoom, F to exit.' : 'Photo mode off.');
      return photo.on;
    },

    cycleTime() {
      phaseIndex = (phaseIndex + 1) % phases.length;
      const p = applyPhase();
      onToast?.(`Light: ${p.name}`);
      return p.name;
    },

    cycleWeather() {
      weatherIndex = (weatherIndex + 1) % weatherStates.length;
      const w = weatherStates[weatherIndex];
      rain.visible = w === 'rain';
      dust.visible = w === 'dust';
      scene.fog.density = w === 'rain' ? 0.0022 : w === 'dust' ? 0.0042 : phases[phaseIndex].fog;
      if (w === 'dust') scene.fog.color.setHex(0xc98a4a);
      else scene.fog.color.copy(phases[phaseIndex].horizon);
      onToast?.(`Weather: ${w}`);
      return w;
    },

    nextStation() {
      return radio?.next();
    },

    update(dt, t) {
      // driving
      if (drive.on) {
        const throttle = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
        const steer = (keys.has('a') ? 1 : 0) - (keys.has('d') ? 1 : 0);
        drive.speed += throttle * 14 * dt;
        drive.speed *= 0.985;
        drive.speed = THREE.MathUtils.clamp(drive.speed, -8, 26);
        drive.heading += steer * dt * (0.6 + Math.abs(drive.speed) * 0.02);
        rick.rotation.y = drive.heading;
        rick.position.x += Math.sin(drive.heading) * drive.speed * dt;
        rick.position.z += Math.cos(drive.heading) * drive.speed * dt;
        rick.position.x = THREE.MathUtils.clamp(rick.position.x, -240, 240);
        rick.position.z = THREE.MathUtils.clamp(rick.position.z, -240, 240);
        resolveCollisions(rick.position);

        // chase camera
        const back = new THREE.Vector3(
          rick.position.x - Math.sin(drive.heading) * 8,
          4.2,
          rick.position.z - Math.cos(drive.heading) * 8,
        );
        camera.position.lerp(back, 1 - Math.pow(0.001, dt));
        camera.lookAt(rick.position.x + Math.sin(drive.heading) * 4, 1.4, rick.position.z + Math.cos(drive.heading) * 4);
        player.pos.copy(rick.position).setY(1.7);
      } else if (photo.on) {
        camera.position.set(
          player.pos.x + Math.sin(photo.yaw) * photo.dist,
          player.pos.y + photo.pitch * photo.dist + 1.2,
          player.pos.z + Math.cos(photo.yaw) * photo.dist,
        );
        camera.lookAt(player.pos.x, 1.6, player.pos.z);
      } else {
        resolveCollisions(player.pos);
        // collect chai
        chaiSpots.forEach((spot, i) => {
          if (found.has(i)) return;
          const d = Math.hypot(player.pos.x - spot.x, player.pos.z - spot.z);
          if (d < 3.2) {
            found.add(i);
            markers[i].visible = false;
            onToast?.(`Chai ${found.size}/5 — ${spot.name}`);
            onHud?.({ chai: found.size });
          }
        });
      }

      // weather animation
      if (rain.visible) {
        const pos = rainGeo.attributes.position;
        for (let i = 0; i < rainCount; i += 1) {
          let y = pos.getY(i) - dt * 22;
          if (y < 0) y = 36 + Math.random() * 6;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
        rain.position.set(camera.position.x, 0, camera.position.z);
      }
      if (dust.visible) {
        const pos = dustGeo.attributes.position;
        for (let i = 0; i < dustCount; i += 1) {
          pos.setX(i, pos.getX(i) + dt * (2 + (i % 5)));
          if (pos.getX(i) > 120) pos.setX(i, -120);
        }
        pos.needsUpdate = true;
      }

      // markers bob
      markers.forEach((m, i) => {
        if (found.has(i)) return;
        m.position.y = 0.3 + Math.sin(t * 2 + i) * 0.12;
        m.rotation.y = t * 0.8;
      });
    },

    state() {
      return {
        driving: drive.on,
        photo: photo.on,
        phase: phases[phaseIndex].name,
        weather: weatherStates[weatherIndex],
        chai: found.size,
      };
    },
  };

  applyPhase();
  return api;
}
