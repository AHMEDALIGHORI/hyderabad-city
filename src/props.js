import * as THREE from 'three';

/**
 * Street props the glTF doesn't carry: trees, bicycles, animals, and a few
 * big destinations (mall, dhaba, gym) with glowing canvas signs.
 */

const ROAD = -23;
const PITCH = 60;

function rngFrom(seed) {
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return {
    next,
    uniform: (a, b) => a + next() * (b - a),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

/** Glowing sign from a canvas: the cheapest way to get readable lettering. */
function signTexture(text, colour = '#4fe3ff', bg = 'rgba(8,4,10,0.92)') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);

  ctx.strokeStyle = colour;
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, 996, 228);

  ctx.font = 'bold 132px "Bebas Neue", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = colour;
  ctx.shadowBlur = 42;
  ctx.fillStyle = '#fff4e6';
  ctx.fillText(text, 512, 136, 940);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function signBoard(text, width, height, colour, position, rotationY = 0) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.4, height + 0.4, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x0a0709, roughness: 0.6, metalness: 0.4 }),
  );
  group.add(frame);

  const tex = signTexture(text, colour);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.4,
      toneMapped: true,
    }),
  );
  face.position.z = 0.14;
  group.add(face);

  group.position.copy(position);
  group.rotation.y = rotationY;
  return group;
}

/* ------------------------------------------------------------------ trees */

function buildTree(rng) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, rng.uniform(2.2, 3.2), 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.95 }),
  );
  trunk.position.y = 1.5;
  group.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.3 + rng.uniform(-0.04, 0.04), 0.45, 0.22),
    roughness: 0.9,
  });
  for (let i = 0; i < 3; i += 1) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(rng.uniform(1.1, 1.7), 1), leafMat);
    blob.position.set(rng.uniform(-0.6, 0.6), 3.1 + i * 0.55, rng.uniform(-0.6, 0.6));
    blob.scale.y = 0.85;
    group.add(blob);
  }
  return group;
}

/* --------------------------------------------------------------- bicycles */

function buildBicycle(rng) {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({
    color: rng.pick([0x1f2f4a, 0x8a1f24, 0x2f6b4a, 0x111114]),
    roughness: 0.5,
    metalness: 0.5,
  });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.9 });
  for (const z of [-0.55, 0.55]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.045, 8, 20), tyreMat);
    wheel.position.set(0, 0.34, z);
    group.add(wheel);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.1), frameMat);
  bar.position.y = 0.66;
  group.add(bar);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.28), frameMat);
  seat.position.set(0, 0.86, 0.34);
  group.add(seat);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.05), frameMat);
  handle.position.set(0, 0.92, -0.48);
  group.add(handle);

  return group;
}

/* ---------------------------------------------------------------- animals */

function buildAnimal(kind, rng) {
  const group = new THREE.Group();
  const isCow = kind === 'cow';
  const bodyMat = new THREE.MeshStandardMaterial({
    color: isCow ? rng.pick([0xd9d2c4, 0x8a6a4a, 0x2e2a26]) : rng.pick([0xe4ddcf, 0x6b5a44, 0x30302c]),
    roughness: 0.92,
  });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.95 });

  const bodyW = isCow ? 1.5 : 0.7;
  const bodyH = isCow ? 0.95 : 0.5;
  const bodyD = isCow ? 0.7 : 0.34;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), bodyMat);
  body.position.y = isCow ? 0.95 : 0.5;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW * 0.45, bodyH * 0.55, bodyD * 0.8),
    bodyMat,
  );
  head.position.set(bodyW * 0.55, isCow ? 1.05 : 0.62, 0);
  group.add(head);

  if (isCow) {
    const horns = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8cdb4, roughness: 0.7 }),
    );
    horns.position.set(bodyW * 0.7, 1.28, 0);
    horns.rotation.z = -0.5;
    group.add(horns);
  }

  const legGeo = new THREE.BoxGeometry(0.09, isCow ? 0.62 : 0.34, 0.09);
  const legs = [];
  for (const dx of [-0.45, 0.45]) {
    for (const dz of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(dx * (bodyW / 1.5), isCow ? 0.31 : 0.17, dz);
      group.add(leg);
      legs.push(leg);
    }
  }

  group.userData.legs = legs;
  group.userData.isCow = isCow;
  return group;
}

