// Color choices for furniture. Each choice repaints some of a model's own
// colors (`paint` maps a model color to its new color). A chosen color comes
// before the room design's palette; the piece's other colors, and every color
// of a piece without a choice, still follow the room.
const choice = (id, name, paint) => ({ id, name, swatch: Object.values(paint)[0], paint });
export const TINTS = {
  daybed: [
    choice('moss', 'Moss velvet', { '#785965': '#667a5f', '#91707c': '#7f9477', '#ad8690': '#9aab8e' }),
    choice('rose', 'Rose velvet', { '#785965': '#a87478', '#91707c': '#c08d8f', '#ad8690': '#d4a7a6' }),
    choice('midnight', 'Midnight velvet', { '#785965': '#4d5573', '#91707c': '#666e8e', '#ad8690': '#8189a7' }),
  ],
  'lounge-chair': [
    choice('mustard', 'Mustard', { '#83968a': '#bf9352', '#a0afa0': '#d3ad6f', '#d8b477': '#8a9a86' }),
    choice('blush', 'Blush', { '#83968a': '#c1918d', '#a0afa0': '#d3aaa4' }),
    choice('slate', 'Slate', { '#83968a': '#6c7a8a', '#a0afa0': '#8794a2' }),
  ],
  ottoman: [
    choice('sage', 'Sage', { '#b3956d': '#7f9281', '#c7ad85': '#98aa97', '#dfc8a2': '#b9c5b1', '#cfb78e': '#a9b8a3' }),
    choice('plum', 'Plum', { '#b3956d': '#7c5d69', '#c7ad85': '#94747f', '#dfc8a2': '#b597a0', '#cfb78e': '#a5848f' }),
    choice('cream', 'Cream', { '#b3956d': '#d4c3a3', '#c7ad85': '#e2d5ba', '#dfc8a2': '#efe5d0', '#cfb78e': '#e0d3b8' }),
  ],
  rug: [
    choice('sage', 'Sage', { '#e1d4b3': '#bfc9ab', '#bca982': '#8f9d80', '#c8b28c': '#a7b393', '#ddcdac': '#cdd5bb', '#d6c49d': '#d5dbc6', '#baa47d': '#8a987b' }),
    choice('blush', 'Blush', { '#e1d4b3': '#ebcdc4', '#bca982': '#c49c92', '#c8b28c': '#d6b1a7', '#ddcdac': '#f0dad2', '#d6c49d': '#ecdcd5', '#baa47d': '#c0978d' }),
    choice('indigo', 'Indigo', { '#e1d4b3': '#7b819c', '#bca982': '#5a5f78', '#c8b28c': '#6b718c', '#ddcdac': '#8d93ad', '#d6c49d': '#c9c6cf', '#baa47d': '#b39d6f' }),
  ],
  'moon-rug': [
    choice('forest', 'Forest', { '#676777': '#5b7263', '#555a6d': '#4a5f52' }),
    choice('plum', 'Plum', { '#676777': '#7a5d6d', '#555a6d': '#654b5a' }),
    choice('rust', 'Rust', { '#676777': '#a0674f', '#555a6d': '#8a5541' }),
  ],
  bookcase: [
    choice('walnut', 'Walnut', { '#936c4e': '#5e4232', '#64483b': '#3f2d25', '#c29c68': '#8a6644', '#73533f': '#4a3528', '#c6a16b': '#9a7550' }),
    choice('cream', 'Cream paint', { '#936c4e': '#e6dcc6', '#64483b': '#cfc3ab', '#c29c68': '#f2ead8', '#73533f': '#d8ccb3', '#c6a16b': '#f4ecdb' }),
    choice('sage', 'Sage paint', { '#936c4e': '#7f927f', '#64483b': '#5f7163', '#c29c68': '#a9b8a3', '#73533f': '#6a7c6c', '#c6a16b': '#b3c1ad' }),
  ],
  // The record player keeps its own wood; painted doors keep the room's dark
  // legs and handles.
  'low-cabinet': [
    choice('walnut', 'Walnut', { '#aa7954': '#6e4d37', '#bc9169': '#86624a', '#c29b71': '#8b6a4f', '#73533d': '#3f2d22' }),
    choice('cream', 'Cream paint', { '#aa7954': '#e4d9c3', '#bc9169': '#efe6d3', '#c29b71': '#f3ecdd' }),
    choice('sage', 'Sage paint', { '#aa7954': '#7f927f', '#bc9169': '#98a996', '#c29b71': '#a5b5a2' }),
  ],
  'floor-lamp': [
    choice('sage', 'Sage shade', { '#e2d2ab': '#b8c4ae', '#c9b78f': '#9dac96' }),
    choice('rose', 'Rose shade', { '#e2d2ab': '#e6c0b7', '#c9b78f': '#cfa39a' }),
    choice('navy', 'Navy shade', { '#e2d2ab': '#636c89', '#c9b78f': '#4e5670' }),
  ],
  plant: [
    choice('cream', 'Cream glaze', { '#bd8469': '#e6dcc8' }),
    choice('sage', 'Sage glaze', { '#bd8469': '#8fa08e' }),
    choice('indigo', 'Indigo glaze', { '#bd8469': '#5f6784' }),
  ],
};
export const tintsFor = type => TINTS[type] || null;
export const tintPaint = (type, id) => TINTS[type]?.find(tint => tint.id === id)?.paint || null;
