import { $ } from './dom.js';

export function createToast() {
  let timeout;
  return {
    show(message, warning = false) {
      $('#toast').textContent = message;
      $('#toast').classList.toggle('is-warning', warning);
      $('#toast').setAttribute('role', warning ? 'alert' : 'status');
      $('#toast').hidden = false;
      clearTimeout(timeout);
      timeout = setTimeout(() => { $('#toast').hidden = true; }, 4200);
    },
    hide() { clearTimeout(timeout); $('#toast').hidden = true; },
    dispose() { clearTimeout(timeout); },
  };
}
