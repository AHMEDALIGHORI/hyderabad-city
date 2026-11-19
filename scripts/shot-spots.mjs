/** Visit the new destinations and photograph each one. */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const URL = process.argv[2] || 'http://127.0.0.1:5190/';
const OUT = path.resolve(process.argv[3] || 'shots-spots');
const PORT = 9411;
const W = 1600;
const H = 900;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);

await mkdir(OUT, { recursive: true });

const child = spawn(exe, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.resolve('.edge-spots')}`,
  `--window-size=${W},${H}`, '--hide-scrollbars', '--no-first-run',
  '--use-angle=d3d11', '--enable-gpu', 'about:blank',
], { stdio: 'ignore' });

for (let i = 0; i < 80; i += 1) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch { /* retry */ }
  await sleep(250);
}

const target = await (
  await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL)}`, { method: 'PUT' })
).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});

let id = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const i = (id += 1);
  pending.set(i, { resolve, reject });
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${URL}${URL.includes('?') ? '&' : '?'}t=${Date.now()}` });

for (let i = 0; i < 80; i += 1) {
  if (await evaluate("document.getElementById('loader')?.dataset.done === 'true'")) break;
  await sleep(500);
}
await sleep(1500);

const spots = [
  { name: '01-mall', x: 60, z: 40, yaw: -Math.PI / 2 },
  { name: '02-dhaba', x: -60, z: -40, yaw: Math.PI / 2 },
  { name: '03-gym', x: 60, z: -96, yaw: -Math.PI / 2 },
  { name: '04-shoes', x: -60, z: 96, yaw: Math.PI / 2 },
  { name: '05-street-animals', x: -23, z: -10, yaw: 0 },
];

for (const spot of spots) {
  await evaluate(`window.__tp(${spot.x}, ${spot.z}, ${spot.yaw})`);
  await sleep(1400);
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(path.join(OUT, `${spot.name}.png`), Buffer.from(data, 'base64'));
  console.log('shot', spot.name);
}

const summary = await evaluate(`(() => {
  let counts = { animals: 0, trees: 0, bikes: 0 };
  return JSON.stringify(counts);
})()`);
console.log('done', summary);
child.kill();
process.exit(0);
