import { GARDEN_SPECIES, GARDEN_PLOTS, GARDEN_CAPACITY, SEED_PRICE, gardenSpecies, gardenPlantName, gardenGrowth, gardenStage, focusGardenPlantId } from '../../core/garden-plants.js';
import { coinArt } from '../../ui/ui-art.js';
import { sessionStarted } from '../../core/session.js';
import { gardenPlantArt } from './garden-art.js';
import './garden.css';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function createGardenUI(root, { store, acceptUpdate, onFocus, notice, celebrate }) {
  let slot = 0, choosing = false, selectedSpecies = 'cosmos', selectedPlant = null;
  const $ = selector => root.querySelector(selector);
  function render() {
    const { garden, house, session } = store.state;
    const editor = $('#garden-name-input');
    if (editor === document.activeElement && garden.plants.some(plant => plant.id === editor.dataset.plant)) selectedPlant = editor.dataset.plant;
    const planted = garden.plants.find(plant => plant.slot === slot);
    const plant = garden.plants.find(item => item.id === selectedPlant) || planted;
    const seeds = choosing || !plant, price = garden.plants.length ? SEED_PRICE : 0;
    const species = gardenSpecies(seeds ? selectedSpecies : plant.species), growth = gardenGrowth(plant);
    const focusId = root.contains(document.activeElement) ? document.activeElement.id : null;
    const draftName = focusId === 'garden-name-input' ? { id: document.activeElement.dataset.plant, value: document.activeElement.value, start: document.activeElement.selectionStart, end: document.activeElement.selectionEnd } : null;
    root.innerHTML = `<div class="garden-heading"><h2 tabindex="-1">Your garden</h2><span class="garden-wallet" aria-label="${house.coins} coins">${coinArt()} ${house.coins}</span></div>
      <div class="garden-plots" role="group" aria-label="Garden spots">${Array.from({ length: GARDEN_PLOTS }, (_, index) => { const p = garden.plants.find(item => item.slot === index); return `<button id="garden-spot-${index}" class="garden-spot" data-plot="${index}" aria-pressed="${slot === index}" aria-label="Spot ${index + 1}${p ? `, ${escape(gardenPlantName(p))}` : ', empty'}"><span aria-hidden="true">${p ? gardenPlantArt(p) : '+'}</span><small>${index + 1}</small></button>`; }).join('')}</div>
      <div class="garden-specimen ${seeds ? 'is-seed-preview' : ''}" style="--flower-color:${species.color}"><span class="garden-halo" aria-hidden="true"></span>${gardenPlantArt(seeds ? { species: selectedSpecies, minutes: 0 } : plant, seeds)}<span class="garden-specimen-stage">${seeds ? 'Grown with your time' : gardenStage(plant)}</span></div>
      ${seeds ? `<h3 class="garden-plant-name">Choose your next bloom</h3><div class="garden-seeds" role="group" aria-label="Seeds">${GARDEN_SPECIES.map(item => `<button id="seed-${item.id}" data-seed="${item.id}" aria-pressed="${selectedSpecies === item.id}">${gardenPlantArt({ species: item.id }, true)}<strong>${item.name}</strong><small>${item.minutes} min</small></button>`).join('')}</div><button id="garden-plant-seed" class="start-button" ${house.coins < price || garden.plants.length >= GARDEN_CAPACITY ? 'disabled' : ''}>${price ? `Plant seeds · ${price} coins` : 'Plant your first seed · Free'}</button>${garden.plants.length >= GARDEN_CAPACITY ? '<p class="garden-help">Your collection is full.</p>' : ''}${planted ? '<p class="garden-help">The plant here moves to your collection.</p><button id="garden-cancel-seeds" class="garden-text-button">Keep this plant</button>' : '<p class="garden-help">Study for 5+ minutes to help it grow.</p>'}` : `
      <h3 class="garden-plant-name">${escape(gardenPlantName(plant))}</h3><div class="garden-growth"><div role="progressbar" aria-label="${escape(gardenPlantName(plant))} growth" aria-valuemin="0" aria-valuemax="${species.minutes}" aria-valuenow="${plant.minutes}"><span style="width:${growth * 100}%"></span></div><span>${Math.floor(plant.minutes)} / ${species.minutes} min</span></div>
      ${growth < 1 ? `<button class="start-button" id="garden-study">${sessionStarted(session) && focusGardenPlantId(store.state) !== plant.id ? 'Grow next session' : 'Study with this plant'} <span aria-hidden="true">↗</span></button><p class="garden-help">${species.minutes - plant.minutes} more minutes to bloom</p>` : '<p class="garden-bloom-note">Grown by you. Yours to keep. ♡</p>'}
      <div class="garden-actions">${plant.slot !== slot ? '<button id="garden-place" class="garden-text-button">Place here</button>' : ''}<button id="garden-new-seeds" class="garden-text-button">New seeds</button><button id="garden-rename" class="garden-text-button">Name</button></div>
      <form id="garden-name-form" hidden><label for="garden-name-input">Plant name</label><div><input id="garden-name-input" data-plant="${plant.id}" maxlength="28" value="${escape(gardenPlantName(plant))}" autocomplete="off"><button class="garden-text-button" type="submit">Save</button><button class="garden-text-button" type="button" id="garden-name-cancel">Cancel</button></div></form>`}
      ${garden.plants.length ? `<details class="garden-collection"><summary>Collection <span>${garden.plants.length}</span></summary><div>${garden.plants.map(item => `<button id="garden-collection-${item.id}" data-plant="${item.id}" aria-pressed="${!seeds && plant?.id === item.id}">${gardenPlantArt(item)}<span><strong>${escape(gardenPlantName(item))}</strong><small>${item.slot === null ? 'In your collection' : `Spot ${item.slot + 1}`} · ${gardenStage(item)}</small></span></button>`).join('')}</div></details>` : ''}`;
    root.querySelectorAll('[data-plot]').forEach(button => button.addEventListener('click', () => { slot = Number(button.dataset.plot); selectedPlant = null; choosing = false; render(); }));
    root.querySelectorAll('[data-seed]').forEach(button => button.addEventListener('click', () => { selectedSpecies = button.dataset.seed; render(); }));
    root.querySelectorAll('[data-plant]').forEach(button => button.addEventListener('click', () => { selectedPlant = button.dataset.plant; choosing = false; render(); $('#garden-study')?.focus({ preventScroll: true }); }));
    $('#garden-plant-seed')?.addEventListener('click', () => {
      const result = store.plantSeed(selectedSpecies, slot, planted?.id ?? null);
      if (result.planted.ok) { choosing = false; selectedPlant = result.planted.id; }
      acceptUpdate(result); render();
      if (result.planted.ok) { celebrate(); notice('Planted. A little time will help it grow.'); $('#garden-study')?.focus({ preventScroll: true }); }
      else notice(result.planted.reason);
    });
    $('#garden-cancel-seeds')?.addEventListener('click', () => { choosing = false; render(); });
    $('#garden-new-seeds')?.addEventListener('click', () => { choosing = true; render(); $('#garden-plant-seed')?.focus({ preventScroll: true }); });
    $('#garden-study')?.addEventListener('click', () => { acceptUpdate(store.tendPlant(plant.id)); onFocus(); });
    $('#garden-place')?.addEventListener('click', () => { acceptUpdate(store.placePlant(plant.id, slot)); render(); celebrate(); });
    $('#garden-rename')?.addEventListener('click', () => { $('#garden-name-form').hidden = false; $('#garden-name-input').focus(); $('#garden-name-input').select(); });
    const closeName = () => { $('#garden-name-form').hidden = true; $('#garden-rename').focus(); };
    $('#garden-name-cancel')?.addEventListener('click', closeName);
    $('#garden-name-form')?.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); closeName(); } });
    $('#garden-name-form')?.addEventListener('submit', event => { event.preventDefault(); acceptUpdate(store.renamePlant(plant.id, $('#garden-name-input').value)); render(); $('#garden-name-form').hidden = true; $('#garden-rename').focus(); });
    if (draftName?.id === plant?.id && $('#garden-name-input')) { $('#garden-name-form').hidden = false; $('#garden-name-input').value = draftName.value; $('#garden-name-input').setSelectionRange(draftName.start, draftName.end); }
    if (focusId) root.querySelector(`#${focusId}`)?.focus({ preventScroll: true });
  }
  return { render, selectSlot(index) { slot = index; selectedPlant = null; choosing = false; render(); }, selectPlant(id) {
    const plant = store.state.garden.plants.find(item => item.id === id);
    if (!plant) return;
    selectedPlant = plant.id; choosing = false; slot = plant.slot ?? slot; render();
  } };
}
