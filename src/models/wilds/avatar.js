import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/index.js';
import { AVATAR_OPTIONS, avatarPaint, normalizeAvatarAppearance } from '../../core/avatar.js';

const LOOPING = new Set(['idle', 'walk', 'run', 'fall', 'climb']);
const SPEEDS = { walk: 4.8, run: 8.5, climb: 2 };
const CLIPS = ['idle', 'walk', 'run', 'jump', 'fall', 'land', 'climb', 'stop', 'stop-back', 'stop-right', 'stop-right-back', 'mantle', 'mantle-wide'];
const TRANSITIONS = { jump: 40, land: 100 / 3, stop: 80 };
const PAINTS = {
  skin: ['skin', 'color'], hair: ['hair', 'color'], top: ['top', 'color'],
  'top-shade': ['top', 'shade'], 'top-trim': ['top', 'trim'],
  bottom: ['bottom', 'color'], 'bottom-trim': ['bottom', 'trim'],
};

export function wildsAvatarClip({ action, speed = 0, grounded = true, mantleAdvance = 0 } = {}) {
  if (action === 'mantle') return mantleAdvance > .6 ? 'mantle-wide' : 'mantle';
  if (CLIPS.includes(action)) return action;
  if (action === 'sprint') return 'run';
  if (!grounded) return 'fall';
  return speed > 5.5 ? 'run' : speed > .05 ? 'walk' : 'idle';
}

