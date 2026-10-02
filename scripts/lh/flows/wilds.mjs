import { dispatchSequenceInput } from '../sequence.mjs';
import { views } from '../steps.mjs';

const D = 'window.__littleHours.wilds.diagnostics()';

export async function advance(app, durationMs) {
  const start = await app.js(`${D}.now`);
  for (let passed = 0; passed < durationMs;) {
    passed = Math.min(durationMs, passed + 50);
    await app.js(`window.__lhFrozenAt = ${start + passed}`);
    await app.waitFor(`${D}.now === ${start + passed}`);
  }
}

async function hold(app, codes, durationMs) {
  for (const code of codes) await dispatchSequenceInput(app, { type: 'keyDown', code });
  await advance(app, durationMs);
  for (const code of codes) await dispatchSequenceInput(app, { type: 'keyUp', code });
}

export function steeringKeys(position, destination, yaw, stop = .8) {
  const dx = destination.x - position.x, dz = destination.z - position.z, distance = Math.hypot(dx, dz);
  if (distance <= stop) return [];
  const forward = (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / distance;
  const side = (Math.cos(yaw) * dx - Math.sin(yaw) * dz) / distance;
  return [...(Math.abs(forward) > .38 ? [forward > 0 ? 'KeyW' : 'KeyS'] : []), ...(Math.abs(side) > .38 ? [side > 0 ? 'KeyD' : 'KeyA'] : [])];
}

async function tap(app, code) {
  await dispatchSequenceInput(app, { type: 'keyDown', code });
  await dispatchSequenceInput(app, { type: 'keyUp', code });
}

export function movementInput(app) {
  const held = new Set();
  return async keys => {
    for (const code of held) if (!keys.includes(code)) { await dispatchSequenceInput(app, { type: 'keyUp', code }); held.delete(code); }
    for (const code of keys) if (!held.has(code)) { await dispatchSequenceInput(app, { type: 'keyDown', code }); held.add(code); }
  };
}

const snapshot = app => app.js(`(() => { const d = ${D}; return { player: d.player, combat: d.combat, events: d.eventHistory, cameraYaw: d.cameraYaw, elapsedMs: d.elapsedMs }; })()`);

async function walkTo(app, destination, move, durationMs = 15000) {
  for (let time = 0; time < durationMs; time += 100) {
    const state = await snapshot(app), keys = steeringKeys(state.player.position, destination, state.cameraYaw);
    await move(keys);
    if (!keys.length) return true;
    await advance(app, 100);
  }
  await move([]);
  return false;
}

export function fightInput(state) {
  const { combat, player, cameraYaw, elapsedMs } = state, boss = combat.boss;
  const distance = Math.hypot(player.position.x - boss.position.x, player.position.z - boss.position.z);
  const actions = [], until = boss.nextActionAt - elapsedMs;
  let keys = [];
  if (!combat.targetId && boss.health > 0) actions.push('Tab');
  if (combat.pet.health > 0 && combat.pet.mode !== 'fight') actions.push('KeyT');
  if (combat.pet.health > 0 && elapsedMs >= combat.pet.skillReadyAt && Math.hypot(combat.pet.position.x - boss.position.x, combat.pet.position.z - boss.position.z) < 11.5) actions.push('KeyQ');
  if (boss.mode === 'telegraph' && boss.move === 'charge') {
    if (until <= 250 && !combat.playerAction && player.stamina >= 24) { keys = ['KeyD']; actions.push('ControlLeft'); }
  } else if (boss.mode === 'charge') {
    keys = ['KeyD'];
  } else if (boss.mode === 'telegraph' && distance < 6.5) {
    const away = { x: player.position.x + (player.position.x - boss.position.x) * 2, z: player.position.z + (player.position.z - boss.position.z) * 2 };
    keys = steeringKeys(player.position, away, cameraYaw);
    if (until <= 200 && !combat.playerAction && player.stamina >= 24) actions.push('ControlLeft');
  } else if (distance > 3.3) {
    keys = steeringKeys(player.position, boss.position, cameraYaw, 3.3);
  } else if (boss.mode !== 'phase' && boss.mode !== 'telegraph' && player.stamina >= 6) {
    if (!combat.playerAction || (combat.playerAction.kind === 'attack' && !combat.playerAction.buffered)) actions.push('KeyF');
  }
  return { keys, actions };
}

async function movementChecks(t, app) {
  await app.js(`document.getElementById('wilds-canvas').focus(); window.__lhFrozenAt = ${D}.now`);
  const original = await snapshot(app), coins = await app.js('window.__littleHours.state.house.coins'), bonds = await app.js('JSON.stringify(window.__littleHours.state.petBonds)');
  t.check('the walk begins at the existing Forest route with the player and the player’s pet', original.player.position.x === -106.5 && original.player.position.z === -180 && original.combat.pet.id === await app.js('window.__littleHours.state.pet') && await app.js(`${D}.avatar.loaded`), original.player.position);
  await hold(app, ['KeyW'], 500);
  const walked = await snapshot(app);
  t.check('actual W input walks across rendered Forest terrain', Math.hypot(walked.player.position.x - original.player.position.x, walked.player.position.z - original.player.position.z) > 2.2 && walked.player.grounded, walked.player.position);
  await hold(app, ['ShiftLeft', 'KeyW'], 500);
  const sprint = await snapshot(app);
  t.check('sprint moves faster and spends the shared stamina pool', Math.hypot(sprint.player.position.x - walked.player.position.x, sprint.player.position.z - walked.player.position.z) > 4 && sprint.player.stamina < 94, sprint.player);
  await advance(app, 1000);
  t.check('rest recovers stamina and updates its HUD', await app.js(`${D}.player.stamina > 99 && document.querySelector('.wilds-stamina progress').value > 99`));
  await tap(app, 'Space'); await advance(app, 200);
  t.check('Space produces an airborne jump', await app.js(`!${D}.player.grounded && ${D}.player.action === 'jump'`));
  await advance(app, 1200);
  t.check('the jump lands on the reused Forest terrain', await app.js(`${D}.player.grounded`));
  const move = movementInput(app), seen = new Map();
  try {
    t.check('real movement follows the forest path into the Warden arena', await walkTo(app, { x: -120, z: -200 }, move));
    await move([]);
    await tap(app, 'Tab'); await advance(app, 50);
    t.check('Tab locks the Warden and sends the companion to fight', await app.js(`${D}.combat.targetId === 'mossback-warden' && ${D}.combat.pet.mode === 'fight'`));
    for (let time = 0; time < 120000; time += 100) {
      const state = await snapshot(app);
      for (const event of state.events) seen.set(JSON.stringify(event), event);
      if (state.combat.boss.mode === 'defeated' || [...seen.values()].some(event => event.type === 'player-defeated')) break;
      const input = fightInput(state);
      await move(input.keys);
      for (const code of input.actions) await tap(app, code);
      await advance(app, 100);
    }
    await move([]);
    const end = await snapshot(app);
    for (const event of end.events) seen.set(JSON.stringify(event), event);
    const events = [...seen.values()], damage = source => events.filter(event => event.type === 'damage' && event.targetId === 'mossback-warden' && event.sourceId === source).reduce((sum, event) => sum + event.amount, 0);
    t.check('the sword combo deals real damage beside the fighting pet', damage('player') > 0 && damage(end.combat.pet.id) > 0 && [0, 1, 2].every(index => events.some(event => event.type === 'attack' && event.comboIndex === index)), { playerDamage: damage('player'), petDamage: damage(end.combat.pet.id) });
    t.check('dodge input and the Warden’s second phase occur during the fight', events.some(event => event.type === 'dodge') && events.some(event => event.type === 'boss-phase' && event.phase === 2));
    t.check('the player and pet defeat the Mossback Warden without a damage shortcut', end.combat.boss.mode === 'defeated' && !events.some(event => event.type === 'player-defeated'), { boss: end.combat.boss, health: end.player.health });
    t.check('victory grants the first reward and a visible level-up', end.combat.progress.totalXp === 260 && end.combat.progress.materials.heartwood === 1 && end.combat.progress.trophies.includes('mossback-warden') && end.player.maxHealth === 124 && end.player.maxStamina === 108 && await app.js(`document.querySelector('.wilds-level').textContent.includes('3') && document.querySelector('.wilds-notice').textContent.includes('3')`), end.combat.progress);
    t.check('victory immediately persists the new Wilds slice without gold or friendship changes', await app.js(`JSON.parse(localStorage.getItem('little-hours-wilds-check-v1')).wilds?.totalXp === 260 && window.__littleHours.state.house.coins === ${coins} && JSON.stringify(window.__littleHours.state.petBonds) === ${JSON.stringify(bonds)}`));
    await t.shot(app, 'warden-victory');
    if (end.combat.boss.mode === 'defeated') t.check('the path continues to the first vista after the fight', await walkTo(app, { x: -140, z: -230 }, move));
    await move([]);
    await t.shot(app, 'first-vista');
  } finally { await move([]); }
  const yaw = await app.js(`${D}.cameraYaw`);
  await app.drag({ x: 500, y: 300 }, { x: 620, y: 320 }); await advance(app, 100);
  t.check('dragging still turns the third-person camera after combat', await app.js(`Math.abs(${D}.cameraYaw - ${yaw}) > .2`));
  await app.js('delete window.__lhFrozenAt');
}


export default {
  about: 'Forest walk, sword and pet-assisted Warden victory, level-up, persistence and scene lifecycle on a fixed clock',
  async run(t) {
    const app = await t.open({ ...views.wilds.settings, seed: 'one-room', theme: 'day', width: 960, height: 640 });
    await views.wilds.go(app);
    t.check('the Wilds mounts a ready populated scene', await app.js(`window.__littleHours.wilds.ready() && ${D}.phase === 'running' && ${D}.scene.meshes.length > 0 && document.querySelectorAll('#wilds-canvas').length === 1`));
    t.check('the independent check save is created without a production save', await app.js(`JSON.parse(localStorage.getItem('little-hours-wilds-check-v1')).theme === 'day' && localStorage.getItem('little-hours-v1') === null`));
    const before = await app.js(`${D}.renderCount`);
    await t.sleep(500);
    const after = await app.js(`${D}.renderCount`);
    t.check('the scene renders continuously without a draw shortcut', after >= before + 10, { before, after });
    await movementChecks(t, app);
    await app.js('window.__lhFrozenAt = window.__lhStartAt + 2500');
    await app.waitFor(`${D}.now === window.__lhFrozenAt`, { what: 'the pinned Wilds clock' });
    const frozen = await app.js(`${D}.elapsedMs`);
    await t.sleep(150);
    t.check('rendering continues while the game clock is pinned', await app.js(`${D}.elapsedMs === ${frozen} && ${D}.now === window.__lhStartAt + 2500`));
    await app.js('delete window.__lhFrozenAt');
    const { targetInfo } = await app.send('Target.getTargetInfo');
    const cover = await app.send('Target.createTarget', { url: 'about:blank' });
    try {
      await app.send('Target.activateTarget', { targetId: cover.targetId });
      await app.waitFor(`document.hidden && ${D}.phase === 'suspended'`, { what: 'the background Wilds tab to suspend' });
      const hidden = await app.js(`${D}.renderCount`);
      await t.sleep(300);
      t.check('a hidden tab stops rendering', await app.js(`${D}.renderCount === ${hidden}`), { hidden });
    } finally {
      await app.send('Target.closeTarget', { targetId: cover.targetId });
      await app.send('Target.activateTarget', { targetId: targetInfo.targetId });
    }
    await app.waitFor(`!document.hidden && ${D}.phase === 'running'`, { what: 'the Wilds tab to resume' });
    const resumed = await app.js(`${D}.renderCount`);
    await app.waitFor(`${D}.renderCount > ${resumed}`, { what: 'a rendered frame after resuming' });
    t.check('returning to the tab resumes rendering', true);
    await t.shot(app, 'forest-day');
    await app.clickSel('#wilds-leave');
    t.check('Leave Wilds disposes the scene and removes its engine and canvas', await app.js(`${D}.phase === 'disposed' && ${D}.scene.isDisposed && !window.__littleHours.wilds.ready() && window.__littleHours.counts().engines === 0 && document.querySelectorAll('canvas').length === 0`));
    const stopped = await app.js(`${D}.renderCount`);
    await t.sleep(100);
    t.check('the disposed scene stays stopped', await app.js(`${D}.renderCount === ${stopped}`));
    t.check('leaving returns keyboard focus to Enter Wilds', await app.js(`document.activeElement.id === 'wilds-enter'`));
    await app.clickSel('#wilds-enter');
    await app.waitFor('window.__littleHours.wilds.ready()', { what: 'the entry button to render the Wilds' });
    t.check('Enter Wilds remounts one scene through its button', await app.js(`${D}.phase === 'running' && window.__littleHours.counts().engines === 1 && document.querySelectorAll('#wilds-canvas').length === 1`));
    await app.clickSel('#wilds-leave');
    await app.key('Enter');
    await app.waitFor('window.__littleHours.wilds.ready()', { what: 'keyboard entry to render the Wilds' });
    t.check('the focused Enter Wilds button also supports keyboard activation', await app.js(`${D}.phase === 'running' && window.__littleHours.counts().engines === 1 && document.querySelectorAll('#wilds-canvas').length === 1`));
    await app.js(`(() => { const saved = JSON.parse(localStorage.getItem('little-hours-wilds-check-v1')); saved.theme = 'rain'; saved.house.coins = 87; saved.avatar.hair = 'silver'; localStorage.setItem('little-hours-wilds-check-v1', JSON.stringify(saved)); localStorage.setItem('little-hours-v1', 'production sentinel'); })()`);
    await app.reload();
    t.check('reload keeps the check path and restores its own save', await app.js(`location.pathname === '/checks/wilds.html' && window.__littleHours.state.theme === 'rain' && window.__littleHours.state.house.coins === 87 && window.__littleHours.state.avatar.hair === 'silver' && ${D}.scene.clearColor.toHexString() === '#A2B2BDFF'`));
    t.check('reload preserves the production save byte for byte', await app.js(`localStorage.getItem('little-hours-v1') === 'production sentinel'`));
    await app.send('Page.addScriptToEvaluateOnNewDocument', { source: `Storage.prototype.setItem = function () { throw new Error('storage blocked'); };` });
    await app.reload();
    t.check('blocked persistence still permits a ready scene', await app.js(`window.__littleHours.wilds.ready() && ${D}.renderCount > 0`));
    await t.close(app);
  },
};
