import { ACESFilmicToneMapping, DirectionalLight, Fog, HemisphereLight, Mesh, PCFShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { heightAt, smooth } from '../../core/world-terrain.js';
import { createGround } from '../../core/wilds/ground.js';
import { createBox, lockTarget, press, stepBox, toggleLock } from '../../core/wilds/box.js';
import { HILL, shapeHill } from '../../core/wilds/layout.js';
import { slopeAt } from '../../core/wilds/player.js';
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
import { createInput } from './input.js';
import { createHud } from './hud.js';

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

export function createGame(stage, hudLayer, { reducedMotion = () => false, onPause = () => {} } = {}) {
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
  const box = createBox(ground), player = box.player;
  const tilt = [0, 0], near = (x, z, list, radius) => list.some(spot => Math.hypot(spot.x - x, spot.z - z) < radius);
  const worn = (x, z) => Math.max(smooth(2.4, 0.9, Math.hypot(x - box.dummy.x, z - box.dummy.z)) * 0.75, smooth(2, 0.6, Math.hypot(x - HILL.spawn.x, z - HILL.spawn.z)) * 0.5);
  scene.add(buildGround(grid, painterly.material('#ffffff', { vertexColors: true, rim: false }), { worn }));
  scene.add(buildTufts(grid, painterly.material('#ffffff', { vertexColors: true, rim: false }), { centre: [HILL.bounds.x, HILL.bounds.z], radius: HILL.bounds.radius + 6, wind, keep: (x, z) => !near(x, z, [box.dummy, ...box.posts], 0.75) && worn(x, z) < 0.3 && Math.hypot(...slopeAt(ground, x, z, tilt)) < 0.7 }));
  scene.add(buildPosts(box.posts, painterly.material('#ffffff', { vertexColors: true })));
  const dummyView = buildDummy(box.dummy, painterly);
  scene.add(dummyView.root);
  const hero = buildStandin(painterly);
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
  const sim = { moveX: 0, moveZ: 0, sprint: false, attackHeld: false, view: rig.yaw };
  const pose = [...BLADE.rest], shownPose = [...BLADE.rest], startPose = [...BLADE.rest], windPose = [0, 0];
  const segment = { root: [0, 0, 0], tip: [0, 0, 0], yaw: BLADE.rest[0], pitch: BLADE.rest[1] }, trailSegment = { root: [0, 0, 0], tip: [0, 0, 0] };
  const projected = new Vector3(), hudState = { stamina: { x: 0, y: 0, visible: false, value: 100, max: 100, tired: false }, lock: { visible: false, x: 0, y: 0, barVisible: false, barX: 0, barY: 0, health: 100, max: 100 } };
  const cpu = [], gaps = [], latency = { move: null, attack: null, jump: null, dodge: null, worst: 0 }, pending = [];
  const reactions = { swings: 0, hits: 0, breaks: 0, lands: 0, dodges: 0, jumps: 0, charges: 0, kicks: 0, trail: 0, warnings: 0, frozen: 0, grabs: 0, mantles: 0, glides: 0, lets: 0 };
  let frame = 0, last = 0, paused = true, disposed = false, width = 0, height = 0, trailAttack = null, trailTime = 0, dustClock = 0, driftClock = 0, muted = false, seconds = 0;

  const hud = createHud(hudLayer);
  const input = createInput(canvas, {
    onPress(action, stamp) {
      if (paused || disposed) return;
      if (action === 'pause') { onPause('key'); return; }
      if (action === 'mute') { muted = !muted; return; }
      if (action === 'lock') { toggleLock(box, rig.yaw); return; }
      if (action === 'dodge' && (player.tired || player.stamina <= 0)) { hud.warn(); reactions.warnings++; }
      if (['jump', 'dodge', 'attack'].includes(action)) press(box, action);
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
      const attack = ATTACKS[event.attack], target = box.world.targets.find(entry => entry.id === event.id);
      bladeAngles(attack, player.time, pose); bladeSegment(player, pose[0], pose[1], segment);
      contact(target, spot);
      const dx = target.x - player.x, dz = target.z - player.z, length = Math.hypot(dx, dz) || 1;
      toward[0] = dx / length; toward[1] = 0.25; toward[2] = dz / length;
      effects.hit(spot[0], spot[1], spot[2], toward, event.attack === 'heavy' || event.attack === 'light3');
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
  }

  function simulate(dt, still) {
    const intent = input.read(dt);
    if (!box.lock) orbit(rig, intent.lookX, intent.lookY);
    if (intent.zoom) zoomRig(rig, intent.zoom * VIEW.zoomStep);
    const [mx, mz] = moveFrom(rig, intent.forward, intent.right);
    sim.moveX = mx; sim.moveZ = mz; sim.sprint = intent.sprint; sim.attackHeld = intent.attackHeld; sim.view = rig.yaw;
    const steps = Math.max(1, Math.ceil(dt / VIEW.step - 1e-6)), h = dt / steps;
    let frozen = false;
    for (let i = 0; i < steps; i++) {
      const before = player.time;
      const stopped = box.stop;
      const events = stepBox(box, sim, h);
      reactions.frozen += Math.min(stopped, h);
      frozen = box.stop > 0;
      for (const event of events) react(event, still);
      if (player.state === 'attack' && player.attack === trailAttack) { sampleTrail(trailAttack, Math.max(before, trailTime), player.time); trailTime = player.time; }
    }
    if (player.sprinting && player.grounded && (dustClock += dt) > 0.28) { dustClock = 0; effects.dust(player.x - player.vx * 0.05, player.y, player.z - player.vz * 0.05, 0.1); }
    if (!still && (driftClock += dt) > 0.09) { driftClock = 0; for (const draft of HILL.updrafts) { const angle = clockRandom() * Math.PI * 2, r = Math.sqrt(clockRandom()) * draft.radius, x = draft.x + Math.cos(angle) * r, z = draft.z + Math.sin(angle) * r; effects.drift(x, ground(x, z) + 0.3, z); } }
    if (player.state === 'charge' && player.charge < 1 && !still && clockRandom() < dt * 30) effects.charge(segment.tip[0], segment.tip[1], segment.tip[2]);
    return frozen;
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
    dummyView.update(box.dummy, still);
    effects.shadow.place(player.x, ground(player.x, player.z), player.y, player.z);
    effects.step(dt, frozen ? 0 : dt);
    stepRig(rig, dt, { player, lock: lockTarget(box), world: box.world, still });
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
    const target = lockTarget(box), lock = hudState.lock;
    if (target) {
      project(target.x, (target.bottom + target.top) / 2, target.z, lock);
      const top = project(target.x, target.top + 0.45, target.z, { x: 0, y: 0, visible: false });
      lock.barVisible = top.visible; lock.barX = top.x; lock.barY = top.y; lock.health = box.dummy.health; lock.max = box.dummy.max;
      hud.update({ stamina, lock }, dt);
    } else hud.update({ stamina, lock: null }, dt);
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
      sim.attackHeld = false;
      renderer.render(scene, camera);
    },
    diagnostics() {
      const info = renderer.info;
      return {
        player: { x: player.x, y: player.y, z: player.z, vx: player.vx, vy: player.vy, vz: player.vz, facing: player.facing, state: player.state, attack: player.attack, charge: player.charge, stamina: player.stamina, tired: player.tired, grounded: player.grounded, sprinting: player.sprinting },
        dummy: { health: box.dummy.health, max: box.dummy.max, tilt: Math.hypot(box.dummy.tiltX, box.dummy.tiltZ), hurt: box.dummy.hurt, x: box.dummy.x, z: box.dummy.z },
        lock: box.lock,
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
