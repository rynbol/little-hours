import { ACESFilmicToneMapping, DirectionalLight, Fog, HemisphereLight, Mesh, PCFShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { heightAt, smooth } from '../../core/world-terrain.js';
import { createGround } from '../../core/wilds/ground.js';
import { createSim, foe, interact, lockTarget, petSkill, press, stepSim, toggleLock, CAMPFIRE, ENCOUNTER } from '../../core/wilds/sim.js';
import { stagAwake, threatens } from '../../core/wilds/stag.js';
import { PET_SKILL, petDown } from '../../core/wilds/pet.js';
import { createWolf, stepWolf } from '../../core/wilds/wolf.js';
import { emptyWilds, kindleFire, levelFor, recordVictory } from '../../core/wilds/progress.js';
import { HILL, shapeHill } from '../../core/wilds/layout.js';
import { VITALS, slopeAt } from '../../core/wilds/player.js';
import { RIG, createRig, kickRig, moveFrom, orbit, stepRig, zoomRig } from '../../core/wilds/camera.js';
import { ATTACKS, BLADE, bladeAngles, bladeSegment } from '../../core/wilds/moves.js';
import { renderRatioCeiling } from '../../core/render-scale.js';
import { clockRandom } from '../../core/test-pins.js';
import { createPainterly } from '../../models/wilds/painterly.js';
import { buildGround, buildTufts } from '../../models/wilds/terrain.js';
import { buildDummy, buildPosts } from '../../models/wilds/props.js';
import { buildStandin } from '../../models/wilds/standin.js';
import { SKY, buildSky } from '../../models/wilds/sky.js';
import { buildEffects } from '../../models/wilds/effects.js';
import { buildRing } from '../../models/wilds/ring.js';
import { buildPet, buildWolf } from '../../models/wilds/critters.js';
import { buildCamp } from '../../models/wilds/camp.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';

const STAG_NAME = 'Stag of the Old Ring';
export const VIEW = Object.freeze({ ratio: 1.5, step: 1 / 120, longest: 0.1, shadow: 2048, shadowHalf: 14, fog: Object.freeze([70, 560]), frames: 240, zoomStep: 0.35 });
const SUN = new Vector3(-0.62, 0.6, 0.36).normalize();
const RESPONSES = Object.freeze({
  move: player => Math.hypot(player.vx, player.vz) > 0,
  attack: player => player.state === 'attack' || player.state === 'charge',
  jump: player => !player.grounded,
  dodge: player => player.state === 'dodge',
});

function rendererName(gl) {
  try { const info = gl.getExtension('WEBGL_debug_renderer_info'); return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)); } catch { return ''; }
}

function quantiles(values) {
  if (!values.length) return { p50: 0, p95: 0, max: 0, count: 0 };
  const sorted = [...values].sort((a, b) => a - b), at = share => sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
  return { p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1], count: sorted.length };
}

