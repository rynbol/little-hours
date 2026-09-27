import { PETS } from './pet.js';
import { petArt } from './pet-art.js';
import { PET_LINES } from '../companion/index.js';
import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';

export function createPetUI(app) {
  const name = () => PETS[app.state.pet]?.name || PETS.cat.name;

  function feedback({ species = app.state.pet, by = 'you' } = {}) {
    if (by === 'companion') app.speech?.say('pet', (PET_LINES[species] || PET_LINES.cat).friend);
  }

  function renderName() {
    app.roomUI.renderLabel();
    $('#pet-company').textContent = `You & ${name()}`; $('#pet-button-label').textContent = name();
    $('#pet-button').setAttribute('aria-label', `${name()}: pet or choose your pet`);
  }

  function onPetCarry({ species, held }) { if (held) app.speech?.say('pet', (PET_LINES[species] || PET_LINES.cat).carry); }

  function renderPanel(panel) {
    const owned = app.state.pets, coins = app.state.house.coins;
    const option = pet => {
      const home = owned.includes(pet.id), short = Math.max(0, pet.price - coins);
      if (!home) return `<button class="pet-option is-locked" data-pet-choice="${pet.id}" aria-pressed="false" aria-label="Adopt ${pet.name} the ${pet.kind} for ${pet.price} coins${short ? `, ${short} more coins needed` : ''}">${petArt(pet.id)}<strong>${pet.name}</strong><em class="pet-tag is-price">${icon('sun')} ${pet.price}</em></button>`;
      const tag = app.state.pet === pet.id ? '<em class="pet-tag is-here">With you</em>' : '<em class="pet-tag">At home</em>';
      return `<button class="pet-option" data-pet-choice="${pet.id}" aria-pressed="${app.state.pet === pet.id}">${petArt(pet.id)}${tag}<span><strong>${pet.name}</strong><small>${pet.about}</small></span></button>`;
    };
    const pets = Object.values(PETS), waiting = pets.filter(pet => !owned.includes(pet.id));
    panel.insertAdjacentHTML('beforeend', `<div class="pet-options">${pets.filter(pet => owned.includes(pet.id)).map(option).join('')}</div>${waiting.length ? `<p class="pet-shop-label">Waiting for a home <span>${icon('sun')} ${coins}</span></p><div class="pet-shop" style="--pet-shop-columns:${Math.min(3, waiting.length)}">${waiting.map(option).join('')}</div>` : ''}<div class="pet-adopt" id="pet-adopt" hidden></div><div class="pet-actions"><button class="quiet-button" id="pet-now">${icon('cat')} Give ${name()} a pet</button><p class="performance-note">Tap ${name()} in the room for a pet, or drag to carry ${name()} somewhere new. Decorate moves the bed.</p></div>`);
    const choose = id => {
      if (app.state.pet === id) return;
      app.acceptUpdate(app.store.update(draft => { draft.pet = id; }));
      app.panels.render(); $(`[data-pet-choice="${app.state.pet}"]`)?.focus();
      app.speech?.say('pet', (PET_LINES[app.state.pet] || PET_LINES.cat).hello);
    };
    const offer = pet => {
      const box = $('#pet-adopt'), short = Math.max(0, pet.price - app.state.house.coins);
      box.hidden = false;
      box.innerHTML = `<div class="pet-adopt-art">${petArt(pet.id)}</div><div class="pet-adopt-copy"><p class="eyebrow">A NEW LITTLE FRIEND</p><strong>${pet.name} the ${pet.kind}</strong><small class="pet-adopt-about">${pet.about}</small><div class="pet-adopt-budget"><span>${icon('sun')} ${pet.price} coins</span><small>${app.state.house.coins} in your pocket</small></div><div class="pet-adopt-bar" aria-hidden="true"><span style="width:${Math.min(100, app.state.house.coins / pet.price * 100)}%"></span></div>${short ? `<p class="pet-adopt-note">${short} more coins to go. ${short <= 25 ? 'One 25-minute focus will do it.' : 'Every focus brings them closer.'}</p>` : ''}<button class="start-button" id="pet-adopt-button" ${short ? 'disabled' : ''}>Welcome ${pet.name} home</button></div>`;
      $('#pet-adopt-button').addEventListener('click', () => {
        const result = app.store.adoptPet(pet.id);
        app.acceptUpdate(result);
        if (!result.adopted) { app.toast?.(result.reason); return; }
        app.panels.render(); $(`[data-pet-choice="${pet.id}"]`)?.focus();
        app.speech?.say('pet', (PET_LINES[pet.id] || PET_LINES.cat).hello);
      });
      panel.querySelectorAll('[data-pet-choice]').forEach(button => button.classList.toggle('is-offered', button.dataset.petChoice === pet.id));
    };
    panel.querySelectorAll('[data-pet-choice]').forEach(button => button.addEventListener('click', () => {
      const pet = PETS[button.dataset.petChoice];
      if (app.state.pets.includes(pet.id)) choose(pet.id); else offer(pet);
    }));
    $('#pet-now').addEventListener('click', () => { if (app.room) app.room.pet(); else feedback(); });
  }

  return { name, feedback, renderName, onPetCarry, renderPanel };
}
