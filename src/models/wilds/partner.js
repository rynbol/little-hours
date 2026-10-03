import { Quaternion, Vector3 } from 'three';
import { heightAt, normalAt } from '../../core/world-terrain.js';
import { createAnimatedActor, loadActorAsset } from './actor.js';

export const PARTNER_CLIPS = Object.freeze(['idle', 'walk', 'run', 'sit', 'sniff', 'pet', 'pounce', 'swipe', 'spin', 'dash', 'hit', 'knockedOut', 'climb', 'swim', 'bow']);
export const PARTNER_SPECIES = Object.freeze(['cat', 'dog', 'bunny', 'fox', 'panda', 'wolf']);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export async function loadPartner(parent, options = {}) {
  const species = PARTNER_SPECIES.includes(options.species) ? options.species : 'cat';
  return createPartner(parent, await loadActorAsset(`/wilds/partner-${species}.glb`), { ...options, species });
}
export function createPartner(parent, gltf, { species = 'cat', world = null } = {}) {
  if (!PARTNER_SPECIES.includes(species)) throw new Error(`Unknown Wilds companion ${species}`);
  const actor = createAnimatedActor(parent, gltf, { name: `wilds-partner-${species}`, required: PARTNER_CLIPS });
  const up = new Vector3(0, 1, 0), normal = new Vector3(), tilt = new Quaternion(), yaw = new Quaternion();
  let previousElapsed = null, previousX = null, previousZ = null, previousY = null, climbSpeed = 0, speed = 0, stillClock = 0, knockoutClock = 0, knockedOut = false, lastHit = 0, hitClock = Infinity, respawn = 0, disposed = false;
  function update(encounter, sim, dt, reducedMotion = false) {
    if (disposed) return;
    dt = Number.isFinite(dt) ? clamp(dt, 0, .05) : 0;
    const pet = encounter.pet, action = pet.action;
    if (Number.isFinite(encounter.elapsed)) { if (previousElapsed !== null && encounter.elapsed < previousElapsed) { lastHit = 0; hitClock = Infinity; previousX = null; previousY = null; previousZ = null; knockoutClock = 0; stillClock = 0; } previousElapsed = encounter.elapsed; }
    if ((encounter.respawn?.serial || 0) !== respawn) { respawn = encounter.respawn?.serial || 0; previousX = null; previousZ = null; previousY = null; hitClock = Infinity; lastHit = 0; knockoutClock = 0; stillClock = 0; }
    if (dt > 0) {
      speed = previousX === null ? 0 : Math.hypot(pet.x - previousX, pet.z - previousZ) / dt;
      climbSpeed = previousY === null ? 0 : Math.hypot(pet.x - previousX, pet.y - previousY, pet.z - previousZ) / dt;
      previousX = pet.x; previousZ = pet.z; previousY = pet.y; hitClock += dt;
      if (pet.health <= 0) knockoutClock = knockedOut ? knockoutClock + dt : 0;
      else knockoutClock = 0;
    }
    if (dt > 0) stillClock = pet.health > 0 && encounter.status !== 'fighting' && ['follow', 'idle'].includes(action.kind) && !pet.swimming && !pet.climbing && speed < .1 ? stillClock + dt : 0;
    knockedOut = pet.health <= 0;
    let impact = 0; for (const event of encounter.impacts || []) if (event.kind === 'petHit') impact = Math.max(impact, event.serial);
    if (impact > lastHit) { lastHit = impact; hitClock = 0; }
    const ground = Number.isFinite(pet.ground) ? pet.ground : pet.y;
    actor.root.position.set(pet.x, action.kind === 'pounce' ? ground : pet.y, pet.z);
    normal.set(0, 1, 0);
    if (!pet.swimming && !pet.climbing && Math.abs(ground - heightAt(pet.x, pet.z)) < .1) normal.fromArray(normalAt(pet.x, pet.z));
    tilt.setFromUnitVectors(up, normal); yaw.setFromAxisAngle(up, -(pet.heading || 0)); actor.root.quaternion.copy(tilt).multiply(yaw);
    let clip = action.kind, token = `${clip}:${action.serial}`, time = action.elapsed, loop = false, rate = 1;
    if (knockedOut) { clip = 'knockedOut'; token = `knockedOut:${action.serial}`; time = knockoutClock; }
    else if (pet.swimming || pet.climbing) { clip = pet.swimming ? 'swim' : 'climb'; token = clip; loop = true; rate = clip === 'swim' ? Math.max(.25, speed / 2.8) : climbSpeed / 3; }
    else if (['follow', 'idle', 'sniff', 'pet', 'sit'].includes(clip)) {
      if (clip === 'follow' || clip === 'idle') clip = speed < .1 ? 'idle' : speed < 2 ? 'walk' : 'run';
      token = clip; loop = true; rate = clip === 'walk' ? speed / 1.2 : clip === 'run' ? speed / 3 : 1;
    }
    if (!knockedOut && stillClock >= 1.2) { clip = 'sit'; token = 'resting-sit'; loop = false; time = stillClock - 1.2; }
    if (!PARTNER_CLIPS.includes(clip)) { clip = 'idle'; token = clip; loop = true; }
    const hitDuration = actor.clip('hit').duration;
    const blocked = ['pounce', 'swipe', 'spin', 'dash', 'knockedOut', 'climb', 'swim'].includes(clip);
    if (blocked) hitClock = Infinity;
    const overlay = !reducedMotion && hitClock < hitDuration ? { clip: 'hit', time: hitClock, weight: Math.sin(Math.PI * hitClock / hitDuration) * .65 } : null;
    actor.sample({ clip, token, time, loop, rate, overlay }, dt);
  }
  function diagnostics() { return { ...actor.diagnostics(), species, speed, knockedOut }; }
  function dispose() { if (disposed) return; disposed = true; actor.dispose(); }
  return { root: actor.root, update, diagnostics, dispose };
}
