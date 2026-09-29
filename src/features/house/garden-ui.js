import { GARDEN_SPECIES, GARDEN_CAPACITY, SEED_PRICE, gardenSpecies, gardenPlantName, gardenGrowth, gardenStage, focusGardenPlantId } from '../../core/garden-plants.js';
import { coinArt } from '../../ui/ui-art.js';
import { icon } from '../../ui/icons.js';
import { sessionStarted } from '../../core/session.js';
import { gardenPlantArt } from './garden-art.js';
import './garden.css';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function createGardenUI(root, { store, acceptUpdate, onFocus, onBack, onPlot, notice, celebrate }) {
  let slot = 0, panel = 'closed', selectedSpecies = 'cosmos', selectedPlant = null;
  const $ = selector => root.querySelector(selector);
  const focusSpot = () => root.closest('.house-page')?.querySelector(`#garden-spot-${slot}`)?.focus({ preventScroll: true });
  function closeCard() {
    panel = 'closed'; selectedPlant = null;
    if ($('#garden-name-form')) $('#garden-name-form').hidden = true;
    if ($('.garden-card')) $('.garden-card').hidden = true;
    onPlot?.(null);
  }
  function shell() {
    if ($('#garden-back')) return;
    root.innerHTML = `<header class="garden-heading"><button id="garden-back" class="garden-chip" aria-label="Back to the island"><span aria-hidden="true">‹</span> Island</button><h2 tabindex="-1">Your garden</h2><button id="garden-collection-open" class="garden-chip" aria-label="Plant collection">${icon('leaf')}<span class="garden-collection-label">Collection</span><b></b></button></header>
      <section id="garden-card" class="garden-card" aria-labelledby="garden-card-title" hidden><button id="garden-card-close" class="garden-card-close" aria-label="Close plant details">${icon('close')}</button><div class="garden-card-inner"></div></section>
      <dialog class="garden-collection" id="garden-collection-dialog" aria-labelledby="garden-collection-title"><header><h3 id="garden-collection-title">Your collection</h3><button id="garden-collection-close" class="garden-chip" aria-label="Close collection">${icon('close')}</button></header><div class="garden-collection-items"></div></dialog>`;
    $('#garden-back').addEventListener('click', onBack);
    $('#garden-card-close').addEventListener('click', () => { closeCard(); focusSpot(); });
    const collection = $('#garden-collection-dialog');
    $('#garden-collection-open').addEventListener('click', () => { collection.returnValue = ''; collection.showModal(); });
    $('#garden-collection-close').addEventListener('click', () => collection.close());
    collection.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
  }
  function render() {
    shell();
    const { garden, house, session } = store.state;
    const editor = $('#garden-name-input'), naming = editor && !$('#garden-name-form').hidden;
    if (naming && garden.plants.some(plant => plant.id === editor.dataset.plant)) selectedPlant = editor.dataset.plant;
    const planted = garden.plants.find(plant => plant.slot === slot), plant = garden.plants.find(item => item.id === selectedPlant) || planted;
    const seeds = panel === 'seeds' || !plant, price = garden.plants.length ? SEED_PRICE : 0;
    const species = gardenSpecies(seeds ? selectedSpecies : plant.species), growth = gardenGrowth(plant);
    const focusId = root.contains(document.activeElement) ? document.activeElement.id : null;
    const draftName = naming ? { id: editor.dataset.plant, value: editor.value, start: editor.selectionStart, end: editor.selectionEnd } : null;
    const card = $('.garden-card'); card.hidden = panel === 'closed'; card.dataset.kind = seeds ? 'seeds' : 'plant';
    $('#garden-collection-open b').textContent = garden.plants.length;
    $('.garden-card-inner').innerHTML = seeds ? `<div class="garden-seed-heading"><h3 id="garden-card-title" tabindex="-1">Choose a seed</h3><span class="garden-wallet" aria-label="${house.coins} coins">${coinArt()} ${house.coins}</span></div><div class="garden-seeds" role="group" aria-label="Seeds">${GARDEN_SPECIES.map(item => `<button id="seed-${item.id}" data-seed="${item.id}" aria-pressed="${selectedSpecies === item.id}">${gardenPlantArt({ species: item.id }, true)}<span><strong>${item.name}</strong><small>${item.minutes} min</small></span></button>`).join('')}</div><button id="garden-plant-seed" class="garden-plant-button" ${house.coins < price || garden.plants.length >= GARDEN_CAPACITY ? 'disabled' : ''}>Plant ${species.name} <span>${price ? `${price} coins` : 'Free'}</span></button><p class="garden-seed-note" ${garden.plants.length < GARDEN_CAPACITY && !planted && house.coins >= price ? 'hidden' : ''}>${garden.plants.length >= GARDEN_CAPACITY ? 'Your collection is full.' : planted ? 'The plant here moves to your collection.' : house.coins < price ? `${price - house.coins} more coins` : ''}</p>`
      : `<div class="garden-plant-summary"><div class="garden-specimen" aria-hidden="true">${gardenPlantArt(plant)}</div><div><h3 id="garden-card-title" class="garden-plant-name" tabindex="-1">${escape(gardenPlantName(plant))}</h3><span class="garden-specimen-stage">${gardenStage(plant)}</span><div class="garden-growth"><div role="progressbar" aria-label="${escape(gardenPlantName(plant))} growth" aria-valuemin="0" aria-valuemax="${species.minutes}" aria-valuenow="${plant.minutes}"><span style="width:${growth * 100}%"></span></div><span>${Math.floor(plant.minutes)} / ${species.minutes} min</span></div></div></div>
      ${growth < 1 ? `<button class="start-button" id="garden-study">${sessionStarted(session) && focusGardenPlantId(store.state) !== plant.id ? 'Grow next session' : 'Grow with focus'} <span aria-hidden="true">↗</span></button>` : '<p class="garden-bloom-note">Grown by you ♡</p>'}<div class="garden-actions">${plant.slot !== slot ? '<button id="garden-place" class="garden-text-button">Place here</button>' : ''}<button id="garden-new-seeds" class="garden-text-button" aria-label="Replace with a new seed" title="New seed">${icon('leaf')}</button><button id="garden-rename" class="garden-text-button" aria-label="Name this plant" title="Name">${icon('build')}</button></div><form id="garden-name-form" hidden><label for="garden-name-input">Plant name</label><div><input id="garden-name-input" data-plant="${plant.id}" maxlength="28" value="${escape(gardenPlantName(plant))}" autocomplete="off"><button class="garden-text-button" type="submit">Save</button><button class="garden-text-button" type="button" id="garden-name-cancel">Cancel</button></div></form>`;
    $('.garden-collection-items').innerHTML = garden.plants.length ? `<div class="garden-collection-grid">${garden.plants.map(item => `<button id="garden-collection-${item.id}" data-plant="${item.id}" aria-pressed="${panel === 'plant' && plant?.id === item.id}">${gardenPlantArt(item)}<strong>${escape(gardenPlantName(item))}</strong><small>${item.slot === null ? 'In your collection' : `Spot ${item.slot + 1}`} · ${gardenStage(item)}</small></button>`).join('')}</div>` : '<p>Plant your first seed to begin.</p>';
    root.querySelectorAll('[data-seed]').forEach(button => button.addEventListener('click', () => { selectedSpecies = button.dataset.seed; render(); }));
    root.querySelectorAll('button[data-plant]').forEach(button => button.addEventListener('click', () => { $('#garden-collection-dialog').close('selected'); if ($('#garden-name-form')) $('#garden-name-form').hidden = true; selectedPlant = button.dataset.plant; panel = 'plant'; render(); ($('#garden-place') || $('#garden-study') || $('#garden-new-seeds'))?.focus({ preventScroll: true }); }));
    $('#garden-plant-seed')?.addEventListener('click', () => {
      const result = store.plantSeed(selectedSpecies, slot, planted?.id ?? null);
      if (result.planted.ok) { panel = 'plant'; selectedPlant = result.planted.id; }
      acceptUpdate(result); render();
      if (result.planted.ok) { celebrate(); notice('Planted ♡'); $('#garden-study')?.focus({ preventScroll: true }); }
      else notice(result.planted.reason);
    });
    $('#garden-new-seeds')?.addEventListener('click', () => { panel = 'seeds'; render(); $('#garden-card-title').focus({ preventScroll: true }); });
    $('#garden-study')?.addEventListener('click', () => { acceptUpdate(store.tendPlant(plant.id)); onFocus(); });
    $('#garden-place')?.addEventListener('click', () => { acceptUpdate(store.placePlant(plant.id, slot)); render(); celebrate(); });
    $('#garden-rename')?.addEventListener('click', () => { $('#garden-name-form').hidden = false; $('#garden-name-input').focus(); $('#garden-name-input').select(); });
    const closeName = () => { $('#garden-name-form').hidden = true; $('#garden-rename').focus({ preventScroll: true }); };
    $('#garden-name-cancel')?.addEventListener('click', closeName);
    $('#garden-name-form')?.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); closeName(); } });
    $('#garden-name-form')?.addEventListener('submit', event => { event.preventDefault(); acceptUpdate(store.renamePlant(plant.id, $('#garden-name-input').value)); render(); closeName(); });
    if (draftName?.id === plant?.id && $('#garden-name-input')) { $('#garden-name-form').hidden = false; $('#garden-name-input').value = draftName.value; $('#garden-name-input').setSelectionRange(draftName.start, draftName.end); }
    if (focusId) root.querySelector(`#${focusId}`)?.focus({ preventScroll: true });
    onPlot?.(panel === 'closed' ? null : slot);
  }
  function selectSlot(index) { if ($('#garden-name-form')) $('#garden-name-form').hidden = true; slot = index; selectedPlant = null; panel = store.state.garden.plants.some(plant => plant.slot === slot) ? 'plant' : 'seeds'; render(); $('#garden-card-title').focus({ preventScroll: true }); }
  return {
    render, selectSlot,
    get selectedSlot() { return panel === 'closed' ? null : slot; },
    close() { closeCard(); $('#garden-collection-dialog')?.close(); },
    dismiss() {
      if (panel !== 'closed') { closeCard(); focusSpot(); return true; }
      return false;
    },
    selectPlant(id) {
      const plant = store.state.garden.plants.find(item => item.id === id);
      if (!plant) return;
      if ($('#garden-name-form')) $('#garden-name-form').hidden = true;
      selectedPlant = plant.id; panel = 'plant'; slot = plant.slot ?? slot; render();
    },
  };
}
