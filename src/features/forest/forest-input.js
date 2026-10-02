export const FOREST_INPUT = Object.freeze({ turnRate: 1.9, drag: 0.0042, stick: 44 });

const KEYS = Object.freeze({
  KeyW: ['forward', 1], ArrowUp: ['forward', 1], KeyS: ['forward', -1], ArrowDown: ['forward', -1],
  KeyD: ['strafe', 1], KeyA: ['strafe', -1], ArrowRight: ['turn', 1], ArrowLeft: ['turn', -1],
});

export function createForestInput() {
  const held = new Set(), stick = { forward: 0, strafe: 0 }, frame = { forward: 0, strafe: 0, turn: 0, look: 0 };
  let turned = 0, looked = 0;
  return {
    handles: code => code in KEYS,
    key(code, down) { if (code in KEYS) { if (down) held.add(code); else held.delete(code); } },
    drag(dx, dy) { turned += dx * FOREST_INPUT.drag; looked -= dy * FOREST_INPUT.drag; },
    stick(x, y) { stick.strafe = Math.max(-1, Math.min(1, x)); stick.forward = Math.max(-1, Math.min(1, -y)); },
    release() { held.clear(); stick.forward = 0; stick.strafe = 0; },
    get moving() { return held.size > 0 || stick.forward !== 0 || stick.strafe !== 0 || turned !== 0 || looked !== 0; },
    read(seconds) {
      frame.forward = stick.forward; frame.strafe = stick.strafe; frame.turn = turned; frame.look = looked;
      for (const code of held) { const [axis, sign] = KEYS[code]; frame[axis] += axis === 'turn' ? sign * FOREST_INPUT.turnRate * seconds : sign; }
      frame.forward = Math.max(-1, Math.min(1, frame.forward)); frame.strafe = Math.max(-1, Math.min(1, frame.strafe));
      turned = 0; looked = 0;
      return frame;
    },
  };
}
