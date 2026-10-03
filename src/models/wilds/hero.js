import { Quaternion, Vector3 } from 'three';
import { avatarPaint, normalizeAvatarAppearance } from '../../core/avatar.js';
import { ATTACKS } from '../../core/wilds/feel.js';
import { heightAt, normalAt } from '../../core/world-terrain.js';
import { createAnimatedActor, loadActorAsset } from './actor.js';

export const HERO_CLIPS = Object.freeze(['idle', 'walk', 'run', 'sprint', 'strafeLeft', 'strafeRight', 'backpedal', 'jump', 'fall', 'land', 'dodge', 'charge', 'light1', 'light2', 'light3', 'heavy', 'climb', 'climbLeap', 'glide', 'swim', 'parry', 'hit', 'knockback', 'knockedOut', 'getup', 'victory', 'pet', 'whistle']);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const gaitSpeed = Object.freeze({ walk: 1.2, run: 4, sprint: 7, strafeLeft: 4, strafeRight: 4, backpedal: 4, climb: 1.5, swim: 2.2 });
const variants = Object.freeze({ Hair: 'style', Outfit: 'outfit', Bottom: 'bottomStyle', Accessory: 'accessory' });

export async function loadHero(parent, options = {}) { return createHero(parent, await loadActorAsset('/wilds/hero.glb'), options); }
export function createHero(parent, gltf, { appearance, world = null, adventure = null, blade = true } = {}) {
  const identity = normalizeAvatarAppearance(appearance), skin = avatarPaint(identity, 'skin'), hair = avatarPaint(identity, 'hair'), top = avatarPaint(identity, 'top'), bottom = avatarPaint(identity, 'bottom');
  const palette = { Skin: skin.color, Hair: hair.color, Top: top.color, TopShade: top.shade, TopTrim: top.trim, Bottom: bottom.color, BottomTrim: bottom.trim };
  const actor = createAnimatedActor(parent, gltf, { name: 'wilds-hero', required: HERO_CLIPS, paint: source => ({ color: palette[source.name] || source.color, surface: ['Top', 'TopShade', 'TopTrim', 'Bottom', 'BottomTrim', 'Cape'].includes(source.name) ? 'cloth' : 'plain' }) });
  actor.root.traverse(object => {
    for (const [prefix, field] of Object.entries(variants)) if (object.name.startsWith(`${prefix}_`)) object.visible = object.name === `${prefix}_${identity[field]}` || object.name.startsWith(`${prefix}_${identity[field]}_`);
    if (!blade && /^Blade(?:_|$)/.test(object.name)) object.visible = false;
  });
  const up = new Vector3(0, 1, 0), normal = new Vector3(), tilt = new Quaternion(), yaw = new Quaternion();
  let previousElapsed = null, respawn = 0, victory = 0, victoryActionSerial = null, getupActionSerial = null, recoveryClock = 0, getupClock = Infinity, victoryClock = Infinity, hitClock = Infinity, hitKind = 'hit', lastHit = 0, lastEvent = -1, previousX = null, previousY = null, previousZ = null, climbSpeed = 0, perfect = 0, parryClock = Infinity, equipment = 'starter', disposed = false;
  function equipmentUpdate() {
    if (!adventure || adventure.state.lastEvent?.serial === lastEvent) return;
    lastEvent = adventure.state.lastEvent?.serial;
    const save = adventure.save;
    equipment = save.gear.includes('trail-sword') ? 'trail-sword' : save.found.includes('root-sword') ? 'root-sword' : 'starter';
    for (const material of actor.materials()) {
      if (material.name === 'BladeSteel') material.color.set(equipment === 'root-sword' ? '#aa8a58' : equipment === 'trail-sword' ? '#cddcd8' : '#b6bfc1');
      if (material.name === 'Cape') material.color.set(save.gear.includes('wind-cape') ? '#7f9cae' : save.found.includes('ruin-cape') ? '#728fa5' : '#9b9e8b');
    }
  }
  function update(encounter, sim, dt, reducedMotion = false) {
    if (disposed) return;
    dt = Number.isFinite(dt) ? clamp(dt, 0, .05) : 0;
    const player = sim.player, action = sim.action, speed = Math.hypot(player.vx || 0, player.vz || 0), moving = speed > .15;
    if (dt > 0) { climbSpeed = previousX === null ? 0 : Math.hypot(player.x - previousX, player.y - previousY, player.z - previousZ) / dt; previousX = player.x; previousY = player.y; previousZ = player.z; }
    if (Number.isFinite(encounter.elapsed)) { if (previousElapsed !== null && encounter.elapsed < previousElapsed) { lastHit = 0; hitClock = Infinity; victoryClock = Infinity; } previousElapsed = encounter.elapsed; }
    equipmentUpdate();
    if ((encounter.respawn?.serial || 0) !== respawn) { respawn = encounter.respawn?.serial || 0; getupClock = 0; getupActionSerial = action.serial; recoveryClock = 0; previousX = null; lastHit = 0; hitClock = Infinity; }
    if ((encounter.victory || 0) !== victory) { victory = encounter.victory || 0; victoryClock = victory ? 0 : Infinity; victoryActionSerial = action.serial; }
    if (dt > 0) { parryClock += dt; getupClock += dt; victoryClock += dt; hitClock += dt; recoveryClock = encounter.status === 'recovering' ? recoveryClock + dt : 0; }
    if ((encounter.counts?.perfectDodges || 0) !== perfect) { perfect = encounter.counts?.perfectDodges || 0; parryClock = perfect ? 0 : Infinity; }
    let impact = 0, reaction = 'hit'; for (const event of encounter.impacts || []) if (event.kind === 'playerHit' && event.serial > impact) { impact = event.serial; reaction = event.attack === 'charge' ? 'knockback' : 'hit'; }
    if (impact > lastHit) { lastHit = impact; hitClock = 0; hitKind = reaction; }
    const locomotion = ['idle', 'run', 'sprint'].includes(action.kind);
    if ((!locomotion || moving) && action.serial !== victoryActionSerial) victoryClock = Infinity;
    if ((!locomotion || moving) && action.serial !== getupActionSerial) getupClock = Infinity;
    let heading = player.heading;
    if (action.kind === 'dodge' && speed > .1) heading = Math.atan2(player.vx, -player.vz);
    let visualY = player.y - (player.mode === 'swim' ? .25 : 0);
    if (player.mode === 'swim' && world) visualY = Math.max(visualY, world.floorAt(player.x, player.z, player.y + .1) - .06);
    actor.root.position.set(player.x, visualY, player.z);
    normal.set(0, 1, 0); if (player.grounded && player.mode !== 'climb' && Math.abs(player.y - heightAt(player.x, player.z)) < .1) normal.fromArray(normalAt(player.x, player.z));
    tilt.setFromUnitVectors(up, normal); yaw.setFromAxisAngle(up, -heading); actor.root.quaternion.copy(tilt).multiply(yaw);
    let clip = action.kind, time = action.elapsed, loop = false, rate = 1, token = `${action.kind}:${action.serial}`;
    if (encounter.status === 'recovering') { clip = 'knockedOut'; time = recoveryClock; token = 'recovery'; }
    else if (getupClock < .7 && !moving && locomotion) { clip = 'getup'; time = getupClock; token = `getup:${respawn}`; }
    else if (victoryClock < 1.6 && !moving && player.grounded && locomotion) { clip = 'victory'; time = victoryClock; token = `victory:${victory}`; }
    else if (player.mode === 'climb' && action.kind !== 'climbLeap') { clip = 'climb'; loop = true; rate = climbSpeed / gaitSpeed.climb; token = clip; }
    else if (player.mode === 'glide' || player.mode === 'swim') { clip = player.mode; loop = true; rate = clip === 'swim' ? Math.max(.25, speed / gaitSpeed.swim) : 1; token = clip; }
    else if (!player.grounded && action.kind === 'jump') { clip = player.vy > 0 ? 'jump' : 'fall'; time = Math.min(action.elapsed, .36); loop = clip === 'fall'; token = clip === 'jump' ? `jump:${action.serial}` : 'fall'; }
    else if (['idle', 'run', 'sprint'].includes(action.kind)) {
      clip = !moving ? 'idle' : action.kind === 'sprint' ? 'sprint' : speed < 2.5 ? 'walk' : 'run';
      const forward = (player.vx || 0) * Math.sin(player.heading) - (player.vz || 0) * Math.cos(player.heading), side = (player.vx || 0) * Math.cos(player.heading) + (player.vz || 0) * Math.sin(player.heading);
      if (moving && Math.abs(side) > Math.abs(forward) * 1.2) clip = side > 0 ? 'strafeRight' : 'strafeLeft';
      else if (moving && forward < -speed * .5) clip = 'backpedal';
      if (!moving && parryClock < .45 && encounter.flurry > 0) { clip = 'parry'; time = parryClock; }
      else if (!moving && adventure?.state.petting > 0 && encounter.pet?.petting) clip = 'pet';
      else if (!moving && adventure?.state.whistle > 0) clip = 'whistle';
      loop = clip !== 'whistle' && clip !== 'parry'; time = clip === 'whistle' ? Math.min(1, 2 - adventure.state.whistle) : clip === 'parry' ? parryClock : undefined; rate = gaitSpeed[clip] ? speed / gaitSpeed[clip] : 1; token = clip;
    }
    if (!HERO_CLIPS.includes(clip)) { clip = 'idle'; loop = true; token = clip; }
    const flinch = !reducedMotion && !['dodge', 'parry', 'knockedOut', 'getup', 'victory', 'climb', 'climbLeap', 'glide', 'swim'].includes(clip) && (!ATTACKS[action.kind] || action.elapsed >= ATTACKS[action.kind].hitEnd);
    if (!flinch) hitClock = Infinity;
    const hitDuration = actor.clip(hitKind).duration;
    const overlay = flinch && hitClock < hitDuration ? { clip: hitKind, time: hitClock, weight: Math.sin(Math.PI * hitClock / hitDuration) * .65 } : null;
    actor.sample({ clip, token, time, loop, rate, overlay }, dt);
  }
  function bladeEndpoints(base, tip) {
    if (!blade || disposed) return false;
    const start = actor.node('BladeBase'), end = actor.node('BladeTip');
    if (!start || !end) return false;
    start.getWorldPosition(base); end.getWorldPosition(tip); return true;
  }
  function diagnostics() { return { ...actor.diagnostics(), appearance: { ...identity }, palette: { ...palette }, equipment, blade }; }
  function dispose() { if (disposed) return; disposed = true; actor.dispose(); }
  return { root: actor.root, update, bladeEndpoints, diagnostics, dispose };
}
