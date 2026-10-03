import { steps } from '../steps.mjs';

const STATE = `(() => { const d = window.__littleHours.wilds?.diagnostics(); return d && { ready: d.ready, hour: d.hour, segment: d.segment, renderCount: d.renderCount, failure: d.failure }; })()`;

export default {
  about: 'enter the Wilds from the island Forest button, see the valley at golden hour, and walk back out to the island trailhead',
  async run(t) {
    const app = await t.open({ seed: 'three-rooms', width: 1440, height: 900 });
    await steps.openWilds(app);
    const entered = await app.js(STATE);
    t.check('the valley builds and renders after the Forest button', entered?.ready && entered.renderCount > 2 && !entered.failure, entered);
    await app.js(`window.__littleHours.wilds.game.setHour('golden')`);
    await app.waitFor(`window.__littleHours.wilds.diagnostics().segment === 'golden'`, { what: 'golden hour' });
    await t.shot(app, 'golden');
    await app.key('Escape');
    await app.waitFor(`document.getElementById('wilds-menu').open`, { what: 'the Wilds menu' });
    await app.clickSel('#wilds-leave');
    await app.waitFor(`!window.__littleHours.wilds && document.body.classList.contains('is-house') && !document.body.classList.contains('is-wilds')`, { what: 'the island again', timeout: 30000 });
    t.check('leaving puts you back on the island', await app.js(`document.body.classList.contains('is-house')`));
    await t.close(app);
  },
};
