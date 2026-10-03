import { isFocusing } from '../session.js';
import { bondLevel } from '../pet-bonds.js';

export function createWildsNavigation(app, container, loadWilds) {
  let active = false, game = null, pending = null, generation = 0, disposed = null, destroyed = false;
  const allowed = () => !destroyed && !isFocusing(app.state.session);
  const release = value => {
    value.dispose();
    disposed = structuredClone(value.diagnostics());
  };
  function restore() {
    container.hidden = true;
    container.replaceChildren();
    if (destroyed) return;
    app.room?.setSuspended(true);
    app.houseUI?.restoreAtTrailhead();
  }
  function close() {
    if (!active) return pending;
    active = false;
    generation++;
    if (game) { release(game); game = null; }
    container.hidden = true;
    if (pending) return pending.then(restore);
    restore();
  }
  function open() {
    if (!allowed()) { app.toast('Pause your focus session before entering the Wilds.', true); return Promise.resolve(false); }
    if (active) return pending || Promise.resolve(true);
    if (pending) return pending.then(open);
    active = true;
    const token = ++generation;
    const current = () => token === generation && active && allowed();
    pending = (async () => {
      await app.nav.setHouseOpen(true);
      if (!current()) return false;
      app.room?.setSuspended(true);
      app.houseUI?.releaseView();
      container.hidden = false;
      container.innerHTML = '<p role="status">Opening the Wilds…</p>';
      const module = await loadWilds();
      if (!current()) return false;
      const created = await module.createWildsGame({ container, appearance: structuredClone(app.state.avatar), pet: app.state.pet || 'cat', bond: bondLevel(app.state.petBonds?.[app.state.pet]).index, onLeave: close });
      if (!current()) { release(created); return false; }
      game = created;
      return true;
    })().catch(error => {
      if (!destroyed && token === generation) { console.error('Could not enter the Wilds:', error); app.toast('The Wilds couldn’t load. Your island is ready.'); }
      return false;
    }).finally(() => {
      pending = null;
      if (!game && token === generation) { active = false; restore(); }
    });
    return pending;
  }
  return {
    open,
    close,
    render() { if (active && !allowed()) close(); },
    diagnostics: () => ({ active, ready: Boolean(game), loading: Boolean(pending), game: game ? structuredClone(game.diagnostics()) : null, disposed: disposed ? structuredClone(disposed) : null }),
    get active() { return active; },
    get isOpen() { return active; },
    dispose() { destroyed = true; close(); container.remove(); },
  };
}
