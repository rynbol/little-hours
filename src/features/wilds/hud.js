import { wildsStats } from '../../core/wilds/progression.js';
import { petEntry } from '../../core/pets.js';

export function createWildsHud(container, { petName: companionName } = {}) {
  const document = container.ownerDocument;
  const root = document.createElement('section');
  root.className = 'wilds-hud';
  root.setAttribute('aria-label', 'Wilds status');
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const location = element('div', 'wilds-location');
  const title = element('strong', 'wilds-region');
  location.append(element('span', 'wilds-eyebrow', 'THE WILDS'), title);
  const vitals = element('div', 'wilds-vitals');
  const level = element('strong', 'wilds-level');
  const meters = {};
  for (const [id, name] of [['health', 'Health'], ['stamina', 'Stamina'], ['xp', 'Experience']]) {
    const row = element('div', `wilds-meter wilds-${id}`);
    const meter = element('progress', '');
    meter.setAttribute('aria-label', name);
    const value = element('span', 'wilds-meter-value');
    row.append(element('span', 'wilds-meter-label', name), value, meter);
    meters[id] = { meter, value };
    vitals.append(row);
  }
  vitals.prepend(level);
  const companion = element('div', 'wilds-companion');
  const petName = element('strong', 'wilds-pet-name');
  const petHealth = element('progress', 'wilds-pet-health');
  petHealth.setAttribute('aria-label', 'Companion health');
  const skill = element('span', 'wilds-pet-skill');
  companion.append(petName, petHealth, skill);
  const bossPanel = element('div', 'wilds-boss');
  const bossName = element('strong', 'wilds-boss-name');
  const bossHealth = element('progress', 'wilds-boss-health');
  bossHealth.setAttribute('aria-label', 'Boss health');
  const bossHint = element('span', 'wilds-boss-hint');
  bossPanel.append(bossName, bossHealth, bossHint);
  bossPanel.hidden = true;
  const marker = element('div', 'wilds-target', '◇');
  marker.setAttribute('aria-label', 'Locked target');
  marker.hidden = true;
  const notice = element('div', 'wilds-notice');
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  notice.hidden = true;
  const controls = element('p', 'wilds-controls', 'WASD Move · Shift Run · Space Jump / Climb · Drag Look');
  const combatControls = element('p', 'wilds-combat-controls', 'Tab Lock · Click / F Strike · Ctrl Dodge · Q Pet skill · R Recall');
  root.append(location, vitals, companion, bossPanel, marker, notice, controls, combatControls);
  container.append(root);
  let noticeUntil = 0, noticeAt = -1;
  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };

  function updateMeter(id, current, maximum) {
    const { meter, value } = meters[id];
    meter.max = maximum;
    meter.value = current;
    const text = `${Math.ceil(current)} / ${maximum}`;
    if (value.textContent !== text) value.textContent = text;
  }

  return {
    update({ player, combat, events = [], elapsedMs = 0, world, targetScreen }) {
      const region = world?.location || 'The Wilds';
      if (title.textContent !== region) title.textContent = region;
      const stats = wildsStats(combat.progress.totalXp);
      setText(level, `Level ${stats.level}`);
      updateMeter('health', player.health, player.maxHealth);
      updateMeter('stamina', player.stamina, player.maxStamina);
      updateMeter('xp', stats.levelXp, stats.nextLevelXp || 1);
      if (!stats.nextLevelXp) setText(meters.xp.value, 'Maximum level');
      root.dataset.exhausted = String(player.stamina < 1);
      const pet = combat.pet, boss = combat.boss;
      setText(petName, `${companionName || petEntry(pet.id)?.name || 'Companion'} · ${Math.ceil(pet.health)} / ${pet.maxHealth}`);
      petHealth.max = pet.maxHealth;
      petHealth.value = pet.health;
      const cooldown = Math.max(0, Math.ceil((pet.skillReadyAt - elapsedMs) / 1000));
      setText(skill, pet.mode === 'knockout' ? `Resting · ${Math.max(0, Math.ceil((pet.recoverAt - elapsedMs) / 1000))}s` : cooldown ? `Pet skill · ${cooldown}s` : 'Q · Pet skill ready');
      companion.dataset.ready = String(!cooldown && pet.mode !== 'knockout');
      bossPanel.hidden = !boss.engaged || boss.mode === 'defeated';
      setText(bossName, boss.name);
      bossHealth.max = boss.maxHealth;
      bossHealth.value = boss.health;
      bossPanel.dataset.phase = String(boss.phase);
      setText(bossHint, boss.mode === 'exposed' ? 'Heartwood exposed' : boss.move === 'roots' && boss.mode === 'telegraph' ? 'Roots are rising' : boss.mode === 'telegraph' && boss.move === 'charge' ? 'Lead the charge into a standing stone' : combat.targetId ? 'Target locked' : 'Tab · Lock target');
      marker.hidden = !combat.targetId || !targetScreen?.visible;
      if (!marker.hidden) {
        marker.style.left = `${targetScreen.x}%`;
        marker.style.top = `${targetScreen.y}%`;
      }
      const reward = events.find(event => event.type === 'boss-defeated');
      const promotion = events.find(event => event.type === 'level-up');
      const defeat = events.find(event => event.type === 'player-defeated');
      if ((reward || promotion || defeat) && elapsedMs !== noticeAt) {
        noticeAt = elapsedMs;
        noticeUntil = elapsedMs + 5500;
        const loot = reward?.reward;
        const rewardText = ['Mossback Warden calmed', ...(loot ? [`+${loot.xp} XP`, ...Object.entries(loot.materials).map(([name, count]) => `${name === 'heartwood' ? 'Heartwood' : name} +${count}`), 'Warden trophy'] : []), ...(promotion ? [`Level ${promotion.level}`] : [])].join(' · ');
        notice.textContent = reward ? rewardText : promotion ? `Level ${promotion.level} · Stronger for the next journey` : 'A moment to breathe · Back at camp';
      }
      notice.hidden = !noticeUntil || elapsedMs >= noticeUntil;
    },
    dispose() { root.remove(); },
  };
}
