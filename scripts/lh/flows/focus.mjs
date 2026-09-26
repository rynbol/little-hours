export default {
  about: 'Focus mode: starts with the companion, isolates the active desk, keeps a faint timer, and returns without pausing the session',
  async run(t) {
    const { check } = t;
    const app = await t.open({ seed: 'three-rooms' });
    await app.settle();
    await app.clickSel('[data-minutes="50"]');
    check('Focus mode uses the selected session length', await app.text('#timer') === '50:00' && await app.attr('[data-minutes="50"]', 'aria-pressed') === 'true', await app.text('#timer'));
    await app.clickSel('#focus-mode-enter');
    await app.waitFor(`document.body.classList.contains('is-focus-mode') && window.__littleHours.state.session.running`, { what: 'Focus mode and a running session' });
    const arrived = await app.waitFor(`window.__littleHours.room.diagnostics().focusCameraApplied`, { what: 'the companion to settle at the desk', timeout: 20000 }).catch(() => false);
    check('entering Focus mode starts the selected session', arrived && await app.attr('#stage-presence', 'data-presence') === 'focusing');
    const style = await app.js(`(() => { const node = document.getElementById('focus-mode-timer'), timer = getComputedStyle(node), rect = node.getBoundingClientRect(); return { color: timer.color, background: timer.backgroundColor, opacity: Number(timer.opacity), text: node.textContent, display: timer.display, viewportWidth: innerWidth, viewportHeight: innerHeight, bounds: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.right), Math.round(rect.bottom)] }; })()`);
    check('the fullscreen view keeps a subtle translucent timer inside the viewport', style.opacity < 1 && /rgba\([^)]*,\s*0?\.?\d+\)/.test(style.color) && style.text !== '' && style.bounds[0] >= 0 && style.bounds[2] <= style.viewportWidth && style.bounds[1] >= 0 && style.bounds[3] <= style.viewportHeight, style);
    const view = await app.js(`(() => { const d = window.__littleHours.room.diagnostics(), desk = d.scene.transformNodes.find(node => node.metadata?.itemId === d.layout.activeDeskId), avatar = desk?.metadata?.avatar; return { focusMode: d.focusMode, cameraApplied: d.focusCameraApplied, hiddenMeshes: d.focusHiddenMeshes, visibleOutsideDesk: d.scene.meshes.filter(mesh => mesh.isEnabled() && !mesh.isDescendantOf(desk) && mesh.visibility > 0).map(mesh => mesh.name).slice(0, 6), avatarVisible: Boolean(avatar?.isEnabled() && avatar.getChildMeshes().some(mesh => mesh.isEnabled() && mesh.visibility > 0 && mesh.getTotalVertices() > 0)), hud: !document.getElementById('focus-mode-hud').hidden, exitVisible: getComputedStyle(document.getElementById('focus-mode-exit')).display !== 'none' }; })()`);
    check('the close-up shows the working avatar and active desk alone', view.focusMode && view.cameraApplied && view.hiddenMeshes > 0 && view.visibleOutsideDesk.length === 0 && view.avatarVisible && view.hud && view.exitVisible, view);
    const matchingTime = await app.js(`document.getElementById('focus-mode-timer').textContent === document.getElementById('timer').textContent`);
    check('the translucent timer matches the session timer', matchingTime);
    const originalDeadline = await app.js(`window.__littleHours.state.session.endsAt`);
    await t.shot(app, 'focus');
    await app.key('Escape');
    await app.waitFor(`!document.body.classList.contains('is-focus-mode')`, { what: 'Escape to leave Focus mode' });
    check('Escape returns to the room and leaves the session running', await app.js(`window.__littleHours.state.session.running && !window.__littleHours.room.diagnostics().focusMode`));
    await app.clickSel('#focus-mode-enter');
    await app.waitFor(`document.body.classList.contains('is-focus-mode')`, { what: 'Focus mode to reopen' });
    check('entering an already-running session keeps its remaining time', await app.js(`window.__littleHours.state.session.endsAt === ${originalDeadline}`));
    await app.clickSel('#focus-mode-exit');
    await app.waitFor(`!document.body.classList.contains('is-focus-mode')`, { what: 'the close button to leave Focus mode' });
    check('the close button also returns without pausing', await app.js(`window.__littleHours.state.session.running`));
    await app.clickSel('#start-button');
    await app.waitFor(`!document.body.classList.contains('is-focusing')`, { what: 'the focus session to pause' });
    const paused = await app.text('#timer');
    await app.clickSel('#focus-mode-enter');
    await app.waitFor(`document.body.classList.contains('is-focus-mode')`, { what: 'Focus mode to resume a paused session' });
    await app.waitFor(`document.getElementById('timer').textContent !== ${JSON.stringify(paused)}`, { what: 'the resumed timer to count down', timeout: 3000 });
    check('entering Focus mode resumes a paused session', await app.js(`window.__littleHours.state.session.running && document.body.classList.contains('is-focus-mode')`));
    await app.key('Escape');
    await app.waitFor(`!document.body.classList.contains('is-focus-mode')`, { what: 'Escape to leave the resumed session' });
    await app.clickSel('#start-button');
    await app.waitFor(`!document.body.classList.contains('is-focusing')`, { what: 'the resumed session to pause' });
    await t.close(app);
  },
};
