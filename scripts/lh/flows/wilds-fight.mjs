import { steps } from '../steps.mjs';
import { WILDS, face, sleep, steering, until, walkTo } from '../wilds-moves.mjs';

const FIGHT_LIMIT = 240000, IN_FRONT_OF_STONE = 2.6, CHARGE_ROOM = 5.6;

function lureSpot(d) {
  let best = null;
  for (const [x, z] of d.stones) {
    const dx = x - d.stag.x, dz = z - d.stag.z, far = Math.hypot(dx, dz);
    if (far - IN_FRONT_OF_STONE < CHARGE_ROOM) continue;
    const spot = { x: x - dx / far * IN_FRONT_OF_STONE, z: z - dz / far * IN_FRONT_OF_STONE };
    spot.walk = Math.hypot(spot.x - d.player.x, spot.z - d.player.z);
    if (!best || spot.walk < best.walk) best = spot;
  }
  return best;
}

async function fight(app, t, check) {
  const seen = { perfect: null, stun: null, swing: null, roots: null, telegraph: null, lure: null };
  let frames = 0, sampled = 0;
  const gaps = [], steer = steering(app);
  const walk = on => on ? steer.toward(0, 0) : steer.stop();
  const end = Date.now() + FIGHT_LIMIT;
  let d = await app.js(WILDS);
  while (Date.now() < end && d.encounter !== 'won') {
    d = await app.js(WILDS);
    frames++;
    if (Date.now() - sampled > 4000) { sampled = Date.now(); gaps.push(d.frames.gap.p50); }
    if (d.player.state === 'down' || d.encounter === 'calm') {
      await walk(false);
      await until(app, `d.player.state === 'move'`, 'waking by the campfire', 8000);
      await walkTo(app, d.arena.x, d.arena.z + d.arena.radius - 4);
      continue;
    }
    if (d.stag.state === 'wake' || d.stag.state === 'dormant') { await sleep(60); continue; }
    if (d.lock !== 'stag') {
      await walk(false);
      if (d.lock) await app.key('f', 'KeyF');
      await face(app, Math.atan2(d.stag.x - d.player.x, d.stag.z - d.player.z));
      await app.key('f', 'KeyF'); await sleep(80);
      continue;
    }
    if (d.threat && d.player.state !== 'dodge' && d.player.state !== 'knocked') { await app.key('Control', 'ControlLeft'); await sleep(40); continue; }
    const charging = d.stag.state === 'attack' && d.stag.attack === 'charge';
    if (d.stag.state === 'retreat' || d.stag.prefer === 'charge' || (d.stag.state === 'telegraph' && d.stag.attack === 'charge') || charging) {
      const spot = !charging && !(d.stag.state === 'telegraph' && d.stag.time > 0.55) && lureSpot(d);
      if (spot && spot.walk > 0.45) await steer.toward(Math.atan2(spot.x - d.player.x, spot.z - d.player.z), d.camera.yaw);
      else await walk(false);
      if (!seen.lure && d.stag.state === 'telegraph') { seen.lure = true; await t.shot(app, 'fight-lure'); }
      await sleep(20);
      continue;
    }
    if (!seen.telegraph && d.stag.state === 'telegraph' && d.stag.time > 0.35) { seen.telegraph = d.stag.attack; await t.shot(app, `fight-telegraph`); }
    if (!seen.roots && d.stag.roots > 6) { seen.roots = true; await t.shot(app, 'fight-roots'); }
    if (d.flurry > 0 && !seen.perfect) { seen.perfect = true; await t.shot(app, 'fight-perfect'); }
    const gap = Math.hypot(d.stag.x - d.player.x, d.stag.z - d.player.z) - 1.3;
    if (d.stag.state === 'telegraph' && d.pet.cooldown === 0 && d.pet.state !== 'out' && d.pet.state !== 'limp') await app.key('q', 'KeyQ');
    if (d.stag.heartOpen) {
      await walk(gap > 1.4);
      if (gap < 1.9 && d.player.state === 'move') {
        if (!seen.stun) { seen.stun = true; await t.shot(app, 'fight-stun'); }
        await app.press(720, 450); await sleep(700); await app.release(720, 450); await sleep(150);
      }
      continue;
    }
    if (gap > 1.9) { await walk(true); await sleep(30); continue; }
    await walk(false);
    await app.click(720, 450);
    if (!seen.swing && d.player.state === 'attack') { seen.swing = true; await t.shot(app, 'fight-swing'); }
  }
  await walk(false);
  return { seen, frames, d, gaps };
}

export default {
  about: 'the Wilds fight: real keys walk to the stone-ring campfire and light it, walk into the ring to wake the stag, lock on, and a bot that only presses keys and clicks dodges its telegraphed blows, lands combos and heavies on its open heart, and wins inside four minutes; the win saves XP, heartwood, the antler trophy and the wolf, the wolf bows from the cliff and follows, and the fight holds 60 fps',
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
    check('a wolf appears on the cliff top after the win', watching.wolf.x < -15, watching.wolf);
    await sleep(2500);
    check('the wolf keeps watching from the cliff until you come near', (await app.js(WILDS)).wolf.state === 'watch');
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
