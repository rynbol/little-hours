import { PETS } from './pet.js';
import { petArt } from './pet-art.js';
import { PET_LINES } from '../companion/index.js';
import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';

export function createPetUI(app) {
  const name = () => PETS[app.state.pet]?.name || PETS.cat.name;

  // A pet gets a cute line in a bubble just above its head.
  function feedback({ species = app.state.pet, state: mood, by = 'you' } = {}) {
    const lines = PET_LINES[species] || PET_LINES.cat;
    if (app.speech) app.speech.say('pet', by === 'companion' ? lines.friend : mood === 'sleeping' ? lines.sleepy : lines.pet);
    else app.toast(`${PETS[species]?.name || 'Miso'} is happy you’re here.`);
  }

  function renderName() {
    app.roomUI.renderLabel();
    $('#pet-company').textContent = `You & ${name()}`; $('#pet-button-label').textContent = name();
    $('#pet-button').setAttribute('aria-label', `${name()}: pet or choose your pet`);
  }

  function onPetCarry({ species, held }) { if (held) app.speech?.say('pet', (PET_LINES[species] || PET_LINES.cat).carry); }

  // Choose the pet; the bed, its spot and the room stay as they are.
  function renderPanel(panel) {
    panel.insertAdjacentHTML('beforeend', `<div class="pet-options">${Object.values(PETS).map(pet => `<button class="pet-option" data-pet-choice="${pet.id}" aria-pressed="${app.state.pet === pet.id}">${petArt(pet.id)}<span><strong>${pet.name}</strong><small>${pet.id === 'cat' ? 'A ginger tabby who loves the fire' : 'A floppy-eared puppy with a happy tail'}</small></span></button>`).join('')}</div><div class="pet-actions"><button class="quiet-button" id="pet-now">${icon('cat')} Give ${name()} a pet</button><p class="performance-note">Tap ${name()} in the room for a pet, or drag to carry ${name()} somewhere new. Decorate moves the bed.</p></div>`);
    panel.querySelectorAll('[data-pet-choice]').forEach(button => button.addEventListener('click', () => {
      if (app.state.pet === button.dataset.petChoice) return;
      app.acceptUpdate(app.store.update(draft => { draft.pet = button.dataset.petChoice; }));
      app.panels.render(); $(`[data-pet-choice="${app.state.pet}"]`)?.focus();
      app.speech?.say('pet', (PET_LINES[app.state.pet] || PET_LINES.cat).hello);
    }));
    $('#pet-now').addEventListener('click', () => { if (app.room) app.room.pet(); else feedback(); });
  }

  return { name, feedback, renderName, onPetCarry, renderPanel };
}
