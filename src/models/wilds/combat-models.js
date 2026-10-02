import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateBoxVertexData } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';

function geometryBatch() {
  const positions = [], normals = [], colors = [], indices = [];
  function add(data, color, position, scale = [1, 1, 1], rotation = Quaternion.Identity()) {
    data.transform(Matrix.Compose(Vector3.FromArray(scale), rotation, Vector3.FromArray(position)));
    const offset = positions.length / 3, tone = Color3.FromHexString(color);
    positions.push(...data.positions); normals.push(...data.normals);
    for (let i = 0; i < data.positions.length / 3; i++) colors.push(tone.r, tone.g, tone.b, 1);
    for (const index of data.indices) indices.push(index + offset);
  }
  return {
    sphere(position, scale, color) { add(CreateSphereVertexData({ diameter: 2, segments: 4 }), color, position, scale); },
    box(position, scale, color) { add(CreateBoxVertexData({ size: 1 }), color, position, scale); },
    branch(from, to, radius, tip, color) {
      const a = Vector3.FromArray(from), b = Vector3.FromArray(to), direction = b.subtract(a);
      add(CreateCylinderVertexData({ height: direction.length(), diameterBottom: radius * 2, diameterTop: tip * 2, tessellation: 7 }), color, a.add(b).scale(.5).asArray(), [1, 1, 1], Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), new Quaternion()));
    },
    mesh(name, scene, parent, material) {
      const mesh = new Mesh(name, scene);
      Object.assign(new VertexData(), { positions, normals, colors, indices }).applyToMesh(mesh);
      mesh.parent = parent; mesh.material = material; mesh.useVertexColors = true; mesh.hasVertexAlpha = false; mesh.isPickable = false;
      return mesh;
    },
  };
}

function wardenGeometry() {
  const batch = geometryBatch(), stone = '#727e70', light = '#9aa68c', dark = '#4d6058', moss = '#677d3c', tips = '#d4c591';
  batch.sphere([0, 2.25, .15], [1.15, 1.1, 1.9], stone);
  batch.sphere([0, 2.8, -.85], [.9, 1.3, .85], light);
  batch.sphere([0, 3.7, -1.55], [.57, .72, .7], stone);
  batch.sphere([0, 3.4, -2.08], [.38, .32, .62], dark);
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      const x = side * .7, z = end * 1.03;
      batch.branch([x, 2.25, z], [x * 1.08, .8, z + end * .22], .29, .19, stone);
      batch.branch([x * 1.08, .8, z + end * .22], [x, .18, z], .2, .15, dark);
      batch.sphere([x, .17, z - .1], [.26, .2, .35], dark);
    }
    batch.sphere([side * .66, 4.1, -1.43], [.4, .2, .19], moss);
    batch.sphere([side * .48, 3.85, -1.96], [.1, .08, .11], '#dfcc76');
    const base = [side * .36, 4.12, -1.42], fork = [side * 1.18, 5.13, -1.08], crown = [side * 1.55, 6.05, -.52];
    batch.branch(base, fork, .19, .13, dark);
    batch.branch(fork, crown, .13, .045, tips);
    batch.branch([side * .85, 4.78, -1.21], [side * 1.55, 5.25, -1.95], .1, .025, tips);
    batch.branch(fork, [side * 1.93, 5.5, -1.25], .09, .025, tips);
    batch.branch([side * 1.38, 5.63, -.8], [side * 1.1, 6.2, -.95], .065, .02, tips);
    batch.sphere([side * .68, 3.02, .48], [.58, .34, 1.1], moss);
    for (let i = 0; i < 3; i++) batch.sphere([side * (.3 + i * .22), 3.1 - i * .09, 1.2 - i * .4], [.4, .2, .5], i % 2 ? '#8b9954' : moss);
  }
  batch.branch([0, 2.65, 1.62], [0, 2.4, 2.36], .2, .06, moss);
  return batch;
}

