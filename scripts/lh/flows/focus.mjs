export default {
  about: 'Focus mode seats you at the desk in first person, live timer, captured session, Escape and close, and phone framing',
  async run(t) {
    const { check } = t;
    const app = await t.open({ seed: 'three-rooms' });
    await app.settle();
    const effects = `Object.keys(window.__littleHours.room.diagnostics().engine._compiledEffects)`;
    await app.js(`(() => { const { scene } = window.__littleHours.room.diagnostics(); window.__flyInEffects = null; const watch = scene.onBeforeRenderObservable.add(() => { if (window.__littleHours.room.diagnostics().seat.state !== 'entering') return; window.__flyInEffects = ${effects}; scene.onBeforeRenderObservable.remove(watch); }); })()`);
    await app.clickSel('#focus-mode-enter');
    await app.waitFor(`window.__littleHours.room.diagnostics().seat.state === 'seated'`, { what: 'the chair view to be prepared and the view to settle in the chair', timeout: 30000 });
    const effectsBefore = await app.js(`window.__flyInEffects`), effectsAfter = await app.js(effects);
    const newEffects = (effectsBefore ? effectsAfter.filter(key => !effectsBefore.includes(key)) : ['no frame drawn at the start of the fly-in']).map(key => key.slice(0, 160));
    check('the fly-in into the chair needs no new shaders, so it does not stall', newEffects.length === 0, newEffects);
    await app.waitFor(`window.__littleHours.room.diagnostics().companion.atDesk && window.__littleHours.room.diagnostics().companion.state === 'working'`, { what: 'the companion to settle at the desk', timeout: 30000 });
    const view = await app.js(`(() => { const d = window.__littleHours.room.diagnostics(), desk = d.scene.transformNodes.find(node => node.metadata?.itemId === d.layout.activeDeskId), head = desk.metadata.avatarHead.getAbsolutePosition(), eye = d.seat.camera.position; return { firstPerson: d.scene.activeCamera === d.seat.camera && d.seat.camera.mode === 0, atHead: Math.hypot(eye.x - head.x, eye.y - head.y, eye.z - head.z) < 0.6, bodyHidden: !desk.metadata.avatar.isEnabled(), detailedDesk: Boolean(desk.metadata.detail?.isEnabled()) && !desk.metadata.body.isEnabled(), storybook: d.seat.storybook === 1, vista: d.seat.world.enabled && d.seat.world.progress > 0, wholeRoom: d.scene.meshes.filter(mesh => mesh.isEnabled() && !mesh.isDescendantOf(desk) && mesh.visibility > 0).length > 40, hidden: ['.room-heading', '.focus-card', '.room-hint', '.stage-presence'].every(selector => getComputedStyle(document.querySelector(selector)).display === 'none'), hud: !document.getElementById('focus-mode-hud').hidden, timer: document.getElementById('focus-mode-timer').textContent === document.getElementById('timer').textContent }; })()`);
    check('Focus mode seats you at the desk in first person, with the room around you, a valley that follows the session and a matching timer', Object.values(view).every(Boolean), view);
    const box = await app.box('#room-canvas'), before = await app.js(`window.__littleHours.room.diagnostics().seat.look.yaw`);
    await app.drag({ x: box.x, y: box.y }, { x: box.x + 160, y: box.y });
    await app.waitFor(`Math.abs(window.__littleHours.room.diagnostics().seat.look.yaw - ${before}) > 0.4`, { what: 'dragging to look around the room' });
    check('dragging looks around from the chair and keeps focus running', await app.js(`window.__littleHours.state.session.running && document.body.classList.contains('is-focus-mode')`));
    const deadline = await app.js(`window.__littleHours.state.session.endsAt`);
    await t.shot(app, 'desk-view'); await app.key('Escape');
    check('Escape flies back out while the room still fills the screen', await app.js(`(() => { const d = window.__littleHours.room.diagnostics(); return d.seat.state === 'leaving' && document.body.classList.contains('is-focus-mode') && document.getElementById('focus-mode-hud').hidden; })()`));
    await app.waitFor(`!document.body.classList.contains('is-focus-mode')`, { what: 'Escape to leave Focus mode' });
    check('the dollhouse camera is back after leaving, with the dollhouse desk, its own look and no valley', await app.js(`(() => { const d = window.__littleHours.room.diagnostics(), desk = d.scene.transformNodes.find(node => node.metadata?.itemId === d.layout.activeDeskId); return d.seat.state === 'room' && d.scene.activeCamera === d.camera && desk.metadata.body.isEnabled() && !desk.metadata.detail?.isEnabled() && d.seat.storybook === 0 && !d.seat.world.enabled; })()`));
    check('Escape preserves focus time and returns keyboard focus', await app.js(`window.__littleHours.state.session.running && window.__littleHours.state.session.endsAt === ${deadline} && document.activeElement.id === 'focus-mode-enter'`));
    await t.steps.openFocus(app);
    check('re-entering keeps the original deadline', await app.js(`window.__littleHours.state.session.endsAt === ${deadline}`));
    await app.waitFor(`window.__littleHours.room.diagnostics().seat.state === 'seated'`, { what: 'the view to settle in the chair again', timeout: 10000 });
    await app.key('Escape'); await app.key('Escape');
    check('a second Escape during the fly-out cuts straight back to the dollhouse', await app.js(`(() => { const d = window.__littleHours.room.diagnostics(); return d.seat.state === 'room' && d.scene.activeCamera === d.camera && !document.body.classList.contains('is-focus-mode'); })()`));
    await app.settle(); await app.clickSel('#start-button');
    await app.waitFor(`!window.__littleHours.state.session.running`, { what: 'pause' });
    const pet = await app.js(`window.__littleHours.state.session.petId`);
    await t.steps.openFocus(app);
    check('paused entry resumes the captured session pet', await app.js(`window.__littleHours.state.session.running && window.__littleHours.state.session.petId === ${JSON.stringify(pet)}`));
    await t.steps.closeFocus(app);
    check('the close control leaves focus running', await app.js(`window.__littleHours.state.session.running`));
    await t.close(app);
    const phone = await t.open({ seed: 'three-rooms', width: 390, height: 844, reducedMotion: true });
    await t.steps.openMore(phone); await phone.clickSel('#mini-button'); await t.steps.openFocus(phone);
    const fit = await phone.js(`(() => { const stage = document.getElementById('stage'), box = stage.getBoundingClientRect(), exit = document.getElementById('focus-mode-exit').getBoundingClientRect(); return !stage.classList.contains('is-mini') && box.top === 0 && box.left === 0 && box.width === innerWidth && Math.abs(box.height - innerHeight) < 2 && exit.right <= innerWidth && exit.bottom <= innerHeight && exit.height >= 44; })()`);
    check('phone focus fills the viewport and leaves mini view with a reachable exit', fit);
    await t.shot(phone, 'phone'); await t.steps.closeFocus(phone); await t.close(phone);
  },
};
