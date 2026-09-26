import { AVATAR_DEFAULT, AVATAR_LOOKS } from '../../core/avatar.js';
import { avatarEditorContent } from './avatar-ui.js';
import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';

export function createAvatarPanel(app) {
  let active = false, resumeTimer = false, section = 'looks';

  function syncEditing(current) {
    const leaving = current !== 'avatar' && active;
    if (current === 'avatar' && !active) {
      active = true; section = 'looks'; app.room?.setAvatarEditing?.(true);
      resumeTimer = app.state.session.running;
      if (resumeTimer) {
        const result = app.store.setRunning(false);
        resumeTimer = !result.completed;
        app.acceptUpdate(result);
      } else app.timer.render();
      app.companion.say('customize', { force: true });
    } else if (leaving) {
      active = false; app.room?.setAvatarEditing?.(false);
      const resume = resumeTimer; resumeTimer = false;
      if (resume && !app.state.session.running) app.acceptUpdate(app.store.setRunning(true));
      else app.timer.render();
      app.companion.say('customizeDone', { force: true });
    }
    document.body.classList.toggle('is-avatar-editing', current === 'avatar');
    app.roomUI.renderLabel();
    $('#avatar-pause-note').textContent = resumeTimer ? 'Focus paused · resumes when you’re done' : 'Make yourself at home';
    if (active) $('#room-hint').textContent = 'A small version of you. A whole world to make your own.';
    else if (!app.decorate.active) $('#room-hint').innerHTML = `Drag to look around<span>·</span>Tap a plant, bookcase or tea table`;
    return leaving;
  }

  function renderPanel(panel) {
    panel.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">THE LITTLE WARDROBE</p><h2>A little more <em>you.</em></h2></div><button class="icon-button" id="close-panel" aria-label="Close wardrobe">${icon('close')}</button></div>
      <div class="avatar-editor-tabs" role="group" aria-label="Customize your avatar">${[['looks', 'Looks'], ['face', 'Face & hair'], ['outfit', 'Outfits'], ['details', 'Extras']].map(([id, name]) => `<button data-avatar-section="${id}" aria-pressed="${section === id}">${name}</button>`).join('')}</div>
      <div class="avatar-customizer">${avatarEditorContent(app.state.avatar, section)}</div>
      <div class="avatar-editor-footer"><button class="avatar-reset" id="avatar-reset">Reset look</button><span class="avatar-save-note">${app.storageWarningShown ? 'This visit only' : 'Saved as you go'}</span><button class="avatar-done" id="avatar-done">${icon('check')} Done</button></div>`;
    const rerenderChoices = selector => {
      const scroll = panel.querySelector('.avatar-customizer').scrollTop;
      app.panels.render();
      panel.querySelector('.avatar-customizer').scrollTop = scroll;
      panel.querySelector(selector)?.focus({ preventScroll: true });
    };
    panel.querySelectorAll('[data-avatar-section]').forEach(button => button.addEventListener('click', () => {
      section = button.dataset.avatarSection; app.panels.render(); panel.querySelector(`[data-avatar-section="${section}"]`)?.focus({ preventScroll: true });
    }));
    panel.querySelectorAll('[data-avatar-part]').forEach(button => button.addEventListener('click', () => {
      const part = button.dataset.avatarPart, value = button.dataset.avatarValue;
      app.acceptUpdate(app.store.update(draft => { draft.avatar[part] = value; }));
      rerenderChoices(`[data-avatar-part="${part}"][data-avatar-value="${value}"]`);
    }));
    panel.querySelectorAll('[data-avatar-look]').forEach(button => button.addEventListener('click', () => {
      const look = AVATAR_LOOKS.find(x => x.id === button.dataset.avatarLook);
      app.acceptUpdate(app.store.update(draft => { Object.assign(draft.avatar, look.appearance); }));
      rerenderChoices(`[data-avatar-look="${look.id}"]`);
    }));
    $('#avatar-reset').addEventListener('click', () => {
      app.acceptUpdate(app.store.update(draft => { draft.avatar = { ...AVATAR_DEFAULT }; }));
      app.panels.render(); $('#avatar-reset')?.focus({ preventScroll: true });
    });
    $('#avatar-done').addEventListener('click', app.panels.close);
  }

  $('#avatar-turn-left').addEventListener('click', () => app.room?.turnAvatar(-Math.PI / 4));
  $('#avatar-turn-right').addEventListener('click', () => app.room?.turnAvatar(Math.PI / 4));
  $('#avatar-face-front').addEventListener('click', () => app.room?.turnAvatar(0, true));

  return { get active() { return active; }, syncEditing, renderPanel };
}
