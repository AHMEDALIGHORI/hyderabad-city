/** Print console errors and hook state for the city page. */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const URL = process.argv[2] || 'http://127.0.0.1:5190/';
const PORT = 9422;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);

const child = spawn(exe, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.resolve('.edge-diag')}`,
  '--window-size=1200,700', '--no-first-run', '--use-angle=d3d11', 'about:blank',
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
ws.addEventListener('message', (event) => {
  const m = JSON.parse(event.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    console.log('[console]', m.params.type, m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    console.log('[exception]', d?.text, (d?.exception?.description || '').split('\n').slice(0, 4).join(' | '));
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    console.log('[log]', m.params.entry.text.slice(0, 300));
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const i = (id += 1);
  pending.set(i, { resolve, reject });
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url: `${URL}?d=${Date.now()}` });
await sleep(6000);

console.log('typeof __tp      :', await evaluate('typeof window.__tp'));
console.log('typeof __player  :', await evaluate('typeof window.__player'));
console.log('loader done      :', await evaluate("document.getElementById('loader')?.dataset.done"));
console.log('canvas size      :', await evaluate("(() => { const c = document.getElementById('scene'); return c ? c.width + 'x' + c.height : 'none'; })()"));
console.log('frames advanced  :', await evaluate('window.__frames ?? "no counter"'));
console.log('body children    :', await evaluate('document.body.children.length'));
child.kill();
process.exit(0);
