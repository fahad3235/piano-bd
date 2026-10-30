// Headless-Chrome smoke test (raw CDP) for piano-bd. Run: node tests/smoke.mjs
import { spawn } from 'node:child_process';

const CHROME = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const PAGE = 'file:///home/hatch/workspace/muse-project-factory/builds/piano-bd/index.html';
let pass = 0, fail = 0;
const failures = [];
function check(cond, label) {
  if (cond) pass++; else { fail++; failures.push(label); console.log('FAIL - ' + label); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', '--user-data-dir=/tmp/piano-bd-profile-' + Date.now(), 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let wsUrl = null, httpPort = null;
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('no DevTools URL')), 15000);
    chrome.stderr.on('data', d => {
      const m = String(d).match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) { wsUrl = m[1]; httpPort = new URL(wsUrl.replace(/^ws:\/\//, 'http://')).port; clearTimeout(t); resolve(); }
    });
    chrome.on('error', reject);
  });
  const res = await fetch(`http://127.0.0.1:${httpPort}/json/new?${encodeURIComponent(PAGE)}`, { method: 'PUT' });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res2, rej) => { ws.onopen = res2; ws.onerror = rej; });
  let id = 0; const pending = new Map(); let loadResolve = null;
  const consoleErrors = [], pageErrors = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push((m.params.args || []).map(a => a.value ?? '').join(' '));
    else if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.text || 'exception');
    else if (m.method === 'Page.loadEventFired' && loadResolve) { loadResolve(); loadResolve = null; }
  };
  function send(method, params = {}) { return new Promise(resolve => { const myId = ++id; pending.set(myId, resolve); ws.send(JSON.stringify({ id: myId, method, params })); }); }
  const waitLoad = () => new Promise(r => { loadResolve = r; setTimeout(r, 8000); });
  async function ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; }
  const text = sel => ev(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent`);
  const pressKey = midi => ev(`(function(){var el=document.querySelector('[data-midi="${midi}"]');el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));})()`);

  await send('Page.enable'); await send('Runtime.enable');
  const loaded = waitLoad(); await send('Page.navigate', { url: PAGE }); await loaded; await sleep(400);

  check(await ev('document.title') === 'Piano BD — Play, Record & Learn', 'title correct');
  check(await ev("document.querySelectorAll('#keyboard .key').length") === 24, '24 keys rendered');
  check(await ev("document.querySelectorAll('#keyboard .key.white').length") === 14, '14 white keys');
  check(await ev("document.querySelectorAll('#keyboard .key.black').length") === 10, '10 black keys');
  check(consoleErrors.length === 0, 'zero console errors on load (got ' + consoleErrors.length + ')');
  check(pageErrors.length === 0, 'zero page errors on load (got ' + pageErrors.length + ')');
  check(await ev("performance.getEntriesByType('resource').length") === 0, 'zero network resource requests');

  await pressKey(60); await sleep(200);
  check(String(await text('#last-note')).includes('C4'), 'press C4 shows C4 in last note');
  check(String(await text('#last-note')).includes('261.63'), 'C4 shows 261.63 Hz');
  check(String(await text('#last-note')).includes('Sa'), 'C4 shows sargam Sa');
  await pressKey(69); await sleep(200);
  check(String(await text('#last-note')).includes('A4'), 'press A4 shows A4');

  // Record first (before any tune timers are running, so no stray notes land in it):
  // record two notes, stop, row appears
  await ev(`document.getElementById('rec-btn').click()`); await sleep(100);
  await pressKey(60); await pressKey(64); await sleep(100);
  await ev(`document.getElementById('rec-btn').click()`); await sleep(200);
  check(String(await text('#rec-list')).includes('Recording 1'), 'recording row appears after stop');
  check(String(await text('#rec-list')).includes('2 notes'), 'recording row shows 2 notes');

  // Learn: play tune + step
  await ev(`document.getElementById('tune-btn').click()`); await sleep(300);
  check(String(await text('#tune-status')).includes('Twinkle'), 'play tune sets Twinkle status');
  await ev(`document.getElementById('tune-select').value='ode'; document.getElementById('tune-select').dispatchEvent(new Event('change',{bubbles:true})); document.getElementById('step-btn').click()`); await sleep(200);
  check(String(await text('#tune-status')).includes('E4'), 'step on Ode to Joy plays E4 first note');

  // BN toggle + persistence
  await ev(`document.getElementById('lang-btn').click()`); await sleep(200);
  check(await text('#app-title') === 'পিয়ানো বিডি', 'BN toggle shows Bengali title');
  const rl = waitLoad(); await send('Page.reload'); await rl; await sleep(400);
  check(await ev("localStorage.getItem('piano-bd-lang')") === 'bn', 'language persists in localStorage');
  check(await text('#app-title') === 'পিয়ানো বিডি', 'BN title restored after reload');

  // 390px viewport: no horizontal overflow
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const rl2 = waitLoad(); await send('Page.reload'); await rl2; await sleep(400);
  const sw = await ev('document.documentElement.scrollWidth');
  check(sw <= 390, '390px viewport: no horizontal overflow (scrollWidth=' + sw + ')');
  check(await ev("document.querySelectorAll('#keyboard .key').length") === 24, '24 keys rendered at 390px');

  check(consoleErrors.length === 0, 'zero console errors overall (got ' + consoleErrors.length + ': ' + consoleErrors.slice(0, 2).join(' | ') + ')');
  check(pageErrors.length === 0, 'zero page errors overall (got ' + pageErrors.length + ')');

  console.log(`\nsmoke: ${pass} passed, ${fail} failed`);
  if (failures.length) { console.log('FAILURES:'); failures.forEach(f => console.log(' - ' + f)); }
  ws.close(); chrome.kill();
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('smoke harness error:', e.message); process.exit(2); });
