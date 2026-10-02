import { randomInt } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openApp } from './app.mjs';
import { sleep } from './chrome.mjs';
import { views } from './steps.mjs';

export const STYLE_CASES = Object.freeze({
  scenery: ['day', 'dusk', 'rain'].flatMap(theme => [0, .45].map(turn => ({ theme, turn }))),
  characters: [
    { subject: 'avatar', reference: 'avatar', angle: 'front' },
    { subject: 'avatar', reference: 'avatar', angle: 'three-quarter' },
    { subject: 'avatar', reference: 'avatar', angle: 'side' },
    { subject: 'cat', reference: 'cat', angle: 'front' },
    { subject: 'cat', reference: 'cat', angle: 'three-quarter' },
    { subject: 'warden', reference: 'dog', angle: 'three-quarter' },
  ],
});

export function blindOrder(cases, choose = randomInt) {
  const shuffled = cases.map((sample, index) => ({ sample, sourceIndex: index }));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const other = choose(i + 1);
    [shuffled[i], shuffled[other]] = [shuffled[other], shuffled[i]];
  }
  return shuffled.map((entry, index) => ({ ...entry, pair: index + 1, wilds: choose(2) ? 'B' : 'A' }));
}

const angles = { front: 0, 'three-quarter': .62, side: Math.PI / 2 };

async function isolateCanvas(app, diagnostic) {
  await app.js(`(() => {
    const d = ${diagnostic}, canvas = d.engine.getRenderingCanvas();
    document.body.append(canvas);
    for (const child of document.body.children) if (child !== canvas) child.style.setProperty('visibility', 'hidden', 'important');
    canvas.style.cssText = 'position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;display:block!important;visibility:visible!important;transform:none!important;margin:0!important;border:0!important;border-radius:0!important;z-index:2147483647!important';
    document.body.style.background = '#dfd7ca';
    d.engine.setHardwareScalingLevel(1);
    d.engine.resize();
    window.__lhFrozenAt = window.__lhStartAt + 5000;
  })()`);
  await sleep(150);
}

async function referenceCharacter(app, { reference, angle }) {
  await views[reference === 'avatar' ? 'avatar' : 'pet'].go(app);
  if (reference === 'avatar' && angles[angle]) {
    await app.js(`window.__littleHours.room.turnAvatar(${angles[angle]})`);
    await app.settle();
  }
  if (reference === 'dog') {
    if (await app.js('Boolean(document.querySelector("#pet-collection"))')) await app.clickSel('#pet-collection > summary');
    await app.clickSel('[data-pet-choice="dog"]');
    await app.settle();
  }
  const diagnostic = reference === 'avatar' ? 'window.__littleHours.room.diagnostics()' : 'window.__littleHours.petCloseup';
  await isolateCanvas(app, diagnostic);
  await app.js(`(() => {
    const d = ${diagnostic}, scene = d.scene, camera = scene.activeCamera;
    d.engine.stopRenderLoop();
    scene.clearColor.set(223 / 255, 215 / 255, 202 / 255, 1);
    if (${reference === 'avatar'}) {
      const root = d.companionModel.root;
      scene.getMeshByName('wardrobe-plinth')?.setEnabled(false);
      camera.target.copyFrom(root.position).addInPlaceFromFloats(0, 1.03, 0);
      camera.beta = 1.46; camera.radius = 6;
      camera.orthoTop = 1.4; camera.orthoBottom = -1.4; camera.orthoLeft = -1.4; camera.orthoRight = 1.4;
    } else {
      const root = scene.getTransformNodeByName('pet-${reference}');
      for (const mesh of scene.meshes) if (!mesh.isDescendantOf(root)) mesh.setEnabled(false);
      const Vector = camera.position.constructor, minimum = new Vector(Infinity, Infinity, Infinity), maximum = new Vector(-Infinity, -Infinity, -Infinity);
      for (const mesh of root.getChildMeshes().filter(mesh => mesh.isEnabled() && mesh.isVisible)) {
        const points = mesh.getPositionData(true, true) || [], matrix = mesh.computeWorldMatrix(true);
        for (let i = 0; i < points.length; i += 3) {
          const point = Vector.TransformCoordinates(Vector.FromArray(points, i), matrix);
          minimum.minimizeInPlace(point); maximum.maximizeInPlace(point);
        }
      }
      camera.alpha = -Math.PI / 2 + ${angles[angle]}; camera.beta = 1.42; camera.fov = .55;
      const size = maximum.subtract(minimum);
      camera.radius = (Math.max(size.y, size.x) + size.z * .15) / (2 * Math.tan(camera.fov / 2) * .78);
      camera.target.copyFrom(minimum.add(maximum).scale(.5));
    }
    scene.render();
  })()`);
}

