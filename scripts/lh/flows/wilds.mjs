import { views } from '../steps.mjs';

const D = 'window.__littleHours.wilds.diagnostics()';

export default {
  about: 'M0 Wilds lifecycle: empty scene, isolated save, live rendering, hidden-tab suspension, disposal and remount',
  async run(t) {
    const app = await t.open({ ...views.wilds.settings, seed: 'one-room', theme: 'day', width: 960, height: 640 });
    await views.wilds.go(app);
    t.check('the Wilds mounts a ready empty scene', await app.js(`window.__littleHours.wilds.ready() && ${D}.phase === 'running' && ${D}.scene.meshes.length === 0 && document.querySelectorAll('#wilds-canvas').length === 1`));
    t.check('the independent check save is created without a production save', await app.js(`JSON.parse(localStorage.getItem('little-hours-wilds-check-v1')).theme === 'day' && localStorage.getItem('little-hours-v1') === null`));
    const before = await app.js(`${D}.renderCount`);
    await t.sleep(500);
    const after = await app.js(`${D}.renderCount`);
    t.check('the scene renders continuously without a draw shortcut', after >= before + 10, { before, after });
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
    await t.shot(app, 'm0-day');
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
