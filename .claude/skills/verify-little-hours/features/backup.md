# Backup and restore

Saving the whole game to a file and loading it back.

- Path: `#download-backup` saves; `#choose-backup` with `#backup-file` picks a file; `#confirm-restore` or `#cancel-restore`; `#undo-restore` undoes.
- Covered by `e2e/backup.spec.js` (`npx playwright test`); there is no lh flow. `app.saved()` reads the stored game.
- What breaks: an old save version that fails to load; a restore that cannot be undone.
