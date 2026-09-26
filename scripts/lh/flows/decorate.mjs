const frames = app => app.js('new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))');
const itemOf = (room, id) => room.layout.items.find(item => item.id === id) || null;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function floorSpots(app) {
  const box = await app.js(`(() => { const r = document.querySelector('#room-canvas canvas').getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: Math.min(r.height, innerHeight - r.top) }; })()`);
  const cx = box.left + box.width / 2, cy = box.top + box.height * .62, points = [];
  for (let y = box.top + box.height * .35; y < box.top + box.height * .95; y += box.height / 14) for (let x = box.left + box.width * .2; x < box.left + box.width * .8; x += box.width / 14) points.push({ x, y });
  points.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  const spots = [];
  for (const point of points) {
    await app.move(point.x, point.y); await frames(app);
    const placement = (await app.room()).placement;
    if (placement?.valid) spots.push({ ...point, fx: placement.x, fz: placement.z });
    if (spots.length >= 12) break;
  }
  return spots;
}

async function press(app, from, to) {
  const mouse = (type, x, y, buttons) => app.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
  await mouse('mouseMoved', from.x, from.y, 0); await frames(app);
  await mouse('mousePressed', from.x, from.y, 1);
  for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', from.x + (to.x - from.x) * i / 8, from.y + (to.y - from.y) * i / 8, 1); await frames(app); }
  return { release: () => mouse('mouseReleased', to.x, to.y, 0) };
}

