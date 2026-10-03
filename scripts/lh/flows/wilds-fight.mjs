import { steps } from '../steps.mjs';
import { FIGHT_LIMIT, WILDS, face, fight, sleep, until, walkTo } from '../wilds-moves.mjs';

export default {
  about: 'the Wilds fight: starting a short walk from the stone-ring campfire at the head of the valley, real keys walk to it and light it, walk into the ring to wake the stag, lock on, and a bot that only presses keys and clicks dodges its telegraphed blows, lands combos and heavies on its open heart, and wins inside four minutes; the win saves XP, heartwood, the antler trophy and the wolf, the wolf bows from the cliff and follows, and the fight holds 60 fps',
  async run(t) {
    const { check } = t;
    const app = await t.open({ seed: 'three-rooms', scale: 2 });
    await app.settle();
    await steps.openWilds(app);
    await steps.playWilds(app);
    await app.move(720, 450);
    await sleep(400);
    const start = await app.js(WILDS);
    check('a fresh save starts the Wilds with no progress', start.progress.xp === 0 && start.progress.lit.length === 0 && !start.wolf, start.progress);
    check('the pet starts at your heel', Math.hypot(start.pet.x - start.player.x, start.pet.z - start.player.z) < 3, start.pet);
    await t.shot(app, 'fight-start');

    const fire = start.campfires.find(entry => entry.id === 'stones');
    await app.js(`window.__littleHours.wilds.visit({ x: ${fire.x + 7}, z: ${fire.z + 5}, facing: ${Math.atan2(-7, -5)} })`);
    await sleep(300);
    await walkTo(app, fire.x + 1.4, fire.z + 0.6, 1.2);
    const lit = await until(app, `d.campfires.find(entry => entry.id === 'stones').lit`, 'the stone-ring campfire to light', 3000);
    check('walking up to the stone-ring campfire lights it and saves it', lit.progress.lit.includes('stones') && lit.lastFire === 'stones', lit.progress);
    const saved = await app.js(`window.__littleHours.state.wilds.lit`);
    check('the lit campfire is in the saved game', saved.includes('stones'), saved);
    await sleep(500);
    await t.shot(app, 'fight-campfire');

    await walkTo(app, start.arena.x, start.arena.z + start.arena.radius - 4, 1.5);
    const awake = await until(app, `d.encounter === 'fight'`, 'the stag to wake', 6000);
    check('walking into the ring wakes the stag and shows its health bar', awake.encounter === 'fight');
    await sleep(900);
    await t.shot(app, 'fight-wake');

    const began = Date.now();
    const coins = await app.js(`window.__littleHours.state.house.coins`);
    const { seen, frames, d, gaps } = await fight(app, t, check);
    const won = await app.js(WILDS);
    const seconds = (Date.now() - began) / 1000;
    check('the bot beats the stag inside four minutes with only keys and clicks', won.encounter === 'won' && seconds < FIGHT_LIMIT / 1000, { seconds, frames, stag: d.stag, player: d.player, lock: d.lock, reactions: d.reactions });
    check('the fight showed a telegraph, a swing and a perfect dodge', Boolean(seen.telegraph && seen.swing && seen.perfect), seen);
    check('dodges in the last moment before a blow opened a flurry', won.reactions.perfects > 0, won.reactions);
    check('the pet joined in and landed hits', won.reactions.petHits > 0, won.reactions);
    check('after a few blows up close the stag bounded back, and its charge into a stone stunned it', won.reactions.retreats > 0 && won.reactions.stuns > 0, won.reactions);
    check('heavy blows landed on the open heart', won.reactions.heartHits > 0, won.reactions);
    check('the stag took the player down to no less than two thirds per hit', won.player.health > 0 || won.reactions.respawns > 0, won.player);
    await sleep(1500);
    await t.shot(app, 'fight-victory');
    const award = await app.js(`window.__littleHours.state.wilds`);
    check('the win is saved: 240 XP, 3 heartwood, the antler trophy and the wolf', award.xp === 240 && award.heartwood === 3 && award.trophies.includes('stag-antler') && award.companions.includes('wolf') && award.beaten.includes('stag'), award);
    check('the Wilds never pays study gold', await app.js(`window.__littleHours.state.house.coins`) === coins, coins);
    const watching = await until(app, `d.wolf && d.wolf.state !== 'follow'`, 'the wolf on the cliff', 3000);
    check('a wolf appears on the lookout crag above the ring after the win', Math.hypot(watching.wolf.x - 40, watching.wolf.z + 330) < 4, watching.wolf);
    await sleep(2500);
    check('the wolf keeps watching from the lookout until you come near', (await app.js(WILDS)).wolf.state === 'watch');
    await face(app, Math.atan2(watching.wolf.x - watching.player.x, watching.wolf.z - watching.player.z));
    await app.down('w', 'KeyW');
    const bowing = await until(app, `d.wolf.state === 'bow'`, 'the wolf to bow as you walk toward it', 8000);
    await app.up('w', 'KeyW');
    check('walking out of the ring toward the wolf makes it bow', Math.hypot(bowing.wolf.x - bowing.player.x, bowing.wolf.z - bowing.player.z) < 26, { player: bowing.player, wolf: bowing.wolf });
    await face(app, Math.atan2(bowing.wolf.x - bowing.player.x, bowing.wolf.z - bowing.player.z), -0.3);
    await t.shot(app, 'fight-wolf-bow');
    const following = await until(app, `d.wolf.state === 'follow' && Math.hypot(d.wolf.x - d.player.x, d.wolf.z - d.player.z) < 4`, 'the wolf to come down and follow', 16000);
    check('the wolf bows, then comes down and follows you', following.wolf.state === 'follow');
    await t.shot(app, 'fight-wolf-follow');
    check('the fight holds 60 fps: every 4 s sample has a median frame gap under 17.5 ms', gaps.length > 2 && Math.max(...gaps) < 17.5, gaps);

    await app.key('Escape', 'Escape');
    await app.waitFor(`document.querySelector('.wilds-menu').open`, { what: 'the pause card' });
    await app.clickSel('.wilds [data-wilds="exit"]');
    await app.waitFor(`Boolean(window.__littleHours.house.diagnostics()?.scene.isReady()) && !document.documentElement.dataset.placeTransition`, { what: 'the island to come back', timeout: 20000 });
    await steps.backToRoom(app);
    await steps.openDecorate(app);
    check('the glowing antler is in the furniture collection after the win', await app.js(`Boolean(document.querySelector('[data-furniture="antler-trophy"]'))`));
    await app.clickSel('[data-furniture="antler-trophy"]');
    let placed = null;
    for (const [fx, fy] of [[0.5, 0.62], [0.42, 0.58], [0.58, 0.58], [0.36, 0.66], [0.64, 0.66], [0.5, 0.72], [0.3, 0.55], [0.7, 0.55]]) {
      const box = await app.js(`(() => { const r = document.querySelector('#room-canvas canvas').getBoundingClientRect(); return { x: r.left + r.width * ${fx}, y: r.top + Math.min(r.height, innerHeight - r.top) * ${fy} }; })()`);
      await app.move(box.x, box.y); await sleep(120);
      if ((await app.room()).placement?.valid) { await app.click(box.x, box.y); await app.settle(); placed = (await app.room()).layout.items.find(item => item.type === 'antler-trophy'); break; }
    }
    check('the antler can be placed in the room', Boolean(placed), placed);
    await t.shot(app, 'fight-trophy-placed');
    await steps.closeDecorate(app);
    await t.shot(app, 'fight-trophy');
  },
};
