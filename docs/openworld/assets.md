# Sources

Stage 1 uses original capsule, terrain and training geometry. Terrain samples the existing plain JavaScript `world-terrain.js` functions; no retired Wilds meshes or models are used. The capsule is the explicit Stage 1 placeholder and will be replaced by a Blender character in Stage 5.

Rendering: [three.js](https://github.com/mrdoob/three.js), pinned to 0.186.1, MIT licence. Cleanup follows the renderer's explicit disposal and context-loss APIs; shaders are compiled before the first playable frame.

The four owner-specified mood references are held outside the repository. No downloaded models, packs, textures or sounds are included in this checkpoint.

Stage 2 adds original merged stag, cat, standing-stone and camp block-outs, along with synthesized Web Audio combat cues. These are authored for this restart. The stag and pet block-outs will be replaced by their own Blender models in Stages 4 and 5; they are not finished character assets.
