import * as THREE from 'three';

/**
 * Street life: traffic on the road grid and people on the pavements.
 * Everything is generated here rather than in Blender so it can move.
 */

const PITCH = 60;
const ROAD_OFFSET = -23; // roads run at n * PITCH + ROAD_OFFSET
const BOUND = 260;

function lanePositions() {
  const lanes = [];
  for (let i = -3; i <= 3; i += 1) {
    lanes.push({ axis: 'z', at: i * PITCH + ROAD_OFFSET }); // road along Z
    lanes.push({ axis: 'x', at: i * PITCH + ROAD_OFFSET }); // road along X
  }
  return lanes;
}

function makeWheel(radius, width, material) {
  const g = new THREE.CylinderGeometry(radius, radius, width, 12);
  const m = new THREE.Mesh(g, material);
  m.rotation.z = Math.PI / 2;
  return m;
}

function buildRickshaw(rng) {
  const group = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({
    color: 0xf2c12e, roughness: 0.4, metalness: 0.25,
    emissive: 0x2a1c00, emissiveIntensity: 0.4,
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

  // headlight + tail light
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
    color: palette[rng.randrange(palette.length)],
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

  const windscreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.5, 1.55),
    new THREE.MeshStandardMaterial({ color: 0x0e2028, roughness: 0.12, metalness: 0.7 }),
  );
  windscreen.position.set(0.95, 1.42, 0);
  group.add(windscreen);

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

    const tail = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1414, emissiveIntensity: 5 }),
    );
    tail.position.set(-2.2, 0.72, z);
    group.add(tail);
  }

  return group;
}

export function createTraffic(scene, { count = 16 } = {}) {
  const rng = (() => {
    let s = 20261120;
    return {
      next: () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
      },
      uniform: (a, b) => a + ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296) * (b - a),
      randrange: (n) => Math.floor(((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296) * n),
    };
  })();

  const lanes = lanePositions();
  const cars = [];

  for (let i = 0; i < count; i += 1) {
    const lane = lanes[rng.randrange(lanes.length)];
    const isRickshaw = rng.next() < 0.45;
    const mesh = isRickshaw ? buildRickshaw(rng) : buildSedan(rng);

    const direction = rng.next() < 0.5 ? 1 : -1;
    const offset = (rng.next() < 0.5 ? 1 : -1) * 3.2; // keep to one side of the road
    const start = rng.uniform(-BOUND, BOUND);

    if (lane.axis === 'z') {
      mesh.position.set(lane.at + offset, 0, start);
      mesh.rotation.y = direction > 0 ? 0 : Math.PI;
    } else {
      mesh.position.set(start, 0, lane.at + offset);
      mesh.rotation.y = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
    }

    scene.add(mesh);
    cars.push({
      mesh,
      lane,
      offset,
      direction,
      speed: rng.uniform(8, 16) * (isRickshaw ? 0.8 : 1),
    });
  }

  return {
    update(dt) {
      for (const car of cars) {
        const axis = car.lane.axis === 'z' ? 'z' : 'x';
        car.mesh.position[axis] += car.speed * car.direction * dt;
        if (car.mesh.position[axis] > BOUND) car.mesh.position[axis] = -BOUND;
        if (car.mesh.position[axis] < -BOUND) car.mesh.position[axis] = BOUND;
      }
    },
  };
}

export function createPedestrians(scene, { count = 22 } = {}) {
  const rng = (() => {
    let s = 77123;
    return {
      uniform: (a, b) => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return a + (s / 4294967296) * (b - a);
      },
    };
  })();

  const palette = [0xd9c3a5, 0x8c5a3c, 0x4a6b8a, 0x7a3f4a, 0x3f6b53, 0xc9a227, 0x2d2d3a];
  const people = [];

  const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.72, 4, 8);
  const headGeo = new THREE.SphereGeometry(0.16, 10, 8);
  const legGeo = new THREE.BoxGeometry(0.14, 0.62, 0.16);

  for (let i = 0; i < count; i += 1) {
    const group = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({
      color: palette[Math.floor(rng.uniform(0, palette.length))],
      roughness: 0.85,
    });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb07a52, roughness: 0.9 });

    const body = new THREE.Mesh(bodyGeo, shirt);
    body.position.y = 1.05;
    group.add(body);

    const head = new THREE.Mesh(headGeo, skin);
    head.position.y = 1.62;
    group.add(head);

    const legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: 0x25262e, roughness: 0.9 }));
      leg.position.set(side * 0.11, 0.31, 0);
      group.add(leg);
      legs.push(leg);
    }

    // walk along a pavement edge
    const axis = rng.uniform(0, 1) < 0.5 ? 'x' : 'z';
    const at = (Math.round(rng.uniform(-2.5, 2.5)) * PITCH) + (rng.uniform(0, 1) < 0.5 ? -21 : 21);
    const along = rng.uniform(-BOUND, BOUND);
    const dir = rng.uniform(0, 1) < 0.5 ? 1 : -1;
    const speed = rng.uniform(1.1, 1.8);

    group.position.set(axis === 'x' ? along : at, 0.16, axis === 'x' ? at : along);
    group.rotation.y = axis === 'x' ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    scene.add(group);

    people.push({ group, legs, axis, dir, speed, phase: rng.uniform(0, Math.PI * 2) });
  }

  return {
    update(dt, t) {
      for (const p of people) {
        p.group.position[p.axis] += p.speed * p.dir * dt;
        if (p.group.position[p.axis] > BOUND) p.group.position[p.axis] = -BOUND;
        if (p.group.position[p.axis] < -BOUND) p.group.position[p.axis] = BOUND;

        const swing = Math.sin(t * 6 * p.speed + p.phase) * 0.35;
        p.legs[0].rotation.x = swing;
        p.legs[1].rotation.x = -swing;
        p.group.position.y = 0.16 + Math.abs(Math.sin(t * 6 * p.speed + p.phase)) * 0.035;
      }
    },
  };
}
