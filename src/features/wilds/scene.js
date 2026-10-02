import { Scene } from '@babylonjs/core/scene.js';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { clockNow } from '../../core/test-pins.js';
import { createMovementState } from '../../core/wilds/movement.js';
import { createCombatState, stepCombat, WARDEN_ARENA } from '../../core/wilds/combat.js';
import { bondLevel } from '../../core/pet-bonds.js';
import { petEntry } from '../../core/pets.js';
import { createPetModel } from '../pet/index.js';
import { createWildsWorld, wildsAtmosphere } from '../../models/wilds/world.js';
import { loadWildsAvatar } from '../../models/wilds/avatar.js';
import { createWildsInput } from './input.js';
import { createWildsCamera } from './camera.js';
import { createWildsHud } from './hud.js';

const SKY = { day: '#BFD9E8', dusk: '#D3B7C9', rain: '#A2B2BD' };
const DEFAULTS = { createWorld: createWildsWorld, loadAvatar: loadWildsAvatar, createInput: createWildsInput, createCamera: createWildsCamera, createHud: createWildsHud, createCombatModels: (...args) => import('../../models/wilds/combat-models.js').then(module => module.createCombatModels(...args)) };

export function createWildsView(engine, canvas, state, now = clockNow, dependencies = DEFAULTS, { onProgress } = {}) {
  dependencies = { ...DEFAULTS, ...dependencies };
  const owner = canvas.ownerDocument, host = owner.defaultView;
  const petId = petEntry(state.pet)?.id || 'cat', bond = state.petBonds?.[petId];
  const scene = new Scene(engine);
  const instrumentation = new SceneInstrumentation(scene);
  const drawCalls = instrumentation.drawCallsCounter;
  scene.useRightHandedSystem = true;
  scene.clearColor = Color4.FromHexString(`${SKY[state.theme] || SKY.day}FF`);
  scene.skipPointerMovePicking = true;
  const loadingCamera = new FreeCamera('wilds-loading-camera', new Vector3(0, 2.2, 6.5), scene);
  loadingCamera.setTarget(new Vector3(0, 1.2, 0));
  const atmosphere = wildsAtmosphere(state.theme);
  const fill = new HemisphericLight('wilds-sky-light', Vector3.Up(), scene);
  fill.intensity = .62;
  fill.diffuse = Color3.FromHexString(atmosphere.skyAmbient);
  fill.groundColor = Color3.FromHexString(atmosphere.groundAmbient);
  const sun = new DirectionalLight('wilds-sun', Vector3.FromArray(atmosphere.sun).scaleInPlace(-1), scene);
  sun.intensity = state.theme === 'rain' ? .35 : 1.1;
  sun.diffuse = Color3.FromHexString(atmosphere.sunColor);
  const bounce = new DirectionalLight('wilds-sky-bounce', new Vector3(-.65, -.45, -.75), scene);
  bounce.intensity = state.theme === 'rain' ? .32 : .48;
  bounce.diffuse = Color3.FromHexString('#bed6e3');
  const still = host.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const abort = new AbortController();
  const input = dependencies.createInput(canvas);
  const hud = dependencies.createHud(canvas.parentElement, { petName: bond?.name });
  let world, avatar, combatModels, cameraControl, player, combat, failure = null, loaded = false;
  let phase = 'suspended', renderCount = 0, readyFrames = 0, previousAt = null, elapsedMs = 0, deltaMs = 0, at = now();
  let cameraYaw = 0, cameraPitch = 0, events = [], eventHistory = [];

  const worldPromise = Promise.resolve().then(() => dependencies.createWorld(scene, { theme: state.theme, still, signal: abort.signal }));
  const initialization = Promise.allSettled([
    worldPromise,
    Promise.resolve().then(() => dependencies.loadAvatar(scene, { appearance: state.avatar })),
    worldPromise.then(world => dependencies.createCombatModels(scene, { petId, ribbon: bond?.ribbon || 0, createPet: createPetModel, arena: WARDEN_ARENA, surfaceAt: world.surfaceAt, still, signal: abort.signal })),
  ]).then(results => {
    const rejected = results.find(result => result.status === 'rejected');
    if (phase === 'disposed' || rejected) {
      for (const result of results) if (result.status === 'fulfilled') result.value.dispose();
      if (rejected && phase !== 'disposed') failure = rejected.reason?.message || String(rejected.reason);
      return;
    }
    [world, avatar, combatModels] = results.map(result => result.value);
    const arena = { ...WARDEN_ARENA, center: { ...WARDEN_ARENA.center, y: world.surfaceAt(WARDEN_ARENA.center.x, WARDEN_ARENA.center.z)?.height ?? WARDEN_ARENA.center.y } };
    combat = createCombatState({ player: createMovementState({ position: world.spawn, yaw: world.spawn.yaw }), progress: state.wilds, petId, bondIndex: bondLevel(bond).index, arena });
    combat.pet.position.y = world.surfaceAt(combat.pet.position.x, combat.pet.position.z)?.height ?? world.spawn.y;
    player = combat.player;
    cameraControl = dependencies.createCamera(scene, canvas, { world, still });
    cameraControl.setPose({ yaw: world.spawn.yaw || 0 });
    previousAt = null;
    deltaMs = 0;
    world.update({ position: player.position, deltaMs, elapsedMs });
    updateActors({});
    scene.activeCamera = cameraControl.camera;
    loadingCamera.dispose();
    loaded = true;
  }).catch(error => {
    failure = error.message;
    loaded = false;
    cameraControl?.dispose();
    avatar?.dispose();
    combatModels?.dispose();
    world?.dispose();
    cameraControl = avatar = combatModels = world = null;
  });

  function updateActors(frameInput) {
    avatar.root.position.set(player.position.x, player.position.y, player.position.z);
    avatar.update({ action: player.action, actionTimeMs: player.actionTimeMs, mantleAdvance: player.mantleAdvance, yaw: player.yaw, speed: player.speed, deltaMs, elapsedMs, grounded: player.grounded });
    combatModels.update(combat);
    const lockTarget = combat.targetId === combat.boss.id ? combat.boss : null;
    ({ cameraYaw, cameraPitch } = cameraControl.update(player, frameInput, deltaMs, lockTarget));
    let targetScreen = null;
    if (lockTarget) {
      const projection = Vector3.Project(new Vector3(lockTarget.position.x, lockTarget.position.y + 2.7, lockTarget.position.z), Matrix.IdentityReadOnly, cameraControl.camera.getTransformationMatrix(), cameraControl.camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
      targetScreen = { x: projection.x / engine.getRenderWidth() * 100, y: projection.y / engine.getRenderHeight() * 100, visible: projection.z > 0 && projection.z < 1 && projection.x >= 0 && projection.x <= engine.getRenderWidth() && projection.y >= 0 && projection.y <= engine.getRenderHeight() };
    }
    hud.update({ player, combat, events, elapsedMs, world: world.diagnostics(), targetScreen });
  }

  function render() {
    if (phase !== 'running' || owner.hidden) return;
    at = now();
    deltaMs = previousAt === null ? 0 : Math.max(0, Math.min(100, at - previousAt));
    previousAt = at;
    elapsedMs += deltaMs;
    if (loaded) {
      world.refreshObstacles?.(player.position);
      const frameInput = { ...(deltaMs > 0 ? input.read() : {}), cameraYaw };
      if (deltaMs > 0) {
        const result = stepCombat(combat, frameInput, world, deltaMs, elapsedMs);
        combat = result.state;
        player = combat.player;
        events = result.events.map(event => ({ ...event, at: event.at ?? elapsedMs }));
        if (events.length) eventHistory = [...eventHistory, ...events].slice(-40);
        for (const event of events) {
          if (event.type !== 'progress-changed') continue;
          state.wilds = structuredClone(event.progress);
          onProgress?.(state.wilds, event);
        }
      }
      world.update({ position: player.position, deltaMs, elapsedMs });
      updateActors(frameInput);
    }
    scene.render();
    renderCount++;
    if (loaded) readyFrames++;
  }

  function visibility() {
    if (phase === 'disposed') return;
    const next = owner.hidden ? 'suspended' : 'running';
    if (phase === next) return;
    phase = next;
    previousAt = null;
    deltaMs = 0;
    if (phase === 'running') engine.runRenderLoop(render);
    else engine.stopRenderLoop(render);
  }

  function resize() {
    if (phase !== 'disposed') engine.resize();
  }

  const observer = new host.ResizeObserver(resize);
  observer.observe(canvas.parentElement);
  host.addEventListener('resize', resize);
  owner.addEventListener('visibilitychange', visibility);
  visibility();

  return {
    initialization,
    ready: () => phase !== 'disposed' && loaded && readyFrames > 0 && scene.isReady(),
    place({ position, yaw = player?.yaw || 0, stamina, appearance, camera } = {}) {
      if (!loaded || phase === 'disposed') return false;
      const next = position || player.position;
      const surface = world.surfaceAt(next.x, next.z);
      if (!surface) return false;
      player = { ...player, ...createMovementState({ position: { x: next.x, y: next.y ?? surface.height, z: next.z }, yaw, stamina: stamina ?? player.stamina, maxStamina: player.maxStamina }) };
      const petPosition = { x: next.x + 1.2, y: surface.height, z: next.z + .8 };
      petPosition.y = world.surfaceAt(petPosition.x, petPosition.z)?.height ?? surface.height;
      combat = { ...combat, player, playerAction: null, targetId: null, pet: { ...combat.pet, position: petPosition, targetId: null, mode: combat.pet.health > 0 ? 'follow' : 'knockout', action: combat.pet.health > 0 ? 'idle' : 'knockout', actionStartedAt: elapsedMs } };
      events = [];
      if (appearance) avatar.setAppearance(appearance);
      avatar.reset();
      if (camera) cameraControl.setPose(camera);
      deltaMs = 0;
      world.update({ position: player.position, deltaMs, elapsedMs });
      updateActors({});
      return true;
    },
    diagnostics: () => ({ engine, scene, camera: cameraControl?.camera || loadingCamera, phase, failure, loaded, player, combat, events, eventHistory, combatModels: combatModels?.diagnostics(), world: world?.diagnostics(), avatar: avatar?.diagnostics(), cameraState: cameraControl?.diagnostics(), cameraYaw, cameraPitch, renderCount, now: at, elapsedMs, deltaMs, drawCalls: drawCalls.current, pixelRatio: 1 / engine.getHardwareScalingLevel() }),
    dispose() {
      if (phase === 'disposed') return;
      phase = 'disposed';
      abort.abort();
      observer.disconnect();
      host.removeEventListener('resize', resize);
      owner.removeEventListener('visibilitychange', visibility);
      engine.stopRenderLoop(render);
      input.dispose();
      hud.dispose();
      cameraControl?.dispose();
      avatar?.dispose();
      combatModels?.dispose();
      world?.dispose();
      instrumentation.dispose();
      scene.dispose();
      engine.dispose();
      canvas.remove();
    },
  };
}
