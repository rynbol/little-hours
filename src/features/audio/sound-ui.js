import { $ } from '../../ui/dom.js';

export function wireSoundControls(app) {
  const { audio } = app;
  async function toggleSound() {
    try {
      await audio.setRain(!audio.raining);
      $('#sound-button').setAttribute('aria-pressed', audio.raining);
      $('#sound-state').textContent = audio.raining ? 'Rain is falling' : 'Sound off';
      $('#volume').disabled = !audio.raining;
    } catch { app.toast('Audio isn’t available in this browser. Your quiet room is still here.'); }
  }
  $('#sound-button').addEventListener('click', toggleSound);
  $('#volume').addEventListener('input', event => audio.setVolume(Number(event.target.value)));
  $('#chime-toggle').addEventListener('change', event => audio.setChime(event.target.checked, true));
}
