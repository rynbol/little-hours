// Small, finite celebrations. No animation loop and no changes to the room or
// avatar editor. Both pointer and keyboard activation go through native clicks.
export function createUIFeedback(root, { signal } = {}) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  const particles = new Set();
  let lastBurst = 0;

  function animate(element, frames, options, done) {
    const animation = element.animate(frames, options);
    animations.add(animation);
    const cleanup = () => { animations.delete(animation); done?.(); };
    animation.onfinish = cleanup;
    animation.oncancel = cleanup;
  }
  function celebrate(target, heart = false) {
    if (!target || reducedMotion.matches || document.hidden || particles.size > 20) return;
    const rect = target.getBoundingClientRect();
    // The dialog's top layer must own its own particles.
    const parent = target.closest('dialog') || document.body;
    const parentRect = parent === document.body ? { left: 0, top: 0 } : parent.getBoundingClientRect();
    for (let i = 0; i < 6; i++) {
      const bit = document.createElement('span');
      bit.className = `ui-spark${heart ? ' is-heart' : ''}`;
      bit.setAttribute('aria-hidden', 'true');
      bit.textContent = heart ? '♡' : i % 2 ? '✦' : '·';
      bit.style.position = parent === document.body ? 'fixed' : 'absolute';
      bit.style.left = `${rect.left + rect.width / 2 - parentRect.left}px`;
      bit.style.top = `${rect.top + rect.height / 2 - parentRect.top}px`;
      parent.append(bit); particles.add(bit);
      const angle = Math.PI * 2 * i / 6, distance = 28 + (i % 3) * 10;
      animate(bit, [
        { transform: 'translate(-50%, -50%) scale(.3)', opacity: 0 },
        { opacity: 1, offset: .18 },
        { transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance - 20}px)) rotate(${i % 2 ? 20 : -20}deg) scale(1)`, opacity: 0 },
      ], { duration: 620, easing: 'cubic-bezier(.18,.7,.35,1)' }, () => { bit.remove(); particles.delete(bit); });
    }
  }
  function onClick(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled || reducedMotion.matches || document.hidden) return;
    if (button.closest('.is-avatar-editing') || button.matches('[data-panel="avatar"]')) return;
    // Feedback is reserved for choices and little milestones, not every utility.
    if (!button.matches('#start-button, #pet-now, [data-minutes], [data-theme-choice], [data-pet-choice], [data-house-design], #build-house-room')) return;
    animate(button, [ { scale: '.96' }, { scale: '1.025', offset: .65 }, { scale: '1' } ], { duration: 320, easing: 'ease-out' });
    if (performance.now() - lastBurst < 250) return;
    lastBurst = performance.now();
    celebrate(button, button.id === 'pet-now' || button.hasAttribute('data-pet-choice'));
  }
  function stop() {
    for (const animation of [...animations]) animation.cancel();
    for (const particle of particles) particle.remove();
    particles.clear();
  }
  root.addEventListener('click', onClick, { capture: true, signal });
  reducedMotion.addEventListener('change', stop, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); }, { signal });
  return { celebrate, dispose: stop };
}
