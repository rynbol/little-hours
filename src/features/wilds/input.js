export function createWildsInput(canvas, { pause, lock, mute, orbit, zoom, onInteraction = () => {} }) {
  const events = new AbortController(), keys = new Set(), pulses = {};
  let pointer = null, mouseHeld = false, previousButtons = [], padActive = false, disposed = false;
  const pulse = name => { pulses[name] = true; };
  const buttons = { Space: 'jump', ControlLeft: 'dodge', ControlRight: 'dodge', KeyQ: 'petSkill', KeyE: 'interact' };
  const release = () => {
    keys.clear();
    if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
    pointer = null; mouseHeld = false; padActive = false;
    for (const name of Object.keys(pulses)) delete pulses[name];
    pulse('attackCancelled');
  };
  document.addEventListener('keydown', event => {
    if (event.isComposing || event.target.closest('input, textarea, select')) return;
    if (event.target.closest('#wilds-menu, button') && event.code !== 'Escape') return;
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space', 'ControlLeft', 'ControlRight', 'KeyF', 'KeyM', 'Escape', 'KeyE', 'KeyQ'].includes(event.code)) return;
    if (!event.repeat) onInteraction();
    event.preventDefault(); event.stopImmediatePropagation();
    keys.add(event.code);
    if (event.repeat) return;
    if (buttons[event.code]) pulse(buttons[event.code]);
    if (event.code === 'KeyF') lock();
    if (event.code === 'KeyM') mute();
    if (event.code === 'Escape') { release(); pause(); }
  }, { capture: true, signal: events.signal });
  document.addEventListener('keyup', event => {
    keys.delete(event.code);
    if (event.target.closest('#wilds-menu, button')) return;
    if (buttons[event.code] || event.code.startsWith('Key')) event.preventDefault();
  }, { signal: events.signal });
  canvas.addEventListener('contextmenu', event => event.preventDefault(), { signal: events.signal });
  canvas.addEventListener('pointerdown', event => {
    if (![0, 1, 2].includes(event.button)) return;
    onInteraction();
    event.preventDefault(); canvas.focus({ preventScroll: true });
    if (event.button === 2) { pulse('dodge'); return; }
    if (event.button !== 0 && event.button !== 1) return;
    canvas.setPointerCapture(event.pointerId);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, dragged: event.button === 1 };
    if (event.button === 0) { mouseHeld = true; pulse('attackPressed'); }
  }, { signal: events.signal });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (!pointer.dragged && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 6) {
      pointer.dragged = true; mouseHeld = false; pulse('attackCancelled');
    }
    if (pointer.dragged) orbit(dx, dy);
    pointer.x = event.clientX; pointer.y = event.clientY;
  }, { signal: events.signal });
  canvas.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!pointer.dragged) pulse('attackReleased');
    mouseHeld = false; pointer = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }, { signal: events.signal });
  canvas.addEventListener('pointercancel', release, { signal: events.signal });
  canvas.addEventListener('wheel', event => { if (event.deltaY) onInteraction(); event.preventDefault(); zoom(event.deltaY * .008); }, { passive: false, signal: events.signal });
  window.addEventListener('blur', release, { signal: events.signal });
  const deadzone = value => Math.abs(value || 0) < .17 ? 0 : value;
  return {
    release,
    read(yaw, dt) {
      let horizontal = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
      let forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
      let sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const pad = disposed ? null : navigator.getGamepads?.().find(pad => pad?.connected);
      let padHeld = false;
      if (pad) {
        horizontal += deadzone(pad.axes[0]); forward -= deadzone(pad.axes[1]);
        orbit(deadzone(pad.axes[2]) * dt * 240, deadzone(pad.axes[3]) * dt * 180);
        const down = pad.buttons.map(button => button.pressed);
        const active = down.some(Boolean) || pad.axes.some(value => deadzone(value) !== 0);
        if (active && !padActive) onInteraction();
        padActive = active;
        const pressed = index => down[index] && !previousButtons[index];
        if (pressed(0)) pulse('jump');
        if (pressed(1)) pulse('dodge');
        if (pressed(3)) pulse('interact');
        if (pressed(6)) pulse('petSkill');
        if (pressed(4) || pressed(11)) lock();
        if (pressed(9)) { release(); pause(); }
        if (pressed(2) || pressed(7)) pulse('attackPressed');
        if ((previousButtons[2] || previousButtons[7]) && !down[2] && !down[7]) pulse('attackReleased');
        padHeld = Boolean(down[2] || down[7]);
        sprint ||= down[10] || down[5];
        previousButtons = down;
      } else {
        if ((previousButtons[2] || previousButtons[7]) && !mouseHeld) pulse('attackCancelled');
        previousButtons = []; padActive = false;
      }
      const length = Math.max(1, Math.hypot(horizontal, forward));
      horizontal /= length; forward /= length;
      const result = { moveX: Math.cos(yaw) * horizontal + Math.sin(yaw) * forward, moveZ: Math.sin(yaw) * horizontal - Math.cos(yaw) * forward, sprint, attackHeld: mouseHeld || padHeld, ...pulses };
      for (const name of Object.keys(pulses)) delete pulses[name];
      return result;
    },
    dispose() { disposed = true; events.abort(); release(); },
  };
}
