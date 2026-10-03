# Sources

Stage 1 uses original capsule, terrain and training geometry. Terrain samples the existing plain JavaScript `world-terrain.js` functions; no retired Wilds meshes or models are used. The capsule is the explicit Stage 1 placeholder and will be replaced by a Blender character in Stage 5.

Rendering: [three.js](https://github.com/mrdoob/three.js), pinned to 0.186.1, MIT licence. Cleanup follows the renderer's explicit disposal and context-loss APIs; shaders are compiled before the first playable frame.

The four owner-specified mood references are held outside the repository. No downloaded models, packs, textures or sounds are included in this checkpoint.

Stage 2 adds original merged stag, cat, standing-stone and camp block-outs, along with synthesized Web Audio combat cues. These are authored for this restart. The stag and pet block-outs will be replaced by their own Blender models in Stages 4 and 5; they are not finished character assets.

Stage 3 adds original authored terrain dressing, broadleaf and pine geometry, curved individual grass blades, leaf clusters, camp cloth and props, ruins, standing stones, moss, reeds, water and sky shaders. All were built for this restart in `src/models/wilds/valley.js`, `discoveries.js` and `materials.js`; no external packs, raster art or retired assets were used. Physical landmarks come from the shared new world definitions. The four mood references remain outside Git. Modelled Blender actors replace the temporary character shapes in the following stages.
