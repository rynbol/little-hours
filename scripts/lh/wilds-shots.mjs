import { writeFileSync } from 'node:fs';

export const WILDS_SHOTS = {
  player: { position: [-106.5, -180], camera: [2.8, 1.6, -4.2], target: [0, .95, 0], crop: [.34, .22, .32, .64] },
  grass: { position: [-111, -185], camera: [3, 1.25, 6], target: [0, .35, -6], crop: [.2, .4, .6, .48], empty: true },
  meadow: { position: [-118, -190], camera: [1.1, 2.3, 5.4], target: [-.6, .9, -9], crop: [.25, .45, .5, .5] },
  vista: { position: [-118, -190], camera: [2, 7, 16], target: [-8, -1, -60], crop: [.2, .3, .6, .4], empty: true },
  wind: { position: [-118, -190], camera: [1.1, 2.3, 5.4], target: [-.6, .9, -9], crop: [.25, .45, .5, .5], empty: true, motion: true },
};

export function wildsShotView(piece) {
  const shot = WILDS_SHOTS[piece];
  return {
    about: `fixed ${piece} reference view`, scene: 'wilds', crop: shot.crop,
    settings: { path: '/checks/wilds.html', storageKey: 'little-hours-wilds-check-v1', reducedMotion: !shot.motion, randomSeed: 7 },
    async go(app) {
      await app.waitFor('window.__littleHours.wilds.ready()', { what: 'the Wilds', timeout: 60000 });
      await app.js(`window.__lhFrozenAt = window.__lhStartAt + 4000`);
      await app.js(`window.__littleHours.wilds.place({position:{x:${shot.position[0]},z:${shot.position[1]}},yaw:0,camera:{yaw:0,pitch:.1,distance:5}})`);
      await app.waitFor('!window.__littleHours.wilds.diagnostics().world.pending && !window.__littleHours.wilds.diagnostics().world.lighting?.pending', { what: 'terrain and lighting', timeout: 60000 });
      await app.js(`(() => {
        const d = window.__littleHours.wilds.diagnostics(), p = d.player.position, v = d.camera.position.clone(), camera = new d.camera.constructor('wilds-piece-camera', v.clone(), d.scene);
        d.scene.activeCamera = camera;
        camera.position.set(p.x + ${shot.camera[0]}, p.y + ${shot.camera[1]}, p.z + ${shot.camera[2]});
        camera.fov = .95;
        v.set(p.x + ${shot.target[0]}, p.y + ${shot.target[1]}, p.z + ${shot.target[2]});
        camera.setTarget(v);
        document.querySelector('.wilds-hud')?.style.setProperty('visibility', 'hidden');
        document.querySelector('nav')?.style.setProperty('visibility', 'hidden');
        d.scene.getTransformNodeByName('wilds-combat')?.setEnabled(false);
        ${shot.empty ? "d.scene.getTransformNodeByName('wilds-player')?.setEnabled(false);" : ''}
      })()`);
    },
  };
}

export async function captureWildsCrop(app, path, crop, viewport) {
  const [x, y, width, height] = crop;
  const result = await app.send('Page.captureScreenshot', { format: 'png', clip: { x: x * viewport.width, y: y * viewport.height, width: width * viewport.width, height: height * viewport.height, scale: 2 }, captureBeyondViewport: false });
  writeFileSync(path, Buffer.from(result.data, 'base64'));
  return path;
}
