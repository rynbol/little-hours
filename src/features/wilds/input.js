const ACTION_KEYS = Object.freeze({
  Space: 'jump',
  ControlLeft: 'dodge',
  ControlRight: 'dodge',
  Tab: 'lock',
  KeyE: 'interact',
  KeyR: 'recall',
  KeyT: 'command',
  KeyQ: 'skill',
  KeyH: 'heal',
  KeyI: 'inventory',
  KeyM: 'map',
});

const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight']);
const MENU_TARGETS = 'input, textarea, select, button, a, [contenteditable=""], [contenteditable="true"], [role="dialog"], [data-wilds-input-block]';

export function createWildsInput(canvas) {
  const owner = canvas.ownerDocument, host = owner.defaultView;
  const held = new Set(), pressed = new Set(), listeners = [];
  let lookX = 0, lookY = 0, drag = null, disposed = false, attacking = false, blocking = false;
  const previousTabIndex = canvas.tabIndex;
  if (canvas.tabIndex < 0) canvas.tabIndex = 0;

  function listen(target, type, callback) {
    target.addEventListener(type, callback);
    listeners.push(() => target.removeEventListener(type, callback));
  }

  function clear() {
    held.clear();
    pressed.clear();
    lookX = 0;
    lookY = 0;
    drag = null;
    attacking = false;
    blocking = false;
  }

  function accepts(target) {
    if (disposed || owner.hidden) return false;
    if (target?.closest?.(MENU_TARGETS)) return false;
    const active = owner.activeElement;
    return !active || active === canvas || active === owner.body;
  }

  listen(host, 'keydown', event => {
    if (event.code === 'Escape') {
      clear();
      if (owner.pointerLockElement === canvas) owner.exitPointerLock?.();
      return;
    }
    if (!accepts(event.target) || event.defaultPrevented || event.metaKey || event.altKey) return;
    if (!MOVEMENT_KEYS.has(event.code) && !ACTION_KEYS[event.code]) return;
    event.preventDefault();
    if (!held.has(event.code) && !event.repeat && ACTION_KEYS[event.code]) pressed.add(ACTION_KEYS[event.code]);
    held.add(event.code);
  });
  listen(host, 'keyup', event => held.delete(event.code));
  listen(host, 'blur', clear);
  listen(owner, 'visibilitychange', clear);
  listen(owner, 'focusin', event => { if (!accepts(event.target)) clear(); });
  listen(owner, 'pointerlockchange', () => { if (owner.pointerLockElement !== canvas) clear(); });
  listen(canvas, 'pointerdown', event => {
    if (disposed || owner.hidden) return;
    canvas.focus?.({ preventScroll: true });
    if (event.button === 0) {
      attacking = true;
      pressed.add('attack');
    }
    if (event.button === 2) blocking = true;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  listen(host, 'pointermove', event => {
    if (!accepts(event.target) && owner.pointerLockElement !== canvas) return;
    if (owner.pointerLockElement === canvas) {
      lookX += event.movementX || 0;
      lookY += event.movementY || 0;
    } else if (drag?.id === event.pointerId) {
      lookX += event.clientX - drag.x;
      lookY += event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
    }
  });
  listen(host, 'pointerup', event => {
    if (event.button === 0) attacking = false;
    if (event.button === 2) blocking = false;
    if (drag?.id === event.pointerId) drag = null;
  });
  listen(canvas, 'pointercancel', clear);
  listen(canvas, 'lostpointercapture', () => { drag = null; attacking = false; blocking = false; });
  listen(canvas, 'contextmenu', event => event.preventDefault());
  listen(canvas, 'dblclick', () => {
    if (!canvas.requestPointerLock || !accepts(canvas)) return;
    const request = canvas.requestPointerLock();
    request?.catch?.(() => {});
  });

  function read() {
    if (!accepts(canvas)) clear();
    const snapshot = {
      forward: Number(held.has('KeyW')) - Number(held.has('KeyS')),
      strafe: Number(held.has('KeyD')) - Number(held.has('KeyA')),
      sprint: held.has('ShiftLeft') || held.has('ShiftRight'),
      climb: held.has('Space'),
      jump: pressed.has('jump'),
      lookX,
      lookY,
      attackHeld: attacking,
      block: blocking,
      actions: [...pressed],
    };
    lookX = 0;
    lookY = 0;
    pressed.clear();
    return snapshot;
  }

  return {
    read,
    consume: read,
    dispose() {
      if (disposed) return;
      disposed = true;
      clear();
      for (const remove of listeners) remove();
      if (owner.pointerLockElement === canvas) owner.exitPointerLock?.();
      canvas.tabIndex = previousTabIndex;
    },
  };
}
