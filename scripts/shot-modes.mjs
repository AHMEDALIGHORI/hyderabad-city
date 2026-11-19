/** Exercise every mode key and photograph the result. */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const URL = process.argv[2] || 'http://127.0.0.1:5190/';
const OUT = path.resolve(process.argv[3] || 'shots-modes');
const PORT = 9433;
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
  `--user-data-dir=${path.resolve('.edge-modes')}`,
  `--window-size=${W},${H}`, '--hide-scrollbars', '--no-first-run',
  '--use-angle=d3d11', '--enable-gpu', '--autoplay-policy=no-user-gesture-required', 'about:blank',
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
const key = async (k) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k });
  await sleep(700);
};
const shoot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log('shot', name);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${URL}?m=${Date.now()}` });

for (let i = 0; i < 80; i += 1) {
  if (await evaluate("document.getElementById('loader')?.dataset.done === 'true'")) break;
  await sleep(500);
}
await sleep(2500);

console.log('systems present:', await evaluate('typeof window.__systems'));
console.log('initial state  :', await evaluate('JSON.stringify(window.__systems.state())'));

await evaluate('window.__tp(-23, 20, 0)');
await sleep(1000);
await shoot('01-walk');

await key('t'); // night
await sleep(800);
await shoot('02-night');

await key('t'); // dawn
await sleep(800);
await shoot('03-dawn');

await key('y'); // rain
await sleep(1200);
await shoot('04-rain');

await key('y'); // dust
await sleep(1200);
await shoot('05-dust');

await key('y'); // clear
await key('e'); // drive
await sleep(500);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w' });
await sleep(1800);
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w' });
await sleep(300);
await shoot('06-driving');

await key('e'); // exit
await key('f'); // photo mode
await sleep(900);
await shoot('07-photo');
await key('f');

console.log('final state    :', await evaluate('JSON.stringify(window.__systems.state())'));
console.log(problems.length ? `problems:\n${[...new Set(problems)].join('\n')}` : 'no console errors');

child.kill();
process.exit(0);
