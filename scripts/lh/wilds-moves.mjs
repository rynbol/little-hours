export const WILDS = `window.__littleHours.wilds.diagnostics()`;
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const DRAG_TURN = 0.006;

export async function hold(app, key, code, ms) { await app.down(key, code); await sleep(ms); await app.up(key, code); }
export async function until(app, expression, what, timeout = 4000) { return app.waitFor(`(() => { const d = ${WILDS}; return (${expression}) ? d : null; })()`, { what, timeout }); }

export async function face(app, yaw, pitch = null) {
  for (let i = 0; i < 8; i++) {
    const { camera } = await app.js(WILDS), off = Math.atan2(Math.sin(yaw - camera.yaw), Math.cos(yaw - camera.yaw)), tip = pitch === null ? 0 : pitch - camera.pitch;
    if (Math.abs(off) < 0.05 && Math.abs(tip) < 0.05) return;
    const px = Math.max(-560, Math.min(560, -off / DRAG_TURN)), py = Math.max(-380, Math.min(380, tip / DRAG_TURN));
    await app.drag({ x: 720, y: 450 }, { x: 720 + px + (px && Math.sign(px) * 7), y: 450 + py + (py && Math.sign(py) * 7) }, 18);
    await sleep(120);
  }
}

export async function walkTo(app, x, z, near = 0.9) {
  for (let i = 0; i < 14; i++) {
    const d = await app.js(WILDS), dx = x - d.player.x, dz = z - d.player.z, far = Math.hypot(dx, dz);
    if (far < near) return d;
    await face(app, Math.atan2(dx, dz));
    await hold(app, 'w', 'KeyW', Math.max(120, Math.min(2000, far / 4.4 * 800)));
    await sleep(200);
  }
  return app.js(WILDS);
}

const STEER_KEYS = Object.freeze([['w', 'KeyW', 1, 0], ['s', 'KeyS', -1, 0], ['d', 'KeyD', 0, 1], ['a', 'KeyA', 0, -1]]);

export function steering(app) {
  const held = new Set();
  async function hold(wanted) {
    for (const [key, code] of STEER_KEYS) {
      if (wanted.has(key) && !held.has(key)) { held.add(key); await app.down(key, code); }
      else if (!wanted.has(key) && held.has(key)) { held.delete(key); await app.up(key, code); }
    }
  }
  return {
    toward(yaw, cameraYaw) {
      const turn = yaw - cameraYaw, forward = Math.cos(turn), right = -Math.sin(turn);
      return hold(new Set(STEER_KEYS.filter(([, , f, r]) => f * forward + r * right > 0.38).map(([key]) => key)));
    },
    stop: () => hold(new Set()),
  };
}
