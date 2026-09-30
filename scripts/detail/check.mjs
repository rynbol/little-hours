import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createFurniture } from '../../src/models/furniture.js';
import { createDetail, loadDetails } from '../../src/models/detail.js';

const types = process.argv.slice(2);
const engine = new NullEngine(), scene = new Scene(engine);
const bounds = node => {
  const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
  for (const mesh of node.getChildMeshes()) {
    mesh.computeWorldMatrix(true);
    const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox;
    minimumWorld.asArray().forEach((v, i) => { low[i] = Math.min(low[i], v); });
    maximumWorld.asArray().forEach((v, i) => { high[i] = Math.max(high[i], v); });
  }
  return [...low, ...high];
};
const sides = ['left', 'bottom', 'back', 'right', 'top', 'front'];
let failed = false;
await loadDetails(types);
for (const type of types) {
  const piece = createFurniture(type, scene), detail = createDetail(type, scene);
  detail.parent = piece;
  const body = bounds(piece.metadata.body), model = bounds(detail);
  const triangles = Object.fromEntries(detail.getChildMeshes().map(mesh => [mesh.material.name.replace('detail-', ''), mesh.getTotalIndices() / 3]));
  const off = model.map((value, i) => [sides[i], value, body[i]]).filter(([, value, want]) => Math.abs(value - want) >= 0.15);
  failed ||= off.length > 0;
  console.log(`${off.length ? 'FAIL' : 'PASS'} ${type} triangles ${JSON.stringify(triangles)}`);
  for (const [side, value, want] of off) console.log(`  ${side} is ${value.toFixed(2)}, the dollhouse piece ${want.toFixed(2)}`);
  console.log(`  dollhouse box ${body.map(v => v.toFixed(2)).join(' ')}\n  detail box    ${model.map(v => v.toFixed(2)).join(' ')}`);
}
process.exitCode = failed ? 1 : 0;
