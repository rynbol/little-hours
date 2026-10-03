const RING = 2 * Math.PI * 15;

export function createHud(layer) {
  layer.innerHTML = `<svg class="wilds-stamina" viewBox="0 0 40 40" aria-hidden="true"><circle class="wilds-stamina-back" cx="20" cy="20" r="15"/><circle class="wilds-stamina-fill" cx="20" cy="20" r="15" transform="rotate(-90 20 20)" stroke-dasharray="${RING} ${RING}"/></svg>
<div class="wilds-lock" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M20 3 37 20 20 37 3 20Z"/><circle cx="20" cy="20" r="3"/></svg></div>
<div class="wilds-bar" aria-hidden="true"><i class="wilds-bar-ghost"></i><i class="wilds-bar-fill"></i></div>`;
  const ring = layer.querySelector('.wilds-stamina'), fill = layer.querySelector('.wilds-stamina-fill');
  const lock = layer.querySelector('.wilds-lock'), bar = layer.querySelector('.wilds-bar'), barFill = layer.querySelector('.wilds-bar-fill'), ghost = layer.querySelector('.wilds-bar-ghost');
  let shown = 0, ghostShare = 1, ghostWait = 0, lastShare = 1, warn = 0, barShown = 0;
  const place = (element, x, y) => { element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; };

  return {
    warn() { warn = 0.6; },
    update({ stamina, lock: target }, dt) {
      const share = stamina.value / stamina.max, wanted = share < 0.999 || stamina.tired || warn > 0 ? 1 : 0;
      shown += (wanted - shown) * Math.min(1, dt * (wanted ? 14 : 2.5));
      warn = Math.max(0, warn - dt);
      ring.style.opacity = stamina.visible ? shown.toFixed(3) : '0';
      ring.classList.toggle('is-tired', stamina.tired || warn > 0);
      fill.setAttribute('stroke-dashoffset', (RING * (1 - share)).toFixed(2));
      if (stamina.visible) place(ring, stamina.x, stamina.y);
      const locked = Boolean(target?.visible);
      lock.classList.toggle('is-on', locked);
      if (locked) place(lock, target.x, target.y);
      const health = target ? target.health / target.max : 1;
      if (health > lastShare + 1e-3 || !target) { ghostShare = health; ghostWait = 0; }
      else if (health < lastShare - 1e-3) ghostWait = 0.45;
      lastShare = health;
      ghostWait = Math.max(0, ghostWait - dt);
      if (!ghostWait) ghostShare = Math.max(health, ghostShare - dt * 0.9);
      barShown += ((target?.barVisible ? 1 : 0) - barShown) * Math.min(1, dt * 10);
      bar.style.opacity = barShown.toFixed(3);
      if (target?.barVisible) place(bar, target.barX, target.barY);
      barFill.style.transform = `scaleX(${health.toFixed(4)})`;
      ghost.style.transform = `scaleX(${ghostShare.toFixed(4)})`;
    },
    dispose() { layer.replaceChildren(); },
  };
}
