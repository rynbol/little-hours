import test from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_DEFAULT, AVATAR_OPTIONS, avatarAppearanceKey, avatarPaint, normalizeAvatarAppearance } from './avatar.js';

test('avatar choices normalize to complete, safe saved appearances', () => {
  assert.deepEqual(normalizeAvatarAppearance(), AVATAR_DEFAULT);
  assert.deepEqual(normalizeAvatarAppearance({ skin: 'cocoa', hair: 'honey', top: 'rose', bottom: 'plum', style: 'waves' }), {
    skin: 'cocoa', hair: 'honey', top: 'rose', bottom: 'plum', style: 'waves',
  });
  assert.deepEqual(normalizeAvatarAppearance({ skin: 'invalid', top: null, style: 'missing' }), AVATAR_DEFAULT);
});

test('every appearance choice has a paint definition and changes the appearance cache key', () => {
  for (const [part, options] of Object.entries(AVATAR_OPTIONS)) {
    for (const option of options) assert.equal(avatarPaint({ [part]: option.id }, part).id, option.id);
    if (options.length > 1) {
      const first = normalizeAvatarAppearance({ [part]: options[0].id });
      const second = normalizeAvatarAppearance({ [part]: options[1].id });
      assert.notEqual(avatarAppearanceKey(first), avatarAppearanceKey(second), `${part} choices have distinct appearance keys`);
    }
  }
});
