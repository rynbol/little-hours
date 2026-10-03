import { ACESFilmicToneMapping, DirectionalLight, FogExp2, HemisphereLight, Mesh, PCFShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { createGround } from '../../core/wilds/ground.js';
import { createSim, drink, equip, foe, interact, interactable, lockTarget, petSkill, press, stepSim, toggleLock, whistle } from '../../core/wilds/sim.js';
import { stagAwake, threatens } from '../../core/wilds/stag.js';
import { PET_SKILL, petDown, placePet } from '../../core/wilds/pet.js';
import { createWolf, stepWolf } from '../../core/wilds/wolf.js';
import { SECRETS, claimSecret, emptyWilds, keepPipFind, kindleFire, levelFor, recordVictory, wildsStats } from '../../core/wilds/progress.js';
import { POTION, drinkPotion } from '../../core/wilds/gear.js';
import { VALLEY, trailDistance, valleyHeight, waterAt } from '../../core/wilds/valley.js';
import { VITALS, placePlayer, slopeAt } from '../../core/wilds/player.js';
import { RIG, createRig, kickRig, moveFrom, orbit, stepRig, zoomRig } from '../../core/wilds/camera.js';
import { ATTACKS, BLADE, bladeAngles, bladeSegment } from '../../core/wilds/moves.js';
import { renderRatioCeiling } from '../../core/render-scale.js';
import { clockNow, clockRandom } from '../../core/test-pins.js';
import { createPainterly } from '../../models/wilds/painterly.js';
import { buildGround, buildTufts } from '../../models/wilds/terrain.js';
import { buildDummy, buildPosts } from '../../models/wilds/props.js';
import { buildHero, loadHero } from '../../models/wilds/hero.js';
import { SKY, buildSky } from '../../models/wilds/sky.js';
import { createDaylight, daylight } from '../../models/wilds/daylight.js';
import { streamWater, valleyFlow, valleyPaint } from '../../models/wilds/valley-ground.js';
import { buildTrees } from '../../models/wilds/trees.js';
import { buildWater, buildWaterSurface } from '../../models/wilds/water.js';
import { buildLandmarks, buildSecrets } from '../../models/wilds/landmarks.js';
import { buildScatter } from '../../models/wilds/scatter.js';
import { buildEffects } from '../../models/wilds/effects.js';
import { buildRing } from '../../models/wilds/ring.js';
import { buildStag, loadStag } from '../../models/wilds/stag.js';
import { buildPet, loadPet } from '../../models/wilds/pet.js';
import { buildCamp } from '../../models/wilds/camp.js';
import { buildRain } from '../../models/wilds/rain.js';
import { createPost } from '../../models/wilds/post.js';
import { buildLife } from '../../models/wilds/life.js';
import { buildMist } from '../../models/wilds/mist.js';
import { ambience, createStride, stride, surfaceUnder } from '../../core/wilds/sound.js';
import { createInput } from './input.js';
import { createSound } from './sound.js';
import { createHud } from './hud.js';

export const VIEW = Object.freeze({ ratio: 1.5, step: 1 / 120, longest: 0.1, shadow: 2048, shadowHalf: 18, haze: 0.00085, far: 3200, frames: 240, zoomStep: 0.35, tree: 140 });
const MEADOWS = Object.freeze([[0, 36, 30], [6, -100, 26], [VALLEY.oak.x, VALLEY.oak.z, 22], [VALLEY.ring.x, VALLEY.ring.z, 26], [2, -40, 22]]);
const SHEETS = Object.freeze([Object.freeze({ lip: [-86.9, 46.2], land: [-84.8, 24.6], z: VALLEY.falls.z, width: 6, bulge: 0.3 }), Object.freeze({ lip: [-75.2, 25.1], land: [-72.6, 1.3], z: VALLEY.falls.z, width: 8, bulge: 0.5 })]);
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

export const loadModels = kind => Promise.all([loadStag(), loadHero(), loadPet(kind), loadPet('wolf')]).then(([stag, hero, pet, wolf]) => ({ stag, hero, pet, wolf }));

export function createGame(stage, hudLayer, { models, reducedMotion = () => false, onPause = () => {}, onShop = () => {}, wilds = {}, onSave = () => {} } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'wilds-canvas'; canvas.tabIndex = -1;
  stage.append(canvas);
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  const pixelRatio = Math.min(VIEW.ratio, renderRatioCeiling(window.devicePixelRatio, rendererName(renderer.getContext())));
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
  renderer.info.autoReset = false;
  const post = createPost(renderer);

  const scene = new Scene();
  scene.fog = new FogExp2(SKY.horizon, VIEW.haze);
  const camera = new PerspectiveCamera(RIG.fov, 1, 0.1, VIEW.far);
  const painterly = createPainterly();
  const wind = { value: 0 }, skyTime = { value: 0 }, light = createDaylight();

  const grid = createGround(valleyHeight, VALLEY.grid);
  const ground = (x, z) => grid.at(x, z);
  let progress = structuredClone(wilds.progress ?? emptyWilds());
  const sim = createSim(VALLEY, ground, { bond: wilds.bond ?? 0, kind: wilds.kind ?? 'cat', progress, hour: wilds.hour ?? 9 }), player = sim.player;
  const tilt = [0, 0], near = (x, z, list, radius) => list.some(spot => Math.hypot(spot.x - x, spot.z - z) < radius);
  const busy = [sim.dummy, ...sim.posts, ...sim.campfires, ...sim.stones, sim.merchant, ...sim.secrets];
  scene.add(buildGround(grid, painterly.material('#ffffff', { vertexColors: true, rim: false }), { paint: valleyPaint }));
  for (const [x, z, radius] of MEADOWS) scene.add(buildTufts(grid, painterly.material('#ffffff', { vertexColors: true, rim: false }), { centre: [x, z], radius, wind, keep: (tx, tz) => !near(tx, tz, busy, 1.1) && trailDistance(tx, tz) > 1.5 && waterAt(tx, tz) < ground(tx, tz) - 0.05 && Math.hypot(...slopeAt(ground, tx, tz, tilt)) < 0.6 }));
  const { bounds } = VALLEY;
  scene.add(buildTrees(sim.trees, painterly, { wind, ground, near: tree => tree.hero || Math.hypot((tree.x - bounds.x) / bounds.rx, (tree.z - bounds.z) / bounds.rz) < 1 }));
  const water = buildWater({
    surfaces: [
      buildWaterSurface(ground, waterAt, valleyFlow, { area: [-77, 72, -305, -100], step: 1.25 }),
      buildWaterSurface(ground, waterAt, valleyFlow, { area: [-88, -76.6, -128, -116], step: 0.6 }),
      buildWaterSurface(ground, streamWater(ground), valleyFlow, { area: [-166, -85.5, -134, -100], step: 1 }),
    ],
    sheets: SHEETS,
  });
  const landmarks = buildLandmarks(VALLEY, ground, painterly), secrets = buildSecrets(sim, painterly), scatter = buildScatter(sim, painterly, wind);
  scene.add(water.root, landmarks.root, secrets.root, ...scatter.meshes);
  scene.add(buildPosts(sim.posts, painterly.material('#ffffff', { vertexColors: true })));
  const dummyView = buildDummy(sim.dummy, painterly);
  scene.add(dummyView.root);
  const hero = buildHero(models.hero, painterly);
  const dress = () => hero.dress({ avatar: wilds.avatar, wear: progress.wear, owned: progress.owned });
  dress();
  const ring = buildRing(sim, painterly), petView = buildPet(models.pet, painterly, { kind: sim.pet.kind, bond: wilds.bond }), wolfView = buildPet(models.wolf, painterly, { kind: 'wolf', name: 'wilds-wolf' }), camp = buildCamp(sim.campfires, painterly);
  scene.add(ring.root, petView.root, wolfView.root, camp.root);
  let wolf = progress.companions.includes('wolf') ? createWolf({ x: player.x + 1.3, z: player.z + 1.7, facing: player.facing, ground: sim.floor }) : null;
  scene.add(hero.root);
  daylight(sim.hour, light);
  const sky = buildSky(light.sun, { time: skyTime });
  scene.add(sky);
  const effects = buildEffects(clockRandom);
  scene.add(...effects.meshes);
  const stagView = buildStag(models.stag, sim.stag, painterly, effects);
  scene.add(stagView.root);
  const rain = buildRain(clockRandom, skyTime);
  scene.add(rain.mesh);
  const life = buildLife(sim, painterly, effects, { time: skyTime, random: clockRandom, flowers: scatter.flowers }), mist = buildMist(skyTime);
  scene.add(...life.meshes, ...mist.meshes);

  const hemi = new HemisphereLight('#bcd4ea', '#6f8a4c', 1.35);
  scene.add(hemi);
  const sun = new DirectionalLight('#ffe3bd', 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(VIEW.shadow, VIEW.shadow);
  Object.assign(sun.shadow.camera, { left: -VIEW.shadowHalf, right: VIEW.shadowHalf, top: VIEW.shadowHalf, bottom: -VIEW.shadowHalf, near: 1, far: 120 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.radius = 3; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const lightRight = new Vector3(), lightUp = new Vector3(), worldUp = new Vector3(0, 1, 0), focus = new Vector3();
  const texel = VIEW.shadowHalf * 2 / VIEW.shadow, snap = value => Math.round(value / texel) * texel;

  function shine() {
    daylight(sim.hour, light);
    sun.color.copy(light.light); sun.intensity = light.strength;
    hemi.color.copy(light.sky); hemi.groundColor.copy(light.earth); hemi.intensity = light.fill;
    scene.fog.color.copy(light.fog); scene.fog.density = VIEW.haze * light.haze;
    renderer.toneMappingExposure = light.exposure;
    sun.shadow.intensity = 1 - light.cloud * 0.7;
    painterly.shared.wet.value = light.wet;
    const { uniforms } = sky.material;
    uniforms.zenith.value.copy(light.zenith); uniforms.middle.value.copy(light.middle); uniforms.horizon.value.copy(light.horizon);
    uniforms.sunColor.value.copy(light.glow); uniforms.sunDirection.value.copy(light.sun); uniforms.moonDirection.value.copy(light.moon); uniforms.night.value = light.night; uniforms.cloud.value = light.cloud; uniforms.rainbow.value = light.rainbow;
    lightRight.crossVectors(light.toward, worldUp).normalize(); lightUp.crossVectors(lightRight, light.toward);
  }
  shine();

  const rig = createRig({ yaw: VALLEY.spawn.facing, at: [player.x, player.y, player.z] });
  const steer = { moveX: 0, moveZ: 0, sprint: false, attackHeld: false, view: rig.yaw };
  const pose = [...BLADE.rest], shownPose = [...BLADE.rest], startPose = [...BLADE.rest], windPose = [0, 0];
  const segment = { grip: [0, 0, 0], root: [0, 0, 0], tip: [0, 0, 0], yaw: BLADE.rest[0], pitch: BLADE.rest[1] }, trailSegment = { grip: [0, 0, 0], root: [0, 0, 0], tip: [0, 0, 0] };
  const projected = new Vector3(), hudState = { stamina: { x: 0, y: 0, visible: false, value: 100, max: 100, tired: false }, lock: { visible: false, x: 0, y: 0, barVisible: false, barX: 0, barY: 0, health: 100, max: 100 }, vitals: { health: 100, max: 100, level: 1, xp: 0, potions: 0, carry: POTION.carry }, pet: { health: 1, max: 1, out: false }, skill: { left: 0, ready: true, useful: false }, boss: { health: 1, max: 1 } };
  const cpu = [], gaps = [], latency = { move: null, attack: null, jump: null, dodge: null, worst: 0 }, pending = [];
  const reactions = { swings: 0, hits: 0, breaks: 0, lands: 0, dodges: 0, jumps: 0, charges: 0, kicks: 0, trail: 0, warnings: 0, frozen: 0, grabs: 0, mantles: 0, glides: 0, lets: 0, hurts: 0, perfects: 0, evades: 0, telegraphs: 0, stuns: 0, heartHits: 0, petHits: 0, petSkills: 0, pats: 0, retreats: 0, rests: 0, respawns: 0, kindles: 0, victories: 0, secrets: 0, herbs: 0, shops: 0, levels: 0, digs: 0, scents: 0, whistles: 0, potions: 0 };
  let frame = 0, last = 0, paused = true, disposed = false, width = 0, height = 0, trailAttack = null, trailTime = 0, dustClock = 0, driftClock = 0, muted = false, seconds = 0;

  const hud = createHud(hudLayer);
  const sound = createSound(), walk = createStride(), hearing = ambience(sim.hour, player.x, player.z), underfoot = { ground, water: waterAt }, lastStep = { x: player.x, z: player.z };
  sound.attach(window);
  const input = createInput(canvas, {
    onPress(action, stamp) {
      if (paused || disposed) return;
      if (action === 'pause') { onPause('key'); return; }
      if (action === 'mute') { muted = !muted; sound.setMuted(muted); return; }
      if (action === 'lock') { toggleLock(sim, rig.yaw); return; }
      if (action === 'interact') { interact(sim); return; }
      if (action === 'pet') { if (petSkill(sim)) reactions.petSkills++; return; }
      if (action === 'whistle') { whistle(sim); return; }
      if (action === 'potion') { drink(sim); return; }
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
    post.resize(Math.round(w * pixelRatio), Math.round(h * pixelRatio));
    effects.resize(h * pixelRatio, camera.fov);
    life.resize(h * pixelRatio / (2 * Math.tan(camera.fov * Math.PI / 360)));
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

  function find(id) {
    const award = claimSecret(progress, id);
    onSave((saved, draft) => { claimSecret(saved, id); if (SECRETS[id].find) keepPipFind(draft.buddy, SECRETS[id].find, clockNow()); });
    reactions.secrets++;
    const spot = sim.secrets.find(entry => entry.id === id);
    effects.hit(spot.x, spot.y + 0.6, spot.z, null, true);
    hud.toast('secret', { icon: 'star', tone: 'glow', seconds: 2.6 });
    if (award) { equip(sim, wildsStats(progress)); dress(); }
  }

  function react(event, still) {
    const { type } = event;
    if (type === 'swing') { reactions.swings++; sound.swish(event.attack === 'heavy'); trailAttack = event.attack; trailTime = 0; startPose[0] = shownPose[0]; startPose[1] = shownPose[1]; if (event.attack === 'heavy') effects.trail.cut(); }
    else if (type === 'hit') {
      reactions.hits++;
      sound.thud(event.attack === 'heavy' || event.heart);
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
    else if (type === 'jump') { reactions.jumps++; sound.step(surfaceUnder(player, underfoot), 0.7); hero.jump(); effects.dust(player.x, player.y, player.z, 0.3); }
    else if (type === 'land') { reactions.lands++; sound.step(surfaceUnder(player, underfoot), Math.min(1.8, 0.8 + event.speed / 10)); hero.land(event); if (event.speed > 4) effects.dust(player.x, player.y, player.z, Math.min(1, event.speed / 14)); }
    else if (type === 'dodge') { reactions.dodges++; effects.dust(player.x, player.y, player.z, 0.5); }
    else if (type === 'charge') reactions.charges++;
    else if (type === 'tired') hud.warn();
    else if (type === 'grab') { reactions.grabs++; effects.dust(player.x, player.y + 0.6, player.z, 0.2); }
    else if (type === 'mantle') { reactions.mantles++; hero.mantle(); }
    else if (type === 'leap') effects.dust(player.x, player.y, player.z, 0.3);
    else if (type === 'glide') reactions.glides++;
    else if (type === 'let-go' || type === 'slip') reactions.lets++;
    else if (type === 'hurt' || type === 'down') {
      reactions.hurts++; hud.hurt();
      if (!still) kickRig(rig, 0, -0.5 - event.damage * 0.03, 0);
      if (type === 'down') hud.toast('down', { icon: 'dizzy', tone: 'danger', seconds: 2.4 });
    }
    else if (type === 'perfect') { reactions.perfects++; hud.flash(); hero.perfect(); }
    else if (type === 'evade') reactions.evades++;
    else if (type === 'awaken') { sound.rumble(); sound.creak(); hud.toast('awaken', { icon: 'wake', tone: 'danger', seconds: 2.4 }); }
    else if (type === 'telegraph') { reactions.telegraphs++; sound.creak(); }
    else if (type === 'retreat') { reactions.retreats++; sound.creak(); effects.dust(sim.stag.x, sim.stag.y, sim.stag.z, 0.8); }
    else if (type === 'slam') { sound.rumble(); effects.dust(event.x, ground(event.x, event.z), event.z, 1); if (!still) kickRig(rig, 0, -0.9, 0); }
    else if (type === 'stun') {
      reactions.stuns++;
      sound.rumble();
      const stone = sim.stones.find(entry => entry.id === event.stone);
      if (stone) effects.hit(stone.x, stone.y + 1.6, stone.z, null, true);
      if (!still) kickRig(rig, 0, -0.8, 0);
      hud.toast('stun', { icon: 'stars', tone: 'glow', seconds: 2 });
    }
    else if (type === 'phase') hud.toast('phase', { icon: 'roots', tone: 'danger', seconds: 2.4 });
    else if (type === 'pet-hit') { reactions.petHits++; effects.hit(sim.pet.x, sim.pet.y + 0.6, sim.pet.z, null, false); }
    else if (type === 'pat') { reactions.pats++; hero.emote('pet', Math.atan2(sim.pet.x - player.x, sim.pet.z - player.z)); effects.charge(sim.pet.x, sim.pet.y + 0.8, sim.pet.z); effects.charge(sim.pet.x, sim.pet.y + 0.9, sim.pet.z); }
    else if (type === 'rest') { reactions.rests++; shine(); hud.toast('rest', { icon: event.hour < 12 ? 'sun' : 'moon', tone: event.hour < 12 ? 'warm' : 'cool', seconds: 2.4 }); }
    else if (type === 'respawn') { reactions.respawns++; hud.toast('respawn', { icon: 'fire', seconds: 2.4 }); }
    else if (type === 'kindle') {
      reactions.kindles++;
      if (kindleFire(progress, event.id)) onSave(saved => kindleFire(saved, event.id));
      hud.toast('kindle', { icon: 'fire', tone: 'glow' });
    }
    else if (type === 'victory') win();
    else if (type === 'secret') find(event.id);
    else if (type === 'herb') { reactions.herbs++; effects.charge(player.x, player.y + 1, player.z); hud.toast('herb', { icon: 'leaf', tone: 'glow', seconds: 1.4 }); }
    else if (type === 'shop') { reactions.shops++; onShop(); }
    else if (type === 'level') { reactions.levels++; hud.flash(); hud.toast('level', { icon: 'up', badge: String(event.level), tone: 'glow', seconds: 3 }); }
    else if (type === 'dug') { reactions.digs++; const found = sim.secrets.find(entry => entry.id === event.id); effects.dust(found.x, found.y, found.z, 0.8); hud.toast('dug', { icon: 'paw', tone: 'glow', seconds: 1.8 }); }
    else if (type === 'pet-scent') { reactions.scents++; effects.charge(sim.pet.x, sim.pet.y + 0.9, sim.pet.z); }
    else if (type === 'whistle' || type === 'whistle-unheard') { reactions.whistles++; hud.toast(type, { icon: type === 'whistle' ? 'note' : 'hush', tone: 'cool', seconds: 1.2 }); }
    else if (type === 'potion') {
      reactions.potions++;
      if (drinkPotion(progress)) onSave(saved => drinkPotion(saved));
      effects.charge(player.x, player.y + 1, player.z);
      hud.toast('potion', { icon: 'flask', tone: 'glow', seconds: 1.4 });
    }
    else if (type === 'potion-wait') hud.toast('potion-wait', { icon: 'empty', tone: 'cool', seconds: 1.2 });
    else if (type === 'rematch') hud.toast('rematch', { icon: 'antler', tone: 'danger', seconds: 1.8 });
  }

  function win() {
    reactions.victories++;
    const award = recordVictory(progress, 'stag');
    onSave(saved => recordVictory(saved, 'stag'));
    hud.toast('victory', { icon: 'antler', tone: 'glow', seconds: 4 });
    equip(sim, wildsStats(progress));
    dress();
    hero.emote('victory');
    if (award.companion && !wolf) {
      const { x, z } = VALLEY.lookout;
      wolf = createWolf({ x, z, facing: Math.atan2(sim.arena.x - x, sim.arena.z - z), ground: sim.floor, waiting: true });
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
    if (wolf) { stepWolf(wolf, { player, ground: sim.floor }, dt); wolf.events.length = 0; }
    const moved = Math.hypot(player.x - lastStep.x, player.z - lastStep.z);
    lastStep.x = player.x; lastStep.z = player.z;
    if (stride(walk, moved, Math.hypot(player.vx, player.vz), player.grounded && player.state !== 'swim')) sound.step(surfaceUnder(player, underfoot));
    sound.update(ambience(sim.hour, player.x, player.z, hearing), dt, seconds);
    if (player.sprinting && player.grounded && (dustClock += dt) > 0.28) { dustClock = 0; effects.dust(player.x - player.vx * 0.05, player.y, player.z - player.vz * 0.05, 0.1); }
    if (!still && (driftClock += dt) > 0.09) { driftClock = 0; for (const draft of VALLEY.updrafts) { const angle = clockRandom() * Math.PI * 2, r = Math.sqrt(clockRandom()) * draft.radius, x = draft.x + Math.cos(angle) * r, z = draft.z + Math.sin(angle) * r; effects.drift(x, ground(x, z) + 0.3, z); } }
    if (player.state === 'charge' && player.charge < 1 && !still && clockRandom() < dt * 30) effects.charge(segment.tip[0], segment.tip[1], segment.tip[2]);
    return frozen;
  }

  function promptFor() {
    if (player.state !== 'move' || foe(sim)) return null;
    return interactable(sim);
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
    hero.update(player, dt, still);
    dummyView.update(sim.dummy, still);
    ring.update(dt, still, light.night);
    stagView.update(dt, still);
    petView.update(sim.pet, dt, still);
    wolfView.update(wolf, dt, still);
    camp.update(sim.campfires, player, dt, still, light.night);
    secrets.update(seconds, still);
    scatter.update();
    shine();
    landmarks.update(seconds, light.night, still);
    water.update(seconds, light.toward, 0.45 + 0.55 * (1 - light.night), still, light.rain);
    const floor = (x, z) => Math.max(ground(x, z), waterAt(x, z));
    effects.shadow.place(0, player.x, floor(player.x, player.z), player.y, player.z, 0.42);
    effects.shadow.place(1, sim.pet.x, floor(sim.pet.x, sim.pet.z), sim.pet.y, sim.pet.z, 0.36);
    if (wolf) effects.shadow.place(2, wolf.x, floor(wolf.x, wolf.z), wolf.y, wolf.z, 0.5); else effects.shadow.hide(2);
    if (sim.stag.state === 'gone') effects.shadow.hide(3); else effects.shadow.place(3, sim.stag.x, floor(sim.stag.x, sim.stag.z), sim.stag.y, sim.stag.z, 1.8);
    effects.step(dt, frozen ? 0 : dt);
    stepRig(rig, dt, { player, lock: lockTarget(sim), world: sim.world, still });
    camera.position.set(...rig.eye); camera.lookAt(rig.look[0], rig.look[1], rig.look[2]);
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    rain.update(camera.position, light.rain, light.sky);
    life.update({ player, hour: sim.hour, light, seconds, dt, still, ground, water: waterAt, flow: valleyFlow, eye: camera.position });
    mist.update(life.amounts.mist, light);
    focus.set(player.x, player.y, player.z);
    const a = snap(focus.dot(lightRight)), b = snap(focus.dot(lightUp)), c = focus.dot(light.toward);
    sun.target.position.set(0, 0, 0).addScaledVector(lightRight, a).addScaledVector(lightUp, b).addScaledVector(light.toward, c);
    sun.position.copy(sun.target.position).addScaledVector(light.toward, 60);
    painterly.setSun(light.toward, camera);
    if (!still) { wind.value = seconds; skyTime.value = seconds; }
    post.grade(light, camera);
    renderer.info.reset();
    post.render(scene, camera);
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
    const growth = levelFor(progress.xp), vitals = hudState.vitals;
    vitals.health = player.health; vitals.max = player.max; vitals.level = growth.level; vitals.xp = growth.span ? growth.into / growth.span : 1; vitals.potions = sim.potions;
    hudState.pet.health = pet.health; hudState.pet.max = pet.max; hudState.pet.out = petDown(pet);
    hudState.skill.left = pet.cooldown / PET_SKILL.cooldown; hudState.skill.ready = pet.cooldown <= 0 && !petDown(pet); hudState.skill.useful = Boolean(fighting);
    hudState.boss.health = sim.stag.health; hudState.boss.max = sim.stag.max;
    hud.update({ stamina, lock: target ? lock : null, vitals: hudState.vitals, pet: hudState.pet, skill: hudState.skill, boss: sim.encounter === 'fight' ? hudState.boss : null, prompt: promptFor(), hour: sim.hour }, dt);
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
  const onVisibility = () => { if (document.hidden) { stop(); sound.hush(); } else if (!paused) { start(); sound.wake(); } };
  document.addEventListener('visibilitychange', onVisibility);

  function compileAll() {
    const hidden = [];
    scene.traverse(object => { if (!object.visible) { hidden.push(object); object.visible = true; } });
    renderer.setRenderTarget(post.target);
    renderer.compile(scene, camera);
    renderer.setRenderTarget(null);
    post.compile();
    for (const object of hidden) object.visible = false;
  }

  resize();
  compileAll();
  draw(0, false, reducedMotion());

  return {
    canvas,
    get paused() { return paused; },
    resume({ capture = true } = {}) {
      if (disposed) return;
      paused = false; input.clear(); sound.wake();
      if (capture) input.lock();
      start();
    },
    pause() {
      if (disposed) return;
      paused = true; stop(); input.clear(); input.unlock(); pending.length = 0; sound.hush();
      steer.attackHeld = false;
      post.render(scene, camera);
    },
    diagnostics() {
      const info = renderer.info;
      return {
        player: { x: player.x, y: player.y, z: player.z, vx: player.vx, vy: player.vy, vz: player.vz, facing: player.facing, state: player.state, attack: player.attack, charge: player.charge, stamina: player.stamina, tired: player.tired, grounded: player.grounded, sprinting: player.sprinting, health: player.health, max: player.max },
        hero: { clip: hero.clip, parts: hero.parts },
        stag: { clip: stagView.clip, dissolve: stagView.dissolve, state: sim.stag.state, attack: sim.stag.attack, time: sim.stag.time, health: sim.stag.health, max: sim.stag.max, phase: sim.stag.phase, prefer: sim.stag.prefer, heartOpen: sim.stag.heartOpen, x: sim.stag.x, z: sim.stag.z, facing: sim.stag.facing, roots: sim.stag.roots.length },
        pet: { kind: sim.pet.kind, state: sim.pet.state, health: sim.pet.health, max: sim.pet.max, cooldown: sim.pet.cooldown, x: sim.pet.x, z: sim.pet.z },
        wolf: wolf && { state: wolf.state, x: wolf.x, z: wolf.z },
        encounter: sim.encounter, flurry: sim.flurry, taunt: sim.taunt,
        threat: stagAwake(sim.stag) && player.state !== 'down' ? threatens(sim.stag, { id: 'player', x: player.x, z: player.z, radius: 0.35, airborne: player.y - ground(player.x, player.z) }, VITALS.perfect) : false,
        arena: { x: sim.arena.x, z: sim.arena.z, radius: sim.arena.radius },
        stones: sim.stones.map(stone => [stone.x, stone.z]),
        campfires: sim.campfires.map(fire => ({ id: fire.id, x: fire.x, z: fire.z, lit: fire.lit })), lastFire: sim.lastFire,
        progress: structuredClone(progress),
        hud: { toast: hud.toastKind, waiting: hud.toastsWaiting, prompt: promptFor() },
        hour: sim.hour, level: sim.level, potions: sim.potions, traits: { ...player.traits },
        secrets: sim.secrets.map(entry => ({ id: entry.id, x: entry.x, y: entry.y, z: entry.z, found: entry.found, dug: entry.dug })),
        herbs: { count: sim.herbs.length, picked: sim.herbs.filter(herb => herb.picked).length, nearest: sim.herbs.filter(herb => !herb.picked).map(herb => ({ x: herb.x, z: herb.z, distance: Math.hypot(herb.x - player.x, herb.z - player.z) })).sort((a, b) => a.distance - b.distance)[0] ?? null },
        merchant: { x: sim.merchant.x, z: sim.merchant.z },
        updrafts: sim.world.updrafts.map(draft => ({ x: draft.x, z: draft.z, radius: draft.radius })),
        life: { amounts: { ...life.amounts }, deer: life.herd.map(deer => ({ state: deer.state, x: deer.x, z: deer.z })), fishJumping: life.fishJumping },
        world: { trees: sim.trees.length, ring: ring.kindled, swimming: player.state === 'swim', water: waterAt(player.x, player.z) },
        dummy: { health: sim.dummy.health, max: sim.dummy.max, tilt: Math.hypot(sim.dummy.tiltX, sim.dummy.tiltZ), hurt: sim.dummy.hurt, x: sim.dummy.x, z: sim.dummy.z },
        lock: sim.lock,
        camera: { yaw: rig.yaw, pitch: rig.pitch, zoom: rig.zoom, distance: rig.distance, eye: [...rig.eye], clearance: rig.eye[1] - ground(rig.eye[0], rig.eye[2]), fov: camera.fov },
        frames: { cpu: quantiles(cpu), gap: quantiles(gaps), over20: gaps.filter(value => value > 20).length },
        latency: { ...latency },
        reactions: { ...reactions, particles: effects.live },
        renderer: { pixelRatio: renderer.getPixelRatio(), width: renderer.domElement.width, height: renderer.domElement.height, calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0 },
        pointer: { locked: input.locked, lockable: input.lockable },
        sound: sound.diagnostics(),
        paused, muted, running: Boolean(frame),
      };
    },
    resetFrames() { cpu.length = 0; gaps.length = 0; latency.worst = 0; },
    visit({ x = player.x, z = player.z, facing = player.facing, hour = sim.hour, yaw = facing, pitch = rig.pitch, zoom = rig.zoom } = {}) {
      placePlayer(player, x, z, facing, sim.floor);
      placePet(sim.pet, x - Math.sin(facing) * 1.6 + Math.cos(facing) * 0.9, z - Math.cos(facing) * 1.6 - Math.sin(facing) * 0.9, sim.floor);
      sim.hour = hour;
      Object.assign(rig, { yaw, pitch, zoom, distance: zoom });
      rig.pivot[0] = player.x; rig.pivot[1] = player.y + RIG.height; rig.pivot[2] = player.z;
      effects.clear();
      draw(0, false, reducedMotion());
    },
    restock(saved) {
      progress = structuredClone(saved);
      equip(sim, wildsStats(progress), progress.potions);
      dress();
    },
    dispose() {
      if (disposed) return;
      disposed = true; stop();
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect(); input.dispose(); hud.dispose(); sound.dispose(); stagView.dispose(); hero.dispose(); petView.dispose(); wolfView.dispose();
      scene.traverse(object => {
        if (object instanceof Mesh || object.isPoints) {
          object.geometry?.dispose();
          for (const material of [object.material].flat()) material?.dispose();
        }
      });
      painterly.dispose();
      post.dispose();
      sun.dispose();
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
