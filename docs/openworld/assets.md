# Wilds assets

Every outside source the Wilds uses, with its licence.

| Source | What it gives | Licence | How it is used |
| --- | --- | --- | --- |
| [three.js](https://github.com/mrdoob/three.js) 0.186.1 | The renderer, scene graph, materials and geometry | MIT | npm dependency, pinned in `package.json`, loaded by dynamic `import()` when the player enters the Wilds |

No downloaded models, textures, HDRIs or sounds are used yet. Every shape in the feel box is built in `src/models/wilds/`.
