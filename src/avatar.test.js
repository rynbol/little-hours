import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { AVATAR_DEFAULT, AVATAR_OPTIONS, avatarAppearanceKey, avatarPaint, normalizeAvatarAppearance } from './avatar.js';
import { createMobileCompanion } from './furniture.js';

test('avatar choices normalize to complete, safe saved appearances', () => {
  assert.deepEqual(normalizeAvatarAppearance(), AVATAR_DEFAULT);
  assert.deepEqual(normalizeAvatarAppearance({ skin: 'cocoa', hair: 'honey', top: 'rose', bottom: 'plum', style: 'waves' }), {
    skin: 'cocoa', hair: 'honey', top: 'rose', bottom: 'plum', style: 'waves',
    outfit: 'cardigan', bottomStyle: 'trousers', accessory: 'none',
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

test('garment cuts and personal accessories change the modeled companion; older saves get the familiar look', () => {
  const engine = new NullEngine({ renderWidth: 640, renderHeight: 480, deterministicLockstep: true });
  const scene = new Scene(engine), created = [];
  const signature = avatar => createHash('sha256').update(avatar.root.getChildMeshes().map(part => {
    const material = part.material?.diffuseColor?.toHexString?.() || '';
    const positions = Array.from(part.getVerticesData('position') || []).join(',');
    const colors = Array.from(part.getVerticesData('color') || []).join(',');
    return `${material}:${positions}:${colors}`;
  }).join('|')).digest('hex');
  try {
    const original = createMobileCompanion(scene, AVATAR_DEFAULT); created.push(original);
    const base = signature(original);
    for (const appearance of [
      { outfit: 'hoodie' }, { outfit: 'overalls' }, { outfit: 'sailor' },
      { bottomStyle: 'skirt' }, { bottomStyle: 'shorts' },
      { accessory: 'glasses' }, { accessory: 'blossom' }, { accessory: 'moon-clips' },
    ]) {
      const companion = createMobileCompanion(scene, { ...AVATAR_DEFAULT, ...appearance }); created.push(companion);
      assert.notEqual(signature(companion), base, `${Object.values(appearance)[0]} has its own visible model`);
    }
    assert.deepEqual(normalizeAvatarAppearance({ skin: 'warm', hair: 'chestnut', top: 'clay', bottom: 'sage', style: 'bun' }), AVATAR_DEFAULT,
      'a save from before outfit designs and accessories keeps the established look');
  } finally {
    for (const avatar of created) avatar.dispose();
    scene.dispose(); engine.dispose();
  }
});

test('every avatar option builds finite geometry inside the character bounds', () => {
  const engine = new NullEngine({ renderWidth: 640, renderHeight: 480, deterministicLockstep: true });
  const scene = new Scene(engine);
  try {
    for (const part of ['skin', 'hair', 'top', 'bottom', 'style', 'outfit', 'bottomStyle', 'accessory']) {
      for (const option of AVATAR_OPTIONS[part]) {
        const avatar = createMobileCompanion(scene, { ...AVATAR_DEFAULT, [part]: option.id });
        try {
          for (const mesh of avatar.root.getChildMeshes()) {
            for (const kind of ['position', 'normal']) {
              const data = mesh.getVerticesData(kind);
              if (!data) continue;
              assert.ok(Array.from(data).every(Number.isFinite), `${part}:${option.id} has finite ${kind} values`);
              if (kind === 'position') assert.ok(Array.from(data).every(value => Math.abs(value) < 3), `${part}:${option.id} stays inside the avatar bounds`);
            }
          }
        } finally { avatar.dispose(); }
      }
    }
  } finally { scene.dispose(); engine.dispose(); }
});
