import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from './server.mjs';
import { openApp } from './app.mjs';
import { sleep } from './chrome.mjs';
import { dispatchSequenceInput } from './sequence.mjs';
import { fightInput, movementInput, steeringKeys } from './flows/wilds.mjs';
import { repoRoot } from './state.mjs';

const output = join(repoRoot, '..', 'wilds-assets', 'ui-research', 'before');
const diagnostic = 'window.__littleHours.wilds.diagnostics()';
const snapshot = app => app.js(`(() => { const d = ${diagnostic}; return { player: d.player, combat: d.combat, events: d.eventHistory, cameraYaw: d.cameraYaw, elapsedMs: d.elapsedMs }; })()`);
const sizes = (process.env.LH_UI_SIZES || '1280x800,390x844').split(',').map(size => size.split('x').map(Number));
const themes = (process.env.LH_UI_THEMES || 'day,dusk,rain').split(',');

async function tap(app, code) {
  await dispatchSequenceInput(app, { type: 'keyDown', code });
  await dispatchSequenceInput(app, { type: 'keyUp', code });
}

async function survey(url, width, height, theme) {
  const folder = join(output, `${width}x${height}-${theme}`);
  mkdirSync(folder, { recursive: true });
  const app = await openApp(url, { seed: 'one-room', theme, width, height, scale: 1, path: '/checks/wilds.html', storageKey: 'little-hours-wilds-check-v1' });
  const move = movementInput(app), captured = new Set(), records = [];
  async function capture(name, state, backdrop = false) {
    if (captured.has(name)) return;
    captured.add(name);
    const layout = await app.js(`(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('.wilds-hud > *, nav, #loading-note')].filter(n => n.checkVisibility()).map(n => { const b = n.getBoundingClientRect(); return { name: n.className || n.id || n.tagName, text: n.textContent, x: b.x, y: b.y, width: b.width, height: b.height }; }) }))()`);
    await app.shot(join(folder, `${name}.png`));
    if (backdrop) {
      await app.js(`(() => { const style = document.createElement('style'); style.id = 'lh-ui-survey-hide'; style.textContent = '.wilds-hud,nav,#loading-note{visibility:hidden!important}'; document.head.append(style); })()`);
      try { await app.shot(join(folder, `${name}-world.png`)); }
      finally { await app.js(`document.getElementById('lh-ui-survey-hide').remove()`); }
    }
    records.push({ name, ...state, layout });
    writeFileSync(join(folder, 'states.json'), JSON.stringify({ theme, width, height, input: 'Real key and pointer events. No placement, damage or clock control.', records }, null, 2));
    console.log(`${width}x${height} ${theme}: ${name}`);
  }
  try {
    await app.clickSel('#wilds-leave');
    await capture('entering', await snapshot(app));
    await app.clickSel('#wilds-enter');
    await app.waitFor('window.__littleHours.wilds.ready()');
    await capture('exploring', await snapshot(app), true);
    let stage = 'walk', retried = false;
    const began = performance.now();
    while (performance.now() - began < 210000) {
      const state = await snapshot(app);
      const { player, combat } = state, boss = combat.boss;
      if (state.events.some(event => event.type === 'player-defeated') && !retried) {
        await move([]);
        await capture('defeat', state, true);
        retried = true;
        await sleep(5700);
        await capture('retry', await snapshot(app));
        stage = 'walk';
      }
      if (stage === 'walk') {
        const keys = steeringKeys(player.position, { x: -120, z: -200 }, state.cameraYaw, 1.1);
        await move(keys);
        if (!keys.length) {
          await capture('near-boss', state);
          await tap(app, 'Tab');
          await sleep(120);
          await capture('locked', await snapshot(app), true);
          stage = retried ? 'victory' : 'pet';
        }
      } else {
        if (player.health < player.maxHealth) await capture('being-hit', state);
        if (player.health <= 30) await capture('low-health', state);
        if (boss.phase === 2) await capture('boss-phase-two', state);
        if (combat.pet.mode === 'knockout') {
          await capture('pet-knocked-out', state);
          if (!retried) stage = 'death';
        }
        if (boss.mode === 'defeated') {
          await move([]);
          await capture('victory', state);
          break;
        }
        const input = fightInput(state);
        if (stage === 'pet') {
          input.actions = input.actions.filter(code => code !== 'KeyF');
          const gap = Math.hypot(player.position.x - boss.position.x, player.position.z - boss.position.z);
          if (gap > 9 && !['charge', 'telegraph'].includes(boss.mode)) input.keys = [];
        }
        if (stage === 'death') {
          input.keys = steeringKeys(player.position, boss.position, state.cameraYaw, 2);
          input.actions = ['KeyR'];
        }
        await move(input.keys);
        for (const code of input.actions) {
          if (code === 'KeyF') {
            await dispatchSequenceInput(app, { type: 'mousePressed', x: width / 2, y: height / 2, button: 'left', buttons: 1 });
            await dispatchSequenceInput(app, { type: 'mouseReleased', x: width / 2, y: height / 2, button: 'left', buttons: 0 });
          } else await tap(app, code);
        }
      }
      await sleep(80);
    }
    await move([]);
    await app.clickSel('#wilds-leave');
    await capture('leaving', await snapshot(app));
    const expected = ['entering', 'exploring', 'near-boss', 'locked', 'being-hit', 'low-health', 'pet-knocked-out', 'boss-phase-two', 'victory', 'defeat', 'retry', 'leaving'];
    const missing = expected.filter(name => !captured.has(name));
    writeFileSync(join(folder, 'result.json'), JSON.stringify({ missing, errors: app.errors, captured: [...captured] }, null, 2));
    if (missing.length || app.errors.length) throw new Error(`Incomplete UI survey ${folder}: ${missing.join(', ')} ${app.errors.join('; ')}`);
  } finally {
    await move([]).catch(() => {});
    await app.close();
  }
}

const server = await serve();
try {
  for (const [width, height] of sizes) for (const theme of themes) await survey(server.url, width, height, theme);
} finally { await server.close(); }
