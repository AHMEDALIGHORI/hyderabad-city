/** Verification stills: aerial + two shopfront rows (both facings). */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const URL = process.argv[2] || 'http://127.0.0.1:5190/';
const OUT = path.resolve(process.argv[3] || 'shots-verify');
const PORT = 9455;
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
  `--user-data-dir=${path.resolve('.edge-verify')}`,
  `--window-size=${W},${H}`, '--hide-scrollbars', '--no-first-run',
  '--use-angle=d3d11', '--enable-gpu', 'about:blank',
], { stdio: 'ignore' });

for (let i = 0; i < 80; i += 1) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch { /* retry */ }
  await sleep(250);
}
const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});
let id = 0;
const pending = new Map();
const problems = [];
ws.addEventListener('message', (event) => {
  const m = JSON.parse(event.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    problems.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') problems.push(m.params.exceptionDetails?.exception?.description || 'exception');
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
await send('Page.navigate', { url: `${URL}?v=${Date.now()}` });
for (let i = 0; i < 90; i += 1) {
  if (await evaluate("document.getElementById('loader')?.dataset.done === 'true'")) break;
  await sleep(500);
}
await sleep(2200);

const shots = [
  { name: '01-aerial', code: 'window.__seek(0.26)' },
  { name: '02-north-facing', code: 'window.__look(-23, 3.2, -25, -23, 4.6, -58)' },
  { name: '03-south-facing', code: 'window.__look(-23, 3.2, 95, -23, 4.6, 62)' },
  { name: '04-street-wide', code: 'window.__look(-23, 2.6, 20, 40, 8, -80)' },
];

for (const shot of shots) {
  await evaluate(shot.code);
  await sleep(1200);
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(path.join(OUT, `${shot.name}.png`), Buffer.from(data, 'base64'));
  console.log('shot', shot.name);
}

console.log(problems.length ? `problems:\n${[...new Set(problems)].join('\n')}` : 'no console errors');
child.kill();
process.exit(0);
