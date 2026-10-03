const RING = 2 * Math.PI * 15, SKILL = 2 * Math.PI * 17, XP = 2 * Math.PI * 18;

const svg = body => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
export const ICONS = Object.freeze({
  fire: svg('<path class="fill" d="M12 3c1.2 3 4.6 4.6 4.6 9a4.6 4.6 0 0 1-9.2 0c0-2.2 1.1-3.6 2.3-4.6 0 2 .9 3.3 2.2 3.4C11.6 8.5 10.9 6 12 3z"/><path d="M5 21l14-3.2M5 17.8 19 21"/>'),
  coin: svg('<circle class="fill" cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.6"/><path d="M12 9.6v4.8"/>'),
  star: svg('<path class="fill" d="M12 2.5l2.3 7.2 7.2 2.3-7.2 2.3L12 21.5l-2.3-7.2L2.5 12l7.2-2.3z"/>'),
  leaf: svg('<path class="fill" d="M5 19C5 10 10 5 19.5 4.5 19 14 14 19 5 19z"/><path d="M5 19l8.5-8.5"/>'),
  antler: svg('<path d="M12 21v-6M12 15c-4 0-6-3-6-7M6 8V3.5M6 8l-3-2.5M9 12 6.5 9.5M12 15c4 0 6-3 6-7M18 8V3.5M18 8l3-2.5M15 12l2.5-2.5"/>'),
  heart: svg('<path class="fill" d="M12 20.5s-7.5-4.6-7.5-10.4A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.5c0 5.8-7.5 10.4-7.5 10.4z"/>'),
  note: svg('<path d="M9 18V6l10-2.5v12"/><circle class="fill" cx="7" cy="18" r="2.4"/><circle class="fill" cx="17" cy="15.5" r="2.4"/>'),
  hush: svg('<path d="M9 18V6l10-2.5v12"/><circle class="fill" cx="7" cy="18" r="2.4"/><path d="M3 3l18 18"/>'),
  flask: svg('<path class="fill" d="M10 3.5h4M10.6 3.5v5L5.8 17.4A2.1 2.1 0 0 0 7.7 20.5h8.6a2.1 2.1 0 0 0 1.9-3.1L13.4 8.5v-5"/>'),
  empty: svg('<path d="M10 3.5h4M10.6 3.5v5L5.8 17.4A2.1 2.1 0 0 0 7.7 20.5h8.6a2.1 2.1 0 0 0 1.9-3.1L13.4 8.5v-5M4 4l16 16"/>'),
  up: svg('<path d="M6 13.5l6-6 6 6M6 19.5l6-6 6 6"/>'),
  sun: svg('<circle class="fill" cx="12" cy="12" r="4.4"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>'),
  moon: svg('<path class="fill" d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>'),
  dizzy: svg('<path d="M12 12a2 2 0 1 1 2-2c0 2.8-2.2 4.5-4.5 4.5A4.5 4.5 0 0 1 5 10a7 7 0 0 1 7-7 7.5 7.5 0 0 1 7.5 7.5c0 5-4 9-9 9"/>'),
  stars: svg('<path class="fill" d="M7 3l1.2 3.3L11.5 7.5 8.2 8.7 7 12 5.8 8.7 2.5 7.5l3.3-1.2zM17 9l1.2 3.3 3.3 1.2-3.3 1.2L17 18l-1.2-3.3-3.3-1.2 3.3-1.2zM9.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
  roots: svg('<path d="M3 20.5h18M7 20.5c0-4 2-5 2-9M12 20.5V9M17 20.5c0-4-2-5-2-9M9 11.5 7 8M12 9l1.5-3.5M15 11.5l2.5-3"/>'),
  wake: svg('<path d="M12 21v-6M12 15c-4 0-6-3-6-7M6 8V3.5M6 8l-3-2.5M12 15c4 0 6-3 6-7M18 8V3.5M18 8l3-2.5"/><circle class="fill" cx="12" cy="9" r="1.6"/>'),
  paw: svg('<ellipse class="fill" cx="12" cy="15.5" rx="4.4" ry="3.6"/><circle class="fill" cx="6" cy="10.5" r="1.9"/><circle class="fill" cx="9.6" cy="6.6" r="1.9"/><circle class="fill" cx="14.4" cy="6.6" r="1.9"/><circle class="fill" cx="18" cy="10.5" r="1.9"/>'),
  stag: svg('<path class="fill" d="M12 21.5c-2.3 0-3.6-2.6-3.6-5.4 0-2.4 1.6-3.8 3.6-3.8s3.6 1.4 3.6 3.8c0 2.8-1.3 5.4-3.6 5.4z"/><path d="M9.5 13C6 12 4.5 9 4.5 5.5M4.5 8 2.5 6.5M6.5 11 4 11.5M14.5 13c3.5-1 5-4 5-7.5M19.5 8l2-1.5M17.5 11l2.5.5"/>'),
});
const TOAST = Object.freeze({ queue: 3, hurry: 1.1 });
export const PROMPTS = Object.freeze({ rest: 'fire', shop: 'coin', secret: 'star', herb: 'leaf', rematch: 'antler', pat: 'heart' });

export function createHud(layer) {
  layer.innerHTML = `<svg class="wilds-stamina" viewBox="0 0 40 40" aria-hidden="true"><circle class="wilds-stamina-back" cx="20" cy="20" r="15"/><circle class="wilds-stamina-fill" cx="20" cy="20" r="15" transform="rotate(-90 20 20)" stroke-dasharray="${RING} ${RING}"/></svg>
<div class="wilds-lock" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M20 3 37 20 20 37 3 20Z"/><circle cx="20" cy="20" r="3"/></svg></div>
<div class="wilds-bar" aria-hidden="true"><i class="wilds-bar-ghost"></i><i class="wilds-bar-fill"></i></div>
<div class="wilds-vitals" aria-hidden="true"><div class="wilds-level"><svg viewBox="0 0 44 44"><circle class="wilds-xp-back" cx="22" cy="22" r="18"/><circle class="wilds-xp" cx="22" cy="22" r="18" transform="rotate(-90 22 22)" stroke-dasharray="${XP} ${XP}"/></svg><b>1</b></div><div class="wilds-life"><i class="wilds-life-ghost"></i><i class="wilds-life-fill"></i></div>
<div class="wilds-pet">${ICONS.paw}<div class="wilds-pet-life"><i></i></div></div><div class="wilds-potions"></div></div>
<div class="wilds-skill" aria-hidden="true"><svg viewBox="0 0 40 40"><circle class="wilds-skill-back" cx="20" cy="20" r="17"/><circle class="wilds-skill-fill" cx="20" cy="20" r="17" transform="rotate(-90 20 20)" stroke-dasharray="${SKILL} ${SKILL}"/></svg><kbd>Q</kbd></div>
<div class="wilds-boss" aria-hidden="true">${ICONS.stag}<div class="wilds-boss-bar"><i class="wilds-boss-ghost"></i><i class="wilds-boss-fill"></i><s></s></div></div>
<div class="wilds-dial" aria-hidden="true"><svg viewBox="0 0 48 26"><path class="wilds-dial-arc" d="M4 24a20 20 0 0 1 40 0"/><circle class="wilds-dial-sun" r="3.6" cx="4" cy="24"/></svg></div>
<p class="wilds-prompt" aria-hidden="true"><kbd>E</kbd><span></span></p>
<div class="wilds-toast" aria-hidden="true"><span class="wilds-toast-icon"></span><b class="wilds-toast-badge"></b></div>
<div class="wilds-flash" aria-hidden="true"></div>`;
  const $ = selector => layer.querySelector(selector);
  const ring = $('.wilds-stamina'), fill = $('.wilds-stamina-fill');
  const lock = $('.wilds-lock'), bar = $('.wilds-bar'), barFill = $('.wilds-bar-fill'), ghost = $('.wilds-bar-ghost');
  const level = $('.wilds-level b'), xpRing = $('.wilds-xp'), life = $('.wilds-life-fill'), lifeGhost = $('.wilds-life-ghost'), vitals = $('.wilds-vitals');
  const petBox = $('.wilds-pet'), petLife = $('.wilds-pet-life i'), potions = $('.wilds-potions');
  const skill = $('.wilds-skill'), skillFill = $('.wilds-skill-fill');
  const boss = $('.wilds-boss'), bossFill = $('.wilds-boss-fill'), bossGhost = $('.wilds-boss-ghost');
  const dialSun = $('.wilds-dial-sun'), dial = $('.wilds-dial');
  const prompt = $('.wilds-prompt'), promptIcon = $('.wilds-prompt span'), toast = $('.wilds-toast'), toastIcon = $('.wilds-toast-icon'), toastBadge = $('.wilds-toast-badge'), flash = $('.wilds-flash');
  let shown = 0, ghostShare = 1, ghostWait = 0, lastShare = 1, warn = 0, barShown = 0, lifeTrail = 1, lifeWait = 0, lastLife = 1, bossTrail = 1, bossWait = 0, lastBoss = 1, toastTime = 0, toastKind = '', flashTime = 0, lastPrompt = null, lastPotions = '', lastHour = -1;
  const place = (element, x, y) => { element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; };
  const scale = (element, share) => { element.style.transform = `scaleX(${Math.max(0, share).toFixed(4)})`; };
  function trail(share, last, wait, trailing, dt) {
    if (share > last + 1e-3) return [share, 0];
    if (share < last - 1e-3) wait = 0.45;
    wait = Math.max(0, wait - dt);
    return [wait ? trailing : Math.max(share, trailing - dt * 0.9), wait];
  }

  const waiting = [];
  function showToast(kind, { icon = kind, badge = '', tone = 'warm', seconds = 2.4 }) {
    toastIcon.innerHTML = ICONS[icon] ?? '';
    toastBadge.textContent = badge; toastBadge.hidden = !badge;
    toast.dataset.tone = tone;
    toast.classList.remove('is-on'); void toast.offsetWidth; toast.classList.add('is-on');
    toastTime = waiting.length ? Math.min(seconds, TOAST.hurry) : seconds; toastKind = kind;
  }

  return {
    warn() { warn = 0.6; },
    flash() { flashTime = 0.5; flash.className = 'wilds-flash'; void flash.offsetWidth; flash.classList.add('is-on'); },
    hurt() { flashTime = 0.35; flash.className = 'wilds-flash is-hurt'; void flash.offsetWidth; flash.classList.add('is-on'); },
    toast(kind, options = {}) {
      if (toastTime <= 0 || kind === toastKind) { showToast(kind, options); return; }
      if (waiting.length < TOAST.queue) waiting.push([kind, options]);
      toastTime = Math.min(toastTime, TOAST.hurry);
    },
    get toastKind() { return toastTime > 0 ? toastKind : ''; },
    get toastsWaiting() { return waiting.map(([kind]) => kind); },
    update({ stamina, lock: target, vitals: state, pet, skill: cooldown, boss: foe, prompt: kind, hour }, dt) {
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
      if (!target) { ghostShare = 1; ghostWait = 0; }
      else [ghostShare, ghostWait] = trail(health, lastShare, ghostWait, ghostShare, dt);
      lastShare = health;
      barShown += ((target?.barVisible ? 1 : 0) - barShown) * Math.min(1, dt * 10);
      bar.style.opacity = barShown.toFixed(3);
      if (target?.barVisible) place(bar, target.barX, target.barY);
      scale(barFill, health); scale(ghost, ghostShare);

      const lifeShare = state.health / state.max;
      [lifeTrail, lifeWait] = trail(lifeShare, lastLife, lifeWait, lifeTrail, dt);
      lastLife = lifeShare;
      scale(life, lifeShare); scale(lifeGhost, lifeTrail);
      vitals.classList.toggle('is-low', lifeShare < 0.3);
      if (level.textContent !== String(state.level)) level.textContent = String(state.level);
      xpRing.setAttribute('stroke-dashoffset', (XP * (1 - state.xp)).toFixed(2));
      const flasks = `${state.potions}/${state.carry}`;
      if (flasks !== lastPotions) {
        lastPotions = flasks;
        potions.innerHTML = Array.from({ length: state.carry }, (_, i) => `<i class="${i < state.potions ? 'is-full' : ''}">${ICONS.flask}</i>`).join('');
      }
      scale(petLife, pet.health / pet.max);
      petBox.classList.toggle('is-out', pet.out);
      skill.classList.toggle('is-ready', cooldown.ready);
      skill.classList.toggle('is-idle', !cooldown.useful);
      skillFill.setAttribute('stroke-dashoffset', (SKILL * cooldown.left).toFixed(2));

      boss.classList.toggle('is-on', Boolean(foe));
      if (foe) {
        const bossShare = foe.health / foe.max;
        [bossTrail, bossWait] = trail(bossShare, lastBoss, bossWait, bossTrail, dt);
        lastBoss = bossShare;
        scale(bossFill, bossShare); scale(bossGhost, bossTrail);
      } else { bossTrail = 1; lastBoss = 1; }

      const rounded = Math.round(hour * 4) / 4;
      if (rounded !== lastHour) {
        lastHour = rounded;
        const day = rounded >= 6 && rounded < 21, t = day ? (rounded - 6) / 15 : ((rounded - 21 + 24) % 24) / 9, a = Math.PI * (1 - t);
        dialSun.setAttribute('cx', (24 + Math.cos(a) * 20).toFixed(2)); dialSun.setAttribute('cy', (24 - Math.sin(a) * 20).toFixed(2));
        dial.classList.toggle('is-night', !day);
      }

      if (kind !== lastPrompt) { promptIcon.innerHTML = kind ? ICONS[PROMPTS[kind]] : ''; prompt.classList.toggle('is-on', Boolean(kind)); prompt.dataset.kind = kind ?? ''; lastPrompt = kind; }
      if (toastTime > 0 && (toastTime -= dt) <= 0) { toast.classList.remove('is-on'); if (waiting.length) showToast(...waiting.shift()); }
      if (flashTime > 0 && (flashTime -= dt) <= 0) flash.classList.remove('is-on');
    },
    dispose() { layer.replaceChildren(); },
  };
}
