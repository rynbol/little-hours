import { BAIT_RANGES, FIGHT, SPECIES, TIERS, baitRange, rollCatch, speciesOf, startFight, stepFight, tierOf } from '../../core/fishing.js';
import { clockRandom } from '../../core/test-pins.js';
import { fishArt } from './fish-art.js';
import { createLakeScene } from './lake-scene.js';
import './fishing.css';

const BAIT_ART = {
  crumb: '<path d="M5 13c0-4 3-7 7-7s7 3 7 7c0 2-1 4-3 4H8c-2 0-3-2-3-4Z" fill="#e6c48f"/><path d="M8 11h2M13 10h2M11 13h2" stroke="#b98e55" stroke-width="1.4" stroke-linecap="round"/>',
  worm: '<path d="M4 15c2-5 5 0 7-4s5 1 7-3" fill="none" stroke="#e39a8e" stroke-width="3.4" stroke-linecap="round"/><circle cx="18.2" cy="7.8" r=".9" fill="#5a3a33"/>',
  cricket: '<ellipse cx="12" cy="13" rx="6" ry="3.6" fill="#8fa35f"/><path d="M8 11 4 6M16 11l4-5M9 15l-3 4M15 15l3 4" stroke="#6b7c45" stroke-width="1.3" stroke-linecap="round"/><circle cx="17" cy="12" r="1" fill="#2f3322"/>',
  firefly: '<circle cx="12" cy="14" r="5.5" fill="#ffe28a" opacity=".45"/><circle cx="12" cy="14" r="3" fill="#ffd45c"/><ellipse cx="8.5" cy="9" rx="3" ry="2" fill="#f4efe6" opacity=".8"/><ellipse cx="15.5" cy="9" rx="3" ry="2" fill="#f4efe6" opacity=".8"/>',
  star: '<path d="m12 3 2.6 5.6 6.1.7-4.6 4.2 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.2 6.1-.7Z" fill="#f1c96b"/><circle cx="12" cy="12" r="9" fill="#f1c96b" opacity=".18"/>',
};
const baitIcon = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${BAIT_ART[id]}</svg>`;
const rangeText = range => range.to === Infinity ? `${range.from}+ min` : `${range.from}–${range.to} min`;
const hintFor = tier => { const index = TIERS.findIndex(t => t.id === tier), range = BAIT_RANGES.reduce((best, r) => r.weights[index] > best.weights[index] ? r : best); return `Best on ${range.label.toLowerCase()} · ${rangeText(range)}`; };
const cm = size => `${size.toFixed(1).replace(/\.0$/, '')} cm`;
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createFishingUI(app, { onClose } = {}) {
  let root = null, scene = null, phase = 'idle', chosen = null, timers = [], caught = null, biteTimer = 0, returnFocus = null, building = 0, fight = null, hooked = null, holding = false, loop = 0, lastFrame = 0;
  const $ = selector => root.querySelector(selector);
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pond = () => app.state.pond;

  function build() {
    root = document.createElement('section'); root.className = 'lake'; root.id = 'lake-page'; root.hidden = true; root.setAttribute('aria-label', 'Willow Pond');
    root.innerHTML = `<div class="lake-stage"></div><div class="lake-vignette" aria-hidden="true"></div>
      <header class="lake-top"><button class="lake-chip" id="lake-back" type="button" aria-label="Back to the island"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="lake-wide">Island</span></button>
        <div class="lake-title"><h1>Willow Pond</h1><p>The pond behind the cottage</p></div>
        <button class="lake-chip lake-book" id="lake-journal-button" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h10a2 2 0 0 1 2 2v13H8a2 2 0 0 1-2-2Z" fill="#f1e2c9" stroke="currentColor" stroke-width="1.5"/><path d="M6 4.5v13" stroke="#a65766" stroke-width="3"/><path d="M10 9h5M10 12h3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span class="lake-wide">Journal</span><b id="lake-found"></b></button></header>
      <p class="lake-status" id="lake-status" aria-live="polite"></p>
      <div class="lake-bite" id="lake-bite" hidden><span class="lake-alert" id="lake-alert" aria-hidden="true">!</span><p id="lake-bite-note"></p><div class="lake-tension" id="lake-tension" role="meter" aria-label="Line tension" aria-valuemin="0" aria-valuemax="100"><i></i></div><div class="lake-bite-ring" id="lake-bite-ring"><button type="button" id="lake-reel">Reel!</button></div></div>
      <footer class="lake-tray" id="lake-tray"><div class="lake-tackle"><div class="lake-tray-head"><p class="lake-tray-title">Tackle box</p><p class="lake-tray-sub">Bait from your focus sessions. Longer sessions draw rarer fish.</p></div>
        <div class="lake-bait" id="lake-bait" role="radiogroup" aria-label="Choose your bait"></div>
        <div class="lake-odds" id="lake-odds" aria-label="Chances for this bait"></div></div>
        <button class="lake-cast" id="lake-cast" type="button"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3v5" stroke="#4b3b40" stroke-width="2" stroke-linecap="round"/><path d="M7 17a9 9 0 0 1 18 0Z" fill="#d9604f"/><path d="M7 17a9 9 0 0 0 18 0Z" fill="#fffaf1"/><path d="M7 17h18" stroke="#4b3b40" stroke-width="1.6"/></svg><span>Cast</span></button></footer>
      <div class="lake-card" id="lake-card" role="dialog" aria-modal="true" aria-labelledby="lake-card-name" hidden></div>
      <div class="lake-journal" id="lake-journal" role="dialog" aria-modal="true" aria-labelledby="lake-journal-title" hidden></div>`;
    document.body.appendChild(root);
    $('#lake-back').addEventListener('click', close);
    $('#lake-cast').addEventListener('click', cast);
    $('#lake-reel').addEventListener('pointerdown', press);
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) root.addEventListener(type, letGo);
    window.addEventListener('blur', letGo);
    $('#lake-journal-button').addEventListener('click', openJournal);
    $('#lake-bait').addEventListener('click', event => { const chip = event.target.closest('[data-bait]'); if (chip && phase === 'idle') { chosen = chip.dataset.bait; renderTray(); } });
    root.querySelector('.lake-stage').addEventListener('pointerdown', press);
  }

  const status = text => { $('#lake-status').textContent = text; };
  function groups() {
    const counts = new Map();
    for (const bait of pond().bait) { const range = baitRange(bait.minutes); counts.set(range.id, (counts.get(range.id) || 0) + 1); }
    return BAIT_RANGES.filter(range => counts.has(range.id)).map(range => ({ range, count: counts.get(range.id) }));
  }
  function renderTray() {
    const list = groups();
    if (!list.some(g => g.range.id === chosen)) chosen = list.at(-1)?.range.id ?? null;
    $('#lake-bait').innerHTML = list.length ? list.map(({ range, count }) => `<button type="button" role="radio" class="lake-bait-chip" data-bait="${range.id}" aria-checked="${range.id === chosen}"${phase !== 'idle' ? ' disabled' : ''}><span class="lake-tin">${baitIcon(range.id)}</span><strong>${range.label}</strong><small>${rangeText(range)}</small><b>×${count}</b></button>`).join('')
      : `<p class="lake-empty">No bait yet. Finish a focus session of 5 minutes or more and a little something turns up here.</p>`;
    const range = BAIT_RANGES.find(r => r.id === chosen) || BAIT_RANGES[0];
    $('#lake-odds').innerHTML = `<div class="lake-odds-bar">${TIERS.map((tier, i) => range.weights[i] ? `<span style="--w:${range.weights[i]};--c:${tier.color}" title="${tier.label} ${range.weights[i]}%"></span>` : '').join('')}</div>
      <ul>${TIERS.map((tier, i) => `<li class="${range.weights[i] ? '' : 'is-off'}" style="--c:${tier.color}"><i></i>${tier.label}<b>${range.weights[i]}%</b></li>`).join('')}</ul>`;
    $('#lake-odds').hidden = !list.length;
    const cast = $('#lake-cast'); cast.disabled = !list.length || phase !== 'idle';
    cast.querySelector('span').textContent = phase === 'idle' ? 'Cast' : phase === 'cast' ? 'Casting…' : phase === 'wait' ? 'Waiting…' : 'Reeling…';
    const found = Object.keys(pond().journal).length; $('#lake-found').textContent = `${found}/${SPECIES.length}`;
    $('#lake-tray').classList.toggle('is-busy', phase !== 'idle');
    $('#lake-tray').classList.toggle('is-away', !['idle', 'cast', 'wait'].includes(phase));
  }

  function cast() {
    if (phase !== 'idle' || !chosen || !scene) return;
    const index = pond().bait.findLastIndex(b => baitRange(b.minutes).id === chosen);
    if (index < 0) return;
    phase = 'cast'; renderTray(); status('Swish…');
    scene.cast().then(() => {
      if (phase !== 'cast') return;
      phase = 'wait'; renderTray(); status('Waiting for a nibble…');
      const bite = 1400 + clockRandom() * 3200, nibbles = Math.floor(clockRandom() * 3);
      for (let i = 0; i < nibbles; i++) later(() => { scene?.nibble(); status('A nibble…'); }, bite * (i + 1) / (nibbles + 1.4));
      later(() => startBite(index), bite);
    });
  }
  function startBite(index) {
    if (phase !== 'wait') return;
    phase = 'bite'; scene.bite(); status(''); renderTray();
    $('#lake-bite').hidden = false; $('#lake-bite').dataset.index = index; $('#lake-bite').classList.remove('is-reeling');
    $('#lake-reel').textContent = 'Reel!'; $('#lake-bite-note').textContent = 'Something’s biting! Press and hold';
    $('#lake-bite-ring').style.setProperty('--progress', 0);
    const head = scene.screenPoint(); $('#lake-alert').style.setProperty('--x', `${head.x}px`); $('#lake-alert').style.setProperty('--y', `${head.y}px`);
    $('#lake-reel').focus({ preventScroll: true });
    app.audio?.chime?.();
    const span = reduced() ? 3200 : 1700;
    $('#lake-bite-ring').style.setProperty('--window', `${span}ms`);
    biteTimer = later(() => { if (phase === 'bite') escaped(); }, span);
  }
  function escaped() {
    phase = 'idle'; scene.escape(); $('#lake-bite').hidden = true; status('It slipped away. Your bait is still on the hook.'); renderTray();
    later(() => { if (phase === 'idle') status(''); }, 3200);
    $('#lake-cast').focus({ preventScroll: true });
  }
  function press(event) {
    if (phase !== 'bite' && phase !== 'reel') return;
    event?.preventDefault?.();
    if (phase === 'bite') hook();
    holding = true; $('#lake-bite').classList.add('is-holding');
  }
  function letGo() { holding = false; root?.querySelector('#lake-bite')?.classList.remove('is-holding'); }
  function hook() {
    clearTimeout(biteTimer);
    const index = Number($('#lake-bite').dataset.index), bait = pond().bait[index];
    if (!bait) { phase = 'idle'; $('#lake-bite').hidden = true; renderTray(); return; }
    hooked = { index, rolled: rollCatch(bait.minutes, clockRandom) };
    fight = startFight(speciesOf(hooked.rolled.species).tier);
    phase = 'reel'; scene.hook(hooked.rolled);
    $('#lake-bite').classList.add('is-reeling'); $('#lake-reel').textContent = 'Hold';
    renderTray(); lastFrame = performance.now(); loop = requestAnimationFrame(struggle);
  }
  function struggle(now) {
    if (phase !== 'reel' || !fight) return;
    stepFight(fight, Math.min(.05, (now - lastFrame) / 1000), holding, clockRandom); lastFrame = now;
    scene?.fight(fight, holding);
    const meter = $('#lake-tension'), tension = Math.min(1, fight.tension);
    meter.style.setProperty('--tension', tension); meter.setAttribute('aria-valuenow', Math.round(tension * 100));
    meter.classList.toggle('is-red', fight.tension >= FIGHT.red);
    $('#lake-bite-ring').style.setProperty('--progress', 1 - fight.line);
    const note = fight.tension >= FIGHT.red ? 'Too tight! Let go a moment' : fight.mood === 'run' && fight.pull > .4 ? 'It’s running! Ease off…' : fight.slack > 1.4 ? 'Keep reeling or it’ll slip off' : holding ? 'Reeling…' : 'Hold to reel it in';
    if ($('#lake-bite-note').textContent !== note) $('#lake-bite-note').textContent = note;
    if (fight.outcome === 'landed') land();
    else if (fight.outcome) lost(fight.outcome);
    else loop = requestAnimationFrame(struggle);
  }
  function lost(outcome) {
    letGo(); fight = null; hooked = null;
    phase = 'idle'; scene.escape(outcome === 'snapped'); $('#lake-bite').hidden = true;
    status(outcome === 'snapped' ? 'Snap! The line gave way. Your bait washed back to shore.' : 'It shook the hook loose. Your bait is still on the line.'); renderTray();
    later(() => { if (phase === 'idle') status(''); }, 3600);
    $('#lake-cast').focus({ preventScroll: true });
  }
  function land() {
    letGo(); fight = null;
    const result = app.store.landFish(hooked.index, hooked.rolled); hooked = null;
    app.acceptUpdate(result); caught = result.caught;
    phase = 'leap'; $('#lake-bite').hidden = true; status(''); renderTray();
    if (!caught) { phase = 'idle'; renderTray(); return; }
    scene.leap(caught).then(() => { if (phase === 'leap') showCard(caught); });
  }
  function showCard(fish) {
    phase = 'card';
    const species = speciesOf(fish.species), tier = tierOf(species.tier), range = baitRange(fish.minutes);
    const eyebrow = fish.isNew ? 'New to your journal!' : fish.record ? 'A new personal best!' : `Caught again · ×${fish.count}`;
    const card = $('#lake-card');
    card.style.setProperty('--tier', tier.color); card.dataset.tier = tier.id;
    card.innerHTML = `<div class="lake-card-inner"><div class="lake-card-rays" aria-hidden="true"></div><p class="lake-card-eyebrow">${eyebrow}</p>
      <div class="lake-card-art">${fishArt(species.id)}</div>
      <span class="lake-tier">${tier.label}</span><h2 id="lake-card-name">${escape(species.name)}</h2><p class="lake-card-about">${escape(species.about)}</p>
      <dl><div><dt>Size</dt><dd>${cm(fish.size)}</dd></div><div><dt>Caught</dt><dd>×${fish.count}</dd></div><div><dt>Best</dt><dd>${cm(fish.best)}</dd></div></dl>
      <p class="lake-card-bait">${baitIcon(range.id)} On ${range.label.toLowerCase()} bait, from ${fish.minutes} focused minutes</p>
      <div class="lake-card-actions"><button type="button" class="lake-secondary" id="lake-card-journal">Open journal</button><button type="button" class="lake-primary" id="lake-card-keep">${pond().bait.length ? 'Keep fishing' : 'Put it in the basket'}</button></div></div>`;
    card.hidden = false; requestAnimationFrame(() => card.classList.add('is-shown'));
    $('#lake-card-keep').addEventListener('click', stow);
    $('#lake-card-journal').addEventListener('click', () => { stow(); openJournal(fish.species); });
    $('#lake-card-keep').focus({ preventScroll: true });
  }
  function stow() {
    if (phase !== 'card') return;
    phase = 'idle'; scene.stow(); const card = $('#lake-card'); card.classList.remove('is-shown'); card.hidden = true;
    status(pond().bait.length ? '' : 'That was your last bait. Focus a little to earn more.'); renderTray();
    $('#lake-cast').focus({ preventScroll: true });
  }

  function openJournal(highlight) {
    const journal = pond().journal, found = Object.keys(journal).length, total = Object.values(journal).reduce((sum, e) => sum + e.count, 0);
    const panel = $('#lake-journal');
    panel.innerHTML = `<div class="lake-journal-inner"><header><div><p class="lake-journal-eyebrow">POND JOURNAL</p><h2 id="lake-journal-title">${found} of ${SPECIES.length} found</h2><p>${total} fish caught so far. Longer focus sessions bring rarer bait.</p></div><button type="button" class="lake-close" id="lake-journal-close" aria-label="Close journal">×</button></header>
      <ol class="lake-ranges">${BAIT_RANGES.map(range => `<li>${baitIcon(range.id)}<span><strong>${range.label}</strong><small>${rangeText(range)}</small></span><span class="lake-mini-odds">${TIERS.map((tier, i) => range.weights[i] ? `<i style="--w:${range.weights[i]};--c:${tier.color}"></i>` : '').join('')}</span></li>`).join('')}</ol>
      ${TIERS.map(tier => { const list = SPECIES.filter(s => s.tier === tier.id); return `<section style="--c:${tier.color}"><h3><i></i>${tier.label}<small>${list.filter(s => journal[s.id]).length} / ${list.length}</small></h3><div class="lake-journal-grid">${list.map(s => {
        const entry = journal[s.id];
        return entry ? `<article class="lake-entry${s.id === highlight ? ' is-new' : ''}" data-species="${s.id}"><div class="lake-entry-art">${fishArt(s.id)}</div><strong>${escape(s.name)}</strong><small>×${entry.count} · best ${cm(entry.best)}</small></article>`
          : `<article class="lake-entry is-missing" data-species="${s.id}"><div class="lake-entry-art">${fishArt(s.id, { silhouette: true })}</div><strong>???</strong><small>${hintFor(tier.id)}</small></article>`;
      }).join('')}</div></section>`; }).join('')}</div>`;
    panel.hidden = false;
    $('#lake-journal-close').addEventListener('click', closeJournal);
    panel.addEventListener('click', event => { if (event.target === panel) closeJournal(); }, { once: true });
    $('#lake-journal-close').focus({ preventScroll: true });
    if (highlight) panel.querySelector(`[data-species="${highlight}"]`)?.scrollIntoView({ block: 'center' });
  }
  function closeJournal() { $('#lake-journal').hidden = true; $(phase === 'card' ? '#lake-card-keep' : '#lake-cast')?.focus({ preventScroll: true }); }

  function onKey(event) {
    if (!root || root.hidden) return;
    if (event.key === 'Escape') {
      event.stopImmediatePropagation(); event.preventDefault();
      if (!$('#lake-journal').hidden) closeJournal(); else if (phase === 'card') stow(); else close();
      return;
    }
    if ((event.key === ' ' || event.key === 'Enter') && (phase === 'bite' || phase === 'reel') && !event.target.closest('input, textarea')) {
      event.preventDefault();
      if (!event.repeat) press();
      return;
    }
    if ((event.key === ' ' || event.key === 'Enter') && !event.target.closest('button, input, textarea')) {
      event.preventDefault();
      if (phase === 'idle') cast();
    }
  }
  function onKeyUp(event) { if (event.key === ' ' || event.key === 'Enter') letGo(); }

  function open() {
    if (!root) build();
    if (!root.hidden) return;
    returnFocus = document.activeElement;
    phase = 'idle'; caught = null; chosen = null;
    root.hidden = false; document.body.classList.add('is-lake');
    building = requestAnimationFrame(() => { building = setTimeout(() => { building = 0; if (!root.hidden) scene = createLakeScene(root.querySelector('.lake-stage'), { theme: app.state.theme, avatar: app.state.avatar, pet: app.state.pet, reducedMotion: reduced() }); }); });
    root.dataset.theme = app.state.theme;
    status(pond().bait.length ? 'Pick a bait, then cast your line.' : ''); renderTray();
    $('#lake-card').hidden = true; $('#lake-journal').hidden = true; $('#lake-bite').hidden = true;
    document.addEventListener('keydown', onKey, true); document.addEventListener('keyup', onKeyUp, true);
    $('#lake-cast').disabled ? $('#lake-back').focus({ preventScroll: true }) : $('#lake-cast').focus({ preventScroll: true });
  }
  function close() {
    if (!root || root.hidden) return;
    cancelAnimationFrame(building); clearTimeout(building); building = 0;
    clearTimers(); cancelAnimationFrame(loop); letGo(); fight = null; hooked = null; document.removeEventListener('keydown', onKey, true); document.removeEventListener('keyup', onKeyUp, true);
    scene?.dispose(); scene = null; phase = 'idle';
    root.hidden = true; document.body.classList.remove('is-lake');
    onClose?.(); returnFocus?.focus?.({ preventScroll: true });
  }
  return {
    open, close,
    get isOpen() { return Boolean(root && !root.hidden); },
    render() { if (root && !root.hidden && phase === 'idle') renderTray(); },
    diagnostics: () => scene ? { ...scene.diagnostics(), ui: phase, fight: fight && { tension: fight.tension, line: fight.line, mood: fight.mood, runs: fight.runs } } : null,
    dispose() { close(); root?.remove(); root = null; },
  };
}