export function createGame(stage, hudLayer, { reducedMotion = () => false, onPause = () => {}, wilds = {}, onSave = () => {} } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'wilds-canvas'; canvas.tabIndex = -1;
  stage.append(canvas);
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  const pixelRatio = Math.min(VIEW.ratio, renderRatioCeiling(window.devicePixelRatio, rendererName(renderer.getContext())));
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.fog = new Fog(SKY.horizon, ...VIEW.fog);
  const camera = new PerspectiveCamera(RIG.fov, 1, 0.1, 2000);
  const painterly = createPainterly();
  const wind = { value: 0 }, skyTime = { value: 0 };

  const grid = createGround(shapeHill(heightAt), { centre: [HILL.bounds.x, HILL.bounds.z] });
  const ground = (x, z) => grid.at(x, z);
  const progress = structuredClone(wilds.progress ?? emptyWilds());
  const sim = createSim(HILL, ground, { bond: wilds.bond ?? 0, kind: wilds.kind ?? 'cat', lit: progress.lit, beaten: progress.beaten.includes('stag') }), player = sim.player;
  const petName = wilds.petName ?? 'Miso';
  const tilt = [0, 0], near = (x, z, list, radius) => list.some(spot => Math.hypot(spot.x - x, spot.z - z) < radius);
  const worn = (x, z) => Math.max(smooth(2.4, 0.9, Math.hypot(x - sim.dummy.x, z - sim.dummy.z)) * 0.75, smooth(2, 0.6, Math.hypot(x - HILL.spawn.x, z - HILL.spawn.z)) * 0.5);
  scene.add(buildGround(grid, painterly.material('#ffffff', { vertexColors: true, rim: false }), { worn }));
  scene.add(buildTufts(grid, painterly.material('#ffffff', { vertexColors: true, rim: false }), { centre: [HILL.bounds.x, HILL.bounds.z], radius: HILL.bounds.radius + 6, wind, keep: (x, z) => !near(x, z, [sim.dummy, ...sim.posts, ...sim.campfires], 0.75) && worn(x, z) < 0.3 && Math.hypot(...slopeAt(ground, x, z, tilt)) < 0.7 }));
  scene.add(buildPosts(sim.posts, painterly.material('#ffffff', { vertexColors: true })));
  const dummyView = buildDummy(sim.dummy, painterly);
  scene.add(dummyView.root);
  const hero = buildStandin(painterly);
  const ring = buildRing(sim, painterly), petView = buildPet(painterly, sim.pet.kind), wolfView = buildWolf(painterly), camp = buildCamp(sim.campfires, painterly);
  scene.add(ring.root, petView.root, wolfView.root, camp.root);
  let wolf = progress.companions.includes('wolf') ? createWolf({ x: player.x + 1.3, z: player.z + 1.7, facing: player.facing, ground }) : null;
  scene.add(hero.root, hero.blade, hero.hand);
  const sky = buildSky(SUN, { time: skyTime });
  scene.add(sky);
  const effects = buildEffects(clockRandom);
  scene.add(...effects.meshes);

  scene.add(new HemisphereLight('#bcd4ea', '#6f8a4c', 1.35));
  const sun = new DirectionalLight('#ffe3bd', 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(VIEW.shadow, VIEW.shadow);
  Object.assign(sun.shadow.camera, { left: -VIEW.shadowHalf, right: VIEW.shadowHalf, top: VIEW.shadowHalf, bottom: -VIEW.shadowHalf, near: 1, far: 90 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.radius = 3; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  const lightRight = new Vector3().crossVectors(SUN, new Vector3(0, 1, 0)).normalize(), lightUp = new Vector3().crossVectors(lightRight, SUN), focus = new Vector3();
  const texel = VIEW.shadowHalf * 2 / VIEW.shadow, snap = value => Math.round(value / texel) * texel;

  const rig = createRig({ yaw: HILL.spawn.facing, at: [player.x, player.y, player.z] });
  const steer = { moveX: 0, moveZ: 0, sprint: false, attackHeld: false, view: rig.yaw };
  const pose = [...BLADE.rest], shownPose = [...BLADE.rest], startPose = [...BLADE.rest], windPose = [0, 0];
  const segment = { root: [0, 0, 0], tip: [0, 0, 0], yaw: BLADE.rest[0], pitch: BLADE.rest[1] }, trailSegment = { root: [0, 0, 0], tip: [0, 0, 0] };
  const projected = new Vector3(), hudState = { stamina: { x: 0, y: 0, visible: false, value: 100, max: 100, tired: false }, lock: { visible: false, x: 0, y: 0, barVisible: false, barX: 0, barY: 0, health: 100, max: 100 }, vitals: { health: 100, max: 100, level: 1 }, pet: { name: '', health: 1, max: 1, out: false }, skill: { left: 0, ready: true, useful: false }, boss: { name: STAG_NAME, health: 1, max: 1 } };
  const cpu = [], gaps = [], latency = { move: null, attack: null, jump: null, dodge: null, worst: 0 }, pending = [];
  const reactions = { swings: 0, hits: 0, breaks: 0, lands: 0, dodges: 0, jumps: 0, charges: 0, kicks: 0, trail: 0, warnings: 0, frozen: 0, grabs: 0, mantles: 0, glides: 0, lets: 0, hurts: 0, perfects: 0, evades: 0, telegraphs: 0, stuns: 0, heartHits: 0, petHits: 0, petSkills: 0, pats: 0, retreats: 0, rests: 0, respawns: 0, kindles: 0, victories: 0 };
  let frame = 0, last = 0, paused = true, disposed = false, width = 0, height = 0, trailAttack = null, trailTime = 0, dustClock = 0, driftClock = 0, muted = false, seconds = 0;

  const hud = createHud(hudLayer);
  const input = createInput(canvas, {
    onPress(action, stamp) {
      if (paused || disposed) return;
      if (action === 'pause') { onPause('key'); return; }
      if (action === 'mute') { muted = !muted; return; }
      if (action === 'lock') { toggleLock(sim, rig.yaw); return; }
      if (action === 'interact') { interact(sim); return; }
      if (action === 'pet') { if (petSkill(sim)) reactions.petSkills++; return; }
      if (action === 'dodge' && (player.tired || player.stamina <= 0)) { hud.warn(); reactions.warnings++; }
      if (['jump', 'dodge', 'attack'].includes(action)) press(sim, action);
      if (RESPONSES[action] && !RESPONSES[action](player)) pending.push({ action, stamp });
    },
    onLockChange(locked) { if (!locked && !paused && !disposed) onPause('pointer'); },
  });

  function resize() {
    const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
    if (w === width && h === height) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    effects.resize(h * pixelRatio, camera.fov);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(stage);

  function displayedPose(dt) {
    if (player.state === 'attack') {
      const attack = ATTACKS[player.attack];
      bladeAngles(attack, player.time, pose);
      if (player.time < attack.strike[0]) {
        bladeAngles(attack, attack.strike[0], windPose);
        const s = 1 - (1 - player.time / attack.strike[0]) ** 2, yawFrom = startPose[0] + Math.round((windPose[0] - startPose[0]) / 360) * 360;
        pose[0] = yawFrom + (windPose[0] - yawFrom) * s; pose[1] = startPose[1] + (windPose[1] - startPose[1]) * s;
      }
      shownPose[0] = pose[0]; shownPose[1] = pose[1];
      return shownPose;
    }
    const target = player.state === 'charge' ? BLADE.raised : BLADE.rest, ease = Math.min(1, dt * (player.state === 'charge' ? 16 : 10));
    const home = target[0] + Math.round((shownPose[0] - target[0]) / 360) * 360;
    shownPose[0] += (home - shownPose[0]) * ease; shownPose[1] += (target[1] - shownPose[1]) * ease;
    return shownPose;
  }

  function sampleTrail(attackId, from, to) {
    const attack = ATTACKS[attackId], start = attack.strike[0] - 0.015, stop = attack.strike[1] + 0.05;
    const a = Math.max(from, start), b = Math.min(to, stop);
    if (a > b) return;
    bladeAngles(attack, a, windPose);
    const yawA = windPose[0], pitchA = windPose[1];
    bladeAngles(attack, b, windPose);
    const pieces = Math.max(1, Math.ceil(Math.max(Math.abs(windPose[0] - yawA), Math.abs(windPose[1] - pitchA)) / 5));
    const heat = attackId === 'heavy' ? 0.45 + player.charge * 0.55 : attackId === 'light3' ? 0.3 : 0;
    for (let i = 1; i <= pieces; i++) {
      bladeAngles(attack, a + (b - a) * i / pieces, windPose);
      bladeSegment(player, windPose[0], windPose[1], trailSegment);
      effects.trail.add(trailSegment, heat);
      reactions.trail++;
    }
  }

  function contact(target, out) {
    const rx = segment.root[0], rz = segment.root[2], dx = segment.tip[0] - rx, dz = segment.tip[2] - rz;
    const t = Math.min(1, Math.max(0, ((target.x - rx) * dx + (target.z - rz) * dz) / Math.max(1e-6, dx * dx + dz * dz)));
    const px = rx + dx * t, pz = rz + dz * t, py = segment.root[1] + (segment.tip[1] - segment.root[1]) * t;
    const ox = px - target.x, oz = pz - target.z, length = Math.hypot(ox, oz) || 1;
    out[0] = target.x + ox / length * target.radius; out[1] = Math.min(target.top - 0.1, Math.max(target.bottom + 0.3, py)); out[2] = target.z + oz / length * target.radius;
    return out;
  }
  const spot = [0, 0, 0], toward = [0, 0, 0];

  function react(event, still) {
    if (event.type === 'swing') { reactions.swings++; trailAttack = event.attack; trailTime = 0; startPose[0] = shownPose[0]; startPose[1] = shownPose[1]; if (event.attack === 'heavy') effects.trail.cut(); }
    else if (event.type === 'hit') {
      reactions.hits++;
      const attack = ATTACKS[event.attack], target = event.id === sim.stag.id ? sim.stag : sim.dummy;
      bladeAngles(attack, player.time, pose); bladeSegment(player, pose[0], pose[1], segment);
      contact(target, spot);
      const dx = target.x - player.x, dz = target.z - player.z, length = Math.hypot(dx, dz) || 1;
      toward[0] = dx / length; toward[1] = 0.25; toward[2] = dz / length;
      effects.hit(spot[0], spot[1], spot[2], toward, event.attack === 'heavy' || event.attack === 'light3' || event.heart);
      if (event.heart) { reactions.heartHits++; effects.hit(spot[0], spot[1] + 0.2, spot[2], toward, true); }
      if (event.broke) { reactions.breaks++; effects.hit(target.x, target.top - 0.3, target.z, null, true); }
      if (!still) { const push = attack.nudge * 26; kickRig(rig, toward[0] * push, -push * (event.attack === 'heavy' ? 0.9 : 0.35), toward[2] * push); reactions.kicks++; }
    }
    else if (event.type === 'jump') { reactions.jumps++; hero.jump(); effects.dust(player.x, player.y, player.z, 0.3); }
    else if (event.type === 'land') { reactions.lands++; hero.land(event.speed); if (event.speed > 4) effects.dust(player.x, player.y, player.z, Math.min(1, event.speed / 14)); }
    else if (event.type === 'dodge') { reactions.dodges++; effects.dust(player.x, player.y, player.z, 0.5); }
    else if (event.type === 'charge') reactions.charges++;
    else if (event.type === 'tired') hud.warn();
    else if (event.type === 'grab') { reactions.grabs++; effects.dust(player.x, player.y + 0.6, player.z, 0.2); }
    else if (event.type === 'mantle') { reactions.mantles++; hero.land(4); }
    else if (event.type === 'leap') effects.dust(player.x, player.y, player.z, 0.3);
    else if (event.type === 'glide') { reactions.glides++; hero.jump(); }
    else if (event.type === 'let-go' || event.type === 'slip') reactions.lets++;
    else if (event.type === 'hurt' || event.type === 'down') {
      reactions.hurts++; hud.hurt();
      if (!still) kickRig(rig, 0, -0.5 - event.damage * 0.03, 0);
      if (event.type === 'down') hud.banner('You fall', ['You will wake by the campfire.'], 2.4);
    }
    else if (event.type === 'perfect') { reactions.perfects++; hud.flash(); }
    else if (event.type === 'evade') reactions.evades++;
    else if (event.type === 'awaken') hud.banner(STAG_NAME, ['It wakes. Watch its antlers glow.'], 2.6);
    else if (event.type === 'telegraph') reactions.telegraphs++;
    else if (event.type === 'retreat') { reactions.retreats++; effects.dust(sim.stag.x, sim.stag.y, sim.stag.z, 0.8); }
    else if (event.type === 'slam') { effects.dust(event.x, ground(event.x, event.z), event.z, 1); if (!still) kickRig(rig, 0, -0.9, 0); }
    else if (event.type === 'stun') {
      reactions.stuns++;
      const stone = sim.stones.find(entry => entry.id === event.stone);
      if (stone) effects.hit(stone.x, stone.y + 1.6, stone.z, null, true);
      if (!still) kickRig(rig, 0, -0.8, 0);
      hud.banner('Stunned!', ['Its heart is open. Hold for a heavy.'], 2.2);
    }
    else if (event.type === 'phase') hud.banner('Roots stir', ['Lines of roots will burst across the ring.'], 2.6);
    else if (event.type === 'pet-hit') { reactions.petHits++; effects.hit(sim.pet.x, sim.pet.y + 0.6, sim.pet.z, null, false); }
    else if (event.type === 'pat') { reactions.pats++; effects.charge(sim.pet.x, sim.pet.y + 0.8, sim.pet.z); effects.charge(sim.pet.x, sim.pet.y + 0.9, sim.pet.z); }
    else if (event.type === 'rest') { reactions.rests++; hud.banner('Rested', ['Health restored.'], 2); }
    else if (event.type === 'respawn') { reactions.respawns++; hud.banner('You wake by the campfire', ['Nothing was lost.'], 2.6); }
    else if (event.type === 'kindle') {
      reactions.kindles++;
      if (kindleFire(progress, event.id)) onSave(saved => kindleFire(saved, event.id));
      hud.banner('Campfire lit', ['You will wake here if you fall.'], 2.4);
    }
    else if (event.type === 'victory') win();
  }

  function win() {
    reactions.victories++;
    const award = recordVictory(progress, 'stag');
    onSave(saved => recordVictory(saved, 'stag'));
    const lines = [`+${award.xp} XP`];
    if (award.heartwood) lines.push(`+${award.heartwood} heartwood`);
    if (award.trophy) lines.push('A glowing antler for your room');
    if (award.companion) lines.push('A wolf watches from the cliff');
    if (award.levelsGained) lines.push(`Level ${award.level}!`);
    hud.banner(award.first ? 'The stag is calmed' : 'Calmed again', lines, 6);
    if (award.companion && !wolf) {
      const { x, z } = HILL.lookout;
      wolf = createWolf({ x, z, facing: Math.atan2(sim.arena.x - x, sim.arena.z - z), ground, waiting: true });
    }
  }

  function simulate(dt, still) {
    const intent = input.read(dt);
    if (!sim.lock) orbit(rig, intent.lookX, intent.lookY);
    if (intent.zoom) zoomRig(rig, intent.zoom * VIEW.zoomStep);
    const [mx, mz] = moveFrom(rig, intent.forward, intent.right);
    steer.moveX = mx; steer.moveZ = mz; steer.sprint = intent.sprint; steer.attackHeld = intent.attackHeld; steer.view = rig.yaw;
    const steps = Math.max(1, Math.ceil(dt / VIEW.step - 1e-6)), h = dt / steps;
    let frozen = false;
    for (let i = 0; i < steps; i++) {
      const before = player.time;
      const stopped = sim.stop;
      const events = stepSim(sim, steer, h);
      reactions.frozen += Math.min(stopped, h);
      frozen = sim.stop > 0;
      for (const event of events) react(event, still);
      if (player.state === 'attack' && player.attack === trailAttack) { sampleTrail(trailAttack, Math.max(before, trailTime), player.time); trailTime = player.time; }
    }
    if (wolf) { stepWolf(wolf, { player, ground }, dt); wolf.events.length = 0; }
    if (player.sprinting && player.grounded && (dustClock += dt) > 0.28) { dustClock = 0; effects.dust(player.x - player.vx * 0.05, player.y, player.z - player.vz * 0.05, 0.1); }
    if (!still && (driftClock += dt) > 0.09) { driftClock = 0; for (const draft of HILL.updrafts) { const angle = clockRandom() * Math.PI * 2, r = Math.sqrt(clockRandom()) * draft.radius, x = draft.x + Math.cos(angle) * r, z = draft.z + Math.sin(angle) * r; effects.drift(x, ground(x, z) + 0.3, z); } }
    if (player.state === 'charge' && player.charge < 1 && !still && clockRandom() < dt * 30) effects.charge(segment.tip[0], segment.tip[1], segment.tip[2]);
    return frozen;
  }

  function promptFor() {
    if (sim.encounter === 'fight' || player.state !== 'move') return '';
    if (sim.campfires.some(fire => fire.lit && Math.hypot(fire.x - player.x, fire.z - player.z) < CAMPFIRE.light)) return 'E  Rest by the fire';
    if (sim.encounter === 'won' && Math.hypot(sim.arena.x - player.x, sim.arena.z - player.z) < ENCOUNTER.rematch) return 'E  Call the stag back';
    if (!petDown(sim.pet) && Math.hypot(sim.pet.x - player.x, sim.pet.z - player.z) < 1.8) return `E  Pet ${petName}`;
    return '';
  }

  function project(x, y, z, into) {
    projected.set(x, y, z).project(camera);
    into.visible = projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2;
    into.x = (projected.x * 0.5 + 0.5) * width; into.y = (-projected.y * 0.5 + 0.5) * height;
    return into;
  }

  function draw(dt, frozen, still) {
    const pivot = displayedPose(dt);
    bladeSegment(player, pivot[0], pivot[1], segment);
    segment.yaw = pivot[0]; segment.pitch = pivot[1];
    hero.update(player, segment, dt, still);
    dummyView.update(sim.dummy, still);
    ring.update(dt, still);
    petView.update(sim.pet, dt, still);
    wolfView.update(wolf, dt, still);
    camp.update(sim.campfires, player, dt, still);
    effects.shadow.place(player.x, ground(player.x, player.z), player.y, player.z);
    effects.step(dt, frozen ? 0 : dt);
    stepRig(rig, dt, { player, lock: lockTarget(sim), world: sim.world, still });
    camera.position.set(...rig.eye); camera.lookAt(rig.look[0], rig.look[1], rig.look[2]);
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    focus.set(player.x, player.y, player.z);
    const a = snap(focus.dot(lightRight)), b = snap(focus.dot(lightUp)), c = focus.dot(SUN);
    sun.target.position.set(0, 0, 0).addScaledVector(lightRight, a).addScaledVector(lightUp, b).addScaledVector(SUN, c);
    sun.position.copy(sun.target.position).addScaledVector(SUN, 45);
    painterly.setSun(SUN, camera);
    if (!still) { wind.value = seconds; skyTime.value = seconds; }
    renderer.render(scene, camera);
    const stamina = hudState.stamina;
    project(player.x, player.y + 1.05, player.z, stamina);
    stamina.x += 46; stamina.value = player.stamina; stamina.tired = player.tired;
    const target = lockTarget(sim), lock = hudState.lock;
    if (target) {
      project(target.x, (target.bottom + target.top) / 2, target.z, lock);
      const top = project(target.x, target.top + 0.45, target.z, { x: 0, y: 0, visible: false });
      lock.barVisible = top.visible && target.id === 'dummy'; lock.barX = top.x; lock.barY = top.y; lock.health = target.health; lock.max = target.max;
    }
    const pet = sim.pet, fighting = foe(sim);
    hudState.vitals.health = player.health; hudState.vitals.max = player.max; hudState.vitals.level = levelFor(progress.xp).level;
    hudState.pet.name = petName; hudState.pet.health = pet.health; hudState.pet.max = pet.max; hudState.pet.out = petDown(pet);
    hudState.skill.left = pet.cooldown / PET_SKILL.cooldown; hudState.skill.ready = pet.cooldown <= 0 && !petDown(pet); hudState.skill.useful = Boolean(fighting);
    hudState.boss.health = sim.stag.health; hudState.boss.max = sim.stag.max;
    hud.update({ stamina, lock: target ? lock : null, vitals: hudState.vitals, pet: hudState.pet, skill: hudState.skill, boss: sim.encounter === 'fight' ? hudState.boss : null, prompt: promptFor() }, dt);
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    const started = performance.now();
    const gap = last ? now - last : 1000 / 60;
    last = now;
    const dt = Math.min(VIEW.longest, gap / 1000), still = reducedMotion();
    seconds += dt;
    const frozen = simulate(dt, still);
    draw(dt, frozen, still);
    const done = performance.now();
    for (let i = pending.length - 1; i >= 0; i--) {
      const entry = pending[i], waited = done - entry.stamp;
      if (RESPONSES[entry.action](player)) { latency[entry.action] = waited; latency.worst = Math.max(latency.worst, waited); pending.splice(i, 1); }
      else if (waited > 400) pending.splice(i, 1);
    }
    cpu.push(done - started); gaps.push(gap);
    if (cpu.length > VIEW.frames) { cpu.shift(); gaps.shift(); }
  }

  function start() {
    if (disposed || frame || document.hidden) return;
    last = 0;
    frame = requestAnimationFrame(tick);
  }
  function stop() { cancelAnimationFrame(frame); frame = 0; }
  const onVisibility = () => { if (document.hidden) stop(); else if (!paused) start(); };
  document.addEventListener('visibilitychange', onVisibility);

  resize();
  draw(0, false, reducedMotion());

  return {
    canvas,
    get paused() { return paused; },
    resume({ capture = true } = {}) {
      if (disposed) return;
      paused = false; input.clear();
      if (capture) input.lock();
      start();
    },
    pause() {
      if (disposed) return;
      paused = true; stop(); input.clear(); input.unlock(); pending.length = 0;
      steer.attackHeld = false;
      renderer.render(scene, camera);
    },
    diagnostics() {
      const info = renderer.info;
      return {
        player: { x: player.x, y: player.y, z: player.z, vx: player.vx, vy: player.vy, vz: player.vz, facing: player.facing, state: player.state, attack: player.attack, charge: player.charge, stamina: player.stamina, tired: player.tired, grounded: player.grounded, sprinting: player.sprinting, health: player.health, max: player.max },
        stag: { state: sim.stag.state, attack: sim.stag.attack, time: sim.stag.time, health: sim.stag.health, max: sim.stag.max, phase: sim.stag.phase, prefer: sim.stag.prefer, heartOpen: sim.stag.heartOpen, x: sim.stag.x, z: sim.stag.z, facing: sim.stag.facing, roots: sim.stag.roots.length },
        pet: { kind: sim.pet.kind, state: sim.pet.state, health: sim.pet.health, max: sim.pet.max, cooldown: sim.pet.cooldown, x: sim.pet.x, z: sim.pet.z },
        wolf: wolf && { state: wolf.state, x: wolf.x, z: wolf.z },
        encounter: sim.encounter, flurry: sim.flurry, taunt: sim.taunt,
        threat: stagAwake(sim.stag) && player.state !== 'down' ? threatens(sim.stag, { id: 'player', x: player.x, z: player.z, radius: 0.35, airborne: player.y - ground(player.x, player.z) }, VITALS.perfect) : false,
        arena: { x: sim.arena.x, z: sim.arena.z, radius: sim.arena.radius },
        stones: sim.stones.map(stone => [stone.x, stone.z]),
        campfires: sim.campfires.map(fire => ({ id: fire.id, x: fire.x, z: fire.z, lit: fire.lit })), lastFire: sim.lastFire,
        progress: structuredClone(progress),
        hud: { banner: hud.bannerText, prompt: promptFor() },
        dummy: { health: sim.dummy.health, max: sim.dummy.max, tilt: Math.hypot(sim.dummy.tiltX, sim.dummy.tiltZ), hurt: sim.dummy.hurt, x: sim.dummy.x, z: sim.dummy.z },
        lock: sim.lock,
        camera: { yaw: rig.yaw, pitch: rig.pitch, zoom: rig.zoom, distance: rig.distance, eye: [...rig.eye], clearance: rig.eye[1] - ground(rig.eye[0], rig.eye[2]), fov: camera.fov },
        frames: { cpu: quantiles(cpu), gap: quantiles(gaps), over20: gaps.filter(value => value > 20).length },
        latency: { ...latency },
        reactions: { ...reactions, particles: effects.live },
        renderer: { pixelRatio: renderer.getPixelRatio(), width: renderer.domElement.width, height: renderer.domElement.height, calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0 },
        pointer: { locked: input.locked, lockable: input.lockable },
        paused, muted, running: Boolean(frame),
      };
    },
    resetFrames() { cpu.length = 0; gaps.length = 0; latency.worst = 0; },
    dispose() {
      if (disposed) return;
      disposed = true; stop();
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect(); input.dispose(); hud.dispose();
      scene.traverse(object => {
        if (object instanceof Mesh || object.isPoints) {
          object.geometry?.dispose();
          for (const material of [object.material].flat()) material?.dispose();
        }
      });
      painterly.dispose();
      sun.dispose();
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
