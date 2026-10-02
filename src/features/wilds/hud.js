export function createWildsHud(container) {
  const document = container.ownerDocument;
  const root = document.createElement('section');
  root.className = 'wilds-hud';
  root.setAttribute('aria-label', 'Exploration status');
  const location = document.createElement('div');
  location.className = 'wilds-location';
  const eyebrow = document.createElement('span');
  eyebrow.textContent = 'THE WILDS';
  const title = document.createElement('strong');
  const stamina = document.createElement('div');
  stamina.className = 'wilds-stamina';
  const label = document.createElement('span');
  label.textContent = 'Stamina';
  const meter = document.createElement('progress');
  meter.max = 100;
  meter.value = 100;
  meter.setAttribute('aria-label', 'Stamina');
  const value = document.createElement('span');
  value.className = 'wilds-stamina-value';
  const controls = document.createElement('p');
  controls.className = 'wilds-controls';
  controls.textContent = 'WASD Move · Shift Run · Space Jump / Climb · Drag Look';
  location.append(eyebrow, title);
  stamina.append(label, meter, value);
  root.append(location, stamina, controls);
  container.append(root);
  return {
    update({ player, world }) {
      const region = world?.location || (player.position.z < -115 ? 'The Long Meadow' : player.position.z < -40 ? 'Bellroot Trail' : 'Hearth Clearing');
      if (title.textContent !== region) title.textContent = region;
      meter.max = player.maxStamina || 100;
      meter.value = player.stamina;
      const text = `${Math.ceil(player.stamina)} / ${meter.max}`;
      if (value.textContent !== text) value.textContent = text;
      root.dataset.exhausted = String(player.stamina < 1);
    },
    dispose() { root.remove(); },
  };
}
