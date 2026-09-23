import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo.js';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Rendering/outlineRenderer.js';
import { createFurniture, createRoundedBox, createContactShadow, createMobileCompanion, disposeFurnitureAssets, WINDOW_VIEW_DEPTH, PET_BED_SURFACE } from './furniture.js';
import { createPetModel } from './pets.js';
import { createPetRoutine, insideBed, PETS, PET_REACTION } from './pet.js';
import { createCompanionRoutine } from './companion.js';
import { createArchitecture, styleFurniture, buildWallMesh } from './architecture.js';
import { getFurniture } from './catalog.js';
import { createLayout, normalizeLayout, validatePlacement, findFreePosition, nearestValidPlacement, rugsOverlap, footprintBounds, MAX_ITEMS, pieceCount, petBed, roomDesign } from './layout.js';
import { SHELLS, isWallPiece, snapWall, openings } from './walls.js';
import { ARTWORKS, SLEEVES } from './art.js';
import { tintPaint } from './tints.js';
import { surfacePaint } from './surfaces.js';

// A real Babylon.js game scene. Every visible object is built with JavaScript;
// no generated bitmap furniture, downloaded models, or texture packs are used.
export function createRoom(container, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Your cozy miniature study room. Drag to look around. Tap a lamp, the fire or the record player to switch it; tap your pet to pet it, or drag your pet somewhere new.');
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'pan-y' });
  container.appendChild(canvas);
  const engine = options.engineFactory?.(canvas) || new Engine(canvas, true, { alpha: true, preserveDrawingBuffer: false, stencil: false, powerPreference: 'high-performance' });
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(0, 0, 0, 0);
  scene.skipPointerMovePicking = true;
  // The room owns the cursor. Babylon resets it to the arrow on every pointer
  // move, one frame before the room sets it again, so it flickered.
  scene.doNotHandleCursors = true;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = 1;
  scene.imageProcessingConfiguration.exposure = 1.08;
  const targetHome = new Vector3(0, 2.15, 0), alphaHome = Math.atan2(12.4, 10.5), betaHome = 1.071;
  const camera = new ArcRotateCamera('whole-room-camera', alphaHome, betaHome, 19, targetHome.clone(), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.1; camera.maxZ = 80;
  // A wider open-side orbit, from low desk-level views to looking into the room.
  // Stay in front of both solid walls; fitRoom keeps the dollhouse in frame.
  camera.lowerAlphaLimit = Math.PI / 18; camera.upperAlphaLimit = Math.PI * 4 / 9;
  camera.lowerBetaLimit = Math.PI / 8; camera.upperBetaLimit = Math.PI * 5 / 12;
  camera.lowerRadiusLimit = camera.upperRadiusLimit = 19;
  camera.inertia = 0.82; camera.panningSensibility = 0;
  camera.angularSensibilityX = camera.angularSensibilityY = 700;
  camera.inputs.removeByType('ArcRotateCameraMouseWheelInput');
  camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
  if (!options.engineFactory) camera.attachControl(canvas, false);
  canvas.style.touchAction = 'pan-y';
  const instrumentation = new SceneInstrumentation(scene);
  const color = value => Color3.FromHexString(value);
  const world = new TransformNode('room', scene);
  const classicArchitecture = new TransformNode('architecture-retreat', scene); classicArchitecture.parent = world;
  const decor = { plants: new TransformNode('window-greenery', scene), lights: new TransformNode('fairy-lights', scene), rug: new TransformNode('legacy-rug', scene) };
  Object.values(decor).forEach(group => { group.parent = world; });
  const materials = new Map();
  const material = (hex, extra = {}) => {
    const key = `${hex}:${JSON.stringify(extra)}`;
    if (!materials.has(key)) {
      const mat = new StandardMaterial(`paint-${key}`, scene);
      mat.diffuseColor = color(hex); mat.specularColor = color(extra.metalness ? '#75624b' : '#11110e'); mat.specularPower = extra.metalness ? 48 : 12;
      if (extra.emissive) mat.emissiveColor = color(extra.emissive).scale(extra.emissiveIntensity || 1);
      materials.set(key, mat);
    }
    return materials.get(key);
  };
  const palette = { cream: material('#c9bba2'), sage: material('#80917d'), wood: material('#926747'), darkWood: material('#503d30'), edge: material('#ac8357'), linen: material('#ebe1cc'), green: material('#758876'), dark: material('#4d5148'), brass: material('#bf9762', { metalness: 0.45 }), ginger: material('#c8884d'), gingerLight: material('#dda467'), leaf: material('#718b59') };
  let meshId = 0;
  function finish(mesh, mat, position, parent = classicArchitecture, shadow = true) {
    mesh.material = mat; mesh.position.set(...position); mesh.parent = parent;
    mesh.receiveShadows = true; mesh.isPickable = false; mesh.metadata = { castShadow: shadow }; return mesh;
  }
  function box(size, position, mat, radius = 0, parent = classicArchitecture) {
    return finish(radius > 0 ? createRoundedBox(`box-${meshId++}`, size, radius, scene) : MeshBuilder.CreateBox(`box-${meshId++}`, { width: size[0], height: size[1], depth: size[2] }, scene), mat, position, parent);
  }
  function sphere(size, position, mat, parent = classicArchitecture) {
    const mesh = finish(MeshBuilder.CreateSphere(`soft-${meshId++}`, { diameter: 2, segments: 10 }, scene), mat, position, parent);
    mesh.scaling.set(...size); return mesh;
  }
  function cylinder(top, bottom, height, position, mat, parent = classicArchitecture, segments = 16) {
    return finish(MeshBuilder.CreateCylinder(`turned-${meshId++}`, { diameterTop: top * 2, diameterBottom: bottom * 2, height, tessellation: segments }, scene), mat, position, parent);
  }
  function rod(a, b, radius, mat, parent = classicArchitecture) {
    const start = Vector3.FromArray(a), end = Vector3.FromArray(b), direction = end.subtract(start);
    const mesh = cylinder(radius, radius, direction.length(), [0, 0, 0], mat, parent, 8);
    mesh.position.copyFrom(start.add(end).scale(0.5)); mesh.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), new Quaternion()); return mesh;
  }
  function tube(points, radius, mat, parent = classicArchitecture) {
    return finish(MeshBuilder.CreateTube(`curve-${meshId++}`, { path: points.map(point => Vector3.FromArray(point)), radius, tessellation: 6, cap: Mesh.CAP_ALL }, scene), mat, [0, 0, 0], parent);
  }
  function drawing(width, height, draw, name) {
    const element = document.createElement('canvas'); element.width = width; element.height = height;
    const context = element.getContext('2d'); draw(context, width, height);
    const texture = new DynamicTexture(name, element, scene, false); texture.update(true); return texture;
  }
  function picture(width, height, texture, position, parent = classicArchitecture) {
    const mat = new StandardMaterial(`picture-${meshId++}`, scene); mat.disableLighting = true; mat.emissiveTexture = texture; mat.diffuseColor = Color3.Black(); mat.backFaceCulling = false;
    return finish(MeshBuilder.CreatePlane(`print-${meshId++}`, { width, height }, scene), mat, position, parent, false);
  }
  // Keep moving decorative objects inexpensive: vertex colors retain all the
  // painted parts in one opaque draw, with a second draw for emissive flames.
  const movingPaint = new StandardMaterial('moving-painted-details', scene);
  movingPaint.diffuseColor = Color3.White(); movingPaint.specularColor = color('#18140f'); movingPaint.specularPower = 20;
  function batchMoving(parent) {
    parent.computeWorldMatrix(true);
    const inverse = parent.getWorldMatrix().clone().invert(), batches = new Map();
    const parts = parent.getChildMeshes();
    for (const part of parts) {
      part.computeWorldMatrix(true);
      const mat = part.material, emissive = mat.emissiveColor.r + mat.emissiveColor.g + mat.emissiveColor.b > 0.1;
      const key = emissive ? mat.uniqueId : 'paint';
      if (!batches.has(key)) batches.set(key, { material: emissive ? mat : movingPaint, emissive, data: [] });
      const data = VertexData.ExtractFromMesh(part, true, true);
      data.transform(part.getWorldMatrix().multiply(inverse)); data.uvs = undefined; data.uvs2 = undefined;
      data.colors = []; const paint = mat.diffuseColor;
      for (let i = 0; i < data.positions.length; i += 3) data.colors.push(paint.r, paint.g, paint.b, 1);
      batches.get(key).data.push(data);
    }
    for (const batch of batches.values()) {
      const data = batch.data[0]; if (batch.data.length > 1) data.merge(batch.data.slice(1), true);
      const mesh = new Mesh(`${parent.name}-${batch.emissive ? 'glow' : 'body'}`, scene); data.applyToMesh(mesh); mesh.parent = parent; mesh.material = batch.material;
      mesh.useVertexColors = true; mesh.hasVertexAlpha = false; mesh.receiveShadows = true; mesh.isPickable = false; mesh.metadata = { dynamic: true, castShadow: !batch.emissive };
    }
    parts.forEach(part => part.dispose(false, false));
  }
  const hemisphere = new HemisphericLight('warm-ambient', new Vector3(0, 1, 0), scene); hemisphere.intensity = 0.55; hemisphere.diffuse = color('#ffe3c5'); hemisphere.groundColor = color('#645441');
  const sun = new DirectionalLight('window-sun', new Vector3(3, -8, -5).normalize(), scene); sun.position.set(-5, 10, 6); sun.intensity = 0.85; sun.diffuse = color('#ffdaaa');
  sun.shadowMinZ = 0.5; sun.shadowMaxZ = 35; sun.autoUpdateExtends = false;
  sun.orthoLeft = -10; sun.orthoRight = 10; sun.orthoTop = 10; sun.orthoBottom = -10;
  // The 20-unit ortho span (24 with Babylon's padding) at 2048 texels gives
  // about 1.2 cm per texel. The map is cached, so the finer map costs memory
  // and an occasional redraw, not per-frame work. The depth bias still keeps
  // filtered samples from shadowing the floor itself. Hardware PCF gives
  // smooth edges instead of Poisson grain; Babylon falls back to Poisson
  // sampling on WebGL1.
  const shadow = new ShadowGenerator(2048, sun); shadow.usePercentageCloserFiltering = true; shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadow.bias = 0.002; shadow.normalBias = 0.02; shadow.darkness = 0.24;
  shadow.getShadowMap().refreshRate = 0;
  const windowGlow = new PointLight('window-lamplight', new Vector3(-2.7, 2.7, -3.3), scene); windowGlow.diffuse = color('#ffc178'); windowGlow.intensity = 1.0; windowGlow.range = 6;
  const hearthGlow = new PointLight('hearth-lamplight', new Vector3(3.25, 1.0, -2.9), scene); hearthGlow.diffuse = color('#ffa555'); hearthGlow.intensity = 1.0; hearthGlow.range = 6;
  const bloom = new GlowLayer('candlelight-bloom', scene, { mainTextureFixedSize: 512, blurKernelSize: 24 }); bloom.intensity = 0.34;
  const glowingMeshes = new Set();

  // A generous timber retreat: deep floorboards, paneled walls and exposed beams.
  box([12.15, 0.40, 9.4], [0, -0.09, 0], palette.darkWood, 0.14);
  box([12.08, 0.16, 9.33], [0, 0.10, 0], palette.edge, 0.06);
  const boardColors = ['#855b43', '#92654a', '#9c6e50', '#805640', '#8c6249', '#a27352'];
  for (let row = 0; row < 24; row++) for (let section = 0; section < 3; section++) box([0.487, 0.052, 3.025], [row * 0.498 - 5.727, 0.193, (section - 1) * 3.045], material(boardColors[(row + section * 3) % 6]));
  // The cream side wall and the sage back wall are meshes of their own (see
  // syncOpenings), so that windows can cut them. They keep their own paint
  // materials: lit paint differs from vertex colors where bright light clamps.
  const archCenter = -2.7, archRadius = 2.1, archSpring = 3.15, windowBottom = 1.45;
  const retreatWalls = [{ wall: 'side', size: [0.22, 5.6, 9.2], xyz: [-5.94, 3.01, 0], hex: '#c9bba2' },
    ...[[12.02, 1.25, 0, 0.835], [12.02, 0.39, 0, 5.595], [1.11, 4.12, -5.455, 3.41], [6.6, 4.12, 2.7, 3.41]].map(([width, height, x, y]) => ({ wall: 'back', size: [width, height, 0.22], xyz: [x, y, -4.6], hex: '#80917d' }))];
  // Small strips fill the spandrels above the arch; the broad timber arch covers
  // their edges. This leaves a genuine opening instead of a decal on a wall.
  for (let i = 0; i < 44; i++) {
    const x = archCenter - archRadius + (i + 0.5) * archRadius * 2 / 44;
    const curveTop = archSpring + Math.sqrt(Math.max(0, archRadius ** 2 - (x - archCenter) ** 2));
    retreatWalls.push({ wall: 'back', size: [archRadius * 2 / 44 + 0.012, 5.42 - curveTop, 0.22], xyz: [x, (5.42 + curveTop) / 2, -4.6], hex: '#80917d' });
  }
  const panel = material('#52695c'), inset = material('#647869'), carved = material('#a78053');
  // The retreat's wall and floor paint, by design color, for a room's choices.
  const retreatSurfaces = { walls: [['#80917d', palette.sage], ['#c9bba2', palette.cream], ['#52695c', panel], ['#647869', inset]], floor: boardColors.map(hex => [hex, material(hex)]) };
  box([0.14, 1.1, 9.02], [-5.76, 0.80, 0], panel);
  box([11.72, 1.1, 0.14], [0.04, 0.80, -4.42], panel);
  for (let i = 0; i < 14; i++) {
    const x = -5.5 + i * 0.83;
    box([0.68, 0.67, 0.025], [x, 0.80, -4.33], inset, 0.03);
    box([0.035, 0.94, 0.045], [x - 0.37, 0.80, -4.29], palette.edge);
  }
  for (let i = 0; i < 10; i++) {
    const z = -4.05 + i * 0.90;
    box([0.025, 0.67, 0.72], [-5.67, 0.80, z], inset, 0.02);
    box([0.045, 0.94, 0.035], [-5.64, 0.80, z - 0.40], palette.edge);
  }
  [0.30, 1.36].forEach(y => { box([0.20, 0.11, 9.15], [-5.73, y, 0], palette.darkWood, 0.02); box([11.82, 0.11, 0.20], [0, y, -4.38], palette.darkWood, 0.02); });
  box([0.29, 0.22, 9.35], [-5.91, 5.80, 0], palette.darkWood, 0.03);
  box([12.15, 0.22, 0.30], [0, 5.80, -4.58], palette.darkWood, 0.03);
  [-5.76, -0.18, 5.79].forEach(x => box([0.22, 5.43, 0.32], [x, 3.04, -4.43], palette.darkWood, 0.035));
  [-4.38, -0.10, 4.38].forEach(z => box([0.30, 5.43, 0.22], [-5.74, 3.04, z], palette.darkWood, 0.035));
  // Gold inlay, visible along the dollhouse's open cut edges.
  box([12.0, 0.027, 0.035], [0, 0.15, 4.65], carved); box([0.035, 0.027, 9.2], [6.03, 0.15, 0], carved);

  const skyTexture = drawing(768, 768, () => {}, 'painted-enchanted-forest');
  // Added windows show other parts of the view; mirroring never shows a seam.
  skyTexture.wrapU = skyTexture.wrapV = DynamicTexture.MIRROR_ADDRESSMODE;
  const retreatView = picture(4.2, 3.82, skyTexture, [archCenter, 3.34, -4.64]).material;
  function paintSky(theme) {
    const ctx = skyTexture.getContext(), size = 768, daylight = theme === 'day', night = theme === 'dusk';
    const stops = daylight ? ['#8bc5dc', '#bededc', '#f7e6b4'] : night ? ['#182643', '#384667', '#8b7e9c'] : ['#5a7288', '#a1b2b8', '#d1cebb'];
    const gradient = ctx.createLinearGradient(0, 0, 0, size); stops.forEach((hex, i) => gradient.addColorStop(i / 2, hex)); ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
    if (daylight || night) {
      const halo = ctx.createRadialGradient(532, 230, 25, 532, 230, daylight ? 150 : 116);
      halo.addColorStop(0, daylight ? '#fff3bf99' : '#e4e6ff30'); halo.addColorStop(1, '#ffffff00');
      ctx.fillStyle = halo; ctx.fillRect(360, 60, 344, 344);
      ctx.fillStyle = daylight ? '#fff4c7' : '#f5e8c6'; ctx.beginPath(); ctx.arc(532, 230, daylight ? 49 : 62, 0, Math.PI * 2); ctx.fill();
    }
    if (night) {
      ctx.fillStyle = '#a0a4b529';
      for (const [x, y, r] of [[511, 215, 12], [550, 248, 17], [543, 201, 7]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#fff0ce';
      for (let i = 0; i < 58; i++) { const x = 30 + ((i * 173) % 700), y = 45 + ((i * 97) % 420); ctx.beginPath(); ctx.arc(x, y, i % 6 === 0 ? 2.2 : 1, 0, Math.PI * 2); ctx.fill(); }
    } else {
      // Soft cloud banks are drawn once when the time of day changes.
      ctx.fillStyle = daylight ? '#fff8eac9' : '#d6dee080';
      for (const [x, y, scale] of [[170, 225, 1], [600, 370, 0.78], [345, 120, 0.52]]) {
        ctx.beginPath();
        for (const [dx, dy, rx, ry] of [[-48, 8, 55, 18], [0, -3, 62, 27], [51, 11, 55, 17]]) {
          ctx.ellipse(x + dx * scale, y + dy * scale, rx * scale, ry * scale, 0, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
    const hills = daylight ? ['#90afaa', '#6f9687', '#507d69'] : night ? ['#55627b', '#384f60', '#233e49'] : ['#809398', '#607e80', '#446569'];
    [510, 575, 650].forEach((height, layer) => {
      ctx.fillStyle = hills[layer]; ctx.beginPath(); ctx.moveTo(0, size); ctx.lineTo(0, height);
      for (let x = 0; x <= size + 40; x += 30) ctx.lineTo(x, height + Math.sin(x * 0.008 + layer * 2) * 50 + Math.cos(x * 0.013) * 24); ctx.lineTo(size, size); ctx.fill();
    });
    for (let i = 0; i < 21; i++) {
      const x = i * 41 - 15, base = 700 + Math.sin(i * 2.4) * 30, height = 100 + (i % 5) * 24;
      ctx.fillStyle = daylight ? (i % 2 ? '#3e6d57' : '#578269') : (i % 2 ? '#243f47' : '#34515a'); ctx.fillRect(x - 3, base - height, 6, height + 80);
      for (let tier = 0; tier < 4; tier++) { const y = base - height + tier * height * 0.17, width = 22 + tier * 13; ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x - width, y + height * 0.4); ctx.lineTo(x + width, y + height * 0.4); ctx.fill(); }
    }
    skyTexture.update(true);
  }
  const windowFrame = material('#be9566'), windowDark = material('#634632'), glazing = material('#d7b572');
  [-1, 1].forEach(side => box([0.18, archSpring - windowBottom, 0.34], [archCenter + side * archRadius, (archSpring + windowBottom) / 2, -4.43], windowFrame, 0.025));
  const archPoints = []; for (let i = 0; i <= 32; i++) { const angle = i / 32 * Math.PI; archPoints.push([archCenter + Math.cos(angle) * archRadius, archSpring + Math.sin(angle) * archRadius, -4.43]); }
  tube(archPoints, 0.13, windowDark); tube(archPoints.map(([x, y, z]) => [x, y, z + 0.06]), 0.065, windowFrame);
  box([4.62, 0.18, 0.68], [archCenter, 1.45, -4.25], palette.wood, 0.045);
  box([0.065, 3.7, 0.15], [archCenter, 3.30, -4.31], glazing, 0.008);
  box([4.12, 0.07, 0.15], [archCenter, archSpring, -4.31], glazing, 0.008);
  [-1, 1].forEach(side => rod([archCenter, archSpring, -4.31], [archCenter + side * 1.47, archSpring + 1.47, -4.31], 0.026, glazing));
  // Heavy linen curtains are swept to each side with golden tiebacks.
  const curtain = material('#a88380'), curtainShade = material('#8c686d');
  for (const side of [-1, 1]) for (let fold = 0; fold < 4; fold++) {
    const x = archCenter + side * (2.25 + fold * 0.12), z = -4.06 + (fold % 2) * 0.04;
    const drape = cylinder(0.13, 0.18, 3.85, [x, 3.38, z], fold % 2 ? curtainShade : curtain); drape.scaling.z = 0.65;
    const tie = cylinder(0.18, 0.18, 0.12, [x, 2.38, z], palette.brass); tie.scaling.z = 0.65;
  }
  rod([-5.34, 5.38, -4.04], [-0.07, 5.38, -4.04], 0.038, palette.brass);
  [-5.42, 0.01].forEach(x => sphere([0.10, 0.10, 0.10], [x, 5.38, -4.04], palette.brass));

  // Climbing greenery and a shelf of tiny potion bottles make the architecture
  // feel lived in without occupying any of the editable floor grid.
  function vine(points, count = 15) {
    tube(points, 0.025, material('#46583c'), decor.plants);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1), index = Math.min(points.length - 2, Math.floor(t * (points.length - 1))), f = t * (points.length - 1) - index;
      const a = points[index], b = points[index + 1], x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f;
      const leaf = sphere([0.14, 0.23, 0.04], [x + (i % 2 ? 0.10 : -0.10), y, z + 0.07], material(i % 3 ? '#68845b' : '#91a073'), decor.plants); leaf.rotation.set(0.3, i * 0.8, i % 2 ? -0.6 : 0.6);
    }
  }
  vine([[-5.63, 5.45, -4.2], [-5.35, 5.14, -4.05], [-5.54, 4.54, -4.02], [-5.35, 3.67, -4.02]], 20);
  vine([[-0.14, 5.62, -4.18], [0.28, 5.31, -4.08], [0.49, 4.70, -4.03], [0.20, 4.13, -4.0]], 17);
  vine([[-5.64, 5.48, -2.1], [-5.53, 4.86, -2.0], [-5.53, 4.48, -1.8], [-5.52, 4.13, -1.95]], 15);
  vine([[0.3, 5.54, -4.27], [1.4, 5.18, -4.20], [2.4, 5.45, -4.21], [3.6, 5.21, -4.20], [5.4, 5.51, -4.20]], 28);
  const wire = material('#594b39'), bulb = material('#ffdda3', { emissive: '#ffd392', emissiveIntensity: 1.25 });
  // Same paint as the bulbs, kept apart: switched-off lights unlight the bulbs
  // and snuff the sill candles, while the fireflies keep glowing.
  const candleFlame = material('#ffdda3', { emissive: '#ffd392', emissiveIntensity: 1.25, flame: true }), moteGlow = material('#ffdda3', { emissive: '#ffd392', emissiveIntensity: 1.25, motes: true });
  const wirePoints = []; for (let i = 0; i <= 32; i++) wirePoints.push([-5.57 + i * 0.35, 5.50 - Math.sin(i / 32 * Math.PI) * 0.53, -4.12]); tube(wirePoints, 0.016, wire, decor.lights);
  for (let i = 0; i < 20; i++) { const x = -5.37 + i * 0.56, y = 5.50 - Math.sin((i + 0.35) / 20 * Math.PI) * 0.53; rod([x, y, -4.12], [x, y - 0.13, -4.12], 0.012, wire, decor.lights); sphere([0.057, 0.083, 0.057], [x, y - 0.18, -4.12], bulb, decor.lights); }
  const sideWire = []; for (let i = 0; i <= 24; i++) sideWire.push([-5.49, 5.44 - Math.sin(i / 24 * Math.PI) * 0.49, -4.20 + i * 0.36]); tube(sideWire, 0.014, wire, decor.lights);
  for (let i = 0; i < 15; i++) { const z = -4.07 + i * 0.57, y = 5.44 - Math.sin((i + 0.35) / 15 * Math.PI) * 0.49; rod([-5.49, y, z], [-5.49, y - 0.11, z], 0.011, wire, decor.lights); sphere([0.052, 0.072, 0.052], [-5.49, y - 0.16, z], bulb, decor.lights); }
  const swayingLanterns = [];
  function lantern(x, y, z) {
    const pivot = new TransformNode(`swaying-lantern-${swayingLanterns.length + 1}`, scene); pivot.parent = decor.lights; pivot.position.set(x, y + 1.1, z);
    const lantern = new TransformNode('lantern-local-model', scene); lantern.parent = pivot; lantern.position.y = -1.1;
    // The wall bracket stays fixed while the chain and body swing from its tip.
    rod(x < -5 ? [-5.78, y + 1.1, z] : [x, y + 1.1, -4.43], [x, y + 1.1, z], 0.022, palette.brass, decor.lights);
    rod([0, 0.35, 0], [0, 1.10, 0], 0.018, palette.brass, lantern);
    cylinder(0.13, 0.27, 0.20, [0, 0.27, 0], palette.darkWood, lantern, 6); cylinder(0.27, 0.20, 0.13, [0, -0.32, 0], palette.brass, lantern, 6);
    for (let i = 0; i < 6; i++) { const angle = i * Math.PI / 3; rod([Math.cos(angle) * 0.23, -0.26, Math.sin(angle) * 0.23], [Math.cos(angle) * 0.23, 0.17, Math.sin(angle) * 0.23], 0.018, palette.darkWood, lantern); }
    cylinder(0.11, 0.12, 0.31, [0, -0.10, 0], material('#efdab1'), lantern); sphere([0.055, 0.115, 0.055], [0, 0.16, 0], bulb, lantern);
    batchMoving(pivot); swayingLanterns.push(pivot);
  }
  lantern(-5.33, 4.32, 2.86); lantern(1.64, 4.35, -4.05); lantern(4.40, 4.54, -4.08);
  for (let i = 0; i < 5; i++) {
    const x = i < 3 ? -4.21 + i * 0.19 : -1.35 + (i - 3) * 0.24, h = 0.20 + (i % 3) * 0.11;
    cylinder(0.07, 0.075, h, [x, 1.55 + h / 2, -4.05], material('#e6cc96'), decor.lights); sphere([0.03, 0.070, 0.03], [x, 1.60 + h, -4.05], candleFlame, decor.lights);
  }

  // Merge architecture per material once. Furniture factories similarly batch
  // their painted parts, keeping only the companion's head and hands dynamic.
  function batchStatic(parent, excluded = new Set()) {
    const buckets = new Map();
    for (const mesh of parent.getChildMeshes()) {
      let blocked = false; for (let node = mesh; node && node !== parent; node = node.parent) if (excluded.has(node)) blocked = true;
      if (blocked || !mesh.material) continue;
      const key = mesh.material.uniqueId; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(mesh);
    }
    for (const meshes of buckets.values()) {
      if (meshes.length < 2) continue;
      meshes.forEach(mesh => mesh.computeWorldMatrix(true));
      const mat = meshes[0].material;
      const merged = Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
      merged.parent = parent; merged.material = mat; merged.receiveShadows = true; merged.isPickable = false; merged.metadata = { castShadow: true };
      merged.freezeWorldMatrix();
    }
  }
  batchStatic(classicArchitecture); Object.values(decor).forEach(group => batchStatic(group, new Set(swayingLanterns)));
  // A tap on the fairy lights, the lanterns or the sill candles switches them.
  for (const mesh of decor.lights.getChildMeshes()) { mesh.isPickable = true; mesh.metadata = { ...mesh.metadata, lightSwitch: true }; }
  const sillFlames = decor.lights.getChildMeshes().filter(mesh => mesh.material === candleFlame);
  const rainSeeds = Array.from({ length: 40 }, (_, i) => { const x = -4.7 + ((i * 0.618033) % 1) * 3.98; return { x, y: (i * 0.371) % 1, speed: 0.55 + (i % 4) * 0.12, top: archSpring + Math.sqrt(Math.max(0, archRadius ** 2 - (x - archCenter) ** 2)) - 0.12 }; });
  const rainLines = rainSeeds.map(seed => [new Vector3(seed.x, 2, -4.52), new Vector3(seed.x - 0.025, 2.18, -4.52)]);
  const rain = MeshBuilder.CreateLineSystem('window-rain', { lines: rainLines, updatable: true }, scene); rain.color = color('#fffdf5'); rain.alpha = 0.6; rain.isPickable = false; rain.setEnabled(false);
  const rainPositions = Float32Array.from(rain.getVerticesData('position'));
  rain.setBoundingInfo(new BoundingInfo(new Vector3(-4.75, 1.55, -4.53), new Vector3(-0.65, 5.28, -4.51)));
  // Forty-eight drifting motes share one draw; size and tint vary per instance.
  const fireflies = MeshBuilder.CreateSphere('floating-fireflies', { diameter: 0.07, segments: 3 }, scene); fireflies.material = moteGlow; fireflies.isPickable = false; fireflies.metadata = { castShadow: false }; fireflies.alwaysSelectAsActiveMesh = true;
  const fireflySeeds = Array.from({ length: 48 }, (_, i) => ({ x: -4.7 + ((i * 0.618033) % 1) * 9.8, y: 1.15 + ((i * 0.377) % 1) * 3.5, z: -3.6 + ((i * 0.713) % 1) * 6.3, scale: 0.65 + ((i * 0.413) % 1) * 0.65 }));
  function seedParticles(mesh, seeds, minimumIntensity = 0.45) {
    const matrices = new Float32Array(seeds.length * 16), colors = new Float32Array(seeds.length * 4);
    seeds.forEach((seed, i) => {
      const offset = i * 16, intensity = minimumIntensity + ((i * 0.731) % 1) * (1 - minimumIntensity);
      matrices[offset] = matrices[offset + 5] = matrices[offset + 10] = seed.scale; matrices[offset + 15] = 1;
      matrices[offset + 12] = seed.x; matrices[offset + 13] = seed.y; matrices[offset + 14] = seed.z;
      colors[i * 4] = intensity; colors[i * 4 + 1] = intensity * (0.86 + (i % 3) * 0.05); colors[i * 4 + 2] = intensity * 0.73; colors[i * 4 + 3] = 1;
    });
    mesh.thinInstanceSetBuffer('matrix', matrices, 16, false); mesh.thinInstanceSetBuffer('color', colors, 4, true);
    return matrices;
  }
  const fireflyMatrices = seedParticles(fireflies, fireflySeeds, 0.65);
  // Tiny four-point stars float just in front of the painted sky, behind all
  // window joinery. The inset arch bounds leave room for their full drift.
  const skyStars = new Mesh('window-drifting-stars', scene), starShape = new VertexData();
  starShape.positions = [0, 0, 0, 0, 0.06, 0, 0.012, 0.012, 0, 0.047, 0, 0, 0.012, -0.012, 0, 0, -0.06, 0, -0.012, -0.012, 0, -0.047, 0, 0, -0.012, 0.012, 0];
  starShape.indices = []; for (let i = 0; i < 8; i++) starShape.indices.push(0, i + 1, (i + 1) % 8 + 1);
  starShape.normals = Array.from({ length: 27 }, (_, i) => i % 3 === 2 ? 1 : 0); starShape.applyToMesh(skyStars);
  const starMaterial = new StandardMaterial('warm-sky-starlight', scene); starMaterial.disableLighting = true; starMaterial.emissiveColor = color('#ffe3ae'); starMaterial.backFaceCulling = false;
  skyStars.material = starMaterial; skyStars.parent = world; skyStars.isPickable = false; skyStars.receiveShadows = false; skyStars.metadata = { castShadow: false, effect: 'window-stars' }; skyStars.alwaysSelectAsActiveMesh = true;
  const starSeeds = Array.from({ length: 20 }, (_, i) => {
    const x = archCenter - 1.7 + ((i * 0.618033) % 1) * 3.4, top = archSpring + Math.sqrt(1.90 ** 2 - (x - archCenter) ** 2);
    return { x, y: 3.40 + ((i * 0.381966 + 0.23) % 1) * (top - 3.59), z: -4.59, scale: 0.62 + ((i * 0.47) % 1) * 0.60 };
  });
  const starMatrices = seedParticles(skyStars, starSeeds);
  const ambienceStart = performance.now() / 1000;
  // Three small moths use one colored mesh. Only their original position buffer
  // changes: no meshes, vectors or geometry builders are created during flight.
  const moths = new Mesh('window-moths', scene), mothShape = new VertexData();
  const mothLocal = [], mothColors = [], mothWings = [], mothIndices = [];
  const mothSeeds = [{ x: -4.05, y: 3.87, z: -3.87 }, { x: -2.86, y: 4.52, z: -3.76 }, { x: -1.30, y: 3.91, z: -3.82 }];
  function mothPolygon(points, tint, wing) {
    const first = mothLocal.length / 3;
    points.forEach(([x, y, z = 0]) => { mothLocal.push(x * 0.68, y * 0.68, z); mothColors.push(...tint, 1); mothWings.push(wing); });
    for (let i = 1; i < points.length - 1; i++) mothIndices.push(first, first + i, first + i + 1);
  }
  for (let i = 0; i < mothSeeds.length; i++) {
    for (const side of [-1, 1]) mothPolygon([[0, 0], [side * 0.10, 0.075], [side * 0.21, 0.115], [side * 0.255, 0.015], [side * 0.145, -0.105], [side * 0.03, -0.055]], i % 2 ? [0.88, 0.66, 0.35] : [1, 0.85, 0.55], 1);
    mothPolygon([[-0.021, -0.075], [0.021, -0.075], [0.016, 0.095], [-0.016, 0.095]], [0.49, 0.28, 0.13], 0);
    for (const side of [-1, 1]) mothPolygon([[side * 0.008, 0.08], [side * 0.09, 0.16], [side * 0.022, 0.095]], [0.77, 0.54, 0.26], 0);
  }
  const mothLocalPositions = Float32Array.from(mothLocal), mothPositions = new Float32Array(mothLocal.length), mothVertices = mothWings.length / mothSeeds.length;
  for (let i = 0; i < mothSeeds.length; i++) for (let v = 0; v < mothVertices; v++) {
    const offset = (i * mothVertices + v) * 3, seed = mothSeeds[i]; mothPositions[offset] = seed.x + mothLocalPositions[offset]; mothPositions[offset + 1] = seed.y + mothLocalPositions[offset + 1]; mothPositions[offset + 2] = seed.z + mothLocalPositions[offset + 2];
  }
  mothShape.positions = mothPositions; mothShape.indices = mothIndices; mothShape.colors = mothColors; mothShape.normals = Array.from({ length: mothPositions.length }, (_, i) => i % 3 === 2 ? 1 : 0); mothShape.applyToMesh(moths, true);
  const mothMaterial = new StandardMaterial('warm-moth-wings', scene); mothMaterial.disableLighting = true; mothMaterial.emissiveColor = color('#f5d49a'); mothMaterial.backFaceCulling = false;
  moths.material = mothMaterial; moths.parent = world; moths.isPickable = false; moths.receiveShadows = false; moths.metadata = { castShadow: false, effect: 'window-moths', count: 3 }; moths.alwaysSelectAsActiveMesh = true;
  moths.setBoundingInfo(new BoundingInfo(new Vector3(-4.6, 3.35, -4.10), new Vector3(-0.75, 5.02, -3.40)));
  const shootingStar = new Mesh('window-shooting-star', scene), streakShape = new VertexData();
  streakShape.positions = [0.025, 0, 0, 0, -0.013, 0, -0.38, 0.14, 0, 0, 0.013, 0]; streakShape.indices = [0, 1, 2, 0, 2, 3]; streakShape.normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]; streakShape.colors = [1, 0.93, 0.75, 1, 1, 0.84, 0.55, 0.8, 1, 0.66, 0.32, 0, 1, 0.84, 0.55, 0.8]; streakShape.applyToMesh(shootingStar);
  const streakMaterial = new StandardMaterial('warm-shooting-star', scene); streakMaterial.disableLighting = true; streakMaterial.emissiveColor = color('#ffe8b7'); streakMaterial.backFaceCulling = false; streakMaterial.alpha = 0;
  shootingStar.material = streakMaterial; shootingStar.hasVertexAlpha = true; shootingStar.parent = world; shootingStar.isPickable = false; shootingStar.receiveShadows = false; shootingStar.position.set(-3.52, 4.63, -4.57);
  shootingStar.metadata = { castShadow: false, effect: 'window-shooting-star', delaySeconds: 3, periodSeconds: 14, durationSeconds: 1.6 }; shootingStar.setEnabled(false);
  const windowEffects = new TransformNode('window-atmosphere', scene); windowEffects.parent = world;
  for (const mesh of [rain, skyStars, shootingStar]) mesh.parent = windowEffects;
  // Where the floor meets both walls, a band of ambient shade settles the room
  // into its corners. Every shell shares these wall lines and floor height.
  const floorShadeMaterial = new StandardMaterial('floor-contact-shade', scene);
  floorShadeMaterial.disableLighting = true; floorShadeMaterial.diffuseColor = Color3.White(); floorShadeMaterial.specularColor = Color3.Black();
  floorShadeMaterial.backFaceCulling = false; floorShadeMaterial.disableDepthWrite = true;
  function wallShade(name, alongX) {
    const rows = [[-0.35, 0.30], [0.22, 0.30], [0.55, 0.12], [1.15, 0]], positions = [], colors = [], indices = [];
    rows.forEach(([distance, alpha], row) => {
      for (const end of alongX ? [-6.0, 5.95] : [-4.7, 4.55]) {
        const across = (alongX ? -4.35 : -5.68) + distance;
        positions.push(alongX ? end : across, 0, alongX ? across : end); colors.push(0.10, 0.065, 0.04, alpha);
      }
      if (row) indices.push(row * 2 - 2, row * 2, row * 2 - 1, row * 2 - 1, row * 2, row * 2 + 1);
    });
    const data = new VertexData(); Object.assign(data, { positions, colors, indices, normals: positions.map((_, i) => i % 3 === 1 ? 1 : 0) });
    const mesh = new Mesh(name, scene); data.applyToMesh(mesh); mesh.material = floorShadeMaterial; mesh.hasVertexAlpha = true;
    mesh.parent = world; mesh.isPickable = false; mesh.receiveShadows = false; mesh.metadata = { castShadow: false, effect: 'contact-shadow' };
    return mesh;
  }
  const wallShades = [wallShade('back-wall-shade', true), wallShade('side-wall-shade', false)];
  // Shade sits 2 mm above whatever is under it: the highest rug it overlaps,
  // or the floor. Rugs stack 6 mm apart, so one fixed height either z-fights a
  // rug top or floats over bare floor and darkens the base of each piece.
  const rugSurfaces = [], pointArea = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  let floorTop = 0.219;
  function surfaceBelow(area) {
    let top = floorTop;
    for (const rug of rugSurfaces) if (area.minX < rug.maxX && area.maxX > rug.minX && area.minZ < rug.maxZ && area.maxZ > rug.minZ) top = Math.max(top, rug.top);
    return top + 0.002;
  }
  function liftShade(object, item) { const shade = object?.metadata.shade; if (shade) shade.position.y = surfaceBelow(footprintBounds(item)) - object.position.y; }
  for (const mesh of wallShades) mesh.position.y = floorTop + 0.002;
  const FLAT_RUG = 0.0055;
  // Each piece gets baked ambient shade under it. The cached sun map cannot
  // darken floor that the walls already shade, so without it pieces float.
  // Once per type, every surface below knee height is projected onto a floor
  // grid (lower surfaces occlude more), then blurred: a sofa base leaves a deep
  // pool, a desk's open legs only a faint trace.
  const contactShadeData = new Map(), shadePoint = new Vector3();
  function bakeContactShade(object, type) {
    const kneeHeight = 0.9, cell = 0.1, margin = 0.45, strength = 0.62, points = [], triangles = [];
    const inverse = object.computeWorldMatrix(true).clone().invert();
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const mesh of object.getChildMeshes()) {
      const positions = !mesh.metadata?.effect && mesh.getVerticesData('position'), indices = mesh.getIndices(); if (!positions || !indices) continue;
      const matrix = mesh.computeWorldMatrix(true).multiply(inverse), first = points.length / 3;
      for (let i = 0; i < positions.length; i += 3) { Vector3.TransformCoordinatesFromFloatsToRef(positions[i], positions[i + 1], positions[i + 2], matrix, shadePoint); points.push(shadePoint.x, shadePoint.y, shadePoint.z); }
      for (let i = 0; i < indices.length; i += 3) {
        const a = (first + indices[i]) * 3, b = (first + indices[i + 1]) * 3, c = (first + indices[i + 2]) * 3, low = Math.min(points[a + 1], points[b + 1], points[c + 1]);
        if (low >= kneeHeight) continue;
        triangles.push(a, b, c, 1 - Math.max(0, low) / kneeHeight);
        for (const p of [a, b, c]) { minX = Math.min(minX, points[p]); maxX = Math.max(maxX, points[p]); minZ = Math.min(minZ, points[p + 2]); maxZ = Math.max(maxZ, points[p + 2]); }
      }
    }
    const [width, depth] = getFurniture(type).footprint;
    minX = Math.max(minX, -width / 2) - margin; maxX = Math.min(maxX, width / 2) + margin; minZ = Math.max(minZ, -depth / 2) - margin; maxZ = Math.min(maxZ, depth / 2) + margin;
    const nx = Math.ceil((maxX - minX) / cell) + 1, nz = Math.ceil((maxZ - minZ) / cell) + 1, cover = new Float32Array(nx * nz);
    const mark = (i, j, weight) => { if (i >= 0 && j >= 0 && i < nx && j < nz) cover[j * nx + i] = Math.max(cover[j * nx + i], weight); };
    for (let t = 0; t < triangles.length; t += 4) {
      const [a, b, c, weight] = [triangles[t], triangles[t + 1], triangles[t + 2], triangles[t + 3]];
      const ax = (points[a] - minX) / cell, az = (points[a + 2] - minZ) / cell, bx = (points[b] - minX) / cell, bz = (points[b + 2] - minZ) / cell, cx = (points[c] - minX) / cell, cz = (points[c + 2] - minZ) / cell;
      mark(Math.round((ax + bx + cx) / 3), Math.round((az + bz + cz) / 3), weight); // Thin legs fall between grid points.
      const area = (bx - ax) * (cz - az) - (bz - az) * (cx - ax); if (Math.abs(area) < 1e-6) continue;
      for (let j = Math.ceil(Math.min(az, bz, cz)); j <= Math.max(az, bz, cz); j++) for (let i = Math.ceil(Math.min(ax, bx, cx)); i <= Math.max(ax, bx, cx); i++) {
        const u = ((bx - i) * (cz - j) - (bz - j) * (cx - i)) / area, v = ((cx - i) * (az - j) - (cz - j) * (ax - i)) / area;
        if (u >= 0 && v >= 0 && u + v <= 1) mark(i, j, weight);
      }
    }
    // Two separable box blurs approximate a soft Gaussian falloff.
    const blurred = new Float32Array(cover.length), radius = 2;
    for (let pass = 0; pass < 2; pass++) for (const [stepI, stepJ] of [[1, 0], [0, 1]]) {
      const source = pass || stepJ ? blurred.slice() : cover;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        let sum = 0; for (let k = -radius; k <= radius; k++) { const x = i + k * stepI, z = j + k * stepJ; if (x >= 0 && z >= 0 && x < nx && z < nz) sum += source[z * nx + x]; }
        blurred[j * nx + i] = sum / (radius * 2 + 1);
      }
    }
    const positions = [], colors = [], indices = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { positions.push(minX + i * cell, 0, minZ + j * cell); colors.push(0.10, 0.065, 0.04, Math.min(1, blurred[j * nx + i] * 1.25) * strength); }
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      if (colors[a * 4 + 3] + colors[b * 4 + 3] + colors[c * 4 + 3] + colors[d * 4 + 3] > 0.004) indices.push(a, c, b, b, c, d);
    }
    const data = new VertexData(); Object.assign(data, { positions, colors, indices, normals: positions.map((_, i) => i % 3 === 1 ? 1 : 0) });
    return data;
  }
  function groundPiece(object, type) {
    if (!contactShadeData.has(type)) contactShadeData.set(type, bakeContactShade(object, type));
    const shade = new Mesh('contact-shadow', scene); contactShadeData.get(type).applyToMesh(shade);
    shade.material = floorShadeMaterial; shade.hasVertexAlpha = true; shade.isPickable = false; shade.receiveShadows = false;
    shade.metadata = { castShadow: false, effect: 'contact-shadow' }; shade.parent = object;
    object.metadata.shade = shade; // Its height follows the rugs below, set by liftShade.
  }
  let architecture = null, architectureStyle = 'retreat';
  const furnitureRoot = new TransformNode('placed-furniture', scene), placedObjects = new Map(), settlingPieces = new Map(), animatedObjects = [];
  const decorVisible = { plants: true, lights: true, rug: true };
  let layout = createLayout(), selectedId = null, editing = false, placement = null, ghost = null, marker = null, lastPlacementState = '';
  let hoveredId = null, drag = null, outlineKey = '';
  let companionRoutine, mobileCompanion, companionTime = 0, companionLayoutKey = '';
  let petRoutine, petModel = null, petSpecies = options.pet === 'dog' ? 'dog' : 'cat', petY = null, petCasts = null, petMoving = false, petKey = '', petTime = 0, petWake = 0, petShadowAt = 0;
  const outlinedMeshes = [];
  const hoverOutline = color('#ffe2a3'), selectedOutline = color('#e6b568'), invalidOutline = color('#e39782'), playOutline = color('#d9b98a');
  const ghostMaterial = new StandardMaterial('placement-preview', scene); ghostMaterial.diffuseColor = color('#85ac80'); ghostMaterial.emissiveColor = color('#42653f'); ghostMaterial.alpha = 0.43; ghostMaterial.disableLighting = true;
  let theme = 'dusk', focused = false, petStart = -Infinity, disposed = false, readyReported = false;
  let frame = 0, lastFrame = 0, lastRenderedAt = 0, visible = !document.hidden, needsRender = true;
  // Adaptive and Crisp both start at the display's own density (capped at 2×),
  // so one canvas pixel lands on one screen pixel; only Adaptive steps down.
  const nativeRatio = () => Math.min(window.devicePixelRatio || 1, 2);
  let quality = 'auto', pixelRatio = nativeRatio(), ratioCeiling = pixelRatio, raisedAt = -Infinity, statsStart = 0, intervalTotal = 0, sampleFrames = 0, slowSamples = 0, steadySamples = 0;
  let rafCalls = 0, lastRafAt = 0, fastRafFrames = 0, onScreen = true;
  const intervals = [], submissions = [];
  engine.setHardwareScalingLevel(1 / pixelRatio);
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;
  const snap = value => Math.round(value * 4) / 4;
  const copyLayout = () => ({ ...layout, items: layout.items.map(item => ({ ...item })) });
  const isDesk = item => item && Boolean(placedObjects.get(item.id)?.metadata.study);
  const isFurnitureSurface = mesh => !mesh.metadata?.effect || ['leaf-sway', 'record-spin'].includes(mesh.metadata.effect);
  function requestRender(shadows = false) {
    if (disposed) return;
    needsRender = true;
    if (shadows) shadow.getShadowMap()?.resetRefreshCounter();
    if (visible && onScreen && !frame) frame = requestAnimationFrame(tick);
  }
  // With reduced motion the room draws only on change, so a clock wakes it
  // once a minute, at the turn of the minute, to move its hands. In full
  // motion the room draws every frame anyway, and nothing more is needed.
  let clockWake = 0;
  function wakeForClock() {
    clearTimeout(clockWake); clockWake = 0;
    if (disposed || !reducedMotion || !visible || !layout?.items.some(item => getFurniture(item.type)?.clock)) return;
    clockWake = setTimeout(() => { clockWake = 0; requestRender(); wakeForClock(); }, 60000 - Date.now() % 60000 + 20);
  }
  function refreshShadows() {
    shadow.getShadowMap().renderList = scene.meshes.filter(mesh => !(drag?.active && mesh === petModel?.body && drag.id === petBed(layout)?.id) && mesh.metadata?.castShadow !== false && !mesh.metadata?.effect && (!drag?.active || itemAncestor(mesh)?.metadata.itemId !== drag.id) && mesh !== rain && mesh !== marker && (!ghost || !mesh.isDescendantOf(ghost)) && mesh.isEnabled() && mesh.getTotalVertices() > 0);
    for (const mesh of glowingMeshes) bloom.removeIncludedOnlyMesh(mesh); glowingMeshes.clear();
    for (const mesh of scene.meshes) { const emission = mesh.material?.emissiveColor; const visibleOwner = mesh.isEnabled() || (mesh.metadata?.effect && mesh.parent?.isEnabled()); if (emission && !mesh.metadata?.companion && !['tea-steam', 'wall-highlight'].includes(mesh.metadata?.effect) && emission.r + emission.g + emission.b > 0.1 && visibleOwner && (!ghost || !mesh.isDescendantOf(ghost))) { bloom.addIncludedOnlyMesh(mesh); glowingMeshes.add(mesh); } }
    bloom.mainTexture.renderList = [...glowingMeshes];
    requestRender(true);
  }
  // A wall piece is flat, and its picture, sleeve or clock hands sit just in
  // front of it, where an outline would paint over them. It shows a band in
  // the outline color around it instead: on its front for flat pieces, and on
  // the wall behind deep shelves.
  const bandMaterial = new StandardMaterial('wall-highlight', scene); bandMaterial.disableLighting = true; bandMaterial.backFaceCulling = false; bandMaterial.diffuseColor = Color3.Black(); bandMaterial.specularColor = Color3.Black();
  let band = null;
  function showBand(object, item, tint, width) {
    const key = `${item.id}:${width}`;
    if (!band || band.isDisposed() || band.metadata.key !== key) {
      if (band && !band.isDisposed()) band.dispose();
      const { size, depth } = getFurniture(item.type), [w, h] = size.map(extent => extent / 2 + 0.03), z = depth <= 0.25 ? depth + 0.005 : 0.012;
      const parts = [[w * 2 + width * 2, width, 0, h + width / 2], [w * 2 + width * 2, width, 0, -h - width / 2], [width, h * 2, -w - width / 2, 0], [width, h * 2, w + width / 2, 0]].map(([across, tall, x, y]) => { const part = MeshBuilder.CreatePlane('wall-highlight', { width: across, height: tall }, scene); part.position.set(x, y, z); return part; });
      band = Mesh.MergeMeshes(parts, true); band.name = 'wall-highlight'; band.material = bandMaterial; band.isPickable = false; band.receiveShadows = false; band.metadata = { effect: 'wall-highlight', castShadow: false, key };
    }
    band.parent = object; bandMaterial.emissiveColor = tint; band.setEnabled(true);
  }
  function updateOutline() {
    const id = editing ? (!placement ? drag?.id || hoveredId || selectedId : null) : playHover;
    const key = `${editing}:${id}:${Boolean(drag?.overCollection && drag.removable)}:${drag?.valid}:${hoveredId === id}`;
    if (key === outlineKey) return;
    for (const mesh of outlinedMeshes) if (!mesh.isDisposed()) mesh.renderOutline = false;
    outlinedMeshes.length = 0; outlineKey = key; outlineFrames = 120;
    if (band && !band.isDisposed()) band.setEnabled(false);
    const object = placedObjects.get(id), item = layout.items.find(entry => entry.id === id);
    // The disappearing preview uses a dashed drawing in the collection instead
    // of outlining transparent meshes (which would require another stencil pass).
    if (object && !(drag?.overCollection && drag.removable)) {
      // Outside Decorate a thinner, softer line only hints that a tap does something.
      const tint = !editing ? playOutline : drag && !drag.valid ? invalidOutline : hoveredId === id ? hoverOutline : selectedOutline, width = editing ? 0.04 : 0.022;
      if (isWallPiece(item)) showBand(object, item, tint, width);
      else for (const mesh of object.getChildMeshes()) {
        if (!mesh.isEnabled() || !isFurnitureSurface(mesh) || mesh.metadata?.outline === false || (object.metadata.avatar && mesh.isDescendantOf(object.metadata.avatar))) continue;
        mesh.outlineColor = tint; mesh.outlineWidth = width; mesh.renderOutline = true; outlinedMeshes.push(mesh);
      }
    } else if (id === 'room-lights') for (const mesh of scene.meshes) if (mesh.metadata?.lightSwitch && mesh.isEnabled()) { mesh.outlineColor = playOutline; mesh.outlineWidth = 0.014; mesh.renderOutline = true; outlinedMeshes.push(mesh); }
    requestRender();
  }
  // The outline shader compiles in the background, so its first frame can skip
  // the outline. Keep drawing until it is ready, even when reduced motion idles,
  // for at most two seconds after each outline change.
  let outlineFrames = 0;
  function outlinesPending() {
    if (outlineFrames <= 0) return false;
    if (band?.isEnabled() && !band.isDisposed() && !band.isReady(true)) return true;
    if (!outlinedMeshes.length) return false;
    const outline = scene.getOutlineRenderer();
    return outlinedMeshes.some(mesh => !mesh.isDisposed() && mesh.renderOutline && mesh.subMeshes?.some(subMesh => !outline.isReady(subMesh, false)));
  }
  function hoverItem(id) {
    if (hoveredId === id) return;
    hoveredId = id; updateOutline();
  }
  // The last desk and the pet's bed stay in the room; both can still move.
  function canRemove(item) { return !getFurniture(item?.type)?.unique && (!isDesk(item) || layout.items.filter(isDesk).length > 1); }
  function keepReason(item) { return getFurniture(item?.type)?.unique ? `${PETS[petSpecies].name}'s bed stays in your room. Move it anywhere you like.` : 'Keep one study desk so your companion has a place to focus.'; }
  function syncCompanionVisibility() {
    const atDesk = companionRoutine?.pose.atDesk ?? true;
    for (const [id, object] of placedObjects) object.metadata.avatar?.setEnabled(atDesk && id === layout.activeDeskId);
    mobileCompanion?.root.setEnabled(!atDesk); mobileCompanion?.contact.setEnabled(!atDesk);
  }
  // A wall piece's back sits on its wall face; the side wall turns it to face the room.
  function placeOnWall(node, piece) {
    const face = (SHELLS[architectureStyle] || SHELLS.retreat)[piece.wall].face;
    if (piece.wall === 'back') { node.position.set(piece.u, piece.v, face); node.rotation.y = 0; }
    else { node.position.set(face, piece.v, piece.u); node.rotation.y = Math.PI / 2; }
  }
  // Windows cut their openings where they hang, so daylight falls through them.
  // A window being dragged closes its opening until it is dropped. The walls
  // are rebuilt only on such a change, never per frame.
  // A room's wall and floor choices repaint the retreat's paint materials, or
  // a shell's walls and floor. The walls mesh a shell builds again joins the
  // shadow map at the end of the sync.
  let surfacesKey = '';
  function applySurfaces() {
    const walls = surfacePaint(architectureStyle, 'walls', layout.walls) || {}, floor = surfacePaint(architectureStyle, 'floor', layout.floor) || {};
    const key = JSON.stringify([architectureStyle, walls, floor]); if (key === surfacesKey) return; surfacesKey = key;
    if (architecture) { architecture.setSurfaces({ walls, floor }); return; }
    for (const [kind, paint] of [['walls', walls], ['floor', floor]]) for (const [hex, mat] of retreatSurfaces[kind]) mat.diffuseColor = color(paint[hex] || hex);
  }
  let retreatWallMeshes = [], openingsKey = '';
  function syncOpenings() {
    const holes = openings(layout.items, drag?.id), key = `${architectureStyle}:${JSON.stringify(holes)}`;
    if (key === openingsKey) return; openingsKey = key;
    if (architecture) architecture.setOpenings(holes);
    else {
      for (const mesh of retreatWallMeshes) mesh.dispose();
      retreatWallMeshes = [['back', palette.sage], ['side', palette.cream]].map(([wall, paint]) => buildWallMesh(retreatWalls.filter(spec => spec.wall === wall), holes, paint, scene, `retreat-${wall}-wall`, classicArchitecture, false));
    }
    // The new walls replace the old ones in the sun's shadow map at once.
    refreshShadows();
  }
  // A window shows the part of the room's view behind it, at the scale of the
  // main window and offset by where it hangs.
  function showView(view, item) {
    const main = architecture?.window || { x: archCenter, y: 3.34, width: 4.2, height: 3.82 }, [width, height] = view.metadata.size;
    const left = 0.5 + ((item.wall === 'back' ? item.u - main.x : item.u) - width / 2) / main.width, bottom = 0.5 + (item.v - main.y - height / 2) / main.height;
    const key = `${architectureStyle}:${left}:${bottom}`;
    if (view.metadata.key !== key) { view.metadata.key = key; view.setVerticesData('uv', view.metadata.uvs.map((value, i) => i % 2 ? bottom + value * height / main.height : left + value * width / main.width)); }
    view.material = architecture?.viewMaterial || retreatView;
  }
  // Pictures are painted once per artwork and frame shape; records take a
  // sleeve color. Both are shared by every piece that shows them.
  const artMaterials = new Map();
  // Upright frames and the easel share each picture, drawn once; the wide
  // frame draws its own landscape shape.
  function artMaterial(type, art) {
    const key = `${type === 'wide-frame' ? 'wide' : SLEEVES[art] ? type : 'upright'}:${art}`;
    if (!artMaterials.has(key)) {
      let mat;
      if (SLEEVES[art]) { mat = new StandardMaterial(`sleeve-${art}`, scene); mat.diffuseColor = color(SLEEVES[art].color); mat.specularColor.set(0.035, 0.035, 0.035); }
      else {
        const [width, height] = type === 'wide-frame' ? [320, 224] : [256, 320], artwork = ARTWORKS[art] || ARTWORKS.herbarium;
        mat = new StandardMaterial(`picture-${key}`, scene); mat.disableLighting = true; mat.diffuseColor = Color3.Black(); mat.backFaceCulling = false;
        mat.emissiveTexture = drawing(width, height, (context, w, h) => artwork.draw(context, w, h), `art-${key}`);
      }
      artMaterials.set(key, mat);
    }
    return artMaterials.get(key);
  }
  // Neon glows like the rooms' accent lights: brightest at night, soft by day.
  function applyAccents() {
    const strength = theme === 'day' ? 0.355 : theme === 'rain' ? 0.667 : 1;
    for (const object of placedObjects.values()) for (const mesh of object.getChildMeshes()) { const accent = mesh.material?.metadata?.accent; if (accent) mesh.material.emissiveColor = accent.scale(strength); }
  }
  function updateMarker() {
    marker?.dispose(); marker = null;
    const item = layout.items.find(candidate => candidate.id === selectedId);
    // A selected wall piece shows its band instead (see showBand).
    if (!editing || !item || placement || isWallPiece(item)) return;
    const [width, depth] = getFurniture(item.type).footprint, w = width / 2 + 0.035, d = depth / 2 + 0.035;
    marker = MeshBuilder.CreateLines('selected-footprint', { points: [new Vector3(-w, 0, -d), new Vector3(w, 0, -d), new Vector3(w, 0, d), new Vector3(-w, 0, d), new Vector3(-w, 0, -d)] }, scene);
    marker.color = color('#b77d38'); marker.position.set(item.x, 0.30, item.z); marker.rotation.y = item.rotation * Math.PI / 2; marker.isPickable = false; marker.metadata = { castShadow: false };
  }
  function syncFurniture(settleNew = false) {
    const nextStyle = roomDesign(layout).style || 'retreat';
    if (architectureStyle !== nextStyle) {
      architecture?.dispose(); architecture = null; architectureStyle = nextStyle;
      for (const object of placedObjects.values()) object.dispose(false, false);
      placedObjects.clear(); settlingPieces.clear();
      if (nextStyle !== 'retreat') architecture = createArchitecture(nextStyle, scene);
      classicArchitecture.setEnabled(nextStyle === 'retreat');
      decor.plants.setEnabled(nextStyle === 'retreat' && decorVisible.plants);
      decor.lights.setEnabled(nextStyle === 'retreat');
      moths.setEnabled(nextStyle !== 'metro');
      const scale = (architecture?.window.width || 4.2) / 4.2;
      windowEffects.scaling.x = scale; windowEffects.position.x = (architecture?.window.x ?? -2.7) + 2.7 * scale;
      // The effects stretch to a wider window, but stars and the shooting star
      // keep their shape, and rain falls to the top of this shell's opening.
      for (let i = 0; i < starSeeds.length; i++) starMatrices[i * 16] = starSeeds[i].scale / scale;
      skyStars.thinInstanceBufferUpdated('matrix'); shootingStar.scaling.x = 1 / scale;
      const opening = architecture?.window;
      for (const seed of rainSeeds) {
        const x = windowEffects.position.x + seed.x * scale;
        seed.top = (!opening ? archSpring + Math.sqrt(Math.max(0, archRadius ** 2 - (x - archCenter) ** 2))
          : opening.radius ? opening.y + Math.sqrt(Math.max(0, opening.radius ** 2 - (x - opening.x) ** 2)) : opening.y + opening.height / 2) - 0.12;
      }
      floorTop = architecture?.floorTop ?? 0.219;
      for (const mesh of wallShades) mesh.position.y = floorTop + 0.002;
      architecture?.setTheme(theme); architecture?.setLights(decorVisible.lights);
    }
    if (!settleNew) { for (const { object } of settlingPieces.values()) object.scaling.setAll(1); settlingPieces.clear(); }
    const ids = new Set(layout.items.map(item => item.id));
    for (const [id, object] of placedObjects) if (!ids.has(id)) { settlingPieces.delete(id); object.dispose(false, false); placedObjects.delete(id); }
    let rugLayer = 0;
    for (const item of layout.items) {
      let object = placedObjects.get(item.id);
      // A new color builds the piece again from its model.
      if (object && (object.metadata.furnitureType !== item.type || object.metadata.tint !== item.tint)) { settlingPieces.delete(item.id); object.dispose(false, false); placedObjects.delete(item.id); object = null; }
      if (!object) {
        object = createFurniture(item.type, scene); styleFurniture(object, architectureStyle, tintPaint(item.type, item.tint)); object.parent = furnitureRoot;
        if (getFurniture(item.type).category !== 'Rugs' && !isWallPiece(item)) groundPiece(object, item.type);
        object.metadata ||= {}; object.metadata.itemId = item.id; object.metadata.furnitureType = item.type; object.metadata.tint = item.tint;
        object.getChildMeshes().forEach(mesh => { mesh.isPickable = isFurnitureSurface(mesh); mesh.receiveShadows = !mesh.metadata?.effect; });
        placedObjects.set(item.id, object);
        if (settleNew && !reducedMotion) { object.scaling.setAll(0.92); settlingPieces.set(item.id, { object, start: performance.now() }); }
      }
      // Frames, framed records and the easel show the picture chosen for them.
      if (object.metadata.picture) object.metadata.picture.material = artMaterial(item.type, item.art);
      if (isWallPiece(item)) {
        placeOnWall(object, item);
        if (object.metadata.view) showView(object.metadata.view, item);
      }
      else {
        object.position.y = getFurniture(item.type).category === 'Rugs' ? 0.22 + rugLayer++ * 0.006 : 0.22;
        object.position.x = item.x; object.position.z = item.z; object.rotation.y = item.rotation * Math.PI / 2;
      }
      object.setEnabled(item.type === 'plant' ? decorVisible.plants : getFurniture(item.type).category === 'Rugs' ? decorVisible.rug : true);
    }
    // A rug lies fully on every rug put down before it. Rugs are several
    // centimeters thick, so a covered rug flattens to a few millimeters instead
    // of pushing its raised weave up through the rug on top.
    rugSurfaces.length = 0;
    const rugs = layout.items.filter(item => getFurniture(item.type).category === 'Rugs' && placedObjects.get(item.id).isEnabled());
    rugs.forEach((item, index) => {
      const object = placedObjects.get(item.id), height = getFurniture(item.type).height;
      const flat = rugs.slice(index + 1).some(upper => rugsOverlap(item, upper));
      object.metadata.body.scaling.y = flat ? FLAT_RUG / height : 1;
      rugSurfaces.push({ ...footprintBounds(item), top: object.position.y + (flat ? FLAT_RUG : height), lost: flat ? height - FLAT_RUG : 0 });
    });
    for (const item of layout.items) liftShade(placedObjects.get(item.id), item);
    applySurfaces(); syncOpenings();
    if (selectedId && !ids.has(selectedId)) { selectedId = null; options.onSelectionChange?.(null); }
    animatedObjects.length = 0;
    for (const object of placedObjects.values()) if (object.metadata.animate) animatedObjects.push(object);
    for (const item of layout.items) applyUse(placedObjects.get(item.id), item);
    placeRoomLights(); applyAccents();
    if (hoveredId && !ids.has(hoveredId)) hoveredId = null;
    const layoutKey = JSON.stringify([layout.activeDeskId, layout.items.map(item => [item.id, item.type, item.x, item.z, item.rotation])]);
    companionRoutine?.setContext({ windowX: architecture?.window.x ?? archCenter });
    if (companionLayoutKey !== layoutKey) { companionLayoutKey = layoutKey; companionRoutine?.setLayout(layout); }
    else companionRoutine?.useLayout(layout);
    // The pet also sees switched fires, so it keeps the full layout.
    const petLayoutKey = JSON.stringify(layout);
    if (petKey !== petLayoutKey) { petKey = petLayoutKey; petRoutine?.setLayout(layout, { windowX: architecture?.window.x ?? archCenter }); }
    syncCompanionVisibility();
    outlineKey = ''; updateOutline(); updateMarker(); refreshShadows(); wakeForClock();
  }
  // The desk lamp light follows the active desk, and the hearth light the
  // first fire that is lit. A switched-off lamp or fire takes its light along.
  function placeRoomLights() {
    const desk = layout.items.find(item => item.id === layout.activeDeskId); windowGlow.setEnabled(!desk?.off);
    if (desk) { const offset = Vector3.TransformCoordinates(new Vector3(0.85, 2.08, -0.35), Matrix.RotationY(desk.rotation * Math.PI / 2)); windowGlow.position.set(desk.x + offset.x, offset.y, desk.z + offset.z); }
    const fireplace = layout.items.find(item => item.type === 'fireplace' && !item.off); hearthGlow.setEnabled(Boolean(fireplace));
    if (fireplace) { const offset = Vector3.TransformCoordinates(new Vector3(0, 1.0, 0.70), Matrix.RotationY(fireplace.rotation * Math.PI / 2)); hearthGlow.position.set(fireplace.x + offset.x, offset.y, fireplace.z + offset.z); }
  }
  // A switched-off lamp keeps its shade with an unlit twin of its glowing
  // paint. Candles and fires lose their flames.
  const unlitMaterials = new Map();
  function unlit(mat) {
    if (!unlitMaterials.has(mat)) { const twin = mat.clone(`${mat.name}-unlit`); twin.emissiveColor = Color3.Black(); twin.metadata = { unlit: true }; unlitMaterials.set(mat, twin); }
    return unlitMaterials.get(mat);
  }
  function applyUse(object, item) {
    const toggle = getFurniture(item.type).use?.toggle; if (!object || !toggle) return;
    const off = Boolean(item.off); object.metadata.off = off;
    object.metadata.glows ??= object.getChildMeshes().filter(mesh => !mesh.metadata?.effect && mesh.material && mesh.material.emissiveColor.r + mesh.material.emissiveColor.g + mesh.material.emissiveColor.b > 0.1).map(mesh => [mesh, mesh.material]);
    for (const [mesh, lit] of object.metadata.glows) {
      if (toggle === 'lamp') mesh.material = off ? unlit(lit) : lit;
      else if (toggle !== 'record') mesh.setEnabled(!off);
    }
    if (toggle === 'fire') for (const mesh of object.getChildMeshes()) if (['hearth-flames', 'hearth-embers'].includes(mesh.metadata?.effect)) mesh.setEnabled(!off && (mesh.metadata.effect === 'hearth-flames' || !reducedMotion));
  }
  // Outside Decorate, a tap uses the piece: toggles save as `off` without an
  // Undo step, and reactions play a short motion that ends at the rest pose.
  const reactions = new Map();
  function useItem(id) {
    const item = layout.items.find(entry => entry.id === id), use = getFurniture(item?.type)?.use; if (!use) return;
    if (use.toggle) {
      if (item.off) delete item.off; else item.off = true;
      applyUse(placedObjects.get(id), item); placeRoomLights(); refreshShadows();
      options.onLayoutChange?.(copyLayout(), { remember: false });
    } else if (!reducedMotion) { reactions.set(id, { kind: use.react, start: performance.now() }); requestRender(); }
  }
  function react(object, kind, t) {
    const wave = Math.sin(Math.min(1, t) * Math.PI);
    if (kind === 'rustle') object.metadata.rustle = (1 - Math.min(1, t)) ** 2;
    else if (kind === 'steam') object.metadata.puff = t < 1 ? wave : 0;
    else if (kind === 'squish') { const squash = t < 1 ? Math.sin(t * Math.PI * 2.2) * Math.exp(-3 * t) : 0; object.metadata.body.scaling.set(1 + squash * 0.03, 1 - squash * 0.07, 1 + squash * 0.03); }
    else if (kind === 'book') { const hinge = object.metadata.book, out = t < 1 ? Math.min(1, t / 0.25, (1 - t) / 0.35) : 0, ease = out * out * (3 - 2 * out); hinge.rotation.x = ease * 0.35; hinge.position.z = 0.225 + ease * 0.04; }
    // A globe spins one turn and slows to its rest pose.
    else if (kind === 'spin') object.metadata.globe.rotation.y = t < 1 ? (1 - (1 - t) ** 3) * Math.PI * 2 : 0;
  }
  const reactionSeconds = { rustle: 1.1, steam: 1.6, squish: 0.6, book: 1.5, spin: 1.8 };
  function setLayout(next) {
    cancelDrag(); layout = normalizeLayout(next); syncFurniture();
    if (selectedId) options.onSelectionChange?.({ ...layout.items.find(item => item.id === selectedId) });
    if (placement) updatePlacement(placement);
  }
  function commitLayout() { syncFurniture(true); options.onLayoutChange?.(copyLayout()); }
  function selectItem(id) {
    selectedId = layout.items.some(item => item.id === id) ? id : null; updateMarker(); updateOutline();
    const item = layout.items.find(candidate => candidate.id === selectedId); options.onSelectionChange?.(item ? { ...item } : null); requestRender();
  }
  // A blocked spot resolves to the closest free one, up to four grid steps
  // away. The spot shown last wins near-ties, so a piece dragged across an
  // obstacle does not flicker between its two sides.
  function resolveSpot(candidate, previous) {
    const wall = isWallPiece(candidate), [a, b] = wall ? ['u', 'v'] : ['x', 'z'], at = point => ({ [a]: point[a], [b]: point[b] });
    const verdict = validatePlacement(layout.items, candidate, architectureStyle);
    if (verdict.valid) return { spot: at(candidate), verdict };
    const spot = nearestValidPlacement(layout.items, candidate, 1, architectureStyle);
    if (!spot) return { spot: null, verdict };
    const reach = point => Math.hypot(point[a] - candidate[a], point[b] - candidate[b]);
    const keep = previous && (!wall || previous.wall === candidate.wall) && reach(previous) <= reach(spot) + 0.3 && validatePlacement(layout.items, { ...candidate, ...at(previous) }, architectureStyle).valid;
    return { spot: keep ? at(previous) : spot, verdict: { valid: true, reason: '' } };
  }
  // Where a pointer ray meets a wall, in wall coordinates. Both walls are
  // tried, and the nearer hit along the ray is the wall in view.
  function wallPosition(ray, margin = 0.6) {
    let best = null;
    for (const wall of ['back', 'side']) {
      const shell = (SHELLS[architectureStyle] || SHELLS.retreat)[wall], across = wall === 'back' ? 'z' : 'x', along = wall === 'back' ? 'x' : 'z';
      const step = ray.direction[across]; if (Math.abs(step) < 1e-6) continue;
      const t = (shell.face - ray.origin[across]) / step; if (t <= 0) continue;
      const u = ray.origin[along] + ray.direction[along] * t, v = ray.origin.y + ray.direction.y * t;
      if (u < shell.min - margin || u > shell.max + margin || v < shell.bottom - margin || v > shell.top + margin) continue;
      if (!best || t < best.t) best = { wall, u, v, t };
    }
    return best;
  }
  // The rug put down last lies on top of the others.
  function raiseRug(item) { if (getFurniture(item.type).category === 'Rugs') layout.items = [...layout.items.filter(other => other !== item), item]; }
  function cancelPlacement() {
    placement = null; if (ghost) { ghost.dispose(false, false); ghost = null; }
    if (lastPlacementState) options.onPlacementState?.(null); lastPlacementState = ''; updateMarker(); updateOutline(); requestRender();
  }
  // `point` is a floor spot { x, z } or, for a wall piece, { wall, u, v }.
  function updatePlacement(point) {
    if (!placement || !point) return;
    const wall = isWallPiece(placement);
    const candidate = wall ? { ...placement, wall: point.wall, u: snapWall(point.u), v: snapWall(point.v) } : { ...placement, x: snap(point.x), z: snap(point.z) };
    const { spot, verdict } = resolveSpot(candidate, placement.valid ? placement : null);
    Object.assign(placement, candidate, spot || {}); placement.valid = Boolean(spot); placement.reason = spot ? '' : verdict.reason || '';
    if (wall) placeOnWall(ghost, placement); else { ghost.position.x = placement.x; ghost.position.z = placement.z; ghost.rotation.y = placement.rotation * Math.PI / 2; }
    ghostMaterial.diffuseColor = color(placement.valid ? '#85ac80' : '#cf7868'); ghostMaterial.emissiveColor = color(placement.valid ? '#42653f' : '#8a4238');
    const key = `${placement.type}:${placement.valid}:${placement.reason}`;
    if (key !== lastPlacementState) { lastPlacementState = key; options.onPlacementState?.({ type: placement.type, valid: placement.valid, reason: placement.reason }); }
    requestRender();
  }
  function beginPlacement(type) {
    if (!getFurniture(type)) return false;
    if (getFurniture(type).unique) return false;
    if (pieceCount(layout.items) >= MAX_ITEMS) { options.onNotice?.(`This room has space for ${MAX_ITEMS} pieces. Remove a piece first.`); return false; }
    cancelDrag(); hoverItem(null); cancelPlacement(); selectItem(null); setEditMode(true);
    ghost = createFurniture(type, scene); ghost.getChildMeshes().forEach(mesh => { mesh.material = ghostMaterial; mesh.isPickable = false; mesh.receiveShadows = false; });
    ghost.metadata.avatar?.setEnabled(false);
    const wall = getFurniture(type).mount === 'wall', id = `piece-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    placement = wall ? { id, type, wall: 'back', u: 0, v: 3 } : { id, type, x: 0, z: 0, rotation: 0 };
    updateOutline();
    const free = findFreePosition(layout.items, type, 0, architectureStyle); updatePlacement(free || (wall ? { wall: 'back', u: 0, v: 3 } : { x: 0, z: 0 })); return true;
  }
  // Adds the previewed piece where it stands. Pointer clicks and the Enter key
  // share this path, so keyboard users can add furniture too.
  function confirmPlacement() {
    if (!placement) return false;
    if (!placement.valid) { options.onNotice?.(placement.reason || 'Choose a clear spot inside the room.'); return false; }
    const { id, type } = placement, arts = getFurniture(type).arts;
    layout.items.push(isWallPiece(placement) ? { id, type, wall: placement.wall, u: placement.u, v: placement.v, ...(arts ? { art: arts[0] } : {}) } : { id, type, x: placement.x, z: placement.z, rotation: placement.rotation });
    cancelPlacement(); commitLayout(); selectItem(id); return true;
  }
  const wallStep = (piece, dx, dz) => ({ u: Math.round((piece.u + Math.sign(dx) * 0.1 * (piece.wall === 'side' ? -1 : 1)) * 1000) / 1000, v: Math.round((piece.v - Math.sign(dz) * 0.1) * 1000) / 1000 });
  function moveSelection(dx, dz) {
    if (drag) return;
    if (placement) { updatePlacement(isWallPiece(placement) ? { wall: placement.wall, ...wallStep(placement, dx, dz) } : { x: placement.x + dx, z: placement.z + dz }); return; }
    const item = layout.items.find(candidate => candidate.id === selectedId); if (!item) return;
    const candidate = isWallPiece(item) ? { ...item, ...wallStep(item, dx, dz) } : { ...item, x: snap(item.x + dx), z: snap(item.z + dz) }, verdict = validatePlacement(layout.items, candidate, architectureStyle);
    if (!verdict.valid) { options.onNotice?.(verdict.reason); return; }
    Object.assign(item, candidate); raiseRug(item); commitLayout(); selectItem(item.id);
  }
  function rotateSelection() {
    // Wall pieces always face the room, so they have nothing to turn.
    if (drag) { if (!drag.wallPiece) { drag.rotation = (drag.rotation + 1) % 4; updateDrag(pendingPointer); } return; }
    if (placement) { if (!isWallPiece(placement)) { placement.rotation = (placement.rotation + 1) % 4; updatePlacement(placement); } return; }
    const item = layout.items.find(candidate => candidate.id === selectedId); if (!item || isWallPiece(item)) return;
    // A turn that would touch a wall or a neighbor slides the piece clear.
    const candidate = { ...item, rotation: (item.rotation + 1) % 4 }, { spot, verdict } = resolveSpot(candidate);
    if (!spot) { options.onNotice?.(verdict.reason); return; }
    Object.assign(item, candidate, spot); raiseRug(item); commitLayout(); selectItem(item.id);
  }
  function removeSelection() {
    cancelDrag();
    const item = layout.items.find(candidate => candidate.id === selectedId); if (!item) return;
    if (!canRemove(item)) { options.onNotice?.(keepReason(item)); return; }
    layout.items = layout.items.filter(candidate => candidate.id !== selectedId);
    if (layout.activeDeskId === selectedId) layout.activeDeskId = layout.items.find(isDesk)?.id || null;
    selectItem(null); commitLayout();
  }
  function setActiveDesk(id) { if (!isDesk(layout.items.find(item => item.id === id))) return; cancelDrag(); layout.activeDeskId = id; commitLayout(); }
  // A frame shows the picture chosen for it, and a framed record its sleeve.
  function setArt(art) {
    const item = layout.items.find(candidate => candidate.id === selectedId);
    if (!item || item.art === art || !getFurniture(item.type).arts?.includes(art)) return;
    cancelDrag(); item.art = art; commitLayout(); selectItem(item.id);
  }
  // A room's walls and floor wear the chosen paint; null gives back the
  // design's own. No furniture changes, so only the surfaces and the shadow
  // list (for a shell's new walls mesh) are brought up to date.
  function setSurface(kind, id) {
    if (!['walls', 'floor'].includes(kind) || (layout[kind] ?? null) === id || (id !== null && !surfacePaint(architectureStyle, kind, id))) return;
    cancelDrag(); if (id === null) delete layout[kind]; else layout[kind] = id;
    applySurfaces(); refreshShadows(); options.onLayoutChange?.(copyLayout());
  }
  // A piece with color choices wears the chosen one; null gives it back the
  // room's colors.
  function setTint(tint) {
    const item = layout.items.find(candidate => candidate.id === selectedId);
    if (!item || (item.tint ?? null) === tint || (tint !== null && !tintPaint(item.type, tint))) return;
    cancelDrag(); if (tint === null) delete item.tint; else item.tint = tint; commitLayout(); selectItem(item.id);
  }
  function setEditMode(value) {
    cancelDrag(); hoverItem(null); playHover = null;
    const wasEditing = editing; editing = Boolean(value);
    if (petRoutine?.pose.held) releasePet();
    companionRoutine?.setEditing(editing); petRoutine?.setEditing(editing); syncCompanionVisibility(); refreshShadows();
    if (!options.engineFactory && wasEditing !== editing) { if (editing) camera.detachControl(); else camera.attachControl(canvas, false); }
    camera.inertialAlphaOffset = 0; camera.inertialBetaOffset = 0;
    canvas.style.touchAction = editing ? 'none' : 'pan-y'; canvas.style.cursor = 'grab';
    canvas.setAttribute('aria-label', editing ? 'Room design canvas. Hover to outline furniture. Drag a piece to move it, or drop it over the bottom collection to return it. Drag empty space to look around. Escape cancels a drag.' : 'Your cozy miniature study room. Drag to look around. Tap a lamp, the fire or the record player to switch it; tap your pet to pet it, or drag your pet somewhere new.');
    if (!editing) { cancelPlacement(); selectItem(null); } updateMarker(); updateOutline(); requestRender();
  }
  function applyBulbs() {
    const glow = color('#ffd392').scale(theme === 'day' ? 0.50 : theme === 'dusk' ? 1.25 : 0.80);
    bulb.emissiveColor = decorVisible.lights ? glow : Color3.Black(); candleFlame.emissiveColor = glow; moteGlow.emissiveColor = glow.clone();
    for (const mesh of sillFlames) mesh.setEnabled(decorVisible.lights);
  }
  function setTheme(name) {
    theme = ['dusk', 'rain', 'day'].includes(name) ? name : 'dusk';
    const daylight = theme === 'day', night = theme === 'dusk';
    companionRoutine?.setContext({ night });
    paintSky(theme); architecture?.setTheme(theme); rain.setEnabled(theme === 'rain'); skyStars.setEnabled(night);
    if (!night) { shootingStar.setEnabled(false); streakMaterial.alpha = 0; }
    sun.diffuse = color(daylight ? '#fff1d2' : night ? '#c5ccec' : '#d5dfeb');
    sun.intensity = daylight ? 1.6 : night ? 0.62 : 0.82;
    sun.position.set(...(daylight ? [-4, 10, -8] : [-5, 10, 6]));
    sun.direction.set(...(daylight ? [3, -8, 7] : [3, -8, -5])).normalize();
    hemisphere.diffuse = color(daylight ? '#edf4e8' : night ? '#e1d3ed' : '#e0e7ed');
    hemisphere.groundColor = color(daylight ? '#a48b6b' : '#645441');
    hemisphere.intensity = daylight ? 0.90 : night ? 0.44 : 0.70;
    windowGlow.intensity = daylight ? 0.22 : night ? 1.25 : 0.65;
    applyBulbs(); applyAccents();
    bloom.intensity = daylight ? 0.18 : night ? 0.40 : 0.26;
    shadow.darkness = daylight ? 0.34 : 0.24;
    // Light direction changes only here, so the shadow map remains cached.
    requestRender(true);
  }
  // A pet: the pet wakes, leans into your hand, and a heart floats up. The
  // companion pets it too, on a break (`by`).
  function pet({ by = 'you' } = {}) {
    petStart = performance.now(); petRoutine.pet();
    options.onPet?.({ species: petSpecies, name: PETS[petSpecies].name, state: petRoutine.pose.state, by }); requestRender();
  }
  // On a break the companion uses a piece: it switches on an unlit lamp or
  // the record player (saved like a tap, with no Undo step), rustles the
  // plant it waters, or pets the pet.
  function companionUse({ kind, itemId }) {
    const item = layout.items.find(entry => entry.id === itemId);
    if ((kind === 'lamp' || kind === 'record') && item?.off) useItem(itemId);
    else if (kind === 'water' && item && !reducedMotion) { reactions.set(itemId, { kind: 'rustle', start: performance.now() }); requestRender(); }
    else if (kind === 'pet' && !petRoutine.pose.held) pet({ by: 'companion' });
  }
  function castPointer(event) {
    const rect = canvas.getBoundingClientRect();
    // Match the actual framebuffer to the displayed canvas. Babylon applies its
    // hardware scaling once more internally; compensate here so picking also
    // stays accurate after CSS sizing, quality changes and embedded previews.
    const hardwareScale = engine.getHardwareScalingLevel();
    const x = (event.clientX - rect.left) * engine.getRenderWidth() * hardwareScale / Math.max(1, rect.width);
    const y = (event.clientY - rect.top) * engine.getRenderHeight() * hardwareScale / Math.max(1, rect.height);
    return scene.createPickingRay(x, y, Matrix.IdentityReadOnly, camera);
  }
  // What a tap outside Decorate reaches: the cat, a piece with a use, or the
  // room's own lights. The closest of them wins.
  const usable = mesh => mesh.isEnabled() && mesh.isPickable && (mesh.metadata?.cat || mesh.metadata?.lightSwitch || Boolean(getFurniture(itemAncestor(mesh)?.metadata.furnitureType)?.use));
  // Distance along a ray to where it enters a sphere, or null.
  const sphereOffset = new Vector3();
  function raySphere(ray, centre, radius) {
    centre.subtractToRef(ray.origin, sphereOffset);
    const along = Vector3.Dot(sphereOffset, ray.direction), miss = sphereOffset.lengthSquared() - along * along;
    return along > 0 && miss <= radius * radius ? along - Math.sqrt(radius * radius - miss) : null;
  }
  // The companion answers taps on its head or body, at the desk or away.
  const companionHead = new Vector3(), companionBody = new Vector3();
  function companionDistance(ray) {
    const head = companionRoutine.pose.atDesk ? placedObjects.get(layout.activeDeskId)?.metadata.avatarHead : mobileCompanion.head;
    if (!head?.isEnabled()) return null;
    companionHead.copyFrom(head.getAbsolutePosition()); companionBody.copyFrom(companionHead); companionBody.y -= 0.55;
    const a = raySphere(ray, companionHead, 0.3), b = raySphere(ray, companionBody, 0.36);
    return a === null ? b : b === null ? a : Math.min(a, b);
  }
  function playTarget(ray) {
    const hit = scene.pickWithRay(ray, usable), petDistance = petModel?.root.isEnabled() ? petModel.hitTest(ray) : null, companion = companionDistance(ray);
    // The pet and the companion win when they are in front of whatever else
    // the ray meets.
    if (petDistance !== null && (!hit?.hit || petDistance <= hit.distance) && (companion === null || petDistance <= companion)) return { cat: true };
    if (companion !== null && (!hit?.hit || companion <= hit.distance)) return { avatar: true };
    if (!hit?.hit) return null;
    // The seated companion's body is part of its desk piece, but a tap on it
    // (its legs too, outside the spheres) is for the companion, not the lamp.
    const mesh = hit.pickedMesh, owner = itemAncestor(mesh);
    if (mesh.metadata?.lightSwitch) return { lights: true };
    if (owner.metadata.avatar && mesh.isDescendantOf(owner.metadata.avatar)) return { avatar: true };
    return { id: owner.metadata.itemId };
  }
  let playHover = null;
  function hoverPlay(target) { const next = target?.id || (target?.lights ? 'room-lights' : null); if (next === playHover) return; playHover = next; updateOutline(); }
  function itemAncestor(mesh) { for (let node = mesh; node; node = node.parent) if (node.metadata?.itemId) return node; return null; }
  function hitItem(ray, fastCheck = false) {
    const hit = scene.pickWithRay(ray, mesh => mesh.isEnabled() && mesh.isPickable && Boolean(itemAncestor(mesh)), fastCheck);
    return hit?.hit ? itemAncestor(hit.pickedMesh)?.metadata.itemId : null;
  }
  const floorHit = new Vector3();
  function floorPosition(ray) { const distance = (0.22 - ray.origin.y) / ray.direction.y; if (!Number.isFinite(distance) || distance < 0) return null; floorHit.copyFrom(ray.direction).scaleInPlace(distance).addInPlace(ray.origin); return floorHit; }
  let downPosition = null, hasPendingPointer = false;
  const pendingPointer = { clientX: 0, clientY: 0, pointerType: 'mouse' };
  function releasePointer(id) {
    if (id == null) return;
    try { canvas.releasePointerCapture(id); } catch { /* A cancelled pointer may already be released. */ }
  }
  // `reopen` puts a window's opening back at once; a drop reopens it where it lands.
  // Escape, a hidden tab or a layout from another tab sets a carried pet down.
  function cancelDrag(reopen = true) {
    const carried = downPosition?.pet ? releasePet() : false;
    const wasDragging = Boolean(drag), pointerId = downPosition?.pointerId;
    if (drag) {
      drag.object.position.copyFrom(drag.originalPosition); drag.object.rotation.y = drag.wallPiece ? drag.originalRotation : drag.original.rotation * Math.PI / 2;
      for (const [mesh, visibility] of drag.visibility) if (!mesh.isDisposed()) mesh.visibility = visibility;
      liftShade(drag.object, drag.original); drag.object.metadata.shade?.setEnabled(true);
      if (drag.object.metadata.view) drag.object.metadata.view.position.z = WINDOW_VIEW_DEPTH;
    }
    drag = null; downPosition = null; hasPendingPointer = false; releasePointer(pointerId);
    if (reopen) syncOpenings();
    if (wasDragging) {
      options.onDragState?.(null); updateMarker(); outlineKey = ''; updateOutline(); refreshShadows();
    }
    canvas.style.cursor = placement ? 'crosshair' : 'grab';
    return wasDragging || carried;
  }
  function startDrag() {
    const item = layout.items.find(item => item.id === downPosition?.itemId), object = placedObjects.get(item?.id);
    const wallPiece = isWallPiece(item);
    if (!item || !object || !(wallPiece ? downPosition.wall : downPosition.floor)) return;
    // A held piece shows no shadow: the sun map drops it below, and its floor
    // shade waits too. Both return where the piece is placed.
    settlingPieces.delete(item.id); object.scaling.setAll(1); object.metadata.shade?.setEnabled(false);
    drag = { active: true, id: item.id, original: { ...item }, candidate: { ...item }, object,
      originalPosition: object.position.clone(), originalRotation: object.rotation.y, rotation: item.rotation,
      offsetX: wallPiece ? 0 : downPosition.floor.x - item.x, offsetZ: wallPiece ? 0 : downPosition.floor.z - item.z,
      wallPiece, grabWall: wallPiece ? downPosition.wall.wall : null, offsetU: wallPiece && downPosition.wall.wall === item.wall ? downPosition.wall.u - item.u : 0, offsetV: wallPiece && downPosition.wall.wall === item.wall ? downPosition.wall.v - item.v : 0,
      visibility: object.getChildMeshes().map(mesh => [mesh, mesh.visibility]),
      removable: canRemove(item), overCollection: false, valid: true, reason: '', shown: wallPiece ? { wall: item.wall, u: item.u, v: item.v } : { x: item.x, z: item.z } };
    // A dragged window closes its opening and shows its view in front of the wall.
    if (object.metadata.view) object.metadata.view.position.z = 0.012;
    syncOpenings(); hoveredId = null; selectItem(item.id); refreshShadows();
  }
  function updateDrag(event) {
    if (!drag) return;
    const overCollection = Boolean(options.isCollectionDrop?.(event.clientX, event.clientY));
    drag.overCollection = overCollection;
    if (overCollection) {
      drag.valid = drag.removable;
      drag.reason = drag.removable ? '' : keepReason(drag.original);
    } else {
      const rect = canvas.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      const ray = inside ? castPointer(event) : null, floor = ray && !drag.wallPiece ? floorPosition(ray) : null, wallHit = ray && drag.wallPiece ? wallPosition(ray, 1.5) : null;
      if (wallHit) {
        // A wall piece slides along the wall under the pointer and crosses the corner to the other wall.
        const same = wallHit.wall === drag.grabWall;
        const candidate = { ...drag.original, wall: wallHit.wall, u: snapWall(wallHit.u - (same ? drag.offsetU : 0)), v: snapWall(wallHit.v - (same ? drag.offsetV : 0)) };
        const { spot, verdict } = resolveSpot(candidate, drag.shown);
        drag.candidate = spot ? { ...candidate, ...spot } : candidate; drag.shown = spot ? { ...spot, wall: candidate.wall } : null; drag.valid = Boolean(spot); drag.reason = spot ? '' : verdict.reason || '';
        placeOnWall(drag.object, drag.candidate);
      } else if (floor) {
        const candidate = { ...drag.original, x: snap(floor.x - drag.offsetX), z: snap(floor.z - drag.offsetZ), rotation: drag.rotation };
        const { spot, verdict } = resolveSpot(candidate, drag.shown);
        drag.candidate = spot ? { ...candidate, ...spot } : candidate; drag.shown = spot; drag.valid = Boolean(spot); drag.reason = spot ? '' : verdict.reason || '';
        drag.object.position.x = drag.candidate.x; drag.object.position.z = drag.candidate.z;
        drag.object.rotation.y = drag.rotation * Math.PI / 2; liftShade(drag.object, drag.candidate);
      } else { drag.valid = false; drag.reason = 'Drop inside the room, or return this piece to the collection.'; }
    }
    for (const [mesh, visibility] of drag.visibility) mesh.visibility = overCollection && drag.removable ? visibility * 0.13 : visibility;
    if (marker) {
      marker.setEnabled(!overCollection); marker.color = drag.valid ? selectedOutline : invalidOutline;
      marker.position.set(drag.candidate.x, 0.30, drag.candidate.z); marker.rotation.y = drag.rotation * Math.PI / 2;
    }
    canvas.style.cursor = overCollection ? drag.removable ? 'alias' : 'not-allowed' : drag.valid ? 'grabbing' : 'not-allowed';
    updateOutline();
    options.onDragState?.({ id: drag.id, type: drag.original.type, overCollection, removable: drag.removable, valid: drag.valid, reason: drag.reason, clientX: event.clientX, clientY: event.clientY });
    requestRender();
  }
  function finishDrag(event) {
    updateDrag(event);
    const completed = drag;
    cancelDrag(false);
    if (completed.overCollection && completed.removable) { removeSelection(); options.onNotice?.(`${getFurniture(completed.original.type).name} returned to the collection. Undo brings it back.`); }
    else if (completed.valid && !completed.overCollection) {
      const item = layout.items.find(item => item.id === completed.id);
      if (item && ['x', 'z', 'rotation', 'wall', 'u', 'v'].some(key => item[key] !== completed.candidate[key])) {
        Object.assign(item, completed.candidate); raiseRug(item); commitLayout(); selectItem(item.id);
      }
    } else options.onNotice?.(completed.reason || 'That spot is occupied. Your piece is back where it started.');
    syncOpenings();
  }
  const onPointerDown = event => {
    if (event.isPrimary === false || (event.button != null && event.button !== 0) || downPosition) return;
    const ray = editing && !placement ? castPointer(event) : null, floor = ray && floorPosition(ray), wall = ray && wallPosition(ray, 1.5);
    downPosition = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, pointerId: event.pointerId,
      itemId: ray ? decorHit(ray) : null, floor: floor ? { x: floor.x, z: floor.z } : null, wall, pet: !editing && hitPet(castPointer(event)) };
    // A press on the pet can become a carry, so the room does not turn.
    if (downPosition.pet && !options.engineFactory) camera.detachControl();
    if ((editing || downPosition.pet) && event.pointerId != null) canvas.setPointerCapture(event.pointerId);
    requestRender();
  };
  const onPointerUp = event => {
    if (!downPosition || (event.pointerId != null && downPosition.pointerId != null && event.pointerId !== downPosition.pointerId)) return;
    hasPendingPointer = false;
    const clicked = Math.hypot(event.clientX - downPosition.x, event.clientY - downPosition.y) < 7;
    if (downPosition.pet) { const carried = releasePet(event); if (!carried && clicked) pet(); return; }
    if (editing && downPosition.itemId && !clicked && !drag) startDrag();
    if (drag) { finishDrag(event); return; }
    const pointerId = downPosition.pointerId; downPosition = null; releasePointer(pointerId);
    // The next frame sets the hover cursor again, so 'grabbing' ends with the gesture.
    pendingPointer.clientX = event.clientX; pendingPointer.clientY = event.clientY; pendingPointer.pointerType = event.pointerType; hasPendingPointer = true;
    requestRender(); if (!clicked) return;
    const ray = castPointer(event);
    if (!editing) { const target = playTarget(ray); if (target?.cat) pet(); else if (target?.avatar) options.onCompanionTap?.({ state: companionRoutine.pose.state, activity: companionRoutine.pose.activity }); else if (target?.id) useItem(target.id); else if (target?.lights) options.onToggleLights?.(); return; }
    if (placement) {
      const point = isWallPiece(placement) ? wallPosition(ray) : floorPosition(ray);
      if (!point) { options.onNotice?.(placement.reason || (isWallPiece(placement) ? 'Choose a clear spot on a wall.' : 'Choose a clear spot inside the room.')); return; }
      updatePlacement(point); confirmPlacement(); return;
    }
    // A click selects the piece under the pointer (the bed, for its pet).
    // Empty floor only deselects, so a stray click never moves the selected piece.
    selectItem(decorHit(ray));
  };
  const onPointerCancel = event => {
    if (event?.pointerId != null && downPosition?.pointerId != null && event.pointerId !== downPosition.pointerId) return;
    if (downPosition?.pet) releasePet(); cancelDrag(); hoverItem(null);
  };
  const onPointerLeave = () => { if (!downPosition) { hasPendingPointer = false; hoverItem(null); hoverPlay(null); } };
  const onPointerMove = event => {
    if (downPosition && event.pointerId != null && downPosition.pointerId != null && event.pointerId !== downPosition.pointerId) return;
    if (!editing && downPosition?.pet) { carryPet(event); return; }
    if (!editing && downPosition) { canvas.style.cursor = 'grabbing'; requestRender(); return; }
    if (editing && downPosition && !downPosition.itemId) {
      // Decorate mode keeps Babylon's camera input detached, so a drag on a
      // piece only moves the piece. A drag from empty space turns the room
      // with the same math and inertia as the camera input.
      camera.inertialAlphaOffset -= (event.clientX - downPosition.lastX) / camera.angularSensibilityX;
      camera.inertialBetaOffset -= (event.clientY - downPosition.lastY) / camera.angularSensibilityY;
      downPosition.lastX = event.clientX; downPosition.lastY = event.clientY;
      canvas.style.cursor = 'grabbing'; requestRender(); return;
    }
    pendingPointer.clientX = event.clientX; pendingPointer.clientY = event.clientY; pendingPointer.pointerType = event.pointerType; hasPendingPointer = true;
    // One closest-object pick per rendered frame; drag motion only intersects
    // the floor. Pointer capture keeps the same gesture alive over the tray.
    if (visible && onScreen && !frame) frame = requestAnimationFrame(tick);
  };
  function processPendingPointer() {
    if (!hasPendingPointer) return;
    hasPendingPointer = false;
    if (editing && downPosition?.itemId && !drag && Math.hypot(pendingPointer.clientX - downPosition.x, pendingPointer.clientY - downPosition.y) >= 7) startDrag();
    if (drag) { updateDrag(pendingPointer); return; }
    const ray = castPointer(pendingPointer);
    if (editing && placement) {
      updatePlacement(isWallPiece(placement) ? wallPosition(ray) : floorPosition(ray));
      canvas.style.cursor = 'crosshair'; return;
    }
    if (pendingPointer.pointerType === 'mouse' || pendingPointer.pointerType === 'pen') {
      if (editing) { hoverItem(decorHit(ray)); canvas.style.cursor = 'grab'; }
      else { const target = playTarget(ray); hoverPlay(target); canvas.style.cursor = target ? 'pointer' : 'grab'; }
    }
  }
  // In Decorate the napping pet covers most of its bed, so a press on the
  // pet takes hold of the bed.
  function decorHit(ray) {
    const hit = scene.pickWithRay(ray, mesh => mesh.isEnabled() && mesh.isPickable && Boolean(itemAncestor(mesh))), bed = petBed(layout);
    const petDistance = bed && petModel?.root.isEnabled() ? petModel.hitTest(ray) : null;
    if (petDistance !== null && (!hit?.hit || petDistance <= hit.distance)) return bed.id;
    return hit?.hit ? itemAncestor(hit.pickedMesh)?.metadata.itemId : null;
  }
  function hitPet(ray) { return Boolean(petModel?.root.isEnabled()) && playTarget(ray)?.cat === true; }
  // Carry: the pet's scruff follows the pointer on a plane above the floor.
  const HOLD_HEIGHT = 0.95;
  function carryPet(event) {
    if (!petRoutine.pose.held) {
      if (Math.hypot(event.clientX - downPosition.x, event.clientY - downPosition.y) < 7 || !petRoutine.pickUp()) return;
      petStart = -Infinity; options.onPetCarry?.({ species: petSpecies, name: PETS[petSpecies].name, held: true }); updatePetShadow();
    }
    const ray = castPointer(event), distance = (0.22 + HOLD_HEIGHT - ray.origin.y) / ray.direction.y;
    if (Number.isFinite(distance) && distance > 0) petRoutine.moveHeld(ray.origin.x + ray.direction.x * distance, ray.origin.z + ray.direction.z * distance);
    canvas.style.cursor = 'grabbing'; requestRender();
  }
  // Ends a press on the pet; returns true when it was carried and set down.
  function releasePet(event) {
    const pointerId = downPosition?.pointerId, carried = petRoutine.pose.held;
    downPosition = null; releasePointer(pointerId);
    if (!options.engineFactory && !editing) camera.attachControl(canvas, false);
    if (carried) {
      petRoutine.drop(); options.onPetCarry?.({ species: petSpecies, name: PETS[petSpecies].name, held: false }); updatePetShadow();
      // With reduced motion, one more frame sends the sitting pet home.
      clearTimeout(petWake); if (reducedMotion && petRoutine.pose.state === 'sitting') petWake = setTimeout(requestRender, petRoutine.diagnostics().timer * 1000 + 50);
    }
    if (event) { pendingPointer.clientX = event.clientX; pendingPointer.clientY = event.clientY; pendingPointer.pointerType = event.pointerType; hasPendingPointer = true; }
    requestRender(); return carried;
  }
  canvas.addEventListener('pointerdown', onPointerDown); canvas.addEventListener('pointerup', onPointerUp); canvas.addEventListener('pointercancel', onPointerCancel); canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave); canvas.addEventListener('lostpointercapture', onPointerCancel);
  window.addEventListener('blur', onPointerCancel);

  const roomCorners = []; for (const x of [-6.19, 6.19]) for (const y of [-0.32, 6.02]) for (const z of [-4.78, 4.78]) roomCorners.push(new Vector3(x, y, z));
  const projectedCorner = new Vector3(); let canvasAspect = 1, fitAlpha = NaN, fitBeta = NaN;
  function fitRoom() {
    const view = camera.getViewMatrix(true); let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const corner of roomCorners) { Vector3.TransformCoordinatesToRef(corner, view, projectedCorner); minX = Math.min(minX, projectedCorner.x); maxX = Math.max(maxX, projectedCorner.x); minY = Math.min(minY, projectedCorner.y); maxY = Math.max(maxY, projectedCorner.y); }
    const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2, viewHeight = Math.max(maxY - minY, (maxX - minX) / canvasAspect) / 0.88, halfWidth = viewHeight * canvasAspect / 2;
    camera.orthoLeft = centerX - halfWidth; camera.orthoRight = centerX + halfWidth; camera.orthoTop = centerY + viewHeight / 2; camera.orthoBottom = centerY - viewHeight / 2; camera.getProjectionMatrix(true);
    fitAlpha = camera.alpha; fitBeta = camera.beta;
  }
  scene.onBeforeRenderObservable.add(() => { if (fitAlpha !== camera.alpha || fitBeta !== camera.beta) fitRoom(); });
  // Where a bubble belongs on screen: above the pet's head or the
  // companion's, in CSS pixels from the canvas corner. The result object is
  // reused from call to call.
  const anchorPoint = new Vector3(), projected = new Vector3(), anchorViewport = camera.viewport.clone(), anchored = { x: 0, y: 0, visible: false };
  let cssWidth = 1, cssHeight = 1;
  function anchor(who) {
    if (who === 'pet') { if (!petModel) return null; petModel.headPoint(anchorPoint); anchorPoint.y += 0.42; }
    else {
      const head = companionRoutine.pose.atDesk ? placedObjects.get(layout.activeDeskId)?.metadata.avatarHead : mobileCompanion.head;
      if (!head?.isEnabled()) return null;
      anchorPoint.copyFrom(head.getAbsolutePosition()); anchorPoint.y += 0.5;
    }
    const width = engine.getRenderWidth(), height = engine.getRenderHeight();
    camera.viewport.toGlobalToRef(width, height, anchorViewport);
    Vector3.ProjectToRef(anchorPoint, Matrix.IdentityReadOnly, scene.getTransformMatrix(), anchorViewport, projected);
    anchored.x = projected.x / width * cssWidth; anchored.y = projected.y / height * cssHeight;
    anchored.visible = projected.z >= 0 && projected.z <= 1 && projected.x >= 0 && projected.x <= width && projected.y >= 0 && projected.y <= height;
    return anchored;
  }
  function resize() { const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight); canvasAspect = width / height; cssWidth = width; cssHeight = height; engine.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio)); fitRoom(); requestRender(); }
  function applyPixelRatio(value) { pixelRatio = value; engine.setHardwareScalingLevel(1 / pixelRatio); slowSamples = 0; steadySamples = 0; resize(); }
  function setQuality(value) { quality = ['auto', 'battery', 'high'].includes(value) ? value : 'auto'; ratioCeiling = quality === 'battery' ? Math.min(window.devicePixelRatio || 1, 1) : nativeRatio(); raisedAt = -Infinity; bloom.isEnabled = quality !== 'battery'; applyPixelRatio(ratioCeiling); }
  const observer = new ResizeObserver(resize); observer.observe(container);
  // Moving the window to a screen with another density changes the native
  // ratio without any CSS resize, so follow the display itself.
  let densityQuery = null;
  function watchDensity() { densityQuery?.removeEventListener('change', onDensityChange); densityQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`); densityQuery.addEventListener('change', onDensityChange); }
  function onDensityChange() { watchDensity(); setQuality(quality); }
  watchDensity();
  // Scrolled out of view, the room pauses like a hidden tab.
  const viewObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    const next = entries[entries.length - 1].isIntersecting; if (next === onScreen) return;
    onScreen = next; if (onScreen) resumeFrames(); else { cancelAnimationFrame(frame); frame = 0; }
  }) : null;
  viewObserver?.observe(container);
  mobileCompanion = createMobileCompanion(scene);
  companionRoutine = createCompanionRoutine(status => {
    syncCompanionVisibility(); refreshShadows(); options.onCompanionState?.(status);
  }, { onUse: companionUse, random: options.random });
  petRoutine = createPetRoutine({ onChange: ({ state }) => { updatePetShadow(); options.onPetState?.({ state, species: petSpecies, name: PETS[petSpecies].name }); } });
  petRoutine.setCompanion(companionRoutine.pose); companionRoutine.setContext({ pet: petRoutine.pose });
  function buildPet() {
    petModel?.dispose(); petModel = createPetModel(scene, petSpecies); petModel.root.parent = world;
    petRoutine.setSpecies(petSpecies); petY = null; petCasts = null; updatePetShadow();
  }
  // A still pet casts into the cached sun shadow, which then redraws once
  // for each new resting place. A walking or carried pet keeps only its soft
  // contact shade.
  function updatePetShadow() {
    if (!petModel) return;
    const pose = petRoutine.pose, casts = !pose.held && !pose.moving && ['sleeping', 'sitting', 'settling'].includes(pose.state);
    const key = casts ? `${pose.x.toFixed(2)},${pose.z.toFixed(2)},${pose.yaw.toFixed(1)}` : '';
    if (key === petCasts) return;
    petCasts = key; petModel.body.metadata.castShadow = casts; refreshShadows();
    // The pose and height blend in over a moment: draw the shadow once more
    // when they have settled.
    if (casts) petShadowAt = performance.now() + 900;
  }
  buildPet();
  syncFurniture(); setTheme(theme); resize();
  function animate(now) {
    const seconds = now / 1000;
    const companionDelta = companionTime ? Math.max(0, Math.min(.1, (now - companionTime) / 1000)) : 0;
    companionTime = now;
    const companionPose = companionRoutine.update(companionDelta, reducedMotion);
    mobileCompanion.animate(companionPose, seconds, reducedMotion);
    if (!companionPose.atDesk) {
      pointArea.minX = pointArea.maxX = companionPose.x; pointArea.minZ = pointArea.maxZ = companionPose.z;
      mobileCompanion.contact.position.y = surfaceBelow(pointArea);
    }
    const ambientTime = reducedMotion ? 0 : seconds;
    for (let i = 0; i < swayingLanterns.length; i++) { const lantern = swayingLanterns[i]; lantern.rotation.z = reducedMotion ? 0 : Math.sin(seconds * 0.85 + i * 1.7) * 0.085; lantern.rotation.x = reducedMotion ? 0 : Math.sin(seconds * 0.63 + i * 1.3) * 0.025; }
    for (let i = 0; i < fireflySeeds.length; i++) {
      const seed = fireflySeeds[i], offset = i * 16;
      const scale = seed.scale * (reducedMotion ? 1 : 1 + Math.sin(seconds * 1.15 + i * 2.7) * 0.16);
      fireflyMatrices[offset] = fireflyMatrices[offset + 5] = fireflyMatrices[offset + 10] = scale;
      fireflyMatrices[offset + 12] = seed.x + (reducedMotion ? 0 : Math.sin(ambientTime * 0.29 + i * 2) * 0.32);
      fireflyMatrices[offset + 13] = seed.y + (reducedMotion ? 0 : Math.sin(ambientTime * 0.37 + i) * 0.23);
      fireflyMatrices[offset + 14] = seed.z + (reducedMotion ? 0 : Math.cos(ambientTime * 0.23 + i * 3) * 0.26);
    }
    fireflies.thinInstanceBufferUpdated('matrix');
    for (let i = 0; i < starSeeds.length; i++) {
      const seed = starSeeds[i], offset = i * 16;
      starMatrices[offset + 12] = seed.x + (reducedMotion ? 0 : Math.sin(seconds * 0.25 + i * 1.7) * 0.09);
      starMatrices[offset + 13] = seed.y + (reducedMotion ? 0 : Math.cos(seconds * 0.19 + i * 2.3) * 0.055);
    }
    skyStars.thinInstanceBufferUpdated('matrix');
    moths.setEnabled(!reducedMotion && architectureStyle !== 'metro');
    for (let i = 0; i < mothSeeds.length; i++) {
      const seed = mothSeeds[i], phase = seconds * 0.52 + i * 2.1;
      const x = seed.x + (reducedMotion ? 0 : Math.sin(phase) * 0.24), y = seed.y + (reducedMotion ? 0 : Math.cos(phase * 1.27) * 0.20), z = seed.z + (reducedMotion ? 0 : Math.sin(phase * 0.83) * 0.13);
      const flap = reducedMotion ? 0 : 0.60 + Math.sin(seconds * (9 + i * 0.7) + i * 2) * 0.50, foldX = Math.cos(flap), foldZ = Math.sin(flap);
      for (let v = 0; v < mothVertices; v++) {
        const vertex = i * mothVertices + v, offset = vertex * 3, localX = mothLocalPositions[offset];
        mothPositions[offset] = x + localX * (mothWings[vertex] ? foldX : 1); mothPositions[offset + 1] = y + mothLocalPositions[offset + 1]; mothPositions[offset + 2] = z + (mothWings[vertex] ? Math.abs(localX) * foldZ : mothLocalPositions[offset + 2]);
      }
    }
    moths.updateVerticesData('position', mothPositions, false, false);
    const streakAge = seconds - ambienceStart - shootingStar.metadata.delaySeconds, streakPhase = streakAge % shootingStar.metadata.periodSeconds;
    const streakVisible = theme === 'dusk' && !reducedMotion && streakAge >= 0 && streakPhase < shootingStar.metadata.durationSeconds;
    shootingStar.setEnabled(streakVisible);
    const streakProgress = streakVisible ? streakPhase / shootingStar.metadata.durationSeconds : 0;
    shootingStar.position.set(-3.52 + streakProgress * 1.04, 4.63 - streakProgress * 0.48, -4.57); streakMaterial.alpha = streakVisible ? Math.sin(streakProgress * Math.PI) * 0.9 : 0;
    hearthGlow.intensity = (theme === 'day' ? 0.30 : theme === 'dusk' ? 1.0 : 0.65) + (reducedMotion ? 0 : Math.sin(seconds * 2.1) * 0.07 + Math.sin(seconds * 4.1) * 0.04);
    // Reduced motion draws only on change, so the pet counts real time
    // between those frames.
    const pose = petRoutine.update(reducedMotion && petTime ? (now - petTime) / 1000 : companionDelta, reducedMotion); petTime = now;
    if (pose.moving !== petMoving) { petMoving = pose.moving; updatePetShadow(); }
    if (petShadowAt && now >= petShadowAt) { petShadowAt = 0; requestRender(true); }
    // The pet stands on its bed, on the rug under it or on the floor; a
    // carried pet hangs below the pointer. Heights ease, so a hop reads.
    pointArea.minX = pointArea.maxX = pose.x; pointArea.minZ = pointArea.maxZ = pose.z;
    const bed = petBed(layout), onBed = !pose.held && insideBed(layout, pose), ground = onBed ? 0.22 + PET_BED_SURFACE : surfaceBelow(pointArea) - 0.002;
    const goalY = pose.held ? 0.22 + HOLD_HEIGHT - 0.62 : ground;
    petY = petY === null || reducedMotion ? goalY : petY + (goalY - petY) * Math.min(1, companionDelta * 12);
    const carriedBed = drag?.active && bed && drag.id === bed.id ? drag.object : null;
    if (carriedBed) petModel.root.position.set(carriedBed.position.x, 0.22 + PET_BED_SURFACE, carriedBed.position.z), petModel.root.rotation.y = carriedBed.rotation.y - Math.PI / 2 - 0.35;
    else petModel.root.position.set(pose.x, petY, pose.z), petModel.root.rotation.y = pose.yaw;
    petModel.contact.position.set(petModel.root.position.x, (bed && (onBed || carriedBed) ? 0.22 + PET_BED_SURFACE + 0.002 : surfaceBelow(pointArea)), petModel.root.position.z); petModel.contact.rotation.y = petModel.root.rotation.y;
    petModel.animate(pose, companionDelta, seconds, reducedMotion);
    for (const [id, reaction] of reactions) {
      const object = placedObjects.get(id), t = (now - reaction.start) / 1000 / reactionSeconds[reaction.kind];
      if (object) react(object, reaction.kind, reducedMotion ? 1 : t);
      if (!object || reducedMotion || t >= 1) reactions.delete(id);
    }
    for (let i = 0; i < animatedObjects.length; i++) { const object = animatedObjects[i]; object.metadata.animate(seconds, focused && object.metadata.itemId === layout.activeDeskId, reducedMotion); }
    let settled = false;
    for (const [id, entry] of settlingPieces) {
      const progress = Math.min(1, Math.max(0, (now - entry.start) / 420));
      if (reducedMotion || progress >= 1) { entry.object.scaling.setAll(1); settlingPieces.delete(id); settled = true; }
      else entry.object.scaling.setAll(0.92 + 0.08 * (1 - (1 - progress) ** 3));
    }
    if (settled) requestRender(true);
    if (rain.isEnabled()) {
      for (let i = 0; i < rainSeeds.length; i++) { const seed = rainSeeds[i], top = seed.top, y = 1.62 + ((seed.y - (reducedMotion ? 0 : seconds * seed.speed) % 1 + 1) % 1) * (top - 1.62); rainPositions[i * 6 + 1] = y; rainPositions[i * 6 + 4] = Math.min(y + 0.20, top); }
      rain.updateVerticesData('position', rainPositions, false, false);
    }
  }
  function reportStats(now, submitMs) {
    if (!statsStart) statsStart = now;
    if (lastRenderedAt && (!reducedMotion || now - lastRenderedAt < 500)) { intervals.push(now - lastRenderedAt); intervalTotal += now - lastRenderedAt; }
    submissions.push(submitMs); sampleFrames++; if (now - statsStart < 1000) return;
    const sorted = intervals.slice().sort((a, b) => a - b), cpu = submissions.slice().sort((a, b) => a - b);
    const fps = sampleFrames * 1000 / (now - statsStart), p95FrameMs = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] || 0, p95SubmitMs = cpu[Math.max(0, Math.ceil(cpu.length * 0.95) - 1)] || 0;
    options.onStats?.({ fps, frameMs: intervals.length ? intervalTotal / intervals.length : 0, p95FrameMs, submitMs: submissions.reduce((total, value) => total + value, 0) / submissions.length, p95SubmitMs, cpuRenderMsP95: p95SubmitMs, drawCalls: instrumentation.drawCallsCounter.current, triangles: Math.round(scene.getActiveIndices() / 3), pixelRatio, quality, engine: 'Babylon.js' });
    if (quality === 'auto') { // On-demand idle time is intentional, so it must never count as slow rendering.
      // Detail returns after eight steady seconds, so one busy moment no longer
      // costs the whole visit. A step up that turns slow again within fifteen
      // seconds lowers the ceiling once, instead of oscillating.
      // Speed is judged against what this display can show: a screen that never
      // delivered 60 Hz callbacks (a 30 Hz low-power mode, a 50 Hz panel) is not
      // slow at its own rate, and a lower resolution would not make it faster.
      const rafRate = rafCalls * 1000 / (now - statsStart), target = fastRafFrames >= 30 ? 60 : Math.min(60, rafRate);
      const slow = (!reducedMotion && fps < target * 0.9) || p95SubmitMs > 12;
      slowSamples = slow ? slowSamples + 1 : 0; steadySamples = !slow && !reducedMotion && fps >= target * 0.96 ? steadySamples + 1 : 0;
      if (slowSamples >= 3 && pixelRatio > 0.75) { if (now - raisedAt < 15000) { ratioCeiling = pixelRatio - 0.25; raisedAt = -Infinity; } applyPixelRatio(Math.max(0.75, pixelRatio - 0.25)); }
      else if (steadySamples >= 8 && pixelRatio < ratioCeiling) { raisedAt = now; applyPixelRatio(Math.min(ratioCeiling, pixelRatio + 0.25)); } }
    statsStart = now; sampleFrames = 0; rafCalls = 0; intervalTotal = 0; intervals.length = 0; submissions.length = 0;
  }
  function tick(now) {
    frame = 0; if (disposed || !visible || !onScreen) return;
    // Raw display callbacks, skipped ones included, show whether this screen
    // can deliver 60 Hz at all.
    rafCalls++; if (lastRafAt && now - lastRafAt > 4 && now - lastRafAt < 1000 / 55) fastRafFrames++; lastRafAt = now;
    const interval = quality === 'battery' ? 1000 / 30 : 1000 / 60, elapsed = now - lastFrame;
    if (lastFrame && elapsed < interval - 1) { frame = requestAnimationFrame(tick); return; }
    processPendingPointer();
    if (reducedMotion && !needsRender && readyReported && !downPosition && Math.abs(camera.inertialAlphaOffset) + Math.abs(camera.inertialBetaOffset) <= 0.0001 && now - petStart >= PET_REACTION * 1000 + 50 && !outlinesPending()) return;
    needsRender = false;
    lastFrame = elapsed > interval * 3 ? now : lastFrame + interval; animate(now);
    const start = performance.now(); engine.beginFrame(); scene.render(); engine.endFrame(); reportStats(now, performance.now() - start); lastRenderedAt = now; outlineFrames--;
    options.onFrame?.();
    if (!readyReported && scene.isReady()) { readyReported = true; requestRender(true); options.onReady?.(); }
    // Until the room reports ready, frames go on: shaders can finish between
    // the two asks, and a still room would stop before it reports.
    if (!reducedMotion || !readyReported || !scene.isReady() || downPosition || Math.abs(camera.inertialAlphaOffset) + Math.abs(camera.inertialBetaOffset) > 0.0001 || now - petStart < PET_REACTION * 1000 + 50 || outlinesPending()) if (!frame) frame = requestAnimationFrame(tick);
  }
  const onMotionChange = event => { reducedMotion = event.matches; requestRender(); wakeForClock(); }; motionQuery.addEventListener('change', onMotionChange);
  // Restart timing from scratch after a pause, so the gap never reads as a slow frame.
  function resumeFrames() { companionTime = 0; lastFrame = 0; lastRenderedAt = 0; statsStart = 0; sampleFrames = 0; rafCalls = 0; lastRafAt = 0; intervalTotal = 0; intervals.length = 0; submissions.length = 0; requestRender(); }
  const onVisibility = () => { visible = !document.hidden; companionTime = 0; if (visible) resumeFrames(); else { cancelDrag(); hoverItem(null); cancelAnimationFrame(frame); frame = 0; } wakeForClock(); };
  document.addEventListener('visibilitychange', onVisibility);
  requestRender();

  return {
    setTheme, setLayout, setEditMode, selectItem, beginPlacement, confirmPlacement, cancelPlacement, cancelDrag, rotateSelection, removeSelection, moveSelection, setActiveDesk, setArt, setTint, setSurface, setQuality,
    setFocused(value) { focused = Boolean(value); companionRoutine.setIntent(focused ? 'working' : 'break'); requestRender(); },
    setActivity(value) { focused = value === 'working'; companionRoutine.setIntent(value); requestRender(); }, pet,
    setPet(species) { const next = species === 'dog' ? 'dog' : 'cat'; if (next === petSpecies) return; if (petRoutine.pose.held) releasePet(); petSpecies = next; buildPet(); requestRender(); },
    anchor,
    setDecor(key, value) { if (!(key in decorVisible)) return; cancelDrag(); decorVisible[key] = Boolean(value); if (key === 'lights') { applyBulbs(); architecture?.setLights(Boolean(value)); } else decor[key]?.setEnabled(architectureStyle === 'retreat' && Boolean(value)); syncFurniture(); },
    resetView() { camera.inertialAlphaOffset = 0; camera.inertialBetaOffset = 0; camera.inertialRadiusOffset = 0; camera.inertialPanningX = 0; camera.inertialPanningY = 0; camera.alpha = alphaHome; camera.beta = betaHome; camera.radius = 19; camera.target.copyFrom(targetHome); fitRoom(); requestRender(); },
    diagnostics() { return { scene, engine, camera, architectureStyle, layout: copyLayout(), editing, selectedId, placement: placement ? { ...placement } : null, quality, pixelRatio, hoveredId, playHover, companion: companionRoutine.diagnostics(), pet: petRoutine.diagnostics(), petSpecies, petModel, companionModel: mobileCompanion, dragging: drag ? { id: drag.id, candidate: { ...drag.candidate }, overCollection: drag.overCollection, valid: drag.valid } : null }; },
    dispose() { if (disposed) return; cancelDrag(); disposed = true; cancelAnimationFrame(frame); clearTimeout(petWake); clearTimeout(clockWake); observer.disconnect(); viewObserver?.disconnect(); densityQuery?.removeEventListener('change', onDensityChange); document.removeEventListener('visibilitychange', onVisibility); motionQuery.removeEventListener('change', onMotionChange); canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointercancel', onPointerCancel); canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointerleave', onPointerLeave); canvas.removeEventListener('lostpointercapture', onPointerCancel); window.removeEventListener('blur', onPointerCancel); settlingPieces.clear(); animatedObjects.length = 0; petModel?.dispose(); instrumentation.dispose(); architecture?.dispose(); disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); canvas.remove(); },
  };
}
