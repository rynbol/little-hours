import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir, lhDir, track, untrack } from './state.mjs';

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const slow = Math.max(1, Number(process.env.LH_SLOW) || 1);

export const chromePath = process.env.CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome');

export const gpuFlag = process.env.LH_ANGLE || (process.platform === 'darwin' ? 'metal' : 'swiftshader');

const open = new Set();

export function killAllNow() {
  for (const browser of open) browser.killNow();
}

export async function closeAll() {
  await Promise.all([...open].map(browser => browser.close()));
}

export async function launch({ width = 1440, height = 1000, scale = 2, headed = false, reducedMotion = false } = {}) {
  const dir = mkdtempSync(join(ensureDir(join(lhDir, 'tmp')), 'chrome-'));
  const args = [
    `--user-data-dir=${dir}`, '--remote-debugging-port=0', headed ? '' : '--headless=new',
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    `--use-angle=${gpuFlag}`, gpuFlag === 'swiftshader' ? '--enable-unsafe-swiftshader' : '', process.env.CI ? '--no-sandbox' : '',
    `--window-size=${width},${height}`, 'about:blank',
  ].filter(Boolean);
  const proc = spawn(chromePath, args, { stdio: 'ignore' });
  track({ pid: proc.pid, marker: dir, dir, kind: 'chrome', startedAt: new Date().toISOString() });
  let exited = false;
  proc.on('exit', () => { exited = true; });
  const cleanup = () => { rmSync(dir, { recursive: true, force: true }); untrack(proc.pid); };

  let port;
  for (let i = 0; i < 150 && !port; i++) {
    await sleep(100);
    if (exited) break;
    const file = join(dir, 'DevToolsActivePort');
    if (existsSync(file)) port = Number(readFileSync(file, 'utf8').split('\n')[0]);
  }
  if (!port) { try { proc.kill('SIGKILL'); } catch {} cleanup(); throw new Error(`Chrome did not start (${chromePath})`); }
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(entry => entry.type === 'page'); } catch {}
    if (!target) await sleep(100);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let id = 0;
  const waiting = new Map(), listeners = new Set(), errors = [];
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { waiting.get(message.id)?.(message); waiting.delete(message.id); return; }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' '));
    for (const listener of listeners) listener(message);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    if (ws.readyState !== WebSocket.OPEN) { reject(new Error(`Chrome connection closed before ${method}`)); return; }
    const n = ++id;
    waiting.set(n, message => message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: width < 600 });
  if (reducedMotion) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  const js = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, clickCount: 1 });

  const browser = {
    send, js, errors, width, height, scale,
    on(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async navigate(url) {
      await send('Page.navigate', { url });
      for (let i = 0; i < 200; i++) { await sleep(50); if (await js('document.readyState').catch(() => '') === 'complete') return; }
      throw new Error(`Page did not load: ${url}`);
    },
    move: (x, y) => mouse('mouseMoved', x, y),
    async click(x, y) {
      await mouse('mouseMoved', x, y); await sleep(40);
      await mouse('mousePressed', x, y, 1); await sleep(40);
      await mouse('mouseReleased', x, y);
    },
    async drag(from, to, steps = 12) {
      await mouse('mouseMoved', from.x, from.y); await sleep(40);
      await mouse('mousePressed', from.x, from.y, 1);
      for (let i = 1; i <= steps; i++) { await sleep(16); await mouse('mouseMoved', from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps, 1); }
      await sleep(40); await mouse('mouseReleased', to.x, to.y);
    },
    async key(key, code = key) {
      const text = key.length === 1 ? key : undefined;
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text, windowsVirtualKeyCode: key === 'Escape' ? 27 : key === 'Enter' ? 13 : key === 'Tab' ? 9 : undefined });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
    },
    async box(selector) {
      return js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const b = el.getBoundingClientRect(); const style = getComputedStyle(el); return b.width && b.height && style.visibility !== 'hidden' ? { x: b.left + b.width / 2, y: b.top + b.height / 2, width: b.width, height: b.height, disabled: Boolean(el.disabled) } : null; })()`);
    },
    async clickSel(selector, { timeout = 5000 } = {}) {
      const end = Date.now() + timeout;
      let box;
      while (!(box = await browser.box(selector)) || box.disabled) {
        if (Date.now() > end) throw new Error(box?.disabled ? `Disabled: ${selector}` : `Not visible: ${selector}`);
        await sleep(50);
      }
      await browser.click(box.x, box.y);
    },
    async shot(path, { format = path.endsWith('.png') ? 'png' : 'jpeg' } = {}) {
      const result = await send('Page.captureScreenshot', format === 'png' ? { format } : { format, quality: 85 });
      writeFileSync(path, Buffer.from(result.data, 'base64'));
      return path;
    },
    killNow() {
      try { proc.kill('SIGKILL'); } catch {}
      try { ws.close(); } catch {}
      open.delete(browser); cleanup();
    },
    async close() {
      if (!open.has(browser)) return;
      open.delete(browser);
      try { await Promise.race([send('Browser.close'), sleep(1500)]); } catch {}
      for (let i = 0; i < 30 && !exited; i++) await sleep(100);
      if (!exited) try { proc.kill('SIGKILL'); } catch {}
      try { ws.close(); } catch {}
      cleanup();
    },
  };
  open.add(browser);
  return browser;
}
