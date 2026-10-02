import { views } from '../steps.mjs';

export default {
  about: 'load the Blender style frame, compare presentation modes, and dispose its scene',
  async run(t) {
    const app = await t.open({ ...views['wilds-style'].settings, theme: 'day', width: 1200, height: 800, reducedMotion: true });
    await views['wilds-style'].go(app);
    const diagnostic = 'window.__littleHours.wilds.diagnostics()';
    const first = await app.js(`(() => {
      const d = ${diagnostic};
      return { ready: window.__littleHours.wilds.ready(), scenery: d.world.scenery, actors: d.actors, still: d.still, theme: d.presentation.theme, drawn: d.scene.getActiveMeshes().length, shadersReady: d.scene.meshes.filter(mesh => mesh.material && mesh.isEnabled()).every(mesh => mesh.material.isReady(mesh)) };
    })()`);
    t.check('the actual Forest frame renders all three skinned Blender actors', first.ready && first.scenery === 'forest' && first.drawn > 0 && ['avatar', 'cat', 'warden'].every(id => first.actors[id].skeletons === 1 && first.actors[id].vertices > 1000 && first.actors[id].clips.includes('idle')), first);
    t.check('GPU materials compile and lh theme and reduced motion reach the view', first.shadersReady && first.still && first.theme === 'day', first);
    for (const theme of ['dusk', 'rain', 'day']) {
      await app.js(`window.__littleHours.wilds.presentation({subject:'avatar',angle:'front',backdrop:'portrait',theme:'${theme}'})`);
      const portrait = await app.js(`(() => { const d = ${diagnostic}; return { background:d.scene.clearColor.toHexString(), actors:Object.values(d.actors).filter(actor=>actor.visible).map(actor=>actor.id), theme:d.presentation.theme, world:d.scene.getTransformNodeByName('world').isEnabled() }; })()`);
      t.check(`${theme} close-up isolates the avatar against the neutral background`, portrait.background === '#DFD7CAFF' && portrait.actors.join() === 'avatar' && portrait.theme === theme && !portrait.world, portrait);
    }
    await app.js("window.__littleHours.wilds.presentation({subject:'scenery',backdrop:'forest',actors:false})");
    t.check('the scenery comparison hides all actors and restores the shared Forest', await app.js(`Object.values(${diagnostic}.actors).every(actor=>!actor.visible) && ${diagnostic}.scene.getTransformNodeByName('world').isEnabled()`));
    await app.js("window.__littleHours.wilds.presentation({subject:'group',actors:true})");
    await t.shot(app, 'group');
    await app.js('window.__littleHours.wilds.dispose()');
    t.check('disposing the preview releases its engine, scene, and canvas', await app.js(`${diagnostic}.scene.isDisposed && ${diagnostic}.phase === 'disposed' && document.querySelectorAll('canvas').length === 0 && window.__littleHours.counts().engines === 0`));
    await t.close(app);
  },
};
