// Every catalog object is modeled by hand in furniture.js, using real geometry.
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
  // The pet's own bed: one per room, always kept, never counted as a piece.
  { id: 'pet-bed', name: 'Cozy pet bed', category: 'Pets', description: 'A soft, low cushion bed where your pet naps and comes home to.', footprint: [1.2, 0.8], height: 0.18, color: '#dfd1b2', blocking: true, unique: true },
  { id: 'moon-rug', name: 'Midnight constellation rug', category: 'Rugs', description: 'A round indigo rug with a woven moon, tiny stars and a warm tasseled border.', footprint: [3.6, 3.6], height: 0.08, color: '#676779', blocking: false },
];

const furnitureById = new Map(FURNITURE.map(item => [item.id, item]));
export function getFurniture(type) { return furnitureById.get(type); }
