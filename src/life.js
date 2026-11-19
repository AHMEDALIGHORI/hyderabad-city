import * as THREE from 'three';

/**
 * Street life: traffic on the road grid and people on the pavements.
 * People are articulated — hips, knees, shoulders, elbows — so the walk reads
 * as a walk rather than a sliding box.
 */

const PITCH = 60;
const ROAD_OFFSET = -23;
const BOUND = 260;

function rngFrom(seed) {
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return { next, uniform: (a, b) => a + next() * (b - a), pick: (arr) => arr[Math.floor(next() * arr.length)] };
}

function makeWheel(radius, width, material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 12), material);
  m.rotation.z = Math.PI / 2;
  return m;
}

/* ---------------------------------------------------------------- vehicles */

function buildRickshaw(rng) {
  const group = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({
    color: 0xf2c12e, roughness: 0.4, metalness: 0.25, emissive: 0x2a1c00, emissiveIntensity: 0.4,
  });
  const black = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.7, metalness: 0.3 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.25, 1.35), yellow);
  body.position.y = 0.95;
  group.add(body);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 1.3), black);
  roof.position.y = 1.85;
  group.add(roof);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.6, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x22424f, roughness: 0.15, metalness: 0.6 }),
  );
  glass.position.set(1.28, 1.5, 0);
  group.add(glass);

  for (const [x, z] of [[-1, 0.62], [1, 0.62], [-1, -0.62], [1, -0.62]]) {
    const w = makeWheel(0.32, 0.16, black);
    w.position.set(x, 0.32, z);
    group.add(w);
  }

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff3d0, emissive: 0xfff0c0, emissiveIntensity: 6 }),
  );
  head.position.set(1.32, 0.75, 0);
  group.add(head);

  const tail = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff1a1a, emissiveIntensity: 5 }),
  );
  tail.position.set(-1.32, 0.75, 0);
  group.add(tail);

  group.userData.rng = rng;
  return group;
}

function buildSedan(rng) {
  const group = new THREE.Group();
  const palette = [0xd8d2c4, 0x8f1f24, 0x1f5a60, 0x2b2f52, 0xcf7b28];
  const paint = new THREE.MeshStandardMaterial({
    color: palette[rng.pick(palette.map((_, i) => i))],
    roughness: 0.32,
    metalness: 0.45,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.6, metalness: 0.4 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.8, 1.9), paint);
  body.position.y = 0.72;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.66, 1.72), paint);
  cabin.position.set(-0.15, 1.42, 0);
  group.add(cabin);

  for (const [x, z] of [[-1.45, 0.86], [1.45, 0.86], [-1.45, -0.86], [1.45, -0.86]]) {
    const w = makeWheel(0.36, 0.2, dark);
    w.position.set(x, 0.36, z);
    group.add(w);
  }

  for (const z of [-0.62, 0.62]) {
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff6de, emissive: 0xfff2c8, emissiveIntensity: 7 }),
    );
    head.position.set(2.2, 0.72, z);
    group.add(head);
  }

  return group;
}

export function createTraffic(scene, { count = 16 } = {}) {
  const rng = rngFrom(20261120);
  const lanes = [];
  for (let i = -3; i <= 3; i += 1) {
    lanes.push({ axis: 'z', at: i * PITCH + ROAD_OFFSET });
    lanes.push({ axis: 'x', at: i * PITCH + ROAD_OFFSET });
  }

  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const lane = lanes[Math.floor(rng.next() * lanes.length)];
    const isRickshaw = rng.next() < 0.45;
    const mesh = isRickshaw ? buildRickshaw(rng) : buildSedan(rng);
    const direction = rng.next() < 0.5 ? 1 : -1;
    const offset = (rng.next() < 0.5 ? 1 : -1) * 3.2;
    const start = rng.uniform(-BOUND, BOUND);

    if (lane.axis === 'z') {
      mesh.position.set(lane.at + offset, 0, start);
      mesh.rotation.y = direction > 0 ? 0 : Math.PI;
    } else {
      mesh.position.set(start, 0, lane.at + offset);
      mesh.rotation.y = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
    }

    scene.add(mesh);
    cars.push({ mesh, lane, direction, speed: rng.uniform(8, 16) * (isRickshaw ? 0.8 : 1) });
  }

  return {
    update(dt) {
      for (const car of cars) {
        const axis = car.lane.axis;
        car.mesh.position[axis] += car.speed * car.direction * dt;
        if (car.mesh.position[axis] > BOUND) car.mesh.position[axis] = -BOUND;
        if (car.mesh.position[axis] < -BOUND) car.mesh.position[axis] = BOUND;
      }
    },
  };
}

/* ------------------------------------------------------------- pedestrians */

const SKIN = [0xb07a52, 0x9a6642, 0xc08a62, 0x8a5a3c];
const SHIRT = [0xd9c3a5, 0x4a6b8a, 0x7a3f4a, 0x3f6b53, 0xc9a227, 0x2d2d3a, 0x8c5a3c, 0x5a6a8a];
const TROUSER = [0x25262e, 0x3a3a46, 0x4a4238, 0x2a2f3a];

/**
 * One figure: pelvis → torso → head, hips with thigh/shin/foot, shoulders with
 * upper arm/forearm. Everything below hangs off pivots so rotation reads as a gait.
 */
