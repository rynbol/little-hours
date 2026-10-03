import { steps } from '../steps.mjs';
import { WILDS, face, fight, followTrail, sleep, until, walkTo } from '../wilds-moves.mjs';

const EAST_TRAIL = Object.freeze([[18, -112], [44, -128], [52, -170], [54, -214], [46, -256], [30, -284], [13, -305]]);

async function talk(app, prompt, what) {
  await until(app, `d.hud.prompt === '${prompt}'`, `the ${what} prompt`, 3000);
  await app.key('e', 'KeyE');
}

export default {
  about: 'the Wilds valley journey with real input only: from the island to the camp, buy a steel sword and a potion from the merchant with study coins, whistle, climb the vista rock, glide off it through the updraft, follow the pet to the buried find and dig it up, pick an herb, rest at the shrine fire into the evening, walk the east trail past the lake and the oak, startling the deer on the far shore, to the stone ring, beat the Mossheart Stag and leave; the play HUD carries no words',
  async run(t) {
    const { check } = t;
    const app = await t.open({ seed: 'one-room-rich', scale: 2 });
    await app.settle();
    await steps.openWilds(app);
    await steps.playWilds(app);
    await app.move(720, 450);
    await sleep(400);
    const start = await app.js(WILDS);
    const spot = (list, id) => list.find(entry => entry.id === id);
    const [CAMP_FIRE, SHRINE_FIRE, STONES_FIRE, BURIED] = [spot(start.campfires, 'camp'), spot(start.campfires, 'shrine'), spot(start.campfires, 'stones'), spot(start.secrets, 'buried-find')];
    const coins = await app.js(`window.__littleHours.state.house.coins`);
    check('the valley opens at the camp clearing in the morning', Math.hypot(start.player.x - CAMP_FIRE.x, start.player.z - CAMP_FIRE.z) < 12 && Math.hypot(start.player.x - start.merchant.x, start.player.z - start.merchant.z) < 12 && start.hour > 6 && start.hour < 12, { player: start.player, hour: start.hour });
    const words = await app.js(`document.querySelector('.wilds-hud').innerText.replace(/[\\s\\d]|\\b[EQRH]\\b/g, '')`);
    check('the play HUD shows shapes, bars and icons, and no words', words === '', words);
    await t.shot(app, 'valley-camp');

    await walkTo(app, start.merchant.x - 1.6, start.merchant.z - 0.8, 0.7);
    await talk(app, 'shop', 'merchant');
    await app.waitFor(`document.querySelector('.wilds-shop').open && window.__littleHours.wilds.diagnostics().paused`, { what: 'the merchant\'s shop' });
    await t.shot(app, 'valley-shop');
    const locked = await app.js(`document.querySelector('[data-buy="moonsteel-sword"]').disabled && document.querySelector('[data-buy="moonsteel-sword"]').textContent.includes('level')`);
    check('the moonsteel sword waits for a higher level', locked);
    await app.clickSel('[data-buy="steel-sword"]');
    await app.waitFor(`window.__littleHours.state.wilds.owned.includes('steel-sword')`, { what: 'the steel sword purchase' });
    await app.clickSel('[data-buy="potion"]');
    await app.waitFor(`window.__littleHours.state.wilds.potions === 1`, { what: 'the potion purchase' });
    const spent = await app.js(`window.__littleHours.state.house.coins`);
    check('the steel sword and a potion cost 75 of the study coins', spent === coins - 75, { coins, spent });
    await app.clickSel('.wilds [data-wilds="done"]');
    const armed = await until(app, `d.phase === 'playing' && !d.paused`, 'play to resume after the shop', 3000);
    check('the steel sword is worn at once and hits 1.3 times as hard', armed.traits.power === 1.3 && armed.potions === 1, { traits: armed.traits, potions: armed.potions });
    await app.move(720, 450);

    await app.key('h', 'KeyH');
    const full = await until(app, `d.hud.toast === 'potion-wait'`, 'the potion to wait for a wound', 1500);
    check('H at full health keeps the potion', full.potions === 1, full.potions);
    const before = await app.js(WILDS);
    await app.key('r', 'KeyR');
    const called = await until(app, `d.reactions.whistles > ${before.reactions.whistles}`, 'the whistle', 1500);
    check('R whistles and the pet comes running, its note queued behind the potion toast instead of replacing it', called.pet.state === 'come' && called.hud.toast === 'potion-wait' && called.hud.waiting.includes('whistle'), { toast: called.hud.toast, waiting: called.hud.waiting, pet: called.pet });
    const noted = await until(app, `d.hud.toast === 'whistle'`, 'the whistle toast to follow', 2500);
    check('the whistle toast shows once the potion toast is done', noted.hud.waiting.length === 0, noted.hud);
    await sleep(1500);

    const foot = await walkTo(app, 1, -29.5);
    await face(app, Math.PI);
    await app.down('w', 'KeyW');
    const topped = await until(app, `d.reactions.mantles > ${foot.reactions.mantles} && d.player.state === 'move'`, 'climbing the vista rock', 16000);
    await app.up('w', 'KeyW');
    check('the vista rock is climbed with W and mantled', topped.player.y > foot.player.y + 3 && topped.reactions.grabs > foot.reactions.grabs, { from: foot.player.y, to: topped.player.y });
    await face(app, Math.PI, 0.1);
    await sleep(400);
    await t.shot(app, 'valley-vista');

    const [draft] = start.updrafts;
    await face(app, Math.atan2(draft.x - topped.player.x, draft.z - topped.player.z));
    await app.down('w', 'KeyW');
    await until(app, `!d.player.grounded`, 'stepping off the vista rock', 5000);
    await sleep(200);
    await app.key(' ', 'Space');
    let glide = await until(app, `d.player.state === 'glide' || d.player.grounded`, 'the glider to open', 1500);
    if (glide.player.state !== 'glide') { await app.key(' ', 'Space'); glide = await until(app, `d.player.state === 'glide'`, 'the glider to open', 1500); }
    let low = Infinity, rise = 0, shot = false;
    for (let d = glide; d.player.state === 'glide'; d = await app.js(WILDS)) {
      const inDraft = Math.hypot(d.player.x - draft.x, d.player.z - draft.z) < draft.radius;
      if (inDraft) { low = Math.min(low, d.player.y); rise = Math.max(rise, d.player.y - low); }
      if (inDraft && !shot) { shot = true; await app.up('w', 'KeyW'); await t.shot(app, 'valley-updraft'); }
      await sleep(120);
    }
    await app.up('w', 'KeyW');
    const landed = await until(app, `d.player.grounded`, 'the glide to land', 20000);
    check('gliding into the updraft below the vista lifts the glider', rise > 1.5, { rise, low });
    check('the glide carries you down the valley', Math.hypot(landed.player.x - topped.player.x, landed.player.z - topped.player.z) > 18, landed.player);

    await followTrail(app, [[-4, -78], [BURIED.x + 4, BURIED.z + 6]]);
    const dug = await until(app, `d.reactions.digs > 0`, 'the pet to sniff out and dig up the buried find', 30000);
    check('the pet sniffed out the buried find and dug it up', dug.secrets.find(entry => entry.id === 'buried-find').dug && dug.reactions.scents > 0, dug.reactions);
    await t.shot(app, 'valley-dig');
    await walkTo(app, BURIED.x, BURIED.z, 1);
    await talk(app, 'secret', 'buried find');
    const found = await until(app, `d.progress.secrets.includes('buried-find')`, 'claiming the buried find', 3000);
    const buddy = await app.js(`window.__littleHours.state.buddy?.finds?.['brass-key']?.count ?? 0`);
    check('E digs out a brass key: the secret and its XP are saved, and Pip keeps the key', found.progress.xp > 0 && buddy > 0, { xp: found.progress.xp, buddy });

    const herb = found.herbs.nearest;
    await walkTo(app, herb.x, herb.z, 0.8);
    await talk(app, 'herb', 'herb');
    const picked = await until(app, `d.reactions.herbs > 0`, 'picking the herb', 2000);
    check('E picks a healing herb by the trail', picked.herbs.picked === 1 && picked.hud.toast === 'herb', picked.herbs);

    await walkTo(app, SHRINE_FIRE.x + 1.5, SHRINE_FIRE.z + 0.8, 1);
    await until(app, `d.campfires.find(entry => entry.id === 'shrine').lit`, 'the shrine fire to light', 3000);
    await talk(app, 'rest', 'campfire');
    const rested = await until(app, `d.reactions.rests > 0`, 'resting at the shrine fire', 2000);
    check('resting at the shrine fire passes the day into the evening and makes it the place you wake', rested.hour > 19 && rested.lastFire === 'shrine', { hour: rested.hour, fire: rested.lastFire });
    await sleep(800);
    await t.shot(app, 'valley-evening');

    const grazing = (await app.js(WILDS)).life.deer;
    await followTrail(app, EAST_TRAIL.slice(0, -1));
    const startled = await app.js(WILDS);
    check('the deer grazing on the far shore bolt away as you walk up to them', grazing.every(deer => deer.state === 'graze' || deer.state === 'look') && startled.life.deer.some(deer => (deer.state === 'bolt' || deer.state === 'wary') && Math.hypot(deer.x - startled.player.x, deer.z - startled.player.z) > 12), { before: grazing, after: startled.life.deer, player: startled.player });
    await followTrail(app, EAST_TRAIL.slice(-1));
    await walkTo(app, STONES_FIRE.x + 1.4, STONES_FIRE.z + 0.6, 1.2);
    await until(app, `d.campfires.find(entry => entry.id === 'stones').lit`, 'the stone-ring fire to light', 3000);
    const arena = (await app.js(WILDS)).arena;
    await walkTo(app, arena.x, arena.z + arena.radius - 4, 1.5);
    await until(app, `d.encounter === 'fight'`, 'the Mossheart Stag to wake', 8000);
    await sleep(600);
    check('the carved spirals on the ring stones kindle when the fight begins', (await app.js(WILDS)).world.ring > 0.3);
    const { d } = await fight(app, t, check);
    const won = await app.js(WILDS);
    check('the stag falls to the steel sword', won.encounter === 'won', { stag: d.stag, player: d.player });
    check('the stag and the find raised your level', won.level > 1 && won.reactions.levels > 0, { level: won.level, xp: won.progress.xp });
    check('every shader was compiled before the first frame: the evening, its lights and life, and the whole stag fight add no program', won.renderer.programs === start.renderer.programs, { start: start.renderer.programs, end: won.renderer.programs });
    check('the Wilds spent study coins at the merchant but never paid any', await app.js(`window.__littleHours.state.house.coins`) === spent);
    await sleep(1200);
    await t.shot(app, 'valley-victory');

    await app.key('Escape', 'Escape');
    await app.waitFor(`document.querySelector('.wilds-menu').open`, { what: 'the pause card' });
    await app.clickSel('.wilds [data-wilds="exit"]');
    await app.waitFor(`Boolean(window.__littleHours.house.diagnostics()?.scene.isReady()) && !document.documentElement.dataset.placeTransition`, { what: 'the island to come back', timeout: 20000 });
    check('leaving brings the island back with no Wilds canvas', !await app.js(`Boolean(document.querySelector('.wilds-canvas'))`));
    await t.close(app);
  },
};
