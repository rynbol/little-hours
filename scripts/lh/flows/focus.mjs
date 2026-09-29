export default {
  about: 'whole-room Focus mode, live timer, captured session, Escape and close, and phone framing',
  async run(t) {
    const { check } = t;
    const app = await t.open({ seed: 'three-rooms' });
    await app.settle(); await t.steps.openFocus(app);
    await app.waitFor(`window.__littleHours.room.diagnostics().companion.atDesk && window.__littleHours.room.diagnostics().companion.state === 'working'`, { what: 'the companion to settle at the desk', timeout: 30000 });
    const view = await app.js(`(() => { const d = window.__littleHours.room.diagnostics(), desk = d.scene.transformNodes.find(node => node.metadata?.itemId === d.layout.activeDeskId), avatar = desk?.metadata?.avatar; return { wholeRoom: d.scene.meshes.filter(mesh => mesh.isEnabled() && !mesh.isDescendantOf(desk) && mesh.visibility > 0).length > 40, avatar: Boolean(avatar?.isEnabled() && avatar.getChildMeshes().some(mesh => mesh.isEnabled() && mesh.visibility > 0)), hidden: ['.app-header', '.focus-card', '.room-hint', '.stage-presence'].every(selector => getComputedStyle(document.querySelector(selector)).display === 'none'), hud: !document.getElementById('focus-mode-hud').hidden, timer: document.getElementById('focus-mode-timer').textContent === document.getElementById('timer').textContent }; })()`);
    check('Focus mode preserves the whole room and working avatar with a matching timer', Object.values(view).every(Boolean), view);
    const deadline = await app.js(`window.__littleHours.state.session.endsAt`);
    await t.shot(app, 'whole-room'); await app.key('Escape');
    await app.waitFor(`!document.body.classList.contains('is-focus-mode')`, { what: 'Escape to leave Focus mode' });
    check('Escape preserves focus time and returns keyboard focus', await app.js(`window.__littleHours.state.session.running && window.__littleHours.state.session.endsAt === ${deadline} && document.activeElement.id === 'focus-mode-enter'`));
    await t.steps.openFocus(app);
    check('re-entering keeps the original deadline', await app.js(`window.__littleHours.state.session.endsAt === ${deadline}`));
    await t.steps.closeFocus(app); await app.clickSel('#start-button');
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
