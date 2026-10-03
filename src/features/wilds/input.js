export const KEYS = Object.freeze({
  KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump', ControlLeft: 'dodge', ControlRight: 'dodge',
  KeyF: 'lock', KeyE: 'interact', KeyQ: 'pet', KeyR: 'whistle', KeyH: 'potion', KeyM: 'mute', Escape: 'pause',
});
export const PAD = Object.freeze({ 0: 'jump', 1: 'dodge', 2: 'attack', 3: 'pet', 4: 'whistle', 5: 'interact', 6: 'lock', 7: 'sprint', 10: 'sprint', 9: 'pause', 12: 'zoomIn', 13: 'zoomOut', 14: 'potion' });
export const PRESSES = Object.freeze(['jump', 'dodge', 'attack', 'lock', 'interact', 'pet', 'whistle', 'potion', 'mute', 'pause']);
const STEERS = Object.freeze(['forward', 'back', 'left', 'right']);

const MOUSE_TURN = 0.0024, DRAG_TURN = 0.006, PAD_TURN = 3.2, DEAD = 0.18, DRAG_START = 7, LOCK_TRIES = 2;

export function stickValue(value) {
  const size = Math.abs(value);
  return size < DEAD ? 0 : Math.sign(value) * (size - DEAD) / (1 - DEAD);
}

export function createInput(surface, { onPress, onLockChange }) {
  const held = new Set(), listeners = new AbortController(), signal = listeners.signal, pad = [];
  const intent = { forward: 0, right: 0, sprint: false, attackHeld: false, lookX: 0, lookY: 0, zoom: 0 };
  let lookX = 0, lookY = 0, zoom = 0, mouseHeld = false, drag = null, padAttack = false, wantLock = false, lockable = true, refusals = 0, buttonDown = false;
  const locked = () => document.pointerLockElement === surface;
  function requestLock() {
    if (!lockable) return Promise.resolve(false);
    if (locked()) return Promise.resolve(true);
    const gesture = navigator.userActivation?.isActive ?? true;
    const refused = () => { if (gesture && ++refusals >= LOCK_TRIES) lockable = false; return false; };
    try { return Promise.resolve(surface.requestPointerLock?.()).then(() => { refusals = 0; return true; }, refused); } catch { return Promise.resolve(refused()); }
  }
  const press = (action, stamp = performance.now()) => onPress(action, stamp);

  const inMenu = event => Boolean(event.target?.closest?.('dialog'));
  window.addEventListener('keydown', event => {
    if (inMenu(event)) return;
    event.stopPropagation();
    const action = KEYS[event.code];
    if (!action || event.metaKey) return;
    event.preventDefault();
    if (event.repeat) return;
    held.add(action);
    if (PRESSES.includes(action)) press(action, event.timeStamp);
    else if (STEERS.includes(action)) press('move', event.timeStamp);
  }, { signal, capture: true });
  window.addEventListener('keyup', event => {
    const action = KEYS[event.code];
    if (action) held.delete(action);
    if (inMenu(event)) return;
    event.stopPropagation();
    if (action) event.preventDefault();
  }, { signal, capture: true });
  window.addEventListener('blur', () => { held.clear(); mouseHeld = false; drag = null; }, { signal });
  surface.addEventListener('contextmenu', event => event.preventDefault(), { signal });
  surface.addEventListener('pointerdown', event => {
    if (event.button === 2 || (event.button === 0 && event.ctrlKey)) { press('dodge', event.timeStamp); return; }
    if (event.button !== 0) return;
    buttonDown = true;
    if (wantLock && lockable && !locked()) {
      const stamp = event.timeStamp;
      requestLock().then(granted => { if (granted) return; mouseHeld = buttonDown; press('attack', stamp); });
      return;
    }
    mouseHeld = true;
    if (!locked()) { drag = { x: event.clientX, y: event.clientY, moved: false }; surface.setPointerCapture?.(event.pointerId); }
    press('attack', event.timeStamp);
  }, { signal });
  const release = event => { if (event.button === 0) { buttonDown = false; mouseHeld = false; drag = null; } };
  window.addEventListener('pointerup', release, { signal });
  window.addEventListener('pointercancel', release, { signal });
  window.addEventListener('pointermove', event => {
    if (locked()) { lookX += event.movementX * MOUSE_TURN; lookY += event.movementY * MOUSE_TURN; return; }
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_START) return;
    drag.moved = true; drag.x = event.clientX; drag.y = event.clientY;
    lookX += dx * DRAG_TURN; lookY += dy * DRAG_TURN;
  }, { signal });
  surface.addEventListener('wheel', event => { event.preventDefault(); zoom += Math.max(-1, Math.min(1, event.deltaY / 240)); }, { signal, passive: false });
  document.addEventListener('pointerlockchange', () => onLockChange?.(locked()), { signal });

  function readPad(dt) {
    const gamepad = navigator.getGamepads?.().find(entry => entry?.connected && entry.mapping === 'standard');
    if (!gamepad) { pad.length = 0; padAttack = false; return null; }
    gamepad.buttons.forEach((button, index) => {
      const down = button.pressed, action = PAD[index];
      if (down && !pad[index] && action) {
        if (PRESSES.includes(action)) press(action);
        if (action === 'zoomIn') zoom -= 0.4;
        if (action === 'zoomOut') zoom += 0.4;
      }
      pad[index] = down;
    });
    padAttack = Boolean(gamepad.buttons[2]?.pressed);
    lookX += stickValue(gamepad.axes[2] ?? 0) * PAD_TURN * dt; lookY += stickValue(gamepad.axes[3] ?? 0) * PAD_TURN * 0.6 * dt;
    return { x: stickValue(gamepad.axes[0] ?? 0), y: stickValue(gamepad.axes[1] ?? 0), sprint: Boolean(gamepad.buttons[7]?.pressed || gamepad.buttons[10]?.pressed) };
  }

  return {
    read(dt) {
      const stick = readPad(dt);
      const forward = (held.has('forward') ? 1 : 0) - (held.has('back') ? 1 : 0), right = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      intent.forward = stick && (stick.x || stick.y) ? -stick.y : forward;
      intent.right = stick && (stick.x || stick.y) ? stick.x : right;
      intent.sprint = held.has('sprint') || Boolean(stick?.sprint);
      intent.attackHeld = (mouseHeld && !drag?.moved) || padAttack;
      intent.lookX = lookX; intent.lookY = lookY; intent.zoom = zoom;
      lookX = 0; lookY = 0; zoom = 0;
      return intent;
    },
    get locked() { return locked(); },
    get lockable() { return lockable; },
    lock() { wantLock = true; return requestLock(); },
    unlock() { wantLock = false; if (locked()) document.exitPointerLock(); },
    clear() { held.clear(); mouseHeld = false; drag = null; lookX = 0; lookY = 0; zoom = 0; },
    dispose() { listeners.abort(); if (locked()) document.exitPointerLock(); },
  };
}
