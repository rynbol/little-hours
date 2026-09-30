export function buildGardenTree(api, species, x, z, floor = 0, scale = 1) {
  const orb = api.orb || api.ball;
  const size = scale, cherry = species === 'cherry', willow = species === 'willow';
  const leaf = cherry ? ['#e4b7c1', '#f1ccd0', '#d6a4b4', '#ecd2d0'] : ['#95b07b', '#aec48b', '#7f9f71', '#a2b984'];
  const at = (dx, y, dz) => [x + dx * size, floor + y * size, z + dz * size];
  api.cylinder(...at(0, .64, 0), .15 * size, .29 * size, 1.28 * size, '#a48363');
  for (const side of [-1, 1]) api.box(...at(side * .23, 1.05, .025), .095 * size, .8 * size, .1 * size, '#ad8c68', -side * .5);
  for (const side of [-1, 1]) orb(...at(side * .13, .045, .02), .34 * size, .12 * size, .21 * size, '#a48363');
  const crowns = [[-.52, 1.48, .03, 1.04], [.48, 1.53, .01, 1.13], [0, 1.72, -.36, 1.18], [-.35, 2.01, -.12, 1.04], [.35, 2.09, -.07, 1.02], [0, 1.84, .4, 1.15], [0, 2.28, -.04, .85]];
  for (const [i, [dx, y, dz, width]] of crowns.entries()) orb(...at(dx, y, dz), width * size, width * .84 * size, width * .86 * size, leaf[i % 4]);
  if (willow) for (let i = 0; i < 11; i++) {
    const angle = i / 11 * Math.PI * 2, dx = Math.cos(angle) * .72, dz = Math.sin(angle) * .6;
    for (let j = 0; j < 4; j++) orb(...at(dx + Math.sin(j * .8) * .07, 1.6 - j * .19, dz), .22 * size, .36 * size, .18 * size, leaf[(i + j) % 4]);
  }
  if (cherry) for (let i = 0; i < 10; i++) {
    const angle = i * 2.4, dx = Math.cos(angle) * .64, dz = Math.sin(angle) * .64 + .13, y = 1.66 + i % 3 * .2;
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; orb(...at(dx + Math.cos(a) * .065, y + Math.sin(a) * .065, dz), .085 * size, .085 * size, .055 * size, '#f7ddd7'); }
    orb(...at(dx, y, dz + .02), .055 * size, .055 * size, .055 * size, '#e4bc79');
  }
}
