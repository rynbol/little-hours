import { createBackup, readBackup, backupFilename } from './backup.js';
import { $ } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';

export function createSavesPanel(app) {
  let pendingRestore = null, lastSaveOk = true, restoring = false;

  function setSaveStatus(persisted) {
    if (persisted === lastSaveOk) return;
    lastSaveOk = persisted;
    $('#save-status').classList.toggle('is-warning', !persisted);
    $('#save-status-text').textContent = persisted ? 'Saved on this device' : 'Not saved · this visit only';
    if (app.panels.current === 'saves') app.panels.render();
  }
  const dateLabel = timestamp => new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  // Download a copy of the home, or bring one back after previewing it. The
  // home being replaced is kept aside so a restore can be undone.
  function renderPanel(panel) {
    const { state, store } = app;
    const busy = state.session.running;
    const summary = pendingRestore?.summary;
    const preview = document.createElement('div');
    preview.className = 'restore-preview';
    if (summary) {
      const title = document.createElement('strong');
      title.textContent = summary.houseName;
      const detail = document.createElement('p');
      detail.textContent = `${summary.rooms} ${summary.rooms === 1 ? 'room' : 'rooms'} · ${summary.pieces} pieces · ${summary.coins} coins · ${summary.sessions} ${summary.sessions === 1 ? 'session' : 'sessions'}${summary.exportedAt ? ` · saved ${dateLabel(summary.exportedAt)}` : ''}`;
      preview.append(title, detail);
    }
    panel.insertAdjacentHTML('beforeend', `<p class="save-note${lastSaveOk ? '' : ' is-warning'}" role="status">${lastSaveOk ? 'Everything is saved in this browser. A downloaded copy keeps your home safe if this browser’s data is ever cleared.' : 'This browser couldn’t save your latest changes. Download a copy to keep them.'}</p>
    <div class="save-actions"><button class="quiet-button" id="download-backup">${icon('check')} Download a copy</button><button class="quiet-button" id="choose-backup" ${busy ? 'disabled' : ''}>${icon('home')} Bring back a copy</button><input type="file" id="backup-file" accept="application/json,.json" hidden></div>
    ${busy ? '<p class="performance-note">Pause your focus session or end your break to bring back a copy.</p>' : ''}
    ${summary ? `<div class="restore-confirm" role="group" aria-labelledby="restore-heading"><p class="eyebrow" id="restore-heading">REPLACE YOUR HOME WITH THIS COPY?</p><div id="restore-slot"></div><p class="performance-note">Your current home is kept aside, so you can swap back.</p><div class="save-actions"><button class="quiet-button" id="confirm-restore" ${busy ? 'disabled' : ''}>Replace my home</button><button class="quiet-button" id="cancel-restore">Keep my home</button></div></div>` : ''}
    ${!summary && store.hasRecovery() ? `<button class="text-link" id="undo-restore" ${busy ? 'disabled' : ''}>Swap back to the home from before the last restore</button>` : ''}`);
    if (summary) $('#restore-slot').replaceWith(preview);
    $('#download-backup').addEventListener('click', async () => {
      await app.timer.flushTask();
      await app.store.settled();
      const url = URL.createObjectURL(new Blob([createBackup(app.state)], { type: 'application/json' }));
      const link = Object.assign(document.createElement('a'), { href: url, download: backupFilename() });
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      app.toast('A copy of your home is on its way to your downloads.');
    });
    $('#choose-backup').addEventListener('click', () => $('#backup-file').click());
    $('#backup-file').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      const result = readBackup(await file.text());
      if (!result.ok) { pendingRestore = null; app.toast(result.reason, true); return; }
      pendingRestore = result;
      app.panels.render(); $('#confirm-restore')?.focus({ preventScroll: true });
    });
    $('#confirm-restore')?.addEventListener('click', () => applyRestore(() => app.store.restore(pendingRestore.state)));
    $('#cancel-restore')?.addEventListener('click', () => { pendingRestore = null; app.panels.render(); $('#choose-backup').focus({ preventScroll: true }); });
    $('#undo-restore')?.addEventListener('click', () => applyRestore(() => app.store.undoRestore()));
    panel.scrollIntoView({ block: 'nearest' });
  }
  async function applyRestore(restore) {
    if (restoring || app.state.session.running) return;
    restoring = true;
    try {
      if (app.decorate.active) app.decorate.setEditMode(false);
      const result = await restore();
      pendingRestore = null;
      if (!result.restored) { app.toast('Your browser couldn’t keep your current home aside, so nothing was changed.', true); app.panels.render(); return; }
      app.decorate.clearUndo();
      await app.acceptUpdate(result);
      if (app.panels.current === 'saves') { app.panels.render(); $('#close-panel')?.focus({ preventScroll: true }); }
      app.toast(`Welcome home to ${app.state.house.name}.`);
    } finally { restoring = false; }
  }

  return { setSaveStatus, renderPanel };
}
