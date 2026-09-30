const RECORD = `(() => { window.__moves = []; if (window.__recording) return true; window.__recording = true; const animate = Element.prototype.animate; Element.prototype.animate = function (...args) { window.__moves.push(this); return animate.apply(this, args); }; return true; })()`;
const MOVED = selector => `window.__moves.filter(el => el.isConnected && el.matches(${JSON.stringify(selector)})).length`;
const CLEAR = `window.__moves.length = 0`;
const SLOW_SAVES = `(() => { const locks = navigator.locks, request = locks.request.bind(locks); window.__fastSaves = request; window.__slowSaves = 0; locks.request = (name, fn) => { window.__slowSaves++; return request(name, () => new Promise(done => setTimeout(done, 800)).then(fn)).finally(() => window.__slowSaves--); }; return true; })()`;
const FAST_SAVES = `(() => { navigator.locks.request = window.__fastSaves; return true; })()`;

async function press(app, sleep, selector) {
  await app.js(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'center' })`);
  await sleep(200);
  await app.js(CLEAR);
  await app.clickSel(selector);
  await sleep(250);
}

export default {
  about: 'motion: the pet card opens centred and every pet control answers with its own little animation (a heartbeat for Pet, a spin for Play, a hop for Feed, rows that unfold), new hearts pop in, re-renders never replay them, Pip’s find card and album pop open with rounded clipped corners, and reduced motion keeps everything still',
  async run(t) {
    const { check, sleep } = t;
    let app = await t.open({ seed: 'buddy' });
    await app.settle();
    await app.js(RECORD);
    await app.clickSel('#pet-button');
    await app.waitFor(`!document.getElementById('room-panel').hidden`, { what: 'the pet card' });
    await app.waitFor(`document.getElementById('room-panel').getAnimations().length === 0`, { what: 'the pet card to finish rising in' });
    const box = await app.js(`(() => { const r = document.querySelector('#room-panel').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2 - innerWidth / 2), y: Math.round(r.top + r.height / 2 - innerHeight / 2) }; })()`);
    check('on a desktop the pet card opens in the middle of the screen', Math.abs(box.x) <= 2 && Math.abs(box.y) <= 2, box);
    check('the pet card rises in as it opens', await app.js(MOVED('#room-panel')) > 0);

    await press(app, sleep, '#pet-friendship > summary');
    check('clicking “Our friendship” opens it', await app.js(`document.querySelector('#pet-friendship').open`));
    check('the friendship milestones rise in one by one', await app.js(MOVED('.pet-milestones li')) === 3, await app.js(MOVED('.pet-milestones li')));
    check('the friendship heart hops', await app.js(MOVED('#pet-friendship .pet-row-icon')) === 1);
    for (const [row, items] of [['#pet-belongings', '.pet-fabrics > *, .pet-ribbons > *, .pet-fabric-preview'], ['#pet-collection', '.pet-options > *'], ['#pet-gifts', '.pet-gift-options > *']]) {
      await press(app, sleep, `${row} > summary`);
      check(`opening ${row} unfolds its contents`, await app.js(`document.querySelector('${row}').open`) && await app.js(MOVED(items)) > 0, await app.js(MOVED(items)));
    }

    await press(app, sleep, '#pet-now');
    check('Pet makes the heart icon beat', await app.js(MOVED('#pet-now svg')) === 1);
    check('the new share of a heart pops into the meter', await app.js(MOVED('.pet-hearts i')) > 0);
    check('the care note floats in', await app.js(MOVED('#pet-ritual-status')) === 1, await app.text('#pet-ritual-status'));
    check('a re-render keeps open rows open without replaying them', await app.js(`document.querySelector('#pet-friendship').open`) && await app.js(MOVED('.pet-milestones li')) === 0);
    await app.js(SLOW_SAVES);
    await press(app, sleep, '#pet-play');
    await app.waitFor(`window.__slowSaves === 0`, { what: 'the slowed Play save to land' });
    await sleep(150);
    await app.js(FAST_SAVES);
    check('Play spins the ball, even when the save lands late and rebuilds the card', await app.js(MOVED('#pet-play svg')) === 1, await app.js(`[${MOVED('#pet-play svg')}, window.__moves.filter(el => el.matches('#pet-play svg')).length]`));
    await press(app, sleep, '#pet-feed');
    check('Feed hops the bowl and the meals slide in', await app.js(MOVED('#pet-feed svg')) === 1 && await app.js(MOVED('#pet-meals > button')) > 0);
    await press(app, sleep, '#pet-edit-name');
    check('the rename pencil wiggles and the name form slides in', await app.js(MOVED('#pet-edit-name svg')) === 1 && await app.js(MOVED('#pet-name-form')) === 1);
    await app.key('Escape');
    await t.shot(app, 'pet-card');
    await app.clickSel('#close-panel');
    await sleep(300);

    await app.js(CLEAR);
    await app.clickSel('#buddy-tool');
    await app.waitFor(`document.querySelector('#buddy-card').open`, { what: 'the find card' });
    await sleep(150);
    check('Pip’s find card pops open and the find tumbles in', await app.js(MOVED('.buddy-card-inner')) === 1 && await app.js(MOVED('.buddy-card-art .find-art')) === 1);
    await press(app, sleep, '#buddy-card-collection');
    await app.waitFor(`document.querySelector('#buddy-album').open`, { what: 'the album' });
    await sleep(200);
    check('the album pops open, the finds rise in and the growth bar fills', await app.js(MOVED('.buddy-album-inner')) === 1 && await app.js(MOVED('.buddy-find')) > 3 && await app.js(MOVED('.buddy-growth-bar i')) === 1);
    const corners = await app.js(`(() => { const inner = getComputedStyle(document.querySelector('.buddy-album-inner')), scroll = document.querySelector('.buddy-album-scroll'); return { radius: inner.borderTopRightRadius, overflow: inner.overflow, scrolls: scroll.scrollHeight > scroll.clientHeight, card: getComputedStyle(document.querySelector('#buddy-card')).borderTopLeftRadius }; })()`);
    check('the album and card have rounded corners that clip the scrollbar too', corners.radius === '28px' && corners.overflow === 'hidden' && corners.card === '26px', corners);
    await press(app, sleep, '#buddy-album [data-color="sky"]');
    check('a colour swatch squishes when picked', await app.js(MOVED('#buddy-album [data-color="sky"]')) === 1);
    await t.shot(app, 'album');

    app = await t.open({ seed: 'buddy', reducedMotion: true, label: 'reduced motion' });
    await app.settle();
    await app.js(RECORD);
    await app.clickSel('#pet-button');
    await app.waitFor(`!document.getElementById('room-panel').hidden`, { what: 'the pet card' });
    await press(app, sleep, '#pet-friendship > summary');
    await press(app, sleep, '#pet-now');
    check('reduced motion: rows and care buttons stay still', await app.js(`document.querySelector('#pet-friendship').open`) && await app.js(`window.__moves.filter(el => !el.closest('canvas')).length`) === 0, await app.js(`window.__moves.map(el => el.id || el.className).join()`));
  },
};
