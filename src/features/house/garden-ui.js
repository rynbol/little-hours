import { GARDEN_SPECIES, GARDEN_PLOTS, GARDEN_CAPACITY, SEED_PRICE, gardenSpecies, gardenPlantName, gardenGrowth, gardenStage, focusGardenPlantId } from '../../core/garden-plants.js';
import { coinArt } from '../../ui/ui-art.js';
import { sessionStarted } from '../../core/session.js';
import { gardenPlantArt } from './garden-art.js';
import './garden.css';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function createGardenUI(root, { store, acceptUpdate, onFocus, onBack, onPlot, notice, celebrate }) {
  let slot = 0, choosing = false, selectedSpecies = 'cosmos', selectedPlant = null, collectionOpen = false;
  const $ = selector => root.querySelector(selector);
  function render() {
    const { garden, house, session } = store.state;
    const editor = $('#garden-name-input');
    if (editor === document.activeElement && garden.plants.some(plant => plant.id === editor.dataset.plant)) selectedPlant = editor.dataset.plant;
    const planted = garden.plants.find(plant => plant.slot === slot), plant = garden.plants.find(item => item.id === selectedPlant) || planted;
    const seeds = choosing || !plant, price = garden.plants.length ? SEED_PRICE : 0;
    const species = gardenSpecies(seeds ? selectedSpecies : plant.species), growth = gardenGrowth(plant);
    const focusId = root.contains(document.activeElement) ? document.activeElement.id : null;
    const draftName = focusId === 'garden-name-input' ? { id: editor.dataset.plant, value: editor.value, start: editor.selectionStart, end: editor.selectionEnd } : null;
    root.classList.toggle('is-choosing-seeds', seeds);
    root.innerHTML = `<header class="garden-heading"><button id="garden-back" class="garden-chip" aria-label="Back to the island"><span aria-hidden="true">‹</span> Island</button><h2 tabindex="-1">Your garden</h2><div class="garden-top-tools"><span class="garden-wallet" aria-label="${house.coins} coins">${coinArt()} ${house.coins}</span><button id="garden-collection-open" class="garden-chip">Collection <b>${garden.plants.length}</b></button></div></header>
      <section class="garden-card" aria-label="${seeds ? 'Seed preview' : 'Selected plant'}" style="--flower-color:${species.color}"><div class="garden-specimen"><span class="garden-halo" aria-hidden="true"></span>${gardenPlantArt(seeds ? { species: selectedSpecies, minutes: 0 } : plant, seeds)}<span class="garden-specimen-stage">${seeds ? 'Seeds' : gardenStage(plant)}</span></div>
      <div class="garden-card-body"><h3 class="garden-plant-name">${escape(seeds ? species.name : gardenPlantName(plant))}</h3>
      ${seeds ? `<p class="garden-help">${species.minutes} study minutes to bloom</p>` : `<div class="garden-growth"><div role="progressbar" aria-label="${escape(gardenPlantName(plant))} growth" aria-valuemin="0" aria-valuemax="${species.minutes}" aria-valuenow="${plant.minutes}"><span style="width:${growth * 100}%"></span></div><span>${Math.floor(plant.minutes)} / ${species.minutes} min</span></div>
      ${growth < 1 ? `<button class="start-button" id="garden-study">${sessionStarted(session) && focusGardenPlantId(store.state) !== plant.id ? 'Grow next session' : 'Study with this plant'} <span aria-hidden="true">↗</span></button>` : '<p class="garden-bloom-note">Grown by you. Yours to keep. ♡</p>'}
      <div class="garden-actions">${plant.slot !== slot ? '<button id="garden-place" class="garden-text-button">Place here</button>' : ''}<button id="garden-new-seeds" class="garden-text-button">New seeds</button><button id="garden-rename" class="garden-text-button">Name</button></div>
      <form id="garden-name-form" hidden><label for="garden-name-input">Plant name</label><div><input id="garden-name-input" data-plant="${plant.id}" maxlength="28" value="${escape(gardenPlantName(plant))}" autocomplete="off"><button class="garden-text-button" type="submit">Save</button><button class="garden-text-button" type="button" id="garden-name-cancel">Cancel</button></div></form>`}</div></section>
      <footer class="garden-tray"><div class="garden-plot-row"><span>${seeds ? 'Plant in' : 'Garden spots'}</span><div class="garden-plots" role="group" aria-label="Garden spots">${Array.from({ length: GARDEN_PLOTS }, (_, index) => { const p = garden.plants.find(item => item.slot === index); return `<button id="garden-spot-${index}" class="garden-spot" data-plot="${index}" aria-pressed="${slot === index}" aria-label="Spot ${index + 1}${p ? `, ${escape(gardenPlantName(p))}` : ', empty'}"><span aria-hidden="true">${p ? gardenPlantArt(p) : '+'}</span><small>${index + 1}</small></button>`; }).join('')}</div></div>
      ${seeds ? `<div class="garden-seed-box"><div class="garden-seeds" role="group" aria-label="Seeds">${GARDEN_SPECIES.map(item => `<button id="seed-${item.id}" data-seed="${item.id}" aria-pressed="${selectedSpecies === item.id}">${gardenPlantArt({ species: item.id }, true)}<strong>${item.name}</strong><small>${item.minutes} min</small></button>`).join('')}</div><button id="garden-plant-seed" class="garden-plant-button" ${house.coins < price || garden.plants.length >= GARDEN_CAPACITY ? 'disabled' : ''}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 25V13M16 18C5 18 5 8 5 8c10 0 11 10 11 10Zm0-4C16 4 27 5 27 5c0 9-11 9-11 9Z" fill="#a7ba8c" stroke="#617653" stroke-width="1.5"/></svg><strong>Plant</strong><small>${price ? `${price} coins` : 'Free'}</small></button></div><div class="garden-seed-note"><span>${garden.plants.length >= GARDEN_CAPACITY ? 'Your collection is full.' : planted ? 'The plant here moves to your collection.' : 'Study for 5+ minutes to help it grow.'}</span>${planted ? '<button id="garden-cancel-seeds" class="garden-text-button">Cancel</button>' : ''}</div>` : ''}</footer>
      <dialog class="garden-collection" id="garden-collection-dialog" aria-labelledby="garden-collection-title"><header><h3 id="garden-collection-title">Your collection</h3><button id="garden-collection-close" class="garden-chip" aria-label="Close collection">×</button></header>${garden.plants.length ? `<div class="garden-collection-grid">${garden.plants.map(item => `<button id="garden-collection-${item.id}" data-plant="${item.id}" aria-pressed="${!seeds && plant?.id === item.id}">${gardenPlantArt(item)}<strong>${escape(gardenPlantName(item))}</strong><small>${item.slot === null ? 'In your collection' : `Spot ${item.slot + 1}`} · ${gardenStage(item)}</small></button>`).join('')}</div>` : '<p>Your first seed is waiting in the seed box.</p>'}</dialog>`;
    $('#garden-back').addEventListener('click', onBack);
    root.querySelectorAll('[data-plot]').forEach(button => button.addEventListener('click', () => { slot = Number(button.dataset.plot); selectedPlant = null; choosing = false; render(); }));
    root.querySelectorAll('[data-seed]').forEach(button => button.addEventListener('click', () => { selectedSpecies = button.dataset.seed; render(); }));
    root.querySelectorAll('button[data-plant]').forEach(button => button.addEventListener('click', () => { selectedPlant = button.dataset.plant; choosing = false; collectionOpen = false; render(); ($('#garden-place') || $('#garden-study') || $('#garden-new-seeds'))?.focus({ preventScroll: true }); }));
    const collection = $('#garden-collection-dialog');
    $('#garden-collection-open').addEventListener('click', () => { collectionOpen = true; collection.showModal(); });
    $('#garden-collection-close').addEventListener('click', () => collection.close());
    collection.addEventListener('close', () => { if (!collection.isConnected) return; collectionOpen = false; $('#garden-collection-open')?.focus({ preventScroll: true }); });
    collection.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
    if (collectionOpen) collection.showModal();
    $('#garden-plant-seed')?.addEventListener('click', () => {
      const result = store.plantSeed(selectedSpecies, slot, planted?.id ?? null);
      if (result.planted.ok) { choosing = false; selectedPlant = result.planted.id; }
      acceptUpdate(result); render();
      if (result.planted.ok) { celebrate(); notice('Planted ♡'); $('#garden-study')?.focus({ preventScroll: true }); }
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
    onPlot?.(slot);
  }
  return { render, close() { collectionOpen = false; $('#garden-collection-dialog')?.close(); }, selectSlot(index) { slot = index; selectedPlant = null; choosing = false; render(); }, selectPlant(id) {
    const plant = store.state.garden.plants.find(item => item.id === id);
    if (!plant) return;
    selectedPlant = plant.id; choosing = false; slot = plant.slot ?? slot; render();
  } };
}