function buildPerson(rng) {
  const root = new THREE.Group();
  const hipHeight = rng.uniform(0.86, 0.96);
  const scale = rng.uniform(0.93, 1.07);

  const skinMat = new THREE.MeshStandardMaterial({ color: rng.pick(SKIN), roughness: 0.85 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: rng.pick(SHIRT), roughness: 0.9 });
  const trouserMat = new THREE.MeshStandardMaterial({ color: rng.pick(TROUSER), roughness: 0.92 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.8 });

  const pelvis = new THREE.Group();
  pelvis.position.y = hipHeight;
  root.add(pelvis);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 8), shirtMat);
  torso.position.y = 0.33;
  pelvis.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 10), skinMat);
  head.position.y = 0.72;
  pelvis.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.142, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.95 }),
  );
  hair.position.y = 0.735;
  pelvis.add(hair);

  const limbs = { hips: [], knees: [], shoulders: [], elbows: [] };

  for (const side of [-1, 1]) {
    // leg: hip pivot → thigh → knee pivot → shin → foot
    const hip = new THREE.Group();
    hip.position.set(side * 0.095, -0.02, 0);
    pelvis.add(hip);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 4, 8), trouserMat);
    thigh.position.y = -0.19;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.38;
    hip.add(knee);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.3, 4, 8), trouserMat);
    shin.position.y = -0.17;
    knee.add(shin);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), shoeMat);
    foot.position.set(0, -0.35, 0.06);
    knee.add(foot);

    limbs.hips.push(hip);
    limbs.knees.push(knee);

    // arm: shoulder pivot → upper arm → elbow pivot → forearm
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.2, 0.55, 0);
    pelvis.add(shoulder);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.24, 4, 8), shirtMat);
    upper.position.y = -0.15;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 4, 8), skinMat);
    forearm.position.y = -0.13;
    elbow.add(forearm);

    limbs.shoulders.push(shoulder);
    limbs.elbows.push(elbow);
  }

  root.scale.setScalar(scale);
  root.userData.limbs = limbs;
  return root;
}

export function createPedestrians(scene, { count = 26 } = {}) {
  const rng = rngFrom(77123);
  const people = [];

  for (let i = 0; i < count; i += 1) {
    const person = buildPerson(rng);

    const axis = rng.next() < 0.5 ? 'x' : 'z';
    const lane = Math.round(rng.uniform(-2.5, 2.5)) * PITCH + ROAD_OFFSET;
    const at = lane + (rng.next() < 0.5 ? -19 : 19);
    const along = rng.uniform(-BOUND, BOUND);
    const dir = rng.next() < 0.5 ? 1 : -1;
    const standing = rng.next() < 0.16; // a few people just stand and talk

    person.position.set(axis === 'x' ? along : at, 0.16, axis === 'x' ? at : along);
    person.rotation.y = axis === 'x'
      ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2)
      : (dir > 0 ? 0 : Math.PI);
    scene.add(person);

    people.push({
      mesh: person,
      axis,
      dir,
      speed: standing ? 0 : rng.uniform(1.0, 1.7),
      stride: rng.uniform(0.7, 1.15),
      phase: rng.uniform(0, Math.PI * 2),
      standing,
      idleTurn: rng.uniform(0, Math.PI * 2),
    });
  }

  return {
    update(dt, t) {
      for (const p of people) {
        const limbs = p.mesh.userData.limbs;
        if (p.standing) {
          // weight shift + a slow look around
          p.mesh.rotation.y = p.idleTurn + Math.sin(t * 0.4 + p.phase) * 0.25;
          p.mesh.position.y = 0.16;
          limbs.hips.forEach((h) => { h.rotation.x = 0; });
          limbs.knees.forEach((k) => { k.rotation.x = 0; });
          limbs.shoulders.forEach((s, i) => { s.rotation.x = Math.sin(t * 1.1 + i) * 0.06; });
          limbs.elbows.forEach((e) => { e.rotation.x = -0.12; });
          continue;
        }

        p.mesh.position[p.axis] += p.speed * p.dir * dt;
        if (p.mesh.position[p.axis] > BOUND) p.mesh.position[p.axis] = -BOUND;
        if (p.mesh.position[p.axis] < -BOUND) p.mesh.position[p.axis] = BOUND;

        // stride frequency scales with speed, like a real gait
        const freq = 1.55 * p.speed * p.stride;
        p.phase += dt * freq;
        const swing = Math.sin(p.phase);
        const swingB = Math.sin(p.phase + Math.PI);

        // hips alternate; knees only bend on the recovery (backward) half
        limbs.hips[0].rotation.x = swing * 0.55 * p.stride;
        limbs.hips[1].rotation.x = swingB * 0.55 * p.stride;
        limbs.knees[0].rotation.x = Math.max(0, -swing) * 0.85 * p.stride;
        limbs.knees[1].rotation.x = Math.max(0, -swingB) * 0.85 * p.stride;

        // arms counter-swing, elbows slightly bent
        limbs.shoulders[0].rotation.x = swingB * 0.42 * p.stride;
        limbs.shoulders[1].rotation.x = swing * 0.42 * p.stride;
        limbs.elbows[0].rotation.x = -0.25 - Math.max(0, swingB) * 0.3;
        limbs.elbows[1].rotation.x = -0.25 - Math.max(0, swing) * 0.3;

        // pelvis rises on the passing position, torso leans in slightly
        const bob = Math.abs(Math.sin(p.phase)) * 0.028;
        p.mesh.position.y = 0.16 + bob;
        p.mesh.rotation.z = Math.sin(p.phase) * 0.02;
      }
    },
  };
}
