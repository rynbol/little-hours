const PROBE = id => `(() => { const d = window.__littleHours.room.diagnostics(), hinge = d.scene.getTransformNodeByName('door-hinge-${id}'), body = document.body.classList; return { walking: body.contains('is-door-walking'), travelling: body.contains('is-travelling'), house: body.contains('is-house'), label: document.getElementById('travel-label').textContent, note: document.querySelector('#room-travel small').textContent, door: hinge ? hinge.rotation.y : null, x: d.companion.x, z: d.companion.z, active: window.__littleHours.state.house.activeId }; })()`;

async function tapDoor(app, id, sleep, { timeout = 20000, slow = 1 } = {}) {
  const spot = await app.point({ door: id });
  if (!spot?.visible) return { spot };
  const start = await app.js(PROBE(id)), began = Date.now(), seen = { walked: false, labels: new Set(), notes: new Set(), open: 0, moved: 0 };
  await app.js(`(() => { clearInterval(window.__lhDoorWatch); window.__lhDoorOpen = 0; window.__lhDoorWatch = setInterval(() => { const hinge = window.__littleHours.room.diagnostics().scene.getTransformNodeByName('door-hinge-${id}'); if (hinge && !document.body.classList.contains('is-house')) window.__lhDoorOpen = Math.max(window.__lhDoorOpen, -hinge.rotation.y); }, 10); })()`);
  await app.click(spot.x, spot.y);
  let now = start;
  while (Date.now() - began < timeout * slow) {
    now = await app.js(PROBE(id)).catch(() => now);
    if (now.walking) seen.walked = true;
    if (now.travelling) { seen.labels.add(now.label); seen.notes.add(now.note); }
    if (now.door !== null && !now.house) seen.open = Math.max(seen.open, -now.door);
    if (now.walking) seen.moved = Math.max(seen.moved, Math.hypot(now.x - start.x, now.z - start.z));
    if (!now.travelling && (now.active === id || now.house)) break;
    await sleep(40 / slow);
  }
  seen.open = Math.max(seen.open, await app.js(`(() => { clearInterval(window.__lhDoorWatch); return window.__lhDoorOpen; })()`).catch(() => 0));
  return { spot, ms: Date.now() - began, ...seen, labels: [...seen.labels], notes: [...seen.notes], end: now };
}

export default {
  about: 'doors in the room: tapping a built door walks the companion through it, stairs reach the loft, an unbuilt door peeks then plans, reduced motion is instant',
  async run(t) {
    const { check, steps } = t;
    let app = await t.open({ seed: 'three-rooms' });
    await app.settle();
    let walk = await tapDoor(app, 'garden', t.sleep, { slow: t.slow });
    check('the garden door is on screen in the studio', walk.spot?.visible, walk.spot);
    check('tapping the garden door walks the companion to it', walk.walked && walk.moved > .5 && walk.labels.includes('Walking to Garden wing'), { moved: walk.moved, labels: walk.labels });
    check('the door swings open for the companion', walk.open > 1 && walk.notes.includes('Opening the door. Make yourself at home.'), { open: walk.open, notes: walk.notes });
    check('the walk ends in the garden wing', walk.end?.active === 'garden' && await app.text('#room-title') === 'Garden wing', walk.end);
    check('the walk and travel states clear on arrival', !walk.end?.walking && !walk.end?.travelling && await app.js(`document.getElementById('room-travel').hidden`), walk.end);
    await app.settle();
    await t.shot(app, 'garden');
    walk = await tapDoor(app, 'loft', t.sleep, { slow: t.slow });
    check('from the garden, the stairs door is on screen', walk.spot?.visible, walk.spot);
    check('the companion climbs the stairs to the loft', walk.walked && walk.moved > .5 && walk.end?.active === 'loft' && await app.text('#room-title') === 'Upstairs hideaway', { moved: walk.moved, end: walk.end });
    await app.settle();
    await t.shot(app, 'loft');
    walk = await tapDoor(app, 'studio', t.sleep, { slow: t.slow });
    check('from the loft, a door leads back down to the studio', walk.walked && walk.end?.active === 'studio' && !walk.end?.travelling, walk.end);
    await app.settle();
    const saved = await app.saved();
    check('the active room is saved after the walks', saved?.house?.activeId === 'studio', saved?.house?.activeId);
    await app.clickSel('#start-button');
    await app.waitFor(`document.body.classList.contains('is-focusing')`, { what: 'the focus session' });
    const spot = await app.point({ door: 'garden' });
    await app.click(spot.x, spot.y);
    await app.waitFor(`!document.getElementById('toast').hidden`, { what: 'the refusal message' });
    check('while focusing, a door tap is refused with a message', await app.text('#toast') === 'Pause your focus session before walking to another room.' && !await app.js(`document.body.classList.contains('is-door-walking')`) && (await app.saved()).house.activeId === 'studio', await app.text('#toast'));
    await app.clickSel('#start-button');
    await t.close(app);

    app = await t.open({ seed: 'one-room', label: 'one room' });
    await app.settle();
    walk = await tapDoor(app, 'garden', t.sleep, { slow: t.slow });
    check('one room: the unbuilt garden door is on screen', walk.spot?.visible, walk.spot);
    check('one room: the companion walks to the unbuilt door first', walk.walked && walk.moved > .5 && walk.ms > 1500, { ms: walk.ms, moved: walk.moved });
    check('one room: the unbuilt door opens ajar for a peek before the house page shows', walk.open > .4 && walk.open < 1 && walk.notes.includes('A little peek at what could be.'), { open: walk.open, notes: walk.notes });
    check('one room: then the house page opens on the garden wing', walk.end?.house && !walk.end?.travelling && await app.text('#house-detail h2') === 'Greenhouse', { end: walk.end, h2: await app.text('#house-detail h2') });
    await steps.backToRoom(app);
    check('one room: back in the room nothing is stuck', !await app.js(`document.body.classList.contains('is-travelling') || document.body.classList.contains('is-door-walking')`) && (await app.saved()).house.activeId === 'studio');
    walk = await tapDoor(app, 'garden', t.sleep, { slow: t.slow });
    check('one room: the unbuilt door works a second time', walk.walked && walk.end?.house, walk.end);
    await t.close(app);

    app = await t.open({ seed: 'two-rooms', label: 'two rooms' });
    await app.settle();
    walk = await tapDoor(app, 'loft', t.sleep, { slow: t.slow });
    check('two rooms: the unbuilt upstairs door walks, then plans the upstairs room', walk.walked && walk.end?.house && await app.text('#house-detail h2') === 'Star attic', { walked: walk.walked, h2: await app.text('#house-detail h2') });
    await t.close(app);

    app = await t.open({ seed: 'two-rooms', reducedMotion: true, label: 'reduced motion' });
    await app.settle();
    walk = await tapDoor(app, 'garden', t.sleep, { slow: t.slow });
    check('reduced motion: a built door takes you there at once', walk.end?.active === 'garden' && !walk.end?.travelling && walk.ms < 1500 * t.slow, { ms: walk.ms, end: walk.end });
    walk = await tapDoor(app, 'loft', t.sleep, { slow: t.slow });
    check('reduced motion: an unbuilt door opens the house page at once', walk.end?.house && !walk.walked && walk.ms < 1500 * t.slow && await app.text('#house-detail h2') === 'Star attic', { ms: walk.ms, walked: walk.walked });
    await t.close(app);
  },
};