/* ------------------------------------------------------------ destinations */

function buildMall(position) {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(46, 17, 34),
    new THREE.MeshStandardMaterial({ color: 0x2b2233, roughness: 0.7, metalness: 0.25 }),
  );
  shell.position.y = 8.5;
  group.add(shell);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(40, 9, 0.4),
    new THREE.MeshStandardMaterial({
      color: 0x1a2a3a,
      roughness: 0.15,
      metalness: 0.7,
      emissive: 0x2a4a66,
      emissiveIntensity: 0.6,
    }),
  );
  glass.position.set(0, 5, 17.1);
  group.add(glass);

  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(44, 0.5, 5),
    new THREE.MeshStandardMaterial({ color: 0x3a2f44, roughness: 0.6 }),
  );
  canopy.position.set(0, 10.5, 18.6);
  group.add(canopy);

  group.add(signBoard('HYDERABAD MALL', 30, 4, '#ff4fa3', new THREE.Vector3(0, 13, 17.4)));
  group.add(signBoard('SALE', 9, 2.4, '#ffce6a', new THREE.Vector3(16, 8, 17.3)));

  group.position.copy(position);
  return group;
}

function buildDhaba(position) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(20, 0.3, 14),
    new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.95 }),
  );
  base.position.y = 0.15;
  group.add(base);

  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xb8482e,
    roughness: 0.8,
    emissive: 0x3a0d05,
    emissiveIntensity: 0.5,
  });
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(19, 0.25, 12), canopyMat);
  canopy.position.y = 3.6;
  group.add(canopy);

  for (const x of [-9, 9]) {
    for (const z of [-6, 6]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 3.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.9 }),
      );
      post.position.set(x, 1.8, z);
      group.add(post);
    }
  }

  // charpai beds / benches
  for (let i = 0; i < 3; i += 1) {
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.16, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 }),
    );
    bed.position.set(-6 + i * 6, 0.6, 2);
    group.add(bed);
  }

  // clay oven
  const oven = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.4, 1.5, 12),
    new THREE.MeshStandardMaterial({ color: 0x7a4a34, roughness: 0.95 }),
  );
  oven.position.set(7, 0.9, -4);
  group.add(oven);

  group.add(signBoard('DHABA', 14, 3, '#ffce6a', new THREE.Vector3(0, 5.2, 6.4)));

  group.position.copy(position);
  return group;
}

function buildGym(position) {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(22, 12, 18),
    new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.6, metalness: 0.3 }),
  );
  shell.position.y = 6;
  group.add(shell);

  const windows = new THREE.Mesh(
    new THREE.BoxGeometry(18, 5, 0.3),
    new THREE.MeshStandardMaterial({
      color: 0x2a3a4a,
      roughness: 0.2,
      metalness: 0.6,
      emissive: 0x4fe3ff,
      emissiveIntensity: 0.35,
    }),
  );
  windows.position.set(0, 6.5, 9.1);
  group.add(windows);

  group.add(signBoard('GYM', 10, 3, '#4fe3ff', new THREE.Vector3(0, 10.4, 9.3)));

  group.position.copy(position);
  return group;
}

function buildShoeShop(position) {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(16, 9, 14),
    new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.7 }),
  );
  shell.position.y = 4.5;
  group.add(shell);
  group.add(signBoard('SHOES', 9, 2.6, '#ffce6a', new THREE.Vector3(0, 7.6, 7.2)));
  group.position.copy(position);
  return group;
}

