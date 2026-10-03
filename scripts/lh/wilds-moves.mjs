export const WILDS = `window.__littleHours.wilds.diagnostics()`;
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const DRAG_TURN = 0.006;

export async function hold(app, key, code, ms) { await app.down(key, code); await sleep(ms); await app.up(key, code); }
export async function until(app, expression, what, timeout = 4000) { return app.waitFor(`(() => { const d = ${WILDS}; return (${expression}) ? d : null; })()`, { what, timeout }); }

export async function face(app, yaw, pitch = null) {
  for (let i = 0; i < 8; i++) {
    const { camera } = await app.js(WILDS), off = Math.atan2(Math.sin(yaw - camera.yaw), Math.cos(yaw - camera.yaw)), tip = pitch === null ? 0 : pitch - camera.pitch;
    if (Math.abs(off) < 0.05 && Math.abs(tip) < 0.05) return;
    const px = Math.max(-560, Math.min(560, -off / DRAG_TURN)), py = Math.max(-380, Math.min(380, tip / DRAG_TURN));
    await app.drag({ x: 720, y: 450 }, { x: 720 + px + (px && Math.sign(px) * 7), y: 450 + py + (py && Math.sign(py) * 7) }, 18);
    await sleep(120);
  }
}

export async function walkTo(app, x, z, near = 0.9) {
  for (let i = 0; i < 14; i++) {
    const d = await app.js(WILDS), dx = x - d.player.x, dz = z - d.player.z, far = Math.hypot(dx, dz);
    if (far < near) return d;
    await face(app, Math.atan2(dx, dz));
    await hold(app, 'w', 'KeyW', Math.max(120, Math.min(2000, far / 4.4 * 800)));
    await sleep(200);
  }
  return app.js(WILDS);
}

const STEER_KEYS = Object.freeze([['w', 'KeyW', 1, 0], ['s', 'KeyS', -1, 0], ['d', 'KeyD', 0, 1], ['a', 'KeyA', 0, -1]]);

export function steering(app) {
  const held = new Set();
  async function hold(wanted) {
    for (const [key, code] of STEER_KEYS) {
      if (wanted.has(key) && !held.has(key)) { held.add(key); await app.down(key, code); }
      else if (!wanted.has(key) && held.has(key)) { held.delete(key); await app.up(key, code); }
    }
  }
  return {
    toward(yaw, cameraYaw) {
      const turn = yaw - cameraYaw, forward = Math.cos(turn), right = -Math.sin(turn);
      return hold(new Set(STEER_KEYS.filter(([, , f, r]) => f * forward + r * right > 0.38).map(([key]) => key)));
    },
    stop: () => hold(new Set()),
  };
}

export const FIGHT_LIMIT = 240000;
const IN_FRONT_OF_STONE = 2.6, CHARGE_ROOM = 5.6;

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

export async function fight(app, t, check) {
  const seen = { perfect: null, stun: null, swing: null, roots: null, telegraph: null, lure: null, clips: {}, dissolve: 0, defeat: null };
  let frames = 0, sampled = 0;
  const gaps = [], steer = steering(app);
  const walk = on => on ? steer.toward(0, 0) : steer.stop();
  const end = Date.now() + FIGHT_LIMIT;
  let d = await app.js(WILDS);
  while (Date.now() < end && d.encounter !== 'won') {
    d = await app.js(WILDS);
    frames++;
    seen.clips[d.stag.clip] = (seen.clips[d.stag.clip] ?? 0) + 1;
    seen.dissolve = Math.max(seen.dissolve, d.stag.dissolve);
    if (!seen.defeat && d.stag.state === 'defeat' && d.stag.time > 2.9) { seen.defeat = true; await t.shot(app, 'fight-defeat'); }
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

export async function followTrail(app, points, near = 2) {
  let d = null;
  for (const [x, z] of points) d = await walkTo(app, x, z, near);
  return d;
}
