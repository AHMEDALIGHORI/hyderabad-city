/**
 * Screenshot the city: after the intro, and after walking forward for a bit.
 *
 *   node scripts/shot.mjs [url] [outDir]
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const URL = process.argv[2] || 'http://127.0.0.1:5190/';
const OUT = path.resolve(process.argv[3] || 'shots');
const PORT = 9399;
const W = 1600;
const H = 900;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);

await mkdir(OUT, { recursive: true });

const child = spawn(exe, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.resolve('.edge-shot')}`,
  `--window-size=${W},${H}`,
  '--hide-scrollbars',
  '--no-first-run',
  '--use-angle=d3d11',
  '--enable-gpu',
  'about:blank',
], { stdio: 'ignore' });

for (let i = 0; i < 80; i += 1) {
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break;
  } catch { /* retry */ }
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
const problems = [];
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    problems.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    problems.push(msg.params.exceptionDetails?.exception?.description || 'exception');
  }
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const i = (id += 1);
  pending.set(i, { resolve, reject });
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
const shoot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log('shot', name);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL });

for (let i = 0; i < 80; i += 1) {
  if (await evaluate("document.getElementById('loader')?.dataset.done === 'true'")) break;
  await sleep(500);
}

await sleep(1200);
await shoot('01-aerial');

// wait for the intro fly-in to finish
await sleep(4200);
await shoot('02-street');

// walk forward for a few seconds
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', windowsVirtualKeyCode: 87 });
await sleep(3500);
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', windowsVirtualKeyCode: 87 });
await sleep(400);
await shoot('03-walk');

// look around with a drag
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 800, y: 450, button: 'left', clickCount: 1 });
for (let i = 0; i < 12; i += 1) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 800 + i * 14, y: 450, button: 'left' });
  await sleep(40);
}
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 968, y: 450, button: 'left', clickCount: 1 });
await sleep(600);
await shoot('04-look');

// neon off
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'n', windowsVirtualKeyCode: 78 });
await sleep(1200);
await shoot('05-neon-off');

console.log('state:', await evaluate("JSON.stringify({ x: Math.round(window.__playerX||0) })"));
console.log(problems.length ? `console problems:\n${[...new Set(problems)].join('\n')}` : 'no console errors');
child.kill();
process.exit(0);
