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

async function movementChecks(t, app) {
  await app.js(`document.getElementById('wilds-canvas').focus(); window.__lhFrozenAt = ${D}.now`);
  t.check('the Blender avatar exposes every M1 clip and the existing appearance', await app.js(`${D}.avatar.loaded && ['idle','walk','run','jump','fall','land','climb','mantle','mantle-wide','stop','stop-back','stop-right','stop-right-back'].every(name => ${D}.avatar.clips.includes(name)) && ${D}.avatar.appearance.hair === window.__littleHours.state.avatar.hair`));
  await hold(app, ['KeyW'], 1000);
  t.check('W walks forward from the clearing on rendered terrain', await app.js(`${D}.player.position.z < -4.7 && ${D}.player.position.z > -4.9 && ${D}.player.grounded`));
  const stopped = await app.js(`${D}.player.position.z`);
  await advance(app, 300);
  t.check('releasing movement stops the player and settles its clip', await app.js(`Math.abs(${D}.player.position.z - ${stopped}) < .001 && ${D}.player.action === 'idle'`));
  await hold(app, ['ShiftLeft', 'KeyW'], 1000);
  t.check('sprinting is faster and spends stamina', await app.js(`${D}.player.position.z < -13 && ${D}.player.stamina >= 85.9 && ${D}.player.stamina <= 86.1`));
  await advance(app, 1000);
  t.check('stamina recovers after release and its HUD matches', await app.js(`${D}.player.stamina > 94 && document.querySelector('.wilds-stamina progress').value > 94`));
  const groundBeforeJump = await app.js(`${D}.player.position.y`);
  await dispatchSequenceInput(app, { type: 'keyDown', code: 'Space' });
  await advance(app, 50);
  t.check('Space starts synchronized compression with the feet still planted', await app.js(`${D}.player.grounded && Math.abs(${D}.player.position.y - ${groundBeforeJump}) < .001 && ${D}.player.action === 'jump' && Math.abs(${D}.player.actionTimeMs - 50) < .001 && Math.abs(${D}.avatar.actionElapsedMs - 50) < .001`));
  await advance(app, 100);
  await dispatchSequenceInput(app, { type: 'keyUp', code: 'Space' });
  t.check('the jump lifts after its five-frame anticipation', await app.js(`!${D}.player.grounded && ${D}.player.position.y - ${groundBeforeJump} > .4 && ${D}.player.action === 'jump' && Math.abs(${D}.player.actionTimeMs - 150) < .001`));
  await advance(app, 1000);
  t.check('the jump lands back on terrain', await app.js(`${D}.player.grounded && Math.abs(${D}.player.position.y - ${groundBeforeJump}) < .01`));
  await dispatchSequenceInput(app, { type: 'keyDown', code: 'Space' });
  await advance(app, 1000);
  await app.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', autoRepeat: true, windowsVirtualKeyCode: 32 });
  await advance(app, 200);
  t.check('a held and repeated Space does not keep jumping', await app.js(`${D}.player.grounded`));
  await dispatchSequenceInput(app, { type: 'keyUp', code: 'Space' });
  await app.js(`window.__littleHours.wilds.place({position:{x:5.5,z:-5.7},camera:{yaw:0}})`);
  await dispatchSequenceInput(app, { type: 'keyDown', code: 'KeyW' });
  await dispatchSequenceInput(app, { type: 'keyDown', code: 'Space' });
  await advance(app, 200);
  t.check('Space against the low rock climbs with the Blender climb cycle', await app.js(`${D}.player.action === 'climb' && ${D}.avatar.action === 'climb' && ${D}.avatar.cyclePhase > 0`));
  await advance(app, 200);
  t.check('the shoulder starts a synchronized wide mantle before the summit', await app.js(`${D}.player.action === 'mantle' && ${D}.avatar.action === 'mantle-wide' && !${D}.player.grounded && ${D}.player.mantleAdvance > .6 && Math.abs(${D}.player.actionTimeMs - ${D}.avatar.actionElapsedMs) < .001`));
  const mantleRemaining = await app.js(`${D}.player.mantle.startedAt + 770 - ${D}.elapsedMs`);
  await advance(app, mantleRemaining + 1000 / 60);
  t.check('the complete reach and wide mantle finish on the summit before release', await app.js(`${D}.player.grounded && ${D}.player.mantle === null`), await app.js(`JSON.stringify({mode:${D}.player.mode,position:${D}.player.position,action:${D}.avatar.action,elapsedMs:${D}.elapsedMs,mantle:${D}.player.mantle})`));
  await dispatchSequenceInput(app, { type: 'keyUp', code: 'Space' });
  await dispatchSequenceInput(app, { type: 'keyUp', code: 'KeyW' });
  await advance(app, 100);
  t.check('the completed mantle settles into supported standing', await app.js(`${D}.player.grounded && ${D}.player.action === 'idle' && ${D}.player.mantle === null`));
  await app.js(`window.__littleHours.wilds.place({position:{x:0,z:0},stamina:100,camera:{yaw:0}})`);
  await hold(app, ['ShiftLeft', 'KeyW'], 7600);
  t.check('exhausted sprint falls back to walking instead of cycling free sprints', await app.js(`${D}.player.action === 'walk' && ${D}.player.stamina < 1`));
  await advance(app, 1500);
  t.check('stamina recovers after exhaustion', await app.js(`${D}.player.stamina > 20`));
  await app.js(`window.__littleHours.wilds.place({position:{x:0,z:0},stamina:100,camera:{yaw:0}})`);
  await hold(app, ['KeyW'], 31000);
  t.check('the real movement route walks from clearing through the forest to the first vista', await app.js(`${D}.player.position.z < -145 && ${D}.player.grounded`), await app.js(`JSON.stringify(${D}.player.position)`));
  await t.shot(app, 'forest-vista');
  const yaw = await app.js(`${D}.cameraYaw`);
  await app.drag({ x: 500, y: 300 }, { x: 620, y: 320 });
  await advance(app, 100);
  t.check('pointer dragging changes the third-person camera', await app.js(`Math.abs(${D}.cameraYaw - ${yaw}) > .2`));
  const beforeMenu = await app.js(`JSON.stringify(${D}.player.position)`);
  await app.js(`document.getElementById('wilds-leave').focus()`);
  await hold(app, ['KeyW'], 300);
  t.check('native control focus prevents gameplay movement', await app.js(`JSON.stringify(${D}.player.position) === ${JSON.stringify(beforeMenu)}`));
  await app.js(`delete window.__lhFrozenAt; window.__littleHours.wilds.place({position:{x:0,z:0},camera:{yaw:0}})`);
}


export default {
  about: 'Wilds exploration and lifecycle: Blender avatar, real movement, terrain, stamina, jump, climb, camera, isolated save and remount',
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
