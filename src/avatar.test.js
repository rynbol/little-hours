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

test('cuffed shorts expose the upper thigh while soft trousers cover it', () => {
  const engine = new NullEngine({ renderWidth: 640, renderHeight: 480, deterministicLockstep: true });
  const scene = new Scene(engine), created = [];
  const exposesUpperThigh = avatar => {
    const body = avatar.root.getChildMeshes().find(mesh => mesh.name === 'companion-articulated-body');
    const positions = body.getVerticesData('position'), colors = body.getVerticesData('color');
    const skin = avatarPaint({ skin: 'cocoa' }, 'skin').color;
    const tone = [1, 3, 5].map(offset => parseInt(skin.slice(offset, offset + 2), 16) / 255);
    for (let vertex = 0; vertex < colors.length / 4; vertex++) {
      const i = vertex * 3, colorIndex = vertex * 4;
      const isSkin = tone.every((channel, axis) => Math.abs(colors[colorIndex + axis] - channel) < 0.005);
      if (isSkin && Math.abs(positions[i]) > 0.06 && Math.abs(positions[i]) < 0.24
        && positions[i + 1] > 0.73 && positions[i + 1] < 0.82
        && positions[i + 2] > -0.2 && positions[i + 2] < 0.06) return true;
    }
    return false;
  };
  try {
    const standingPose = { atDesk: false, x: 0, z: 0, yaw: 0, sit: 0, seatHeight: 0.8, doze: 0, step: 0, moving: false, activity: null, activityTime: 0 };
    const shorts = createMobileCompanion(scene, { ...AVATAR_DEFAULT, skin: 'cocoa', bottomStyle: 'shorts' }); created.push(shorts);
    const trousers = createMobileCompanion(scene, { ...AVATAR_DEFAULT, skin: 'cocoa', bottomStyle: 'trousers' }); created.push(trousers);
    shorts.animate(standingPose, 0, true); trousers.animate(standingPose, 0, true);
    assert.equal(exposesUpperThigh(shorts), true, 'skin is visible between the short hem and knee');
    assert.equal(exposesUpperThigh(trousers), false, 'full-length trousers do not expose the upper thigh');
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

test('curated outfits preserve identity and round-trip through the saved state', async () => {
  const { AVATAR_LOOKS } = await import('./avatar.js');
  const { createStateStore } = await import('./state.js');
  let saved = null;
  const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
  const store = createStateStore(storage);
  store.update(draft => { Object.assign(draft.avatar, { skin: 'deep', hair: 'silver', style: 'waves' }); });
  for (const look of AVATAR_LOOKS) {
    store.update(draft => { Object.assign(draft.avatar, look.appearance); });
    const restored = createStateStore(storage).state.avatar;
    assert.deepEqual(restored, normalizeAvatarAppearance(restored));
    assert.deepEqual([restored.skin, restored.hair, restored.style], ['deep', 'silver', 'waves']);
    for (const [part, value] of Object.entries(look.appearance)) assert.equal(restored[part], value);
  }
});

test('avatar ellipsoids and animated joints keep unit normals for consistent skin and cloth lighting', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const avatar = createMobileCompanion(scene, { ...AVATAR_DEFAULT, outfit: 'overalls', bottomStyle: 'shorts' });
  try {
    for (const sit of [0, .5, 1]) {
      avatar.animate({ atDesk: false, x: 0, z: 0, yaw: .8, sit, seatHeight: .8, doze: 0, step: 4, moving: !sit, activity: null }, 1 + sit, false);
      for (const mesh of avatar.root.getChildMeshes()) {
        const normals = mesh.getVerticesData('normal');
        if (!normals) continue;
        for (let i = 0; i < normals.length; i += 3) {
          const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
          assert.ok(Math.abs(length - 1) < .001 || length < 1e-6, `${mesh.name} has normalized surface lighting (${length})`);
        }
      }
    }
  } finally { avatar.dispose(); scene.dispose(); engine.dispose(); }
});
