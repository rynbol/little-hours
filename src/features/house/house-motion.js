import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';

// Room-scale feedback, layered over the renderer's existing floor opening.
// No mesh/material allocation or permanent layout/camera changes.
const timings = { arrive: 850, select: 680, design: 760, build: 1150 };
export function roomMotionPose(kind, progress) {
  const t = Math.max(0, Math.min(1, progress));
  if (t === 1) return { lift: 0, scale: 1 };
  if (kind === 'select') return { lift: .28 * Math.sin(Math.PI * t) ** 2, scale: 1 };
  // A spring that lands exactly, with a small, bounded overshoot.
  const spring = 1 - Math.exp(-7 * t) * Math.cos(11 * t);
  const strength = kind === 'build' ? .34 : kind === 'arrive' ? .16 : .22;
  return { lift: .16 * Math.sin(Math.PI * t), scale: 1 - strength * (1 - spring) };
}

export function createHouseMotion(origins) {
  let model = null;
  const active = new Map();
  const applied = new Map();
  function matrices() {
    if (!model) return;
    if (model.refresh) { model.refresh(); return; }
    for (const level of Object.values(model.levels)) level.computeWorldMatrix(true);
    for (const mesh of model.meshes) {
      mesh.unfreezeWorldMatrix(); mesh.computeWorldMatrix(true); mesh.freezeWorldMatrix();
    }
  }
  function restore() {
    for (const [id, lift] of applied) {
      const level = model?.levels[id];
      if (level) { level.position.y -= lift; level.scaling.setAll(1); }
    }
    if (applied.size) matrices();
    applied.clear();
  }
  function stop() { restore(); active.clear(); }
  return {
    bind(next) {
      stop(); model = next;
      for (const [id, origin] of Object.entries(origins)) model.levels[id]?.setPivotPoint(new Vector3(...origin));
    },
    trigger(id, kind, now, delay = 0) {
      if (model?.levels[id]) active.set(id, { kind, start: now + delay, duration: timings[kind] || timings.select });
    },
    restore,
    update(now, reduced = false) {
      if (reduced) { stop(); return false; }
      for (const [id, effect] of active) {
        const t = (now - effect.start) / effect.duration;
        if (t >= 1) { active.delete(id); continue; }
        const level = model.levels[id], pose = roomMotionPose(effect.kind, t);
        level.position.y += pose.lift; level.scaling.setAll(pose.scale);
        applied.set(id, pose.lift);
      }
      if (applied.size) matrices();
      return active.size > 0;
    },
    stop,
    get activeCount() { return active.size; },
    dispose() { stop(); model = null; },
  };
}
