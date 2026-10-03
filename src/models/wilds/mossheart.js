import { AnimationMixer, Group, LoopOnce, LoopRepeat, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BOSS_ATTACKS } from '../../core/wilds/encounter.js';
import { normalAt } from '../../core/world-terrain.js';
import { wildsPaint } from './materials.js';

export const MOSSHEART_CLIPS = Object.freeze(['idle', 'walk', 'trot', 'charge', 'sweep', 'stomp', 'roots', 'hit', 'stunned', 'phase', 'defeat']);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const GAIT_SPEED = Object.freeze({ walk: 1, trot: 2.4 });
const BLEND_TIME = .12;

export async function loadMossheart(parent, options = {}) {
  const gltf = await new GLTFLoader().loadAsync('/wilds/mossheart.glb');
  return createMossheart(parent, gltf, options);
}

export function createMossheart(parent, gltf, { world = null } = {}) {
  const root = new Group(); root.name = 'mossheart'; root.add(gltf.scene); parent.add(root);
  const up = new Vector3(0, 1, 0), terrainNormal = new Vector3(), terrainTilt = new Quaternion(), yaw = new Quaternion();
  const mixer = new AnimationMixer(gltf.scene), clips = new Map(gltf.animations.map(clip => [clip.name, clip])), actions = new Map(), painted = new Map();
  const missing = MOSSHEART_CLIPS.filter(name => !clips.has(name));
  if (missing.length) { parent.remove(root); throw new Error(`Mossheart is missing clips: ${missing.join(', ')}`); }
  let skinnedMeshes = 0, bones = 0;
  const boneSet = new Set();
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true; object.receiveShadow = true;
    if (object.isSkinnedMesh) { skinnedMeshes++; object.skeleton.bones.forEach(bone => boneSet.add(bone)); object.frustumCulled = false; }
    const replace = source => {
      if (!painted.has(source)) {
        const material = wildsPaint(source.color, { surface: source.name === 'Heartwood' ? 'bark' : 'plain', vertexColors: source.vertexColors || Boolean(object.geometry.getAttribute('color')), roughness: source.roughness ?? .9, metalness: source.metalness ?? 0, emissive: source.emissive, emissiveIntensity: source.emissiveIntensity ?? 1, side: source.side, transparent: source.transparent, opacity: source.opacity, depthWrite: source.depthWrite });
        const compile = material.onBeforeCompile, cacheKey = material.customProgramCacheKey(), dissolve = { value: 0 };
        material.userData.stagDissolve = dissolve;
        material.onBeforeCompile = shader => {
          compile(shader); shader.uniforms.wildsStagDissolve = dissolve;
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float wildsStagDissolve;').replace('#include <opaque_fragment>', 'if (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) < wildsStagDissolve) discard;\n#include <opaque_fragment>');
        };
        material.customProgramCacheKey = () => `${cacheKey}-stag-dissolve`;
        material.name = source.name; painted.set(source, material);
      }
      return painted.get(source);
    };
    object.material = Array.isArray(object.material) ? object.material.map(replace) : replace(object.material);
  });
  bones = boneSet.size;
  for (const material of painted.keys()) material.dispose();
  for (const [name, clip] of clips) {
    const action = mixer.clipAction(clip);
    action.setLoop(['idle', 'walk', 'trot'].includes(name) ? LoopRepeat : LoopOnce, Infinity);
    action.clampWhenFinished = true; action.play(); action.setEffectiveWeight(name === 'idle' ? 1 : 0);
    actions.set(name, action);
  }
  let selected = 'idle', serial = -1, previousX = 0, previousZ = 0, hasPrevious = false, speed = 0, gaitTime = 0, blendTime = BLEND_TIME, blendFrom = new Map([['idle', 1]]), weights = new Map([['idle', 1]]), hitTime = Infinity, lastImpact = 0, disposed = false;
  mixer.update(0);
  function update(encounter, sim, dt, reducedMotion = false) {
    if (disposed) return;
    dt = Number.isFinite(dt) ? clamp(dt, 0, .05) : 0;
    const boss = encounter.boss, domain = boss.action, row = BOSS_ATTACKS[domain.kind];
    root.visible = domain.kind !== 'defeat' || domain.elapsed < domain.duration;
    const dissolve = domain.kind === 'defeat' ? clamp((domain.elapsed - 1.5) / 1.5, 0, 1) : 0;
    for (const material of painted.values()) material.userData.stagDissolve.value = dissolve;
    root.position.set(boss.x, Number.isFinite(boss.y) ? boss.y : world?.floorAt(boss.x, boss.z) ?? 0, boss.z);
    terrainNormal.fromArray(normalAt(boss.x, boss.z)); terrainTilt.setFromUnitVectors(up, terrainNormal); yaw.setFromAxisAngle(up, -boss.heading); root.quaternion.copy(terrainTilt).multiply(yaw);
    if (dt > 0) speed = hasPrevious ? Math.hypot(boss.x - previousX, boss.z - previousZ) / dt : 0;
    previousX = boss.x; previousZ = boss.z; hasPrevious = true;
    const locomotion = domain.kind === 'idle', next = locomotion ? speed > 2.2 ? 'trot' : speed > .08 ? 'walk' : 'idle' : actions.has(domain.kind) ? domain.kind : 'idle';
    if (next !== selected) { blendFrom = new Map(weights); blendTime = 0; selected = next; }
    if (domain.serial < serial) { lastImpact = 0; hitTime = Infinity; }
    serial = domain.serial;
    if (dt > 0) {
      blendTime = Math.min(BLEND_TIME, blendTime + dt);
      if (locomotion) gaitTime += dt * (selected === 'idle' ? 1 : speed / GAIT_SPEED[selected]);
      hitTime += dt;
    }
    const fraction = blendTime / BLEND_TIME;
    for (const name of actions.keys()) weights.set(name, (blendFrom.get(name) || 0) * (1 - fraction) + (name === selected ? fraction : 0));
    let impact = 0;
    for (const event of encounter.impacts || []) if (event.kind === 'bossHit' || event.kind === 'petAttack') impact = Math.max(impact, event.serial);
    const canFlinch = !reducedMotion && (locomotion || row && domain.elapsed >= row.telegraph + row.active);
    if (!canFlinch) hitTime = Infinity;
    if (impact > lastImpact) {
      lastImpact = impact;
      if (canFlinch) hitTime = 0;
    }
    const hitDuration = clips.get('hit').duration, hitWeight = reducedMotion || hitTime >= hitDuration ? 0 : Math.sin(Math.PI * hitTime / hitDuration) * .65;
    for (const [name, action] of actions) {
      action.enabled = true; action.paused = false;
      if (name === selected) action.time = locomotion ? gaitTime % clips.get(name).duration : clamp(domain.elapsed, 0, clips.get(name).duration);
      if (name === 'hit') action.time = clamp(hitTime, 0, hitDuration);
      action.setEffectiveWeight(name === 'hit' ? hitWeight : (weights.get(name) || 0) * (1 - hitWeight));
    }
    mixer.update(0); root.updateMatrixWorld(true);
  }
  function diagnostics() {
    return { clip: selected, time: actions.get(selected)?.time ?? 0, serial, speed, skinnedMeshes, bones, visible: root.visible, playing: !disposed && Array.from(actions.values()).some(action => action.getEffectiveWeight() > 0), disposed, weights: Object.fromEntries(Array.from(actions, ([name, action]) => [name, action.getEffectiveWeight()])) };
  }
  function dispose() {
    if (disposed) return;
    disposed = true; mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene); actions.clear(); clips.clear(); painted.clear(); boneSet.clear(); weights.clear(); blendFrom.clear(); hasPrevious = false;
  }
  return { root, update, dispose, diagnostics };
}
