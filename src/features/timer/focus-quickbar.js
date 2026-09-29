import { icon } from '../../ui/icons.js';
import './focus-outlook.css';

export function createFocusQuickbar({ signal, onToggle, onSettings }) {
  const bar = document.createElement('nav');
  bar.id = 'focus-quickbar'; bar.hidden = true; bar.setAttribute('aria-label', 'Quick focus controls');
  bar.innerHTML = `<button id="quick-focus-settings" aria-label="Focus settings">${icon('clock')}<time>25:00</time><span aria-hidden="true">⌃</span></button><button id="quick-focus-start">Start ${icon('arrow')}</button>`;
  document.querySelector('.app-shell').appendChild(bar);
  const start = bar.querySelector('#quick-focus-start'), settings = bar.querySelector('#quick-focus-settings');
  start.addEventListener('click', onToggle); settings.addEventListener('click', onSettings);
  const observer = new IntersectionObserver(([entry]) => { bar.hidden = entry.intersectionRatio >= .95; }, { threshold: .95 });
  observer.observe(document.querySelector('#start-button'));
  signal.addEventListener('abort', () => { observer.disconnect(); bar.remove(); }, { once: true });
  return {
    render({ time, remaining, label, running, paused, completed, disabled }) {
      bar.querySelector('time').textContent = time;
      bar.querySelector('time').setAttribute('aria-label', `${remaining} remaining`);
      start.firstChild.textContent = `${running ? 'Pause' : paused ? 'Continue' : completed ? 'Again' : 'Start'} `;
      start.setAttribute('aria-label', label);
      if (bar.dataset.running !== String(running)) start.querySelector('svg').outerHTML = icon(running ? 'pause' : 'arrow');
      start.disabled = disabled; settings.disabled = disabled;
      bar.dataset.running = String(running);
    },
  };
}
