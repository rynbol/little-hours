import { icon } from '../../ui/icons.js';
import './focus-outlook.css';

const pillLabels = { 'Start focusing': 'Start', 'Pause a moment': 'Pause', 'Keep going': 'Keep going', 'Begin another session': 'Begin', 'End break': 'End break' };

export function createTimerPill() {
  const sheet = document.getElementById('focus-card'), toggle = document.getElementById('timer-sheet-toggle'), start = document.getElementById('start-button');
  sheet.addEventListener('toggle', event => toggle.setAttribute('aria-expanded', String(event.newState === 'open')));
  return {
    render({ time, remaining, label, running, disabled }) {
      toggle.querySelector('time').textContent = time;
      toggle.setAttribute('aria-label', `Focus timer, ${remaining} remaining`);
      start.querySelector('span').textContent = pillLabels[label];
      start.setAttribute('aria-label', label);
      if (start.dataset.running !== String(running)) start.querySelector('svg').outerHTML = icon(running ? 'pause' : 'arrow');
      start.dataset.running = String(running);
      start.disabled = disabled;
    },
    closeSheet() { if (sheet.matches(':popover-open')) sheet.hidePopover(); },
  };
}