export async function loadWildsAvatar(scene, { appearance, parent = null, assetSource } = {}) {
  let container;
  let root;
  try {
    container = await LoadAssetContainerAsync(assetSource ?? `${import.meta.env?.BASE_URL ?? '/'}wilds/avatar.glb`, scene, {
      pluginExtension: '.glb', pluginOptions: { gltf: { animationStartMode: 0 } },
    });
    if (scene.isDisposed) throw new Error('The Wilds scene was disposed while loading its avatar');
    const groups = new Map(container.animationGroups.map(group => [group.name, group]));
    const missing = CLIPS.filter(name => !groups.has(name));
    if (missing.length) throw new Error(`The Wilds avatar is missing clips: ${missing.join(', ')}`);
    root = new TransformNode('wilds-avatar', scene);
    root.parent = parent;
    container.addAllToScene();
    for (const node of container.rootNodes) node.parent = root;
    for (const mesh of container.meshes) {
      mesh.isPickable = false;
      mesh.receiveShadows = true;
    }
    const variantNames = new Set(['style', 'outfit', 'bottomStyle', 'accessory'].flatMap(part => AVATAR_OPTIONS[part].map(option => `variant.${part}.${option.id}`)));
    const variants = [...new Set([...container.meshes, ...container.transformNodes])].filter(node => variantNames.has(node.name));
    let selectedAppearance;
    function setAppearance(next) {
      selectedAppearance = normalizeAvatarAppearance(next);
      for (const node of variants) {
        const [, part, option] = node.name.split('.');
        node.setEnabled(selectedAppearance[part] === option);
      }
      for (const material of container.materials) {
        const paint = PAINTS[material.name];
        if (paint && material.albedoColor) {
          const [part, tone] = paint;
          material.albedoColor.copyFrom(Color3.FromHexString(avatarPaint(selectedAppearance, part)[tone]).toLinearSpace());
        }
      }
      return { ...selectedAppearance };
    }
    setAppearance(appearance);
    let disposed = false;
    let current = 'idle';
    let transitionMs = 120;
    let transitionDurationMs = 120;
    let actionElapsedMs = 0;
    let facingYaw = null;
    let plantedEntry = false;
    let plantedSide = 'L';
    let preserveContact = true;
    let lowerTransitionMs = 120;
    let jumpContact = null;
    let targetWeights = new Map([['idle', 1]]);
    const feet = ['L', 'R'].map(side => ({ side, node: scene.getTransformNodeByName(`foot.${side}`) }));
    function plantedFoot() {
      root.computeWorldMatrix(true);
      const inverse = root.getWorldMatrix().clone().invert();
      return feet.map(({ side, node }) => {
        node.computeWorldMatrix(true);
        return { side, position: Vector3.TransformCoordinates(node.getAbsolutePosition(), inverse) };
      }).sort((a, b) => a.position.y - b.position.y)[0];
    }
    const tracks = new Map(CLIPS.map(name => {
      const group = groups.get(name);
      group.start(true, 1);
      group.pause();
      group.setWeightForAllAnimatables(name === 'idle' ? 1 : 0);
      const lowerBody = group.animatables.filter(animation => animation.target.name === 'pelvis' || /^(thigh|shin|foot|skirt)\./.test(animation.target.name));
      return [name, { group, lowerBody, fromLowerWeights: lowerBody.map(animation => animation.weight), duration: durationMs(group), timeMs: 0, weight: name === 'idle' ? 1 : 0, fromWeight: 0, speedRatio: 1 }];
    }));
    groups.get('idle').goToFrame(groups.get('idle').from);
    function update(input = {}) {
      if (disposed) return;
      const deltaMs = Number.isFinite(input.deltaMs) ? Math.max(0, input.deltaMs) : 0;
      if (Number.isFinite(input.yaw)) {
        if (facingYaw === null) facingYaw = input.yaw;
        const difference = Math.atan2(Math.sin(input.yaw - facingYaw), Math.cos(input.yaw - facingYaw));
        const turn = difference * (1 - Math.exp(-deltaMs / 90));
        const limit = deltaMs * .01;
        facingYaw += Math.max(-limit, Math.min(limit, turn));
        root.rotation.y = facingYaw;
      }
      let next = wildsAvatarClip(input);
      if (next === 'idle' && (current === 'walk' || current === 'run' || current === 'stop' && actionElapsedMs < tracks.get('stop').duration)) next = 'stop';
      if (next !== current) {
        const previous = tracks.get(current);
        const incoming = tracks.get(next);
        jumpContact = null;
        if (next === 'jump' && input.grounded) {
          const { side } = plantedFoot();
          jumpContact = { side, weights: new Map([...tracks].map(([name, track]) => [name, track.lowerBody.find(animation => animation.target.name === `foot.${side}`).weight])) };
        }
        const bothMoving = SPEEDS[current] && SPEEDS[next] && current !== 'climb' && next !== 'climb';
        plantedEntry = (next === 'walk' || next === 'run') && !bothMoving;
        preserveContact = true;
        lowerTransitionMs = 120;
        targetWeights = new Map([[next, 1]]);
        incoming.timeMs = bothMoving ? previous.timeMs / previous.duration * incoming.duration : 0;
        if (plantedEntry) {
          const { side, position } = plantedFoot();
          plantedSide = side;
          const stance = next === 'walk' ? .24 : .20;
          const contactPhase = Math.max(0, Math.min(stance, stance / 2 + position.z / (SPEEDS[next] * incoming.duration / 1000)));
          incoming.timeMs = incoming.duration * (contactPhase + (side === 'R' ? .5 : 0));
        }
        if (next === 'stop') {
          const { side, position } = plantedFoot();
          plantedSide = side;
          preserveContact = position.y <= .125;
          lowerTransitionMs = preserveContact ? 20 : 80;
          const frontWeight = Math.max(0, Math.min(1, (.38 - position.z) / .76));
          const front = side === 'L' ? 'stop' : 'stop-right';
          const back = side === 'L' ? 'stop-back' : 'stop-right-back';
          targetWeights = new Map([[front, frontWeight], [back, 1 - frontWeight]]);
          for (const name of targetWeights.keys()) tracks.get(name).timeMs = 0;
          plantedEntry = true;
        }
        for (const track of tracks.values()) {
          track.fromWeight = track.weight;
          track.fromLowerWeights = track.lowerBody.map(animation => animation.weight);
        }
        current = next;
        transitionMs = 0;
        transitionDurationMs = TRANSITIONS[next] ?? 120;
        actionElapsedMs = 0;
      }
      const synchronized = (next === input.action || input.action === 'mantle' && next === 'mantle-wide') && Number.isFinite(input.actionTimeMs);
      actionElapsedMs = synchronized ? Math.max(0, input.actionTimeMs) : actionElapsedMs + deltaMs;
      transitionMs = Math.min(transitionDurationMs, transitionMs + deltaMs);
      const blend = transitionMs / transitionDurationMs;
      const jumpContactWeight = jumpContact ? 1 - Math.max(0, Math.min(1, (actionElapsedMs - 1000 / 12) / 40)) : 0;
      const active = [];
      for (const [name, track] of tracks) {
        const targetWeight = targetWeights.get(name) ?? 0;
        track.weight = track.fromWeight * (1 - blend) + targetWeight * blend;
        track.group.setWeightForAllAnimatables(track.weight);
        if (plantedEntry) {
          const lowerBlend = Math.min(1, transitionMs / lowerTransitionMs);
          for (const [index, animation] of track.lowerBody.entries()) animation.weight = preserveContact && animation.target.name === `foot.${plantedSide}` ? targetWeight : track.fromLowerWeights[index] * (1 - lowerBlend) + targetWeight * lowerBlend;
        }
        const heldContactWeight = (jumpContact?.weights.get(name) ?? 0) * jumpContactWeight;
        if (jumpContact) for (const animation of track.lowerBody) {
          if (animation.target.name === `foot.${jumpContact.side}`) animation.weight = heldContactWeight + (name === current ? 1 - jumpContactWeight : 0);
        }
        if (track.weight <= 0 && heldContactWeight <= 0) continue;
        const speed = Number.isFinite(input.speed) ? Math.abs(input.speed) : SPEEDS[name];
        track.speedRatio = SPEEDS[name] ? speed / SPEEDS[name] : 1;
        track.timeMs = name === current && synchronized ? actionElapsedMs : track.timeMs + (jumpContactWeight > 0 && name !== current ? 0 : deltaMs * track.speedRatio);
        const duration = track.duration;
        const time = LOOPING.has(name) ? track.timeMs % duration : Math.min(track.timeMs, duration);
        track.frame = track.group.from + time / duration * (track.group.to - track.group.from);
        active.push(track);
      }
      for (const track of active) {
        for (const animation of track.group.animatables) if (animation.weight > 0) animation.goToFrame(track.frame, active.length > 1);
      }
    }
    function diagnostics() {
      const track = tracks.get(current);
      const cyclePhase = LOOPING.has(current) ? (track.timeMs % track.duration) / track.duration : Math.min(1, (current === 'stop' ? actionElapsedMs : track.timeMs) / track.duration);
      return {
        loaded: !disposed, action: current, actionElapsedMs, cyclePhase, facingYaw: root.rotation.y, appearance: { ...selectedAppearance },
        clips: [...groups.keys()], skeletons: container.skeletons.length,
        activeVariants: [...new Set(variants.filter(node => node.isEnabled()).map(node => node.name))].sort(),
        animation: [...tracks].filter(([, track]) => track.weight > 0).map(([name, track]) => ({ name, weight: track.weight, frame: track.frame ?? track.group.from, speedRatio: track.speedRatio })),
        vertices: container.meshes.filter(mesh => mesh.isEnabled()).reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0),
      };
    }
    function reset(action = 'idle') {
      if (disposed) return;
      current = wildsAvatarClip({ action });
      facingYaw = null;
      plantedEntry = false;
      jumpContact = null;
      targetWeights = new Map([[current, 1]]);
      actionElapsedMs = 0;
      transitionMs = 120;
      transitionDurationMs = 120;
      for (const [name, track] of tracks) {
        track.timeMs = 0;
        track.frame = track.group.from;
        track.speedRatio = 1;
        track.weight = name === current ? 1 : 0;
        track.fromWeight = track.weight;
        track.group.setWeightForAllAnimatables(track.weight);
      }
      groups.get(current).goToFrame(groups.get(current).from);
    }
    const sceneObserver = scene.onDisposeObservable.add(() => dispose());
    function dispose() {
      if (disposed) return;
      disposed = true;
      scene.onDisposeObservable.remove(sceneObserver);
      container.dispose();
      root.dispose();
    }
    return { root, update, setAppearance, reset, diagnostics, dispose };
  } catch (error) {
    container?.dispose();
    root?.dispose();
    throw error;
  }
}

function durationMs(group) {
  const fps = group.targetedAnimations[0].animation.framePerSecond;
  return (group.to - group.from) / fps * 1000;
}