export default {
  about: 'Decorate: add a piece, select it in the 3D view, drag, rotate, undo, Escape, leave, and the change survives a reload',
  async run(t) {
    const { check, steps } = t;
    let app = await t.open({ seed: 'three-rooms' });
    await app.settle();
    const start = await app.room();
    await steps.openDecorate(app);
    check('Decorate opens the builder panel', await app.visible('#builder-panel') && await app.attr('#decorate-button', 'aria-pressed') === 'true' && (await app.room()).editing);
    check('the timer card steps aside while decorating', !await app.visible('#focus-card'));
    check('Undo starts disabled', await app.js(`document.getElementById('undo-layout').disabled`));

    const name = await app.text('[data-furniture="plant"] .furniture-name');
    await app.clickSel('[data-furniture="plant"]'); await frames(app);
    check('picking a piece from the collection starts placing it', (await app.room()).placement?.type === 'plant' && await app.attr('[data-furniture="plant"]', 'aria-pressed') === 'true');
    check('the room hint says where to click', /floor/i.test(await app.text('#room-hint')), await app.text('#room-hint'));
    await app.key('Escape'); await frames(app);
    check('Escape cancels placing a piece', !(await app.room()).placement && (await app.room()).layout.items.length === start.layout.items.length);
    check('Escape keeps Decorate open', await app.js(`document.body.classList.contains('is-decorating')`));

    await app.clickSel('[data-furniture="plant"]'); await frames(app);
    const spots = await floorSpots(app);
    check('moving over the floor finds clear spots for the piece', spots.length >= 2, `${spots.length} spots`);
    const spot = spots[0];
    await app.click(spot.x, spot.y); await app.settle();
    let room = await app.room();
    const added = room.layout.items.find(item => !start.layout.items.some(old => old.id === item.id));
    check('clicking the floor places the piece there', added?.type === 'plant' && !room.placement && Math.hypot(added.x - spot.fx, added.z - spot.fz) < .6, { added, spot });
    check('the new piece is selected', added && room.selectedId === added.id);
    check('the inspector names the new piece', (await app.text('#selection-inspector strong'))?.includes(name), await app.text('#selection-inspector strong'));
    check('Undo becomes available', !await app.js(`document.getElementById('undo-layout').disabled`));
    if (!added) throw new Error('No piece was added');
    const id = added.id;

    await app.key('Escape'); await frames(app);
    check('Escape deselects the piece', (await app.room()).selectedId === null);
    const where = await app.point({ item: id });
    check('the new piece is on screen', where?.visible, where);
    await app.click(where.x, where.y); await frames(app);
    check('clicking the piece in the room selects it', (await app.room()).selectedId === id);

    const target = spots.slice(1).sort((a, b) => Math.hypot(b.fx - spot.fx, b.fz - spot.fz) - Math.hypot(a.fx - spot.fx, a.fz - spot.fz))[0];
    const held = await press(app, where, { x: where.x + (target.x - spot.x), y: where.y + (target.y - spot.y) });
    check('dragging the piece lifts it', (await app.room()).dragging?.id === id);
    await app.key('Escape'); await frames(app);
    await held.release(); await app.settle();
    room = await app.room();
    check('Escape during a drag puts the piece back', !room.dragging && same(itemOf(room, id), added), { before: added, after: itemOf(room, id) });

    const from = await app.point({ item: id });
    await app.drag(from, { x: from.x + (target.x - spot.x), y: from.y + (target.y - spot.y) });
    await app.settle();
    room = await app.room();
    const moved = itemOf(room, id);
    check('dragging the piece moves it in the layout', moved && Math.hypot(moved.x - added.x, moved.z - added.z) >= 1, { from: added, to: moved });
    check('the dragged piece stays selected', room.selectedId === id);

    await app.clickSel('#rotate-item'); await app.settle();
    const turned = itemOf(await app.room(), id);
    check('the Rotate button turns the piece a quarter', turned?.rotation === (moved.rotation + 1) % 4, turned);
    await app.key('r'); await app.settle();
    const turnedAgain = itemOf(await app.room(), id);
    check('the R key turns it again', turnedAgain?.rotation === (turned.rotation + 1) % 4, turnedAgain);
    await app.clickSel('#undo-layout'); await app.settle();
    check('Undo brings back the arrangement before the last change', same(itemOf(await app.room(), id), turned), itemOf(await app.room(), id));
    check('Undo is used up after one step', await app.js(`document.getElementById('undo-layout').disabled`));
    check('Undo says the arrangement is back', /previous arrangement/i.test(await app.text('#toast') || ''), await app.text('#toast'));
    await t.shot(app, 'decorating');

    await steps.closeDecorate(app);
    check('Done decorating leaves Decorate', !await app.visible('#builder-panel') && await app.attr('#decorate-button', 'aria-pressed') === 'false' && !(await app.room()).editing);
    check('the timer card comes back', await app.visible('#focus-card'));
    check('the change is saved in the browser', same(((await app.saved()).layout.items || []).find(item => item.id === id), turned), ((await app.saved()).layout.items || []).find(item => item.id === id));
    await app.reload(); await app.settle();
    check('after a reload the new piece is where it was left', same(itemOf(await app.room(), id), turned), itemOf(await app.room(), id));
    check('a reload does not reopen Decorate', !await app.js(`document.body.classList.contains('is-decorating')`));
    await t.close(app);

    app = await t.open({ seed: 'three-rooms', reducedMotion: true, label: 'reduced motion' });
    await app.settle();
    await app.clickSel('#decorate-button'); await frames(app);
    const still = await app.js(`(() => { const panel = document.getElementById('builder-panel'); return { shown: !panel.hidden, opacity: getComputedStyle(panel).opacity, moving: [panel, document.getElementById('stage'), document.getElementById('room-canvas')].flatMap(el => el.getAnimations({ subtree: true })).filter(a => a.playState === 'running').length }; })()`);
    check('reduced motion: the panel appears at once, with nothing moving', still.shown && still.opacity === '1' && still.moving === 0, still);
    await app.clickSel('#decorate-button'); await frames(app);
    check('reduced motion: leaving is instant too', !await app.visible('#builder-panel') && await app.visible('#focus-card'));
    await t.close(app);

    app = await t.open({ seed: 'three-rooms', width: 390, height: 844, scale: 2, label: 'phone' });
    await app.settle();
    await steps.openDecorate(app);
    const phone = await app.js(`(() => {
      const rect = s => document.querySelector(s).getBoundingClientRect();
      const clear = s => { const r = rect(s), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.width > 0 && r.right <= innerWidth && Boolean(hit?.closest(s)); };
      return { panelBelowRoom: rect('#builder-panel').top >= rect('#stage').bottom - 1, done: clear('#decorate-button'), undo: clear('#undo-layout'), card: clear('[data-furniture]'), scroll: document.documentElement.scrollWidth <= innerWidth };
    })()`);
    check('phone: the panel sits below the room without covering it', phone.panelBelowRoom, phone);
    check('phone: Done decorating, Undo and the collection are uncovered', phone.done && phone.undo && phone.card, phone);
    check('phone: no sideways scroll', phone.scroll, phone);
    await app.clickSel('[data-furniture="plant"]'); await frames(app);
    check('phone: tapping a piece starts placing it', (await app.room()).placement?.type === 'plant');
    await t.shot(app, 'phone');
    await app.key('Escape');
    await steps.closeDecorate(app);
    check('phone: Done decorating leaves Decorate', !await app.visible('#builder-panel'));
    await t.close(app);
  },
};
