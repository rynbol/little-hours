export function createStatics(list, cell = 8) {
  const cells = new Map(), found = [], widest = list.reduce((most, solid) => Math.max(most, solid.radius), 0);
  const key = (i, j) => i * 65536 + j;
  for (const solid of list) {
    const k = key(Math.floor(solid.x / cell), Math.floor(solid.z / cell));
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(solid);
  }
  return {
    list,
    near(x, z, reach) {
      found.length = 0;
      const r = reach + widest;
      for (let i = Math.floor((x - r) / cell); i <= Math.floor((x + r) / cell); i++) for (let j = Math.floor((z - r) / cell); j <= Math.floor((z + r) / cell); j++) {
        const entries = cells.get(key(i, j));
        if (entries) for (const solid of entries) found.push(solid);
      }
      return found;
    },
  };
}
