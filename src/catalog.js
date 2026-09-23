// Every catalog object is modeled by hand in furniture.js, using real geometry.
const FRAME_ARTS = ['herbarium', 'hills', 'sea', 'kitten', 'blossom', 'stars', 'fern'];
// `height` is the top of the model above the floor, kept in step with the
// geometry by a test; wall pieces and fixtures use it to avoid tall furniture.
// `use` is what a tap does outside Decorate: `toggle` switches a light, the
// fire or the record player (saved as `off`), `react` plays a short motion.
export const FURNITURE = [
  { id: 'study-desk', name: 'Oak study station', category: 'Study', description: 'A generous oak desk, laptop, shaded lamp and a chair for your study companion.', footprint: [3, 2.1], height: 2.11, use: { toggle: 'lamp' }, color: '#ac7953', blocking: true },
  { id: 'writing-desk', name: 'Little writing desk', category: 'Study', description: 'A compact cream desk with a journal, pencil cup and a warm terracotta chair.', footprint: [2.5, 2.1], height: 2.11, use: { toggle: 'lamp' }, color: '#d8ccb1', blocking: true },
  { id: 'bookcase', name: 'Collected bookcase', category: 'Storage', description: 'Four shelves of well-loved books, a ceramic vase and a linen basket.', footprint: [1.9, 0.65], height: 3.42, use: { react: 'book' }, color: '#9c7150', blocking: true },
  { id: 'lounge-chair', name: 'Sunday armchair', category: 'Seating', description: 'Soft sage cushions, a honey-colored pillow and a tasseled throw.', footprint: [1.7, 1.8], height: 1.38, use: { react: 'squish' }, color: '#82958b', blocking: true },
  { id: 'side-table', name: 'Tea time table', category: 'Storage', description: 'A small turned-wood table, a book and your favorite little cup.', footprint: [0.85, 0.85], height: 0.84, use: { react: 'steam' }, color: '#b7895d', blocking: true },
  { id: 'floor-lamp', name: 'Pleated floor lamp', category: 'Lighting', description: 'A brass stem and a gently glowing linen shade for the reading corner.', footprint: [0.7, 0.7], height: 2.22, use: { toggle: 'lamp' }, color: '#d7b783', blocking: true },
  { id: 'plant', name: 'Terracotta greenery', category: 'Plants', description: 'A hand-shaped leafy plant in a rimmed terracotta pot.', footprint: [0.9, 0.9], height: 1.36, use: { react: 'rustle' }, color: '#819566', blocking: true },
  { id: 'rug', name: 'Woven morning rug', category: 'Rugs', description: 'Layered warm linen, a geometric border and little woven tassels.', footprint: [3.5, 2.25], height: 0.056, color: '#d6c29b', blocking: false },
  { id: 'ottoman', name: 'Round linen pouf', category: 'Seating', description: 'A low, softly rounded footrest with a piped edge and stitched panels.', footprint: [1.05, 1.05], height: 0.51, use: { react: 'squish' }, color: '#baa07a', blocking: true },
  { id: 'low-cabinet', name: 'Record cabinet', category: 'Storage', description: 'Sliding oak doors, tapered feet and a tiny record player on top.', footprint: [1.8, 0.8], height: 1.05, use: { toggle: 'record' }, color: '#b58862', blocking: true },
  { id: 'fireplace', name: 'Emberwood hearth', category: 'Lighting', description: 'A walnut mantel, carved stone arch, glowing embers and a little gathering of candlelight.', footprint: [2.7, 1.15], height: 2.95, use: { toggle: 'fire' }, color: '#9e694c', blocking: true },
  { id: 'daybed', name: 'Velvet dreaming sofa', category: 'Seating', description: 'A deep plum daybed with moss velvet pillows, carved feet and a draped golden throw.', footprint: [3.1, 1.65], height: 1.34, use: { react: 'squish' }, color: '#795765', blocking: true },
  { id: 'moon-tree', name: 'Moonleaf tree', category: 'Plants', description: 'A branching indoor tree with hand-shaped leaves, a brass pot and tiny hanging stars.', footprint: [1.8, 1.8], height: 3.22, use: { react: 'rustle' }, color: '#68816a', blocking: true },
  { id: 'lantern-cluster', name: 'Wandering lanterns', category: 'Lighting', description: 'Three little brass lanterns, beeswax candles and glowing stars for the quiet hours.', footprint: [1.05, 1.05], height: 1.03, use: { toggle: 'candles' }, color: '#d1a458', blocking: true },
  { id: 'bean-bag', name: 'Cloud bean bag', category: 'Seating', description: 'A deep, soft bean bag with a sunk-in seat and a raised back.', footprint: [1.3, 1.25], height: 0.92, use: { react: 'squish' }, color: '#c9a27e', blocking: true },
  { id: 'monstera', name: 'Swiss cheese plant', category: 'Plants', description: 'Big split leaves on tall stems, in a cream ceramic pot.', footprint: [1.3, 1.3], height: 1.93, use: { react: 'rustle' }, color: '#5f7d4f', blocking: true },
  { id: 'tea-cart', name: 'Brass tea cart', category: 'Storage', description: 'Two oak trays on little wheels: a teapot, cups and biscuits on top, books below. Tap it for a puff of steam.', footprint: [1.25, 0.75], height: 1.045, use: { react: 'steam' }, color: '#bf9762', blocking: true },
  // Curios: a tap switches the aquarium's lid lamp and spins the globe; the
  // easel shows a picture of your choice, like the frames.
  { id: 'fish-tank', name: 'Little aquarium', category: 'Curios', description: 'Three bright fish, sea grass and a stone arch in a tank on an oak stand. Tap it to switch the lid lamp.', footprint: [1.7, 0.8], height: 1.58, use: { toggle: 'lamp' }, color: '#8fc3bf', blocking: true },
  { id: 'globe', name: 'Brass floor globe', category: 'Curios', description: 'A little painted world in a brass meridian, on a turned oak stand. Tap it to spin it.', footprint: [0.8, 0.8], height: 1.465, use: { react: 'spin' }, color: '#6f96ae', blocking: true },
  { id: 'easel', name: "Painter's easel", category: 'Curios', description: 'An oak easel with a canvas, a ledge and a jar of brushes. Pick the picture.', footprint: [1, 1], height: 2.1, arts: FRAME_ARTS, color: '#f1e6cf', blocking: true },
  { id: 'moon-rug', name: 'Midnight constellation rug', category: 'Rugs', description: 'A round indigo rug with a woven moon, tiny stars and a warm tasseled border.', footprint: [3.6, 3.6], height: 0.08, color: '#676779', blocking: false },
  // Wall pieces hang on the back or side wall: `size` is their width and height
  // on the wall, `depth` how far they stand out, `arts` the pictures to choose.
  { id: 'tall-frame', name: 'Walnut picture frame', category: 'Wall decor', description: 'A deep walnut frame for a favorite little picture. Pick the picture.', mount: 'wall', size: [1.04, 1.4], depth: 0.14, arts: FRAME_ARTS, color: '#503d30', blocking: false },
  { id: 'small-frame', name: 'Honey picture frame', category: 'Wall decor', description: 'A small honey-wood frame. Pick the picture.', mount: 'wall', size: [0.74, 1.02], depth: 0.14, arts: FRAME_ARTS, color: '#ac8357', blocking: false },
  { id: 'wide-frame', name: 'Landscape frame', category: 'Wall decor', description: 'A wide walnut frame for a landscape. Pick the picture.', mount: 'wall', size: [1.5, 1.04], depth: 0.14, arts: FRAME_ARTS, color: '#6b4b3b', blocking: false },
  { id: 'moon-clock', name: 'Moon clock', category: 'Wall decor', description: 'A brass pendulum clock that keeps the real time.', mount: 'wall', size: [0.86, 1.64], depth: 0.14, color: '#bf9762', blocking: false },
  { id: 'apothecary-shelf', name: 'Potion shelf', category: 'Wall decor', description: 'A little wooden shelf of glass bottles in sage, honey and plum.', mount: 'wall', size: [1.4, 0.705], depth: 0.61, color: '#926747', blocking: false },
  { id: 'wall-shelf', name: 'Floating book shelf', category: 'Wall decor', description: 'A floating oak shelf with a few books, a candle and a trailing plant.', mount: 'wall', size: [1.6, 0.62], depth: 0.42, color: '#aa7954', blocking: false },
  { id: 'hanging-plant', name: 'Trailing wall planter', category: 'Wall decor', description: 'A terracotta planter on a brass bracket, with leaves that trail down.', mount: 'wall', size: [0.8, 1.3], depth: 0.45, color: '#819566', blocking: false },
  { id: 'cloud-shelf', name: 'Cloud shelf', category: 'Wall decor', description: 'A soft cream shelf edged with little clouds, books and a vase.', mount: 'wall', size: [2.69, 0.75], depth: 0.565, color: '#f5e6d9', blocking: false },
  { id: 'small-cloud-shelf', name: 'Little cloud shelf', category: 'Wall decor', description: 'A shorter cloud shelf with books and a rose-colored vase.', mount: 'wall', size: [2.26, 0.75], depth: 0.565, color: '#f5e6d9', blocking: false },
  { id: 'wall-scroll', name: 'Blossom scroll', category: 'Wall decor', description: 'A linen hanging scroll with an ink branch and cherry blossoms.', mount: 'wall', size: [1.5, 2.41], depth: 0.19, color: '#faf0da', blocking: false },
  { id: 'neon-orbit', name: 'Neon orbit sign', category: 'Wall decor', description: 'A lilac ring and a pink streak on a navy panel. Tap it to switch it.', mount: 'wall', size: [1.66, 2.4], depth: 0.23, use: { toggle: 'lamp' }, color: '#a997ff', blocking: false },
  { id: 'record-sleeve', name: 'Framed record', category: 'Wall decor', description: 'A favorite record in a dark frame. Pick the sleeve color.', mount: 'wall', size: [1.22, 1.22], depth: 0.24, arts: ['lilac', 'coral', 'sage', 'honey'], color: '#b4aecb', blocking: false },
  { id: 'felt-rainbow', name: 'Felt rainbow', category: 'Wall decor', description: 'Three soft felt arches in peach, cream and lilac.', mount: 'wall', size: [2.34, 1.24], depth: 0.14, color: '#eabfa1', blocking: false },
  // A window (`opening`) cuts a real opening in its wall: daylight falls
  // through it onto the floor, and the room's own view shows behind it.
  { id: 'cottage-window', name: 'Cottage window', category: 'Windows', description: 'A four-pane timber window with a deep sill. Daylight falls through it.', mount: 'wall', opening: true, size: [1.5, 1.7], depth: 0.2, color: '#aa7954', blocking: false },
  { id: 'arched-window', name: 'Arched window', category: 'Windows', description: 'A tall window with a round top and six small panes.', mount: 'wall', opening: true, size: [1.1, 2.3], depth: 0.2, color: '#aa7954', blocking: false },
  { id: 'round-window', name: 'Round window', category: 'Windows', description: 'A little round window with a cross of glazing bars.', mount: 'wall', opening: true, size: [1.2, 1.2], depth: 0.14, color: '#bc9169', blocking: false },
];

const furnitureById = new Map(FURNITURE.map(item => [item.id, item]));
export function getFurniture(type) { return furnitureById.get(type); }
