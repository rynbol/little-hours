// Wall and floor choices for each room design. The first choice is the design
// as it was built; each other choice repaints some of the design's own wall or
// floor colors (`paint` maps a design color to its new color). A room keeps
// its choices with its layout, so every saved room has its own.
const choice = (id, name, swatch, paint = {}) => ({ id, name, swatch, paint });
const boards = ['#855b43', '#92654a', '#9c6e50', '#805640', '#8c6249', '#a27352'];
const planks = (name, id, colors) => choice(id, name, [colors[1], colors[5]], Object.fromEntries(boards.map((hex, i) => [hex, colors[i]])));
export const SURFACES = {
  retreat: {
    walls: [
      choice('', 'Sage and cream', ['#80917d', '#c9bba2']),
      choice('rose', 'Rose and linen', ['#b28e88', '#ddcdb9'], { '#80917d': '#b28e88', '#c9bba2': '#ddcdb9', '#52695c': '#7a5957', '#647869': '#8c6a66' }),
      choice('blue', 'Dusk blue', ['#7f93a3', '#cfc6b3'], { '#80917d': '#7f93a3', '#c9bba2': '#cfc6b3', '#52695c': '#4b5d6e', '#647869': '#5d7082' }),
      choice('honey', 'Honey and oat', ['#b9955f', '#dccbaa'], { '#80917d': '#b9955f', '#c9bba2': '#dccbaa', '#52695c': '#6f5537', '#647869': '#826545' }),
    ],
    floor: [
      choice('', 'Honey oak', ['#92654a', '#a27352']),
      planks('Walnut', 'walnut', ['#5d3f30', '#674635', '#704d3a', '#5a3c2d', '#634334', '#7a543e']),
      planks('Pale oak', 'pale', ['#bf9f7d', '#c9aa87', '#d1b391', '#bb9b79', '#c5a683', '#d8bd9b']),
      planks('Grey ash', 'ash', ['#8a7f73', '#94887b', '#9c9183', '#867b6f', '#908578', '#a39789']),
    ],
  },
  sakura: {
    walls: [
      choice('', 'Rice plaster', ['#eee2c6', '#e8ddc4']),
      choice('blossom', 'Blossom plaster', ['#efd6cf', '#e8cfc8'], { '#eee2c6': '#efd6cf', '#e8ddc4': '#e8cfc8', '#f8efd4': '#f8e9e4' }),
      choice('matcha', 'Matcha plaster', ['#dde2c4', '#d6dcbd'], { '#eee2c6': '#dde2c4', '#e8ddc4': '#d6dcbd', '#f8efd4': '#f0f2df' }),
      choice('wisteria', 'Wisteria plaster', ['#d9d3e3', '#d2ccdd'], { '#eee2c6': '#d9d3e3', '#e8ddc4': '#d2ccdd', '#f8efd4': '#f0edf5' }),
    ],
    floor: [
      choice('', 'Tatami', ['#c8bd87', '#d7ca97']),
      choice('fresh', 'Fresh tatami', ['#b8bf86', '#c8ce96'], { '#7c7655': '#6f7650', '#c8bd87': '#b8bf86', '#d7ca97': '#c8ce96', '#bdb27f': '#abb279' }),
      choice('aged', 'Golden tatami', ['#cdb57c', '#dac38b'], { '#7c7655': '#80704c', '#c8bd87': '#cdb57c', '#d7ca97': '#dac38b', '#bdb27f': '#bfa76f' }),
      choice('smoked', 'Smoked tatami', ['#a59d74', '#b3ab82'], { '#7c7655': '#5d5a45', '#c8bd87': '#a59d74', '#d7ca97': '#b3ab82', '#bdb27f': '#999169' }),
    ],
  },
  cloud: {
    walls: [
      choice('', 'Lilac and blush', ['#b5afcf', '#dcbfcf']),
      choice('mint', 'Mint', ['#a9c6bf', '#cfe0d4'], { '#b5afcf': '#a9c6bf', '#dcbfcf': '#cfe0d4' }),
      choice('peach', 'Peach', ['#e0b4a2', '#f0d2c0'], { '#b5afcf': '#e0b4a2', '#dcbfcf': '#f0d2c0' }),
      choice('sky', 'Sky', ['#a8bad6', '#cbd8ea'], { '#b5afcf': '#a8bad6', '#dcbfcf': '#cbd8ea' }),
    ],
    floor: [
      choice('', 'Blush check', ['#dfc6c0', '#f3e7db']),
      choice('mint', 'Mint check', ['#c5dacd', '#eef4e8'], { '#dfc6c0': '#c5dacd', '#f3e7db': '#eef4e8' }),
      choice('lilac', 'Lilac check', ['#d4cae1', '#f2eef5'], { '#dfc6c0': '#d4cae1', '#f3e7db': '#f2eef5' }),
      choice('butter', 'Butter check', ['#ecd9aa', '#f9f1dc'], { '#dfc6c0': '#ecd9aa', '#f3e7db': '#f9f1dc' }),
    ],
  },
  metro: {
    walls: [
      choice('', 'Midnight brick', ['#434b61', '#976e69']),
      choice('red', 'Red brick', ['#3d3f4c', '#a35a4b'], { '#434b61': '#3d3f4c', '#5b4f5b': '#4f3f3f', '#826365': '#8e4c42', '#976e69': '#a35a4b', '#765b61': '#7c443b', '#aa7d70': '#b46753' }),
      choice('painted', 'Painted brick', ['#5b6173', '#d5cfc7'], { '#434b61': '#5b6173', '#5b4f5b': '#a39c95', '#826365': '#c9c2ba', '#976e69': '#d5cfc7', '#765b61': '#bfb8b0', '#aa7d70': '#ddd7cf' }),
      choice('green', 'Bottle green', ['#34463f', '#7c8e78'], { '#434b61': '#34463f', '#5b4f5b': '#475a51', '#826365': '#6d7f6b', '#976e69': '#7c8e78', '#765b61': '#61725f', '#aa7d70': '#879a82' }),
    ],
    floor: [
      choice('', 'Slate tiles', ['#677080', '#747b89']),
      choice('clay', 'Clay tiles', ['#80665a', '#8d7266'], { '#677080': '#80665a', '#747b89': '#8d7266' }),
      choice('concrete', 'Pale concrete', ['#8e9097', '#9a9ca3'], { '#677080': '#8e9097', '#747b89': '#9a9ca3' }),
      choice('ink', 'Ink tiles', ['#484e5c', '#525868'], { '#677080': '#484e5c', '#747b89': '#525868' }),
    ],
  },
};
export const surfaceChoices = (style, kind) => SURFACES[style || 'retreat']?.[kind] || [];
// The paint of a saved choice, or null for the design's own surface.
export const surfacePaint = (style, kind, id) => (id && surfaceChoices(style, kind).find(entry => entry.id === id)?.paint) || null;
