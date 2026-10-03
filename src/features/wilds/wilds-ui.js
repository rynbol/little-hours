import { travelTo } from '../../ui/place-transition.js';
import { isFocusing } from '../../core/session.js';
import { bondLevel } from '../../core/pet-bonds.js';
import { GEAR, POTION, purchase, shelf } from '../../core/wilds/gear.js';
import { levelFor } from '../../core/wilds/progress.js';
import './wilds.css';

const ICONS = Object.freeze({
  leave: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 8.5 10.5 12l3.5 3.5M10.8 12H20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="6" width="3.4" height="12" rx="1.2" fill="currentColor"/><rect x="13.6" y="6" width="3.4" height="12" rx="1.2" fill="currentColor"/></svg>',
});
const CONTROLS = Object.freeze([
  ['W A S D', 'Move'], ['Shift', 'Sprint'], ['Space', 'Jump'], ['Ctrl · Right click', 'Dodge roll'],
  ['Click', 'Attack · click again to combo'], ['Hold click', 'Charged heavy'], ['F', 'Lock on'], ['E', 'Rest · shop · pick up · pet'], ['Q', 'Pet skill'], ['R', 'Whistle for your pet'], ['H', 'Drink a potion'], ['M', 'Mute'], ['Mouse · Scroll', 'Look · Zoom'], ['Esc', 'Pause'],
]);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createWildsUI(app) {
  let root = null, game = null, loading = null, disposed = false, failed = false, entering = false;
  const $ = selector => root.querySelector(selector);
  const isOpen = () => Boolean(root && !root.hidden);
  const load = () => loading ??= import('./game.js');

  function build() {
    root = document.createElement('section');
    root.className = 'wilds'; root.hidden = true; root.setAttribute('aria-label', 'The Wilds');
    root.innerHTML = `<div class="wilds-stage"></div><div class="wilds-hud"></div>
<div class="wilds-corner"><button class="wilds-icon" data-wilds="pause" aria-label="Pause">${ICONS.pause}</button><button class="wilds-icon" data-wilds="leave" aria-label="Leave the Wilds">${ICONS.leave}</button></div>
<dialog class="wilds-menu" aria-labelledby="wilds-menu-title"><h2 id="wilds-menu-title">The Wilds</h2><p class="wilds-menu-note">A long green valley above the island: a camp, a lake under the falls, old stones, and things hidden for whoever looks.</p>
<dl class="wilds-keys">${CONTROLS.map(([key, does]) => `<div><dt>${key}</dt><dd>${does}</dd></div>`).join('')}</dl>
<div class="wilds-menu-actions"><button class="wilds-play" data-wilds="play">Play</button><button class="wilds-quiet" data-wilds="exit">Leave the Wilds</button></div></dialog>
<dialog class="wilds-menu wilds-shop" aria-labelledby="wilds-shop-title"><h2 id="wilds-shop-title">Camp merchant</h2><p class="wilds-menu-note" data-wilds="purse"></p>
<ul class="wilds-wares"></ul><div class="wilds-menu-actions"><button class="wilds-play" data-wilds="done">Back to the valley</button></div></dialog>`;
    document.body.append(root);
    root.addEventListener('keydown', event => event.stopPropagation());
    $('[data-wilds="play"]').addEventListener('click', play);
    $('[data-wilds="exit"]').addEventListener('click', close);
    $('[data-wilds="leave"]').addEventListener('click', close);
    $('[data-wilds="pause"]').addEventListener('click', () => pause());
    $('.wilds-menu:not(.wilds-shop)').addEventListener('cancel', event => { event.preventDefault(); play(); });
    $('.wilds-shop').addEventListener('cancel', event => { event.preventDefault(); closeShop(); });
    $('[data-wilds="done"]').addEventListener('click', closeShop);
    $('.wilds-wares').addEventListener('click', event => { const id = event.target.closest('[data-buy]')?.dataset.buy; if (id) buy(id); });
  }

  const REASONS = Object.freeze({ owned: 'Owned', level: 'Needs level', coins: 'Not enough coins', full: 'Satchel full' });
  function stock() {
    const { wilds, house } = app.state, level = levelFor(wilds.xp).level;
    $('[data-wilds="purse"]').textContent = `${house.coins} coins from studying · level ${level} · ${wilds.potions}/${POTION.carry} potions`;
    $('.wilds-wares').innerHTML = shelf(wilds, house.coins, level).map(row => {
      const item = row.id === 'potion' ? POTION : GEAR[row.id], status = row.reason === 'level' ? `${REASONS.level} ${row.level}` : REASONS[row.reason] ?? `Buy · ${row.price}`;
      return `<li><div><strong>${item.label}</strong><span>${item.note}</span></div><button class="wilds-buy" data-buy="${row.id}" ${row.ready ? '' : 'disabled'}>${status}</button></li>`;
    }).join('');
  }
  function shop() {
    if (!game || game.paused) return;
    game.pause();
    stock();
    root.dataset.phase = 'shop';
    $('.wilds-shop').showModal();
    $('[data-wilds="done"]').focus({ preventScroll: true });
  }
  async function buy(id) {
    const level = levelFor(app.state.wilds.xp).level;
    await app.acceptUpdate(app.store.update(draft => { purchase(draft.wilds, draft.house, id, level); }));
    game?.restock(app.state.wilds);
    if ($('.wilds-shop').open) stock();
  }
  function closeShop() {
    $('.wilds-shop').close();
    play();
  }

  function menu(started) {
    $('#wilds-menu-title').textContent = started ? 'Paused' : 'The Wilds';
    $('[data-wilds="play"]').textContent = started ? 'Resume' : 'Play';
    root.dataset.phase = 'menu';
    if (!$('.wilds-menu').open) $('.wilds-menu').showModal();
    $('[data-wilds="play"]').focus({ preventScroll: true });
  }
  function play() {
    if (!game) return;
    for (const dialog of root.querySelectorAll('dialog[open]')) dialog.close();
    root.dataset.phase = 'playing'; root.dataset.started = 'true';
    game.resume({ capture: true });
    game.canvas.focus({ preventScroll: true });
  }
  function pause() {
    if (!game || game.paused) return;
    game.pause();
    menu(true);
  }

  function enter(module) {
    if (disposed || isOpen()) return;
    if (!root) build();
    root.hidden = false; root.dataset.phase = 'loading'; delete root.dataset.started;
    document.body.classList.add('is-wilds'); document.getElementById('app').inert = true;
    app.houseUI?.release();
    module.then(({ createGame, loadModels }) => loadModels().then(models => {
      if (disposed || !isOpen() || game) return;
      const { state } = app;
      game = createGame($('.wilds-stage'), $('.wilds-hud'), {
        models, reducedMotion, onPause: pause, onShop: shop,
        wilds: { bond: bondLevel(state.petBonds[state.pet]).index, kind: state.pet, progress: state.wilds },
        onSave: mutate => app.acceptUpdate(app.store.update(draft => { mutate(draft.wilds, draft); })),
      });
      menu(false);
    })).catch(error => {
      failed = true;
      console.error('Could not open the Wilds:', error);
      app.toast('The Wilds couldn’t load. Your island is safe.', true);
      leave();
    });
  }
  function leave() {
    if (!root || root.hidden) return;
    for (const dialog of root.querySelectorAll('dialog[open]')) dialog.close();
    game?.dispose(); game = null;
    root.hidden = true; delete root.dataset.phase;
    document.body.classList.remove('is-wilds'); document.getElementById('app').inert = false;
    app.houseUI?.restore();
  }

  function open() {
    if (disposed || isOpen() || entering) return;
    if (isFocusing(app.state.session)) { app.toast('Pause your focus session before heading into the Wilds.', true); return; }
    failed = false; entering = true;
    const module = load();
    module.catch(() => {});
    return Promise.resolve(travelTo('forest', () => enter(module), () => Boolean(game) || failed)).finally(() => { entering = false; });
  }
  function close() {
    if (!isOpen()) return;
    game?.pause();
    return Promise.resolve(travelTo('island', leave, () => Boolean(app.houseUI?.diagnostics()?.scene.isReady())))
      .then(() => document.querySelector('#house-canvas [data-room="forest"]')?.focus({ preventScroll: true }));
  }

  return {
    open, close,
    get isOpen() { return isOpen(); },
    render() { if (isOpen() && isFocusing(app.state.session)) close(); },
    diagnostics: () => game ? { ...game.diagnostics(), phase: root.dataset.phase } : null,
    visit: place => game?.visit(place),
    buy,
    dispose() { disposed = true; leave(); root?.remove(); root = null; },
  };
}
