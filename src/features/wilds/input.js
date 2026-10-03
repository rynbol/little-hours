const MOVE = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const ACTIONS = { Space: 'jump', ControlLeft: 'dodge', ControlRight: 'dodge', KeyF: 'lock', KeyE: 'interact', KeyQ: 'skill', KeyM: 'mute' };
const PAD = { 0: 'jump', 1: 'dodge', 3: 'interact', 4: 'skill', 5: 'lock' };
const TAP_MS = 50, HOLD_MS = 320, DRAG_PX = 5, LOOK = .0046, PAD_LOOK = 2.6, DEAD = .18;

export function createInput(canvas, { now, onMute = () => {} }) {
  const held = new Set(), edges = new Set(), padBefore = [];
  let orbitX = 0, orbitY = 0, zoom = 0, press = null, steering = false, enabled = true;

  const own = event => enabled && (event.code in MOVE || event.code in ACTIONS || event.code.startsWith('Shift'));
  function keydown(event) {
    if (!own(event) || event.metaKey) return;
    event.preventDefault();
    if (!event.repeat && ACTIONS[event.code]) { if (ACTIONS[event.code] === 'mute') onMute(); else edges.add(ACTIONS[event.code]); }
    held.add(event.code);
  }
  const keyup = event => { held.delete(event.code); };
  function pointerdown(event) {
    if (!enabled) return;
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture?.(event.pointerId);
    if (event.button === 2) { edges.add('dodge'); return; }
    press = { at: now(), moved: 0, button: event.button, fired: event.button !== 0, charging: false };
  }
  function pointermove(event) {
    if (!press) return;
    press.moved += Math.abs(event.movementX) + Math.abs(event.movementY);
    if (press.moved > DRAG_PX || press.button !== 0) { orbitX += event.movementX * LOOK; orbitY += event.movementY * LOOK * .8; steering = true; }
  }
  function pointerup(event) {
    if (!press || event.button !== press.button) return;
    if (press.charging) edges.add('release');
    press = null; steering = false;
  }
  const wheel = event => { event.preventDefault(); zoom += Math.sign(event.deltaY) * Math.min(3, Math.abs(event.deltaY) / 60 || 1); };
  const blur = () => { held.clear(); press = null; steering = false; };
  const context = event => event.preventDefault();

  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', blur);
  canvas.addEventListener('pointerdown', pointerdown);
  canvas.addEventListener('pointermove', pointermove);
  canvas.addEventListener('pointerup', pointerup);
  canvas.addEventListener('pointercancel', blur);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('contextmenu', context);

  function readPad(dt) {
    const pad = navigator.getGamepads?.()?.find(candidate => candidate?.connected && candidate.mapping === 'standard');
    if (!pad) return null;
    const axis = i => (Math.abs(pad.axes[i] ?? 0) > DEAD ? pad.axes[i] : 0), down = i => Boolean(pad.buttons[i]?.pressed);
    for (const [index, action] of Object.entries(PAD)) { if (down(index) && !padBefore[index]) edges.add(action); }
    if (down(2) && !padBefore[2]) press = { at: now(), moved: 0, button: 'pad', fired: false, charging: false };
    if (!down(2) && padBefore[2] && press?.button === 'pad') { if (press.charging) edges.add('release'); press = null; }
    if (down(9) && !padBefore[9]) edges.add('menu');
    pad.buttons.forEach((button, i) => { padBefore[i] = button.pressed; });
    orbitX += axis(2) * PAD_LOOK * dt; orbitY += axis(3) * PAD_LOOK * .7 * dt;
    return { x: axis(0), z: -axis(1), sprint: down(7) || down(10) };
  }

  return {
    set enabled(value) { enabled = value; if (!value) blur(); },
    sample(cameraYaw, dt) {
      let mx = 0, mz = 0;
      for (const code of held) if (MOVE[code]) { mx += MOVE[code][0]; mz += MOVE[code][1]; }
      const pad = readPad(dt);
      if (pad && Math.hypot(pad.x, pad.z) > Math.hypot(mx, mz)) { mx = pad.x; mz = pad.z; }
      const length = Math.hypot(mx, mz);
      if (length > 1) { mx /= length; mz /= length; }
      const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
      let attack = null;
      if (press && !press.fired && (press.moved <= DRAG_PX || press.button === 'pad') && now() - press.at >= TAP_MS) { press.fired = true; attack = 'light'; }
      if (press?.fired && press.button !== 2 && press.button !== 1 && !press.charging && press.moved <= DRAG_PX * 2 && now() - press.at >= HOLD_MS) press.charging = true;
      const out = {
        x: mx * cos + mz * sin, z: -mx * sin + mz * cos, raw: { x: mx, z: mz },
        sprint: held.has('ShiftLeft') || held.has('ShiftRight') || Boolean(pad?.sprint),
        jump: edges.has('jump'), dodge: edges.has('dodge'), lock: edges.has('lock'), interact: edges.has('interact'), skill: edges.has('skill'), menu: edges.has('menu'),
        attack, charging: Boolean(press?.charging), release: edges.has('release'),
        orbit: { x: orbitX, y: orbitY }, zoom, steering: steering || Math.abs(orbitX) > 0,
      };
      edges.clear(); orbitX = 0; orbitY = 0; zoom = 0;
      return out;
    },
    dispose() {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur);
      canvas.removeEventListener('pointerdown', pointerdown);
      canvas.removeEventListener('pointermove', pointermove);
      canvas.removeEventListener('pointerup', pointerup);
      canvas.removeEventListener('pointercancel', blur);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('contextmenu', context);
    },
  };
}