/* ------------------------------------------------------------------- main */

export function createProps(scene) {
  const rng = rngFrom(31337);
  const movers = { animals: [], bikes: [] };

  // trees along the pavements
  for (let i = 0; i < 46; i += 1) {
    const along = rng.uniform(-250, 250);
    const lane = Math.round(rng.uniform(-3, 3)) * PITCH + ROAD;
    const side = rng.next() < 0.5 ? 18 : -18;
    const tree = buildTree(rng);
    if (rng.next() < 0.5) tree.position.set(lane + side, 0.16, along);
    else tree.position.set(along, 0.16, lane + side);
    scene.add(tree);
  }

  // parked bicycles + a few riders
  for (let i = 0; i < 10; i += 1) {
    const bike = buildBicycle(rng);
    const along = rng.uniform(-200, 200);
    const lane = Math.round(rng.uniform(-2, 2)) * PITCH + ROAD;
    bike.position.set(lane + rng.uniform(8, 16), 0.16, along);
    bike.rotation.y = rng.uniform(0, Math.PI * 2);
    scene.add(bike);
    if (i < 3) movers.bikes.push({ mesh: bike, axis: 'z', dir: rng.next() < 0.5 ? 1 : -1, speed: rng.uniform(3, 5) });
  }

  // animals: cows on the road, goats and dogs on the pavements
  const animalKinds = ['cow', 'cow', 'goat', 'goat', 'dog', 'cow', 'goat', 'dog'];
  for (let i = 0; i < 12; i += 1) {
    const kind = animalKinds[i % animalKinds.length];
    const animal = buildAnimal(kind, rng);
    const lane = Math.round(rng.uniform(-2, 2)) * PITCH + ROAD;
    const along = rng.uniform(-220, 220);
    if (rng.next() < 0.5) {
      animal.position.set(lane + rng.uniform(-5, 5), 0.16, along);
      animal.rotation.y = rng.uniform(0, Math.PI * 2);
    } else {
      animal.position.set(along, 0.16, lane + rng.uniform(-5, 5));
      animal.rotation.y = rng.uniform(0, Math.PI * 2);
    }
    scene.add(animal);
    movers.animals.push({
      mesh: animal,
      axis: rng.next() < 0.5 ? 'x' : 'z',
      dir: rng.next() < 0.5 ? 1 : -1,
      speed: kind === 'cow' ? rng.uniform(0.5, 1.0) : rng.uniform(0.8, 1.6),
      phase: rng.uniform(0, Math.PI * 2),
    });
  }

  // destinations
  scene.add(buildMall(new THREE.Vector3(96, 0, 40)));
  scene.add(buildDhaba(new THREE.Vector3(-96, 0, -40)));
  scene.add(buildGym(new THREE.Vector3(96, 0, -96)));
  scene.add(buildShoeShop(new THREE.Vector3(-96, 0, 96)));

  return {
    update(dt, t) {
      for (const a of movers.animals) {
        a.mesh.position[a.axis] += a.speed * a.dir * dt;
        if (a.mesh.position[a.axis] > 240) a.mesh.position[a.axis] = -240;
        if (a.mesh.position[a.axis] < -240) a.mesh.position[a.axis] = 240;
        const legs = a.mesh.userData.legs || [];
        const swing = Math.sin(t * 4 * a.speed + a.phase) * 0.4;
        legs.forEach((leg, i) => {
          leg.rotation.x = i % 2 === 0 ? swing : -swing;
        });
        a.mesh.position.y = 0.16 + Math.abs(Math.sin(t * 4 * a.speed + a.phase)) * 0.02;
      }
      for (const b of movers.bikes) {
        b.mesh.position.z += b.speed * b.dir * dt;
        if (b.mesh.position.z > 240) b.mesh.position.z = -240;
        if (b.mesh.position.z < -240) b.mesh.position.z = 240;
      }
    },
  };
}
