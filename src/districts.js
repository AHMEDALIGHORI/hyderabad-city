import * as THREE from 'three';

/**
 * The towns of Hyderabad, Sindh — each with a real position in the world, a
 * gantry sign at its edge, and a card that appears as the camera arrives.
 */
export const DISTRICTS = [
  {
    id: 'saddar',
    name: 'Saddar',
    urdu: 'صدر',
    note: 'The old centre — clock tower, cinemas, the bazaar crowd.',
    at: new THREE.Vector3(0, 0, 0),
    signAt: new THREE.Vector3(0, 0, 34),
    yaw: Math.PI,
  },
  {
    id: 'latifabad',
    name: 'Latifabad',
    urdu: 'لطیف آباد',
    note: 'Twelve units of grid streets, chai khana at every corner.',
    at: new THREE.Vector3(-96, 0, -40),
    signAt: new THREE.Vector3(-70, 0, -40),
    yaw: -Math.PI / 2,
  },
  {
    id: 'qasimabad',
    name: 'Qasimabad',
    urdu: 'قاسم آباد',
    note: 'The newer side — malls, offices, glass after sunset.',
    at: new THREE.Vector3(96, 0, 40),
    signAt: new THREE.Vector3(66, 0, 40),
    yaw: Math.PI / 2,
  },
  {
    id: 'hirabad',
    name: 'Hirabad',
    urdu: 'ہیرآباد',
    note: 'Narrow lanes, workshops, the smell of diesel and frying.',
    at: new THREE.Vector3(-96, 0, 96),
    signAt: new THREE.Vector3(-96, 0, 66),
    yaw: 0,
  },
  {
    id: 'gor',
    name: 'GOR Colony',
    urdu: 'جی او آر',
    note: 'Bungalows behind walls, trees over the road.',
    at: new THREE.Vector3(96, 0, -96),
    signAt: new THREE.Vector3(96, 0, -66),
    yaw: Math.PI,
  },
  {
    id: 'autobhan',
    name: 'Auto Bhan',
    urdu: 'آٹو بھان',
    note: 'The long road south — rickshaws, buses, workshops.',
    at: new THREE.Vector3(0, 0, -150),
    signAt: new THREE.Vector3(0, 0, -118),
    yaw: 0,
  },
  {
    id: 'site',
    name: 'S.I.T.E.',
    urdu: 'سائٹ',
    note: 'Industry: sheds, chimneys, trucks queuing at the gate.',
    at: new THREE.Vector3(-150, 0, 150),
    signAt: new THREE.Vector3(-118, 0, 150),
    yaw: -Math.PI / 2,
  },
  {
    id: 'paretabad',
    name: 'Paretabad',
    urdu: 'پریٹ آباد',
    note: 'Dense, low, alive — shopfronts stacked three deep.',
    at: new THREE.Vector3(150, 0, 150),
    signAt: new THREE.Vector3(150, 0, 118),
    yaw: Math.PI,
  },
  {
    id: 'phuleli',
    name: 'Phuleli',
    urdu: 'پھلیلی',
    note: 'Canals, vegetable trucks, the water that feeds the fields.',
    at: new THREE.Vector3(0, 0, 150),
    signAt: new THREE.Vector3(0, 0, 118),
    yaw: Math.PI,
  },
  {
    id: 'bhitai',
    name: 'Bhitai Nagar',
    urdu: 'بھٹائی نگر',
    note: 'Quiet streets named after a poet.',
    at: new THREE.Vector3(-150, 0, -150),
    signAt: new THREE.Vector3(-150, 0, -118),
    yaw: 0,
  },
  {
    id: 'tando',
    name: 'Tando Yousaf',
    urdu: 'ٹنڈو یوسف',
    note: 'The road out of town, trucks and dhabas all night.',
    at: new THREE.Vector3(150, 0, -150),
    signAt: new THREE.Vector3(150, 0, -118),
    yaw: 0,
  },
];

function signTexture(title, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1a0a18');
  grad.addColorStop(1, '#2a0f22');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 256);

  ctx.strokeStyle = '#4fe3ff';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 1004, 236);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = '#ff4fa3';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#fff3e4';
  ctx.font = 'bold 118px "Bebas Neue", Impact, sans-serif';
  ctx.fillText(title.toUpperCase(), 512, 108, 880);

  ctx.shadowColor = '#4fe3ff';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#8fe9ff';
  ctx.font = '500 44px "Space Grotesk", Inter, sans-serif';
  ctx.fillText(subtitle, 512, 196, 820);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A gantry over the road: two posts, a beam, and the district board. */
export function createDistrictSigns(scene) {
  const posts = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.6, metalness: 0.5 });
  const boards = [];

  for (const district of DISTRICTS) {
    const group = new THREE.Group();
    const { x, z } = district.signAt;

    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 11, 0.6), posts);
      post.position.set(x + side * 9, 5.5, z);
      scene.add(post);
    }

    const beam = new THREE.Mesh(new THREE.BoxGeometry(19, 0.8, 0.8), posts);
    beam.position.set(x, 11.2, z);
    scene.add(beam);

    const tex = signTexture(district.name, district.urdu);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 4.2),
      new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 1.1,
        side: THREE.DoubleSide,
      }),
    );
    face.position.set(x, 9, z + (district.yaw === 0 ? 0.6 : -0.6));
    face.rotation.y = district.yaw;
    scene.add(face);

    boards.push({ district, face, group });
  }

  return boards;
}