function terrainMark(mark, surfaceAt) {
  const positions = [], indices = [];
  const ground = (x, z) => surfaceAt(x, z)?.height ?? mark.origin.y;
  const vertex = (x, z) => { positions.push(x, ground(x, z) + .075, z); return positions.length / 3 - 1; };
  if (mark.length > 0) {
    const segments = Math.ceil(mark.length / 1.5), half = mark.width / 2, sideX = mark.direction.z * half, sideZ = -mark.direction.x * half;
    for (let i = 0; i <= segments; i++) {
      const x = mark.origin.x + mark.direction.x * mark.length * i / segments, z = mark.origin.z + mark.direction.z * mark.length * i / segments;
      vertex(x - sideX, z - sideZ); vertex(x + sideX, z + sideZ);
      if (i) { const a = (i - 1) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  } else {
    const segments = 48, inside = mark.innerRadius ?? mark.radius * .86;
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      for (const radius of [inside, mark.radius]) vertex(mark.origin.x + Math.cos(angle) * radius, mark.origin.z + Math.sin(angle) * radius);
      if (i) { const a = (i - 1) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  }
  const normals = []; VertexData.ComputeNormals(positions, indices, normals);
  return Object.assign(new VertexData(), { positions, normals, indices });
}

export function createCombatModels(scene, { petId = 'cat', ribbon = 0, arena, surfaceAt, createPet, signal } = {}) {
  if (signal?.aborted || scene.isDisposed) throw new DOMException('Combat model creation cancelled', 'AbortError');
  const previousMaterials = new Set(scene.materials), previousTextures = new Set(scene.textures);
  const root = new TransformNode('wilds-combat', scene), bossRoot = new TransformNode('wilds-warden', scene), swordRoot = new TransformNode('wilds-sword', scene);
  bossRoot.parent = root; swordRoot.parent = root;
  const paint = new StandardMaterial('wilds-combat-stone', scene);
  paint.diffuseColor = Color3.White(); paint.specularColor.set(.035, .04, .025); paint.ambientColor.set(.26, .3, .23);
  const glow = new StandardMaterial('wilds-heartwood-glow', scene);
  glow.diffuseColor = Color3.FromHexString('#ccb66c'); glow.emissiveColor = Color3.FromHexString('#7d7932'); glow.specularColor.set(0, 0, 0);
  const warning = new StandardMaterial('wilds-telegraph-paint', scene);
  warning.disableLighting = true; warning.emissiveColor = Color3.FromHexString('#e2ae64'); warning.alpha = .55; warning.backFaceCulling = false;
  const skillPaint = new StandardMaterial('wilds-pet-skill-paint', scene);
  skillPaint.disableLighting = true; skillPaint.emissiveColor = Color3.FromHexString('#b9d696'); skillPaint.alpha = .72; skillPaint.backFaceCulling = false;
  const body = wardenGeometry().mesh('wilds-warden-body', scene, bossRoot, paint);
  const heartBatch = geometryBatch(); heartBatch.sphere([0, 3.22, .12], [.39, .3, .7], '#ead698');
  const heart = heartBatch.mesh('wilds-warden-heartwood', scene, bossRoot, glow);
  const stonesBatch = geometryBatch();
  for (const [index, stone] of arena.stones.entries()) {
    const y = surfaceAt(stone.x, stone.z)?.height ?? stone.baseY ?? arena.center.y;
    stonesBatch.branch([stone.x, y -.18, stone.z], [stone.x + (index % 2 ? .18 : -.18), y + stone.height, stone.z], stone.radius, stone.radius * .55, '#8d9786');
    stonesBatch.sphere([stone.x, y + .25, stone.z], [stone.radius * 1.06, .4, stone.radius * 1.02], '#647944');
    stonesBatch.box([stone.x, y + stone.height * .72, stone.z - stone.radius * .69], [.14, .8, .05], '#d4cba4');
  }
  const stones = stonesBatch.mesh('wilds-standing-stones', scene, root, paint); stones.freezeWorldMatrix();
  const swordBatch = geometryBatch();
  swordBatch.branch([0, 0, 0], [0, .3, 0], .055, .055, '#665846');
  swordBatch.box([0, .32, 0], [.34, .07, .12], '#c7ad6e');
  swordBatch.box([0, .77, 0], [.12, .85, .045], '#d5ddd0');
  swordBatch.branch([0, 1.18, 0], [0, 1.34, 0], .055, 0, '#edf1de');
  const sword = swordBatch.mesh('wilds-sword-body', scene, swordRoot, paint); sword.rotation.x = -.58;
  const pet = createPet(scene, petId, ribbon); pet.root.parent = root;
  pet.animate({ action: 'stand', moving: false, walked: 0, petAge: Infinity, hearts: [], ritual: null, ritualAge: Infinity }, 0, 0, true);
  pet.contact.setEnabled(false);
  const telegraph = new Mesh('wilds-warden-telegraph', scene); telegraph.parent = root; telegraph.material = warning; telegraph.isPickable = false; telegraph.setEnabled(false);
  const skill = new Mesh('wilds-pet-skill', scene); skill.parent = root; skill.material = skillPaint; skill.isPickable = false; skill.setEnabled(false);
  const slash = new Mesh('wilds-sword-strike', scene); slash.parent = root; slash.material = skillPaint; slash.isPickable = false; slash.setEnabled(false);
  const ownedMaterials = scene.materials.filter(material => !previousMaterials.has(material)), ownedTextures = scene.textures.filter(texture => !previousTextures.has(texture));
  let disposed = false, lastTelegraph = '', lastSkill = '', lastSlash = '', bossAction = 'idle', petAction = 'idle', telegraphKind = null;
  function positionRoot(node, position, yaw = 0) { node.position.set(position.x, position.y ?? surfaceAt(position.x, position.z)?.height ?? 0, position.z); node.rotation.y = yaw; }
  function update(state) {
    if (disposed) return;
    const { boss, player, playerAction, pet: companion, now = 0 } = state;
    positionRoot(bossRoot, boss.position, boss.yaw); positionRoot(pet.root, companion.position, companion.yaw);
    bossAction = boss.action; petAction = companion.action;
    bossRoot.setEnabled(boss.mode !== 'defeated');
    heart.setEnabled(boss.mode !== 'defeated');
    glow.emissiveColor.copyFromFloats(...(boss.mode === 'exposed' ? [1, .82, .28] : boss.phase === 2 ? [.82, .5, .16] : [.49, .47, .2]));
    pet.body.visibility = companion.mode === 'knockout' ? .45 : 1;
    const rightX = Math.cos(player.yaw) * .48, rightZ = -Math.sin(player.yaw) * .48;
    positionRoot(swordRoot, { x: player.position.x + rightX, y: player.position.y + .65, z: player.position.z + rightZ }, player.yaw);
    const mark = boss.mode === 'telegraph' || boss.mode === 'charge' ? boss.telegraph : null;
    telegraphKind = mark?.kind ?? null; telegraph.setEnabled(Boolean(mark));
    const telegraphKey = mark ? JSON.stringify(mark) : '';
    if (mark && telegraphKey !== lastTelegraph) terrainMark(mark, surfaceAt).applyToMesh(telegraph, true);
    lastTelegraph = telegraphKey;
    warning.alpha = boss.mode === 'charge' ? .25 : .55;
    const skillActive = companion.action === 'skill' && now - companion.actionStartedAt < 650;
    skill.setEnabled(skillActive);
    const skillKey = skillActive ? `${companion.position.x},${companion.position.z}` : '';
    if (skillActive && skillKey !== lastSkill) terrainMark({ origin: companion.position, radius: 1.5, innerRadius: 1.27 }, surfaceAt).applyToMesh(skill, true);
    lastSkill = skillKey;
    const attacking = playerAction?.kind === 'attack'; slash.setEnabled(attacking);
    const slashKey = attacking ? `${player.position.x},${player.position.z},${player.yaw}` : '';
    if (attacking && slashKey !== lastSlash) terrainMark({ origin: { x: player.position.x - Math.sin(player.yaw) * 1.3, y: player.position.y, z: player.position.z - Math.cos(player.yaw) * 1.3 }, radius: .85, innerRadius: .71 }, surfaceAt).applyToMesh(slash, true);
    lastSlash = slashKey;
  }
  const observer = scene.onDisposeObservable.add(() => dispose());
  signal?.addEventListener('abort', dispose, { once: true });
  function dispose() {
    if (disposed) return;
    disposed = true; scene.onDisposeObservable.remove(observer); signal?.removeEventListener('abort', dispose);
    pet.dispose(); root.dispose(false, false);
    for (const material of ownedMaterials) material.dispose();
    for (const texture of ownedTextures) texture.dispose();
  }
  return {
    update,
    diagnostics: () => ({ source: 'temporary-static', petId, ribbon, bossAction, petAction, bossPosition: bossRoot.position.asArray(), petPosition: pet.root.position.asArray(), telegraph: { kind: telegraphKind, visible: telegraph.isEnabled() }, meshes: [body, heart, stones, sword, pet.body, telegraph, skill, slash].filter(mesh => mesh.isEnabled()).length, disposed }),
    dispose,
  };
}
