import { AnimationMixer, Group, LoopOnce, LoopRepeat } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { wildsPaint } from './materials.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const loadActorAsset = path => new GLTFLoader().loadAsync(path);

export function createAnimatedActor(parent, gltf, { name, required = [], paint = () => ({}) } = {}) {
  const root = new Group(); root.name = name || 'wilds-actor'; root.add(gltf.scene); parent.add(root);
  const clips = new Map(gltf.animations.map(clip => [clip.name, clip])), actions = new Map(), materials = new Map(), nodes = new Map(), boneSet = new Set();
  const missing = required.filter(clip => !clips.has(clip));
  if (missing.length) { throw new Error(`${root.name} is missing clips: ${missing.join(', ')}`); }
  let skinnedMeshes = 0;
  gltf.scene.traverse(object => {
    if (object.name) nodes.set(object.name, object);
    if (!object.isMesh) return;
    object.castShadow = true; object.receiveShadow = true;
    if (object.isSkinnedMesh) { skinnedMeshes++; object.frustumCulled = false; for (const bone of object.skeleton.bones) boneSet.add(bone); }
    const replace = source => {
      if (!materials.has(source)) {
        const options = paint(source, object), material = wildsPaint(options.color ?? source.color, { vertexColors: source.vertexColors || Boolean(object.geometry.getAttribute('color')), roughness: source.roughness ?? .9, metalness: source.metalness ?? 0, emissive: source.emissive, emissiveIntensity: source.emissiveIntensity ?? 1, side: source.side, transparent: source.transparent, opacity: source.opacity, depthWrite: source.depthWrite, ...options });
        material.name = source.name; materials.set(source, material);
      }
      return materials.get(source);
    };
    object.material = Array.isArray(object.material) ? object.material.map(replace) : replace(object.material);
  });
  for (const source of materials.keys()) source.dispose();
  const mixer = new AnimationMixer(gltf.scene);
  for (const [name, clip] of clips) {
    const action = mixer.clipAction(clip); action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play(); action.setEffectiveWeight(0); actions.set(name, action);
  }
  let selected = null, key = null, clock = 0, blendClock = 0, initialized = false, disposed = false, blendFrom = new Map(), weights = new Map(), overlayClip = null, overlayTime = 0, overlayWeight = 0;
  function sample({ clip, token = clip, time, loop = false, rate = 1, overlay = null }, dt) {
    if (disposed) return;
    if (!actions.has(clip)) throw new Error(`${root.name} has no clip ${clip}`);
    dt = Number.isFinite(dt) ? clamp(dt, 0, .05) : 0;
    if (selected !== clip || key !== token) {
      const changedClip = selected !== clip;
      if (changedClip) { blendFrom = new Map(weights); blendClock = initialized ? 0 : .12; }
      selected = clip; key = token; clock = Number.isFinite(time) && !loop ? Math.max(0, time) : 0;
    }
    if (dt > 0) {
      blendClock = Math.min(.12, blendClock + dt);
      clock = Number.isFinite(time) && !loop ? Math.max(0, time) : clock + dt * Math.max(0, rate);
    }
    if (dt > 0 || !initialized) { overlayClip = overlay?.clip ?? null; overlayTime = overlay?.time ?? 0; overlayWeight = overlay ? clamp(overlay.weight, 0, 1) : 0; }
    const fraction = blendClock / .12;
    for (const [name, action] of actions) {
      const weight = (blendFrom.get(name) || 0) * (1 - fraction) + (name === selected ? fraction : 0);
      weights.set(name, weight);
      action.enabled = true; action.paused = false;
      if (name === selected) { action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1); action.time = loop ? clock % clips.get(name).duration : Math.min(clock, clips.get(name).duration); }
      if (name === overlayClip) action.time = clamp(overlayTime, 0, clips.get(name).duration);
      action.setEffectiveWeight(name === overlayClip ? overlayWeight : weight * (1 - overlayWeight));
    }
    initialized = true; mixer.update(0); root.updateMatrixWorld(true);
  }
  function diagnostics() {
    const visible = []; root.traverse(object => { if (object.isMesh && object.visible) visible.push(object.name); });
    return { clip: selected, time: actions.get(selected)?.time ?? 0, token: key, skinnedMeshes, bones: boneSet.size, playing: initialized && !disposed, disposed, visible, weights: Object.fromEntries(Array.from(actions, ([name, action]) => [name, action.getEffectiveWeight()]).filter(([, weight]) => weight > 0)) };
  }
  function dispose() {
    if (disposed) return;
    disposed = true; mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene); clips.clear(); actions.clear(); materials.clear(); nodes.clear(); boneSet.clear(); blendFrom.clear(); weights.clear();
  }
  return { root, sample, dispose, diagnostics, node: name => nodes.get(name), clip: name => clips.get(name), materials: () => materials.values() };
}
