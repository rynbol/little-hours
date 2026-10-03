const RING = 2 * Math.PI * 15, SKILL = 2 * Math.PI * 17;

export function createHud(layer) {
  layer.innerHTML = `<svg class="wilds-stamina" viewBox="0 0 40 40" aria-hidden="true"><circle class="wilds-stamina-back" cx="20" cy="20" r="15"/><circle class="wilds-stamina-fill" cx="20" cy="20" r="15" transform="rotate(-90 20 20)" stroke-dasharray="${RING} ${RING}"/></svg>
<div class="wilds-lock" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M20 3 37 20 20 37 3 20Z"/><circle cx="20" cy="20" r="3"/></svg></div>
<div class="wilds-bar" aria-hidden="true"><i class="wilds-bar-ghost"></i><i class="wilds-bar-fill"></i></div>
<div class="wilds-vitals" aria-hidden="true"><b class="wilds-level">1</b><div class="wilds-life"><i class="wilds-life-ghost"></i><i class="wilds-life-fill"></i></div>
<div class="wilds-pet"><span class="wilds-pet-name"></span><div class="wilds-pet-life"><i></i></div></div></div>
<div class="wilds-skill" aria-hidden="true"><svg viewBox="0 0 40 40"><circle class="wilds-skill-back" cx="20" cy="20" r="17"/><circle class="wilds-skill-fill" cx="20" cy="20" r="17" transform="rotate(-90 20 20)" stroke-dasharray="${SKILL} ${SKILL}"/></svg><kbd>Q</kbd></div>
<div class="wilds-boss" aria-hidden="true"><span class="wilds-boss-name"></span><div class="wilds-boss-bar"><i class="wilds-boss-ghost"></i><i class="wilds-boss-fill"></i><s></s></div></div>
<p class="wilds-prompt" aria-live="polite"></p>
<div class="wilds-banner" aria-live="polite"><h3></h3><ul></ul></div>
<div class="wilds-flash" aria-hidden="true"></div>`;
  const $ = selector => layer.querySelector(selector);
  const ring = $('.wilds-stamina'), fill = $('.wilds-stamina-fill');
  const lock = $('.wilds-lock'), bar = $('.wilds-bar'), barFill = $('.wilds-bar-fill'), ghost = $('.wilds-bar-ghost');
  const level = $('.wilds-level'), life = $('.wilds-life-fill'), lifeGhost = $('.wilds-life-ghost'), vitals = $('.wilds-vitals');
  const petBox = $('.wilds-pet'), petName = $('.wilds-pet-name'), petLife = $('.wilds-pet-life i');
  const skill = $('.wilds-skill'), skillFill = $('.wilds-skill-fill');
  const boss = $('.wilds-boss'), bossName = $('.wilds-boss-name'), bossFill = $('.wilds-boss-fill'), bossGhost = $('.wilds-boss-ghost');
  const prompt = $('.wilds-prompt'), banner = $('.wilds-banner'), bannerTitle = $('.wilds-banner h3'), bannerList = $('.wilds-banner ul'), flash = $('.wilds-flash');
  let shown = 0, ghostShare = 1, ghostWait = 0, lastShare = 1, warn = 0, barShown = 0, lifeTrail = 1, lifeWait = 0, lastLife = 1, bossTrail = 1, bossWait = 0, lastBoss = 1, bannerTime = 0, flashTime = 0, lastPrompt = '';
  const place = (element, x, y) => { element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; };
  const scale = (element, share) => { element.style.transform = `scaleX(${Math.max(0, share).toFixed(4)})`; };
  function trail(share, last, wait, trailing, dt) {
    if (share > last + 1e-3) return [share, 0];
    if (share < last - 1e-3) wait = 0.45;
    wait = Math.max(0, wait - dt);
    return [wait ? trailing : Math.max(share, trailing - dt * 0.9), wait];
  }

  return {
    warn() { warn = 0.6; },
    flash() { flashTime = 0.5; flash.className = 'wilds-flash'; void flash.offsetWidth; flash.classList.add('is-on'); },
    hurt() { flashTime = 0.35; flash.className = 'wilds-flash is-hurt'; void flash.offsetWidth; flash.classList.add('is-on'); },
    banner(title, lines = [], seconds = 4.5) {
      bannerTitle.textContent = title;
      bannerList.replaceChildren(...lines.map(line => Object.assign(document.createElement('li'), { textContent: line })));
      bannerTime = seconds; banner.classList.add('is-on');
    },
    get bannerText() { return bannerTime > 0 ? banner.textContent : ''; },
    update({ stamina, lock: target, vitals: state, pet, skill: cooldown, boss: foe, prompt: words }, dt) {
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
      if (petName.textContent !== pet.name) petName.textContent = pet.name;
      scale(petLife, pet.health / pet.max);
      petBox.classList.toggle('is-out', pet.out);
      skill.classList.toggle('is-ready', cooldown.ready);
      skill.classList.toggle('is-idle', !cooldown.useful);
      skillFill.setAttribute('stroke-dashoffset', (SKILL * cooldown.left).toFixed(2));

      boss.classList.toggle('is-on', Boolean(foe));
      if (foe) {
        if (bossName.textContent !== foe.name) bossName.textContent = foe.name;
        const bossShare = foe.health / foe.max;
        [bossTrail, bossWait] = trail(bossShare, lastBoss, bossWait, bossTrail, dt);
        lastBoss = bossShare;
        scale(bossFill, bossShare); scale(bossGhost, bossTrail);
      } else { bossTrail = 1; lastBoss = 1; }

      if (words !== lastPrompt) { prompt.textContent = words; prompt.classList.toggle('is-on', Boolean(words)); lastPrompt = words; }
      if (bannerTime > 0 && (bannerTime -= dt) <= 0) banner.classList.remove('is-on');
      if (flashTime > 0 && (flashTime -= dt) <= 0) flash.classList.remove('is-on');
    },
    dispose() { layer.replaceChildren(); },
  };
}
