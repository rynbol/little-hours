export const MULLION = Object.freeze({ width: 0.065, depth: 0.15, bevel: 0.02 });

export function moulding(length, axis = 'y', { width, depth, bevel } = MULLION) {
  const front = depth / 2, face = width * 0.72, inset = 0.03;
  const parts = [
    { tone: 'core', across: width, deep: depth, offset: 0, at: 0, long: length, bevel },
    { tone: 'face', across: face, deep: 0.02, offset: 0, at: front + 0.004, long: length - inset, bevel: 0.006 },
    ...[-1, 1].map(side => ({ tone: 'lit', across: 0.009, deep: 0.009, offset: side * face / 2, at: front + 0.01, long: length - inset, bevel: 0 })),
    ...[-0.22, 0.17].map(across => ({ tone: 'grain', across: 0.003, deep: 0.002, offset: across * face, at: front + 0.0145, long: length - inset * 3, bevel: 0 })),
  ];
  return parts.map(({ tone, across, deep, offset, at, long, bevel: round }) => ({
    tone,
    size: axis === 'y' ? [across, long, deep] : [long, across, deep],
    at: axis === 'y' ? [offset, 0, at] : [0, offset, at],
    bevel: round,
  }));
}

export function sillNosing(length, { height, depth }) {
  const front = depth / 2, top = height / 2;
  return [
    { tone: 'lit', rod: [[-length / 2, top - 0.02, front - 0.012], [length / 2, top - 0.02, front - 0.012]], radius: 0.024 },
    { tone: 'shadow', size: [length - 0.08, 0.014, 0.014], at: [0, -top - 0.002, front - 0.05] },
    ...[-0.16, 0.05].map(z => ({ tone: 'grain', size: [length - 0.2, 0.003, 0.004], at: [0, top + 0.001, z] })),
  ];
}