async function captureCharacter(url, output, sample, source) {
  const style = source === 'wilds';
  const app = await openApp(url, { width: 800, height: 800, scale: 1, theme: 'day', reducedMotion: true, ...(style ? views['wilds-style'].settings : {}) });
  try {
    if (style) {
      await views['wilds-style'].go(app);
      await app.js(`window.__littleHours.wilds.presentation(${JSON.stringify({ subject: sample.subject, angle: sample.angle, theme: 'day', backdrop: 'portrait' })})`);
      await app.js('window.__lhFrozenAt = window.__lhStartAt + 5000');
    } else await referenceCharacter(app, sample);
    await sleep(150);
    if (app.errors.length) throw new Error(app.errors.join('\n'));
    await app.shot(output);
  } finally { await app.close(); }
}

async function captureScenery(url, outputs, { theme, turn }) {
  const reference = await openApp(url, { width: 1200, height: 800, scale: 1, theme, reducedMotion: true });
  let camera;
  try {
    await views.forest.go(reference);
    await isolateCanvas(reference, 'window.__littleHours.forest.diagnostics()');
    camera = await reference.js(`(() => {
      const d = window.__littleHours.forest.diagnostics();
      d.engine.stopRenderLoop();
      d.camera.rotation.y += ${turn};
      const rain = d.scene.getMaterialByName('island-rain-paint');
      rain?.setFloat('time', 0); rain?.setFloat('aspect', d.engine.getRenderWidth() / d.engine.getRenderHeight());
      d.camera.getViewMatrix(true); d.scene.render();
      return { position: d.camera.position.asArray(), target: d.camera.getTarget().asArray(), fov: d.camera.fov };
    })()`);
    if (reference.errors.length) throw new Error(reference.errors.join('\n'));
    await reference.shot(outputs.reference);
  } finally { await reference.close(); }
  const style = await openApp(url, { width: 1200, height: 800, scale: 1, theme, reducedMotion: true, ...views['wilds-style'].settings });
  try {
    await views['wilds-style'].go(style);
    await style.js(`window.__littleHours.wilds.presentation(${JSON.stringify({ subject: 'scenery', actors: false, theme, camera })})`);
    await style.js('window.__lhFrozenAt = window.__lhStartAt + 5000');
    await sleep(150);
    if (style.errors.length) throw new Error(style.errors.join('\n'));
    await style.shot(outputs.wilds);
  } finally { await style.close(); }
}

export async function captureStylePairs(url, out, category) {
  if (category && !Object.hasOwn(STYLE_CASES, category)) throw new Error('Choose scenery or characters');
  const folder = join(out, 'pairs'); mkdirSync(folder, { recursive: true });
  const key = {};
  for (const [kind, cases] of Object.entries(STYLE_CASES)) {
    if (category && category !== kind) continue;
    key[kind] = blindOrder(cases);
    writeFileSync(join(out, 'private-key.json'), JSON.stringify(key, null, 2));
    for (const { sample, pair, wilds } of key[kind]) {
      const outputs = { wilds: join(folder, `${kind}-${pair}-${wilds}.jpg`), reference: join(folder, `${kind}-${pair}-${wilds === 'A' ? 'B' : 'A'}.jpg`) };
      if (kind === 'scenery') await captureScenery(url, outputs, sample);
      else for (const source of wilds === 'A' ? ['wilds', 'reference'] : ['reference', 'wilds']) await captureCharacter(url, outputs[source], sample, source);
      console.log(`${kind} pair ${pair}: captured A and B`);
    }
  }
  return folder;
}
