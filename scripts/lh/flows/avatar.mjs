const avatar = app => app.js('JSON.parse(JSON.stringify(window.__littleHours.state.avatar))');
const editing = app => app.js(`document.body.classList.contains('is-avatar-editing')`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function pickPart(app) {
  const choice = await app.js(`(() => { const b = document.querySelector('[data-avatar-part][aria-pressed="false"]'); return b && { part: b.dataset.avatarPart, value: b.dataset.avatarValue }; })()`);
  if (!choice) return null;
  await app.clickSel(`[data-avatar-part="${choice.part}"][data-avatar-value="${choice.value}"]`);
  await app.waitFor(`document.querySelector('[data-avatar-part="${choice.part}"][data-avatar-value="${choice.value}"]')?.getAttribute('aria-pressed') === 'true'`, { what: 'the avatar choice to save' });
  return { ...choice, now: (await avatar(app))[choice.part], pressed: await app.attr(`[data-avatar-part="${choice.part}"][data-avatar-value="${choice.value}"]`, 'aria-pressed') };
}

export default {
  about: 'the avatar editor: opens, switches tabs, picks parts and looks, resets, closes, keeps the look after a reload, waits out a door walk',
  async run(t) {
    const { check, steps, sleep } = t;
    let app = await t.open({ seed: 'three-rooms' });
    await app.settle();
    const initial = await avatar(app);
    await steps.openAvatar(app);
    check('the Avatar button opens the editor', await app.visible('#room-panel') && await app.attr('#avatar-button', 'aria-expanded') === 'true');
    check('the room turns to the avatar close-up', (await app.room()).avatarEditing === true);
    check('the editor opens on the Looks tab', await app.attr('[data-avatar-section="looks"]', 'aria-pressed') === 'true' && await app.visible('[data-avatar-look]'));

    const lookId = await app.js(`document.querySelector('[data-avatar-look][aria-pressed="false"]')?.dataset.avatarLook ?? null`);
    await app.clickSel(`[data-avatar-look="${lookId}"]`);
    await app.waitFor(`document.querySelector('[data-avatar-look="${lookId}"]')?.getAttribute('aria-pressed') === 'true'`, { what: 'the avatar look to save' });
    const afterLook = await avatar(app);
    check('picking a look changes the avatar', !same(afterLook, initial), afterLook);
    check('the picked look shows as chosen', await app.attr(`[data-avatar-look="${lookId}"]`, 'aria-pressed') === 'true');

    for (const [section, label] of [['face', 'Face & hair'], ['outfit', 'Outfits'], ['details', 'Extras']]) {
      await app.clickSel(`[data-avatar-section="${section}"]`);
      check(`the ${label} tab opens with its choices`, await app.attr(`[data-avatar-section="${section}"]`, 'aria-pressed') === 'true' && await app.js(`document.querySelectorAll('[data-avatar-part]').length`) > 1);
      const picked = await pickPart(app);
      check(`a choice on the ${label} tab changes the avatar`, picked && picked.now === picked.value && picked.pressed === 'true', picked);
    }
    const edited = await avatar(app);
    check('each choice is saved as you go', same((await app.saved()).avatar, edited), (await app.saved()).avatar);

    const canvas = await app.js(`(() => { const r = document.querySelector('#room-canvas canvas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await app.drag(canvas, { x: canvas.x + 140, y: canvas.y });
    await app.settle();
    check('dragging the avatar preview keeps the editor open', await editing(app));
    check('dragging the preview changes nothing about the look', same(await avatar(app), edited));

    await app.key('Escape'); await app.settle();
    check('Escape closes the editor', !await editing(app) && !await app.visible('#room-panel'));
    check('the room leaves the close-up', (await app.room()).avatarEditing === false);
    await steps.openAvatar(app);
    await app.clickSel('#avatar-done'); await app.waitFor(`!document.body.classList.contains('is-avatar-editing')`, { what: 'the editor to close' }); await app.settle();
    check('Done closes the editor', !await app.visible('#room-panel') && await app.attr('#avatar-button', 'aria-expanded') === 'false');
    check('closing keeps the look', same(await avatar(app), edited));

    await app.reload(); await app.settle();
    check('after a reload the avatar keeps its look', same(await avatar(app), edited), await avatar(app));

    await steps.openAvatar(app);
    await app.clickSel('#avatar-reset');
    await app.waitFor(`JSON.stringify(window.__littleHours.state.avatar) === ${JSON.stringify(JSON.stringify(initial))}`, { what: 'the avatar reset to save' });
    check('Reset look brings back the starting avatar', same(await avatar(app), initial), await avatar(app));
    check('Reset keeps the editor open', await editing(app));
    await steps.closeAvatar(app);

    await app.clickSel('#start-button');
    await app.waitFor('window.__littleHours.state.session.running === true', { what: 'the timer to start' });
    await steps.openAvatar(app);
    check('the editor pauses a running focus timer', !await app.js('window.__littleHours.state.session.running') && /paused/i.test(await app.text('#avatar-pause-note') || ''), await app.text('#avatar-pause-note'));
    await steps.closeAvatar(app);
    check('Done resumes the focus timer', await app.js('window.__littleHours.state.session.running'));
    await t.close(app);

    app = await t.open({ seed: 'three-rooms', label: 'door walk' });
    await app.settle();
    const door = await app.point({ door: 'garden' });
    check('the garden door is on screen', door?.visible, door);
    await app.click(door.x, door.y);
    await app.waitFor(`document.body.classList.contains('is-door-walking')`, { what: 'the door walk', timeout: 3000 });
    check('the Avatar button is disabled during a door walk', await app.js(`document.getElementById('avatar-button').disabled`));
    await steps.openMore(app); const button = await app.box('#avatar-button');
    await app.click(button.x, button.y); await sleep(150);
    check('clicking Avatar during a door walk does not open the editor', !await editing(app) && !await app.visible('#room-panel'));
    await app.waitFor(`window.__littleHours.state.house.activeId === 'garden' && !document.body.classList.contains('is-travelling')`, { what: 'arrival in the garden', timeout: 20000 });
    check('the walk still arrives in the garden', await app.js('window.__littleHours.state.house.activeId') === 'garden');
    check('the editor stayed closed through the walk', !await editing(app));
    await app.settle();
    await steps.openAvatar(app);
    check('after the walk the editor opens', await editing(app));
    await steps.closeAvatar(app);
    await t.close(app);

    app = await t.open({ seed: 'three-rooms', width: 390, height: 844, scale: 2, label: 'phone' });
    await app.settle();
    await steps.openAvatar(app);
    const layout = async () => app.js(`(() => {
      const clear = s => { const el = document.querySelector(s); el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.width > 0 && r.left >= 0 && r.right <= innerWidth && Boolean(hit?.closest(s)); };
      const c = document.querySelector('#room-canvas canvas').getBoundingClientRect();
      return { preview: [Math.round(c.width), Math.round(c.height)], tabs: ['looks', 'face', 'outfit', 'details'].every(id => clear('[data-avatar-section="' + id + '"]')), done: clear('#avatar-done'), reset: clear('#avatar-reset'), scroll: document.documentElement.scrollWidth <= innerWidth };
    })()`);
    const phone = await layout();
    check('phone: the avatar preview is on screen', phone.preview[0] > 200 && phone.preview[1] > 150, phone);
    check('phone: every tab, Reset and Done are uncovered', phone.tabs && phone.done && phone.reset, phone);
    check('phone: no sideways scroll', phone.scroll, phone);
    await app.clickSel('[data-avatar-section="outfit"]');
    const picked = await pickPart(app);
    check('phone: a tap on a choice changes the avatar', picked && picked.now === picked.value, picked);
    check('phone: still no sideways scroll on the Outfits tab', (await layout()).scroll);
    await t.shot(app, 'phone');
    await steps.closeAvatar(app);
    check('phone: Done closes the editor', !await editing(app));
    await t.close(app);
  },
};
