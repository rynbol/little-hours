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
import { createFurniture, createRoundedBox, disposeFurnitureAssets } from './furniture.js';
import { getFurniture } from './catalog.js';
import { createLayout, normalizeLayout, validatePlacement, findFreePosition, MAX_ITEMS } from './layout.js';

// A real Babylon.js game scene. Every visible object is built with JavaScript;
// no generated bitmap furniture, downloaded models, or texture packs are used.
export function createRoom(container, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Your cozy miniature study room. Drag to look around; click the sleeping cat to pet it.');
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'pan-y' });
  container.appendChild(canvas);
  const engine = options.engineFactory?.(canvas) || new Engine(canvas, true, { alpha: true, preserveDrawingBuffer: false, stencil: false, powerPreference: 'high-performance' });
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(0, 0, 0, 0);
  scene.skipPointerMovePicking = true;
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
  function finish(mesh, mat, position, parent = world, shadow = true) {
    mesh.material = mat; mesh.position.set(...position); mesh.parent = parent;
    mesh.receiveShadows = true; mesh.isPickable = false; mesh.metadata = { castShadow: shadow }; return mesh;
  }
  function box(size, position, mat, radius = 0, parent = world) {
    return finish(radius > 0 ? createRoundedBox(`box-${meshId++}`, size, radius, scene) : MeshBuilder.CreateBox(`box-${meshId++}`, { width: size[0], height: size[1], depth: size[2] }, scene), mat, position, parent);
  }
  function sphere(size, position, mat, parent = world) {
    const mesh = finish(MeshBuilder.CreateSphere(`soft-${meshId++}`, { diameter: 2, segments: 10 }, scene), mat, position, parent);
    mesh.scaling.set(...size); return mesh;
  }
  function cylinder(top, bottom, height, position, mat, parent = world, segments = 16) {
    return finish(MeshBuilder.CreateCylinder(`turned-${meshId++}`, { diameterTop: top * 2, diameterBottom: bottom * 2, height, tessellation: segments }, scene), mat, position, parent);
  }
  function rod(a, b, radius, mat, parent = world) {
    const start = Vector3.FromArray(a), end = Vector3.FromArray(b), direction = end.subtract(start);
    const mesh = cylinder(radius, radius, direction.length(), [0, 0, 0], mat, parent, 8);
    mesh.position.copyFrom(start.add(end).scale(0.5)); mesh.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), new Quaternion()); return mesh;
  }
  function tube(points, radius, mat, parent = world) {
    return finish(MeshBuilder.CreateTube(`curve-${meshId++}`, { path: points.map(point => Vector3.FromArray(point)), radius, tessellation: 6, cap: Mesh.CAP_ALL }, scene), mat, [0, 0, 0], parent);
  }
  function drawing(width, height, draw, name) {
    const element = document.createElement('canvas'); element.width = width; element.height = height;
    const context = element.getContext('2d'); draw(context, width, height);
    const texture = new DynamicTexture(name, element, scene, false); texture.update(true); return texture;
  }
  function picture(width, height, texture, position, parent = world) {
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
  // The 20-unit ortho span (24 with Babylon's padding) at 1024 texels needs
  // enough depth bias to keep Poisson samples from shadowing the floor itself.
  const shadow = new ShadowGenerator(1024, sun); shadow.usePoissonSampling = true; shadow.bias = 0.002; shadow.normalBias = 0.02; shadow.darkness = 0.24;
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
  box([0.22, 5.6, 9.2], [-5.94, 3.01, 0], palette.cream);
  const archCenter = -2.7, archRadius = 2.1, archSpring = 3.15, windowBottom = 1.45;
  box([12.02, 1.25, 0.22], [0, 0.835, -4.6], palette.sage);
  box([12.02, 0.39, 0.22], [0, 5.595, -4.6], palette.sage);
  box([1.11, 4.12, 0.22], [-5.455, 3.41, -4.6], palette.sage);
  box([6.6, 4.12, 0.22], [2.7, 3.41, -4.6], palette.sage);
  // Small strips fill the spandrels above the arch; the broad timber arch covers
  // their edges. This leaves a genuine opening instead of a decal on a wall.
  for (let i = 0; i < 44; i++) {
    const x = archCenter - archRadius + (i + 0.5) * archRadius * 2 / 44;
    const curveTop = archSpring + Math.sqrt(Math.max(0, archRadius ** 2 - (x - archCenter) ** 2));
    box([archRadius * 2 / 44 + 0.012, 5.42 - curveTop, 0.22], [x, (5.42 + curveTop) / 2, -4.6], palette.sage);
  }
  const panel = material('#52695c'), inset = material('#647869'), carved = material('#a78053');
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
  picture(4.2, 3.82, skyTexture, [archCenter, 3.34, -4.64]);
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
  box([0.60, 0.11, 2.18], [-5.52, 3.42, -0.52], palette.wood, 0.025);
  const bottleColors = ['#768d77', '#b09572', '#95839d', '#b9795e'];
  for (let i = 0; i < 6; i++) {
    const z = -1.30 + i * 0.31, h = 0.24 + (i % 3) * 0.09, mat = material(bottleColors[i % 4]);
    cylinder(0.075, 0.11, h, [-5.42, 3.53 + h / 2, z], mat); cylinder(0.04, 0.06, 0.10, [-5.42, 3.55 + h, z], mat); cylinder(0.045, 0.045, 0.06, [-5.42, 3.62 + h, z], palette.edge);
  }
  const artTexture = drawing(256, 320, (ctx, width, height) => {
    ctx.fillStyle = '#e9d9b7'; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = '#766d56'; ctx.lineWidth = 3; ctx.strokeRect(14, 14, width - 28, height - 28);
    ctx.fillStyle = '#9b784d'; ctx.beginPath(); ctx.arc(128, 112, 58, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e9d9b7'; ctx.beginPath(); ctx.arc(148, 99, 49, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6e815b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(110, 274); ctx.quadraticCurveTo(151, 216, 105, 175); ctx.stroke();
    for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(118, 252 - i * 15); ctx.rotate(i % 2 ? 0.7 : -0.7); ctx.fillStyle = '#899872'; ctx.beginPath(); ctx.ellipse(i % 2 ? 18 : -18, -8, 23, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  }, 'moon-herbarium');
  box([1.04, 1.40, 0.08], [0.72, 3.45, -4.40], palette.darkWood, 0.025); picture(0.88, 1.23, artTexture, [0.72, 3.45, -4.35]);
  box([0.74, 1.02, 0.08], [5.04, 3.63, -4.40], palette.edge, 0.025); picture(0.60, 0.86, artTexture, [5.04, 3.63, -4.35]);
  const wallClock = new TransformNode('moon-clock', scene); wallClock.parent = world; wallClock.position.set(-5.79, 4.56, 1.76); wallClock.rotation.y = Math.PI / 2;
  const rim = cylinder(0.43, 0.43, 0.08, [0, 0, 0], palette.brass, wallClock, 32); rim.rotation.x = Math.PI / 2;
  const face = cylinder(0.37, 0.37, 0.015, [0, 0, 0.05], material('#e5d4ac'), wallClock, 32); face.rotation.x = Math.PI / 2;
  const clockMotion = new TransformNode('clock-movement', scene); clockMotion.parent = wallClock;
  const hourHand = new TransformNode('clock-hour-hand', scene); hourHand.parent = clockMotion;
  const minuteHand = new TransformNode('clock-minute-hand', scene); minuteHand.parent = clockMotion;
  const secondHand = new TransformNode('clock-second-hand', scene); secondHand.parent = clockMotion;
  rod([0, 0, 0.065], [0.13, 0.18, 0.065], 0.014, palette.darkWood, hourHand);
  rod([0, 0, 0.075], [-0.25, 0.045, 0.075], 0.012, palette.darkWood, minuteHand);
  rod([0, -0.055, 0.085], [0, 0.30, 0.085], 0.008, palette.ginger, secondHand);
  const pendulum = new TransformNode('clock-pendulum', scene); pendulum.parent = clockMotion; pendulum.position.set(0, -0.25, 0.07);
  box([0.31, 0.87, 0.065], [0, -0.77, 0], palette.darkWood, 0.035, wallClock);
  rod([0, 0, 0], [0, -0.67, 0], 0.017, palette.brass, pendulum);
  const bob = cylinder(0.13, 0.13, 0.052, [0, -0.69, 0], palette.brass, pendulum, 20); bob.rotation.x = Math.PI / 2;
  batchMoving(pendulum);
  for (let i = 0; i < 12; i++) { const angle = i / 12 * Math.PI * 2; sphere([0.018, 0.018, 0.008], [Math.cos(angle) * 0.31, Math.sin(angle) * 0.31, 0.067], palette.darkWood, wallClock); }

  const cat = new TransformNode('sleeping-cat', scene); cat.parent = world; cat.position.set(0.84, 0.29, 1.59); cat.rotation.y = -0.3;
  const catTorso = new TransformNode('miso-breathing', scene); catTorso.parent = cat;
  const catBody = sphere([0.56, 0.26, 0.36], [-0.08, 0.23, 0], palette.ginger, catTorso); catBody.name = 'miso-body';
  sphere([0.37, 0.14, 0.26], [0.08, 0.13, 0.19], palette.gingerLight, catTorso);
  const catHead = new TransformNode('miso-head', scene); catHead.parent = cat; catHead.position.set(0.33, 0.26, 0.15);
  sphere([0.29, 0.245, 0.25], [0, 0, 0], palette.gingerLight, catHead);
  const catEars = [-0.16, 0.15].map((x, i) => { const ear = cylinder(0, 0.115, 0.24, [x, 0.21, -0.06], palette.ginger, catHead, 3); ear.name = i ? 'miso-ear-right' : 'miso-ear-left'; ear.rotation.set(0.12, i ? -0.15 : 0.15, i ? -0.16 : 0.16); return ear; });
  [-0.105, 0.105].forEach(x => tube([[x - 0.037, 0.035, 0.221], [x, 0.02, 0.239], [x + 0.037, 0.035, 0.228]], 0.012, material('#6e513b'), catHead));
  sphere([0.031, 0.019, 0.019], [0, -0.035, 0.248], material('#b87869'), catHead);
  const catPaw = sphere([0.11, 0.065, 0.07], [0.25, 0.14, 0.31], palette.linen, cat); catPaw.name = 'miso-resting-paw';
  const catTail = new TransformNode('miso-tail', scene); catTail.parent = cat; catTail.position.set(-0.52, 0.22, -0.12);
  tube([[0, 0, 0], [-0.10, -0.09, 0.22], [0.03, -0.115, 0.49], [0.30, -0.115, 0.55]], 0.10, palette.gingerLight, catTail);
  // The curled tail stays on the floor. Only its short, tapered tip can flex.
  const catTailTip = new TransformNode('miso-tail-tip', scene); catTailTip.parent = catTail; catTailTip.position.set(0.30, -0.115, 0.55);
  finish(MeshBuilder.CreateTube('miso-tail-tip-fur', { path: [new Vector3(0, 0, 0), new Vector3(0.14, 0.005, -0.015), new Vector3(0.26, 0.015, -0.08)], radiusFunction: i => 0.10 - i * 0.018, tessellation: 6, cap: Mesh.CAP_END }, scene), palette.gingerLight, [0, 0, 0], catTailTip);
  [-0.32, -0.08, 0.13].forEach(x => sphere([0.047, 0.015, 0.22], [x, 0.478 - Math.abs(x + 0.08) * 0.06, -0.045], material('#ac7041'), catTorso));
  // A cached depth map cannot follow the breathing pose accurately. Keep the
  // cat's cast shadow on the floor, without sampling stale shadows on its fur.
  cat.getChildMeshes().forEach(mesh => { mesh.isPickable = true; mesh.receiveShadows = false; mesh.metadata.cat = true; });
  const heart = new TransformNode('pet-heart', scene); heart.parent = world; heart.position.set(1.18, 1.12, 1.62); heart.setEnabled(false);
  const heartMaterial = material('#c77868', { emissive: '#c77868', emissiveIntensity: 0.3 });
  const leftHeart = sphere([0.09, 0.12, 0.055], [-0.052, 0.018, 0], heartMaterial, heart); leftHeart.rotation.z = -0.7;
  const rightHeart = sphere([0.09, 0.12, 0.055], [0.052, 0.018, 0], heartMaterial, heart); rightHeart.rotation.z = 0.7;
  const wire = material('#594b39'), bulb = material('#ffdda3', { emissive: '#ffd392', emissiveIntensity: 1.25 });
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
    cylinder(0.07, 0.075, h, [x, 1.55 + h / 2, -4.05], material('#e6cc96'), decor.lights); sphere([0.03, 0.070, 0.03], [x, 1.60 + h, -4.05], bulb, decor.lights);
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
  batchStatic(world, new Set([cat, heart, clockMotion, ...Object.values(decor)])); Object.values(decor).forEach(group => batchStatic(group, new Set(swayingLanterns)));
  const rainSeeds = Array.from({ length: 40 }, (_, i) => { const x = -4.7 + ((i * 0.618033) % 1) * 3.98; return { x, y: (i * 0.371) % 1, speed: 0.55 + (i % 4) * 0.12, top: archSpring + Math.sqrt(Math.max(0, archRadius ** 2 - (x - archCenter) ** 2)) - 0.12 }; });
  const rainLines = rainSeeds.map(seed => [new Vector3(seed.x, 2, -4.52), new Vector3(seed.x - 0.025, 2.18, -4.52)]);
  const rain = MeshBuilder.CreateLineSystem('window-rain', { lines: rainLines, updatable: true }, scene); rain.color = color('#fffdf5'); rain.alpha = 0.6; rain.isPickable = false; rain.setEnabled(false);
  const rainPositions = Float32Array.from(rain.getVerticesData('position'));
  rain.setBoundingInfo(new BoundingInfo(new Vector3(-4.75, 1.55, -4.53), new Vector3(-0.65, 5.28, -4.51)));
  // Forty-eight drifting motes share one draw; size and tint vary per instance.
  const fireflies = MeshBuilder.CreateSphere('floating-fireflies', { diameter: 0.07, segments: 3 }, scene); fireflies.material = bulb; fireflies.isPickable = false; fireflies.metadata = { castShadow: false }; fireflies.alwaysSelectAsActiveMesh = true;
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
  const furnitureRoot = new TransformNode('placed-furniture', scene), placedObjects = new Map(), settlingPieces = new Map(), animatedObjects = [];
  const decorVisible = { plants: true, lights: true, rug: true };
  let layout = createLayout(), selectedId = null, editing = false, placement = null, ghost = null, marker = null, lastPlacementState = '';
  let hoveredId = null, drag = null, outlineKey = '';
  const outlinedMeshes = [];
  const hoverOutline = color('#ffe2a3'), selectedOutline = color('#e6b568'), invalidOutline = color('#e39782');
  const ghostMaterial = new StandardMaterial('placement-preview', scene); ghostMaterial.diffuseColor = color('#85ac80'); ghostMaterial.emissiveColor = color('#42653f'); ghostMaterial.alpha = 0.43; ghostMaterial.disableLighting = true;
  let theme = 'dusk', focused = false, petStart = -Infinity, disposed = false, readyReported = false;
  let frame = 0, lastFrame = 0, lastRenderedAt = 0, visible = !document.hidden, needsRender = true;
  let quality = 'auto', pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5), statsStart = 0, intervalTotal = 0, sampleFrames = 0, slowSamples = 0;
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
    if (visible && !frame) frame = requestAnimationFrame(tick);
  }
  function refreshShadows() {
    shadow.getShadowMap().renderList = scene.meshes.filter(mesh => mesh.metadata?.castShadow !== false && !mesh.metadata?.effect && (!drag?.active || itemAncestor(mesh)?.metadata.itemId !== drag.id) && mesh !== rain && mesh !== marker && !mesh.isDescendantOf(heart) && (!ghost || !mesh.isDescendantOf(ghost)) && mesh.isEnabled() && mesh.getTotalVertices() > 0);
    for (const mesh of glowingMeshes) bloom.removeIncludedOnlyMesh(mesh); glowingMeshes.clear();
    for (const mesh of scene.meshes) { const emission = mesh.material?.emissiveColor; const visibleOwner = mesh.isEnabled() || (mesh.metadata?.effect && mesh.parent?.isEnabled()); if (emission && mesh.metadata?.effect !== 'tea-steam' && emission.r + emission.g + emission.b > 0.1 && visibleOwner && (!ghost || !mesh.isDescendantOf(ghost))) { bloom.addIncludedOnlyMesh(mesh); glowingMeshes.add(mesh); } }
    bloom.mainTexture.renderList = [...glowingMeshes];
    requestRender(true);
  }
  function updateOutline() {
    const id = editing && !placement ? drag?.id || hoveredId || selectedId : null;
    const key = `${id}:${Boolean(drag?.overCollection && drag.removable)}:${drag?.valid}:${hoveredId === id}`;
    if (key === outlineKey) return;
    for (const mesh of outlinedMeshes) if (!mesh.isDisposed()) mesh.renderOutline = false;
    outlinedMeshes.length = 0; outlineKey = key;
    const object = placedObjects.get(id);
    // The disappearing preview uses a dashed drawing in the collection instead
    // of outlining transparent meshes (which would require another stencil pass).
    if (object && !(drag?.overCollection && drag.removable)) {
      for (const mesh of object.getChildMeshes()) {
        if (!mesh.isEnabled() || !isFurnitureSurface(mesh) || (object.metadata.avatar && mesh.isDescendantOf(object.metadata.avatar))) continue;
        mesh.outlineColor = drag && !drag.valid ? invalidOutline : hoveredId === id ? hoverOutline : selectedOutline;
        mesh.outlineWidth = 0.04; mesh.renderOutline = true; outlinedMeshes.push(mesh);
      }
    }
    requestRender();
  }
  function hoverItem(id) {
    if (hoveredId === id) return;
    hoveredId = id; updateOutline();
  }
  function canRemove(item) { return !isDesk(item) || layout.items.filter(isDesk).length > 1; }
  function updateMarker() {
    marker?.dispose(); marker = null;
    const item = layout.items.find(candidate => candidate.id === selectedId);
    if (!editing || !item || placement) return;
    const [width, depth] = getFurniture(item.type).footprint, w = width / 2 + 0.035, d = depth / 2 + 0.035;
    marker = MeshBuilder.CreateLines('selected-footprint', { points: [new Vector3(-w, 0, -d), new Vector3(w, 0, -d), new Vector3(w, 0, d), new Vector3(-w, 0, d), new Vector3(-w, 0, -d)] }, scene);
    marker.color = color('#b77d38'); marker.position.set(item.x, 0.30, item.z); marker.rotation.y = item.rotation * Math.PI / 2; marker.isPickable = false; marker.metadata = { castShadow: false };
  }
  function syncFurniture(settleNew = false) {
    if (!settleNew) { for (const { object } of settlingPieces.values()) object.scaling.setAll(1); settlingPieces.clear(); }
    const ids = new Set(layout.items.map(item => item.id));
    for (const [id, object] of placedObjects) if (!ids.has(id)) { settlingPieces.delete(id); object.dispose(false, false); placedObjects.delete(id); }
    let rugLayer = 0;
    for (const item of layout.items) {
      let object = placedObjects.get(item.id);
      if (object && object.metadata.furnitureType !== item.type) { settlingPieces.delete(item.id); object.dispose(false, false); placedObjects.delete(item.id); object = null; }
      if (!object) {
        object = createFurniture(item.type, scene); object.parent = furnitureRoot;
        object.metadata ||= {}; object.metadata.itemId = item.id; object.metadata.furnitureType = item.type;
        object.getChildMeshes().forEach(mesh => { mesh.isPickable = isFurnitureSurface(mesh); mesh.receiveShadows = !mesh.metadata?.effect; });
        placedObjects.set(item.id, object);
        if (settleNew && !reducedMotion) { object.scaling.setAll(0.92); settlingPieces.set(item.id, { object, start: performance.now() }); }
      }
      object.position.y = getFurniture(item.type).category === 'Rugs' ? 0.22 + rugLayer++ * 0.006 : 0.22;
      object.position.x = item.x; object.position.z = item.z; object.rotation.y = item.rotation * Math.PI / 2;
      object.setEnabled(item.type === 'plant' ? decorVisible.plants : getFurniture(item.type).category === 'Rugs' ? decorVisible.rug : true);
      object.metadata.avatar?.setEnabled(item.id === layout.activeDeskId);
    }
    if (selectedId && !ids.has(selectedId)) { selectedId = null; options.onSelectionChange?.(null); }
    animatedObjects.length = 0;
    for (const object of placedObjects.values()) if (object.metadata.animate) animatedObjects.push(object);
    const desk = layout.items.find(item => item.id === layout.activeDeskId);
    if (desk) { const offset = Vector3.TransformCoordinates(new Vector3(0.85, 2.08, -0.35), Matrix.RotationY(desk.rotation * Math.PI / 2)); windowGlow.position.set(desk.x + offset.x, offset.y, desk.z + offset.z); }
    const fireplace = layout.items.find(item => item.type === 'fireplace'); hearthGlow.setEnabled(Boolean(fireplace));
    if (fireplace) { const offset = Vector3.TransformCoordinates(new Vector3(0, 1.0, 0.70), Matrix.RotationY(fireplace.rotation * Math.PI / 2)); hearthGlow.position.set(fireplace.x + offset.x, offset.y, fireplace.z + offset.z); }
    if (hoveredId && !ids.has(hoveredId)) hoveredId = null;
    outlineKey = ''; updateOutline(); updateMarker(); refreshShadows();
  }
  function setLayout(next) {
    cancelDrag(); layout = normalizeLayout(next); syncFurniture();
    if (selectedId) options.onSelectionChange?.({ ...layout.items.find(item => item.id === selectedId) });
    if (placement) updatePlacement(placement.x, placement.z);
  }
  function commitLayout() { syncFurniture(true); options.onLayoutChange?.(copyLayout()); }
  function selectItem(id) {
    selectedId = layout.items.some(item => item.id === id) ? id : null; updateMarker(); updateOutline();
    const item = layout.items.find(candidate => candidate.id === selectedId); options.onSelectionChange?.(item ? { ...item } : null); requestRender();
  }
  function cancelPlacement() {
    placement = null; if (ghost) { ghost.dispose(false, false); ghost = null; }
    if (lastPlacementState) options.onPlacementState?.(null); lastPlacementState = ''; updateMarker(); updateOutline(); requestRender();
  }
  function updatePlacement(x, z) {
    if (!placement) return;
    placement.x = snap(x); placement.z = snap(z);
    const verdict = validatePlacement(layout.items, placement); placement.valid = verdict.valid; placement.reason = verdict.reason || '';
    ghost.position.x = placement.x; ghost.position.z = placement.z; ghost.rotation.y = placement.rotation * Math.PI / 2;
    ghostMaterial.diffuseColor = color(verdict.valid ? '#85ac80' : '#cf7868'); ghostMaterial.emissiveColor = color(verdict.valid ? '#42653f' : '#8a4238');
    const key = `${placement.type}:${verdict.valid}:${placement.reason}`;
    if (key !== lastPlacementState) { lastPlacementState = key; options.onPlacementState?.({ type: placement.type, valid: verdict.valid, reason: placement.reason }); }
    requestRender();
  }
  function beginPlacement(type) {
    if (!getFurniture(type)) return false;
    if (layout.items.length >= MAX_ITEMS) { options.onNotice?.(`This room has space for ${MAX_ITEMS} pieces. Remove a piece first.`); return false; }
    cancelDrag(); hoverItem(null); cancelPlacement(); selectItem(null); setEditMode(true);
    ghost = createFurniture(type, scene); ghost.getChildMeshes().forEach(mesh => { mesh.material = ghostMaterial; mesh.isPickable = false; mesh.receiveShadows = false; });
    ghost.metadata.avatar?.setEnabled(false);
    placement = { id: `piece-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, type, x: 0, z: 0, rotation: 0 };
    updateOutline();
    const free = findFreePosition(layout.items, type); updatePlacement(free?.x ?? 0, free?.z ?? 0); return true;
  }
  function moveSelection(dx, dz) {
    if (drag) return;
    if (placement) { updatePlacement(placement.x + dx, placement.z + dz); return; }
    const item = layout.items.find(candidate => candidate.id === selectedId); if (!item) return;
    const candidate = { ...item, x: snap(item.x + dx), z: snap(item.z + dz) }, verdict = validatePlacement(layout.items, candidate);
    if (!verdict.valid) { options.onNotice?.(verdict.reason); return; }
    Object.assign(item, candidate); commitLayout(); selectItem(item.id);
  }
  function rotateSelection() {
    if (drag) { drag.rotation = (drag.rotation + 1) % 4; updateDrag(pendingPointer); return; }
    if (placement) { placement.rotation = (placement.rotation + 1) % 4; updatePlacement(placement.x, placement.z); return; }
    const item = layout.items.find(candidate => candidate.id === selectedId); if (!item) return;
    const candidate = { ...item, rotation: (item.rotation + 1) % 4 }, verdict = validatePlacement(layout.items, candidate);
    if (!verdict.valid) { options.onNotice?.(verdict.reason); return; }
    Object.assign(item, candidate); commitLayout(); selectItem(item.id);
  }
  function removeSelection() {
    cancelDrag();
    const item = layout.items.find(candidate => candidate.id === selectedId); if (!item) return;
    if (!canRemove(item)) { options.onNotice?.('Keep one study desk so your companion has a place to focus.'); return; }
    layout.items = layout.items.filter(candidate => candidate.id !== selectedId);
    if (layout.activeDeskId === selectedId) layout.activeDeskId = layout.items.find(isDesk)?.id || null;
    selectItem(null); commitLayout();
  }
  function setActiveDesk(id) { if (!isDesk(layout.items.find(item => item.id === id))) return; cancelDrag(); layout.activeDeskId = id; commitLayout(); }
  function setEditMode(value) {
    cancelDrag(); hoverItem(null);
    const wasEditing = editing; editing = Boolean(value);
    if (!options.engineFactory && wasEditing !== editing) { if (editing) camera.detachControl(); else camera.attachControl(canvas, false); }
    camera.inertialAlphaOffset = 0; camera.inertialBetaOffset = 0;
    canvas.style.touchAction = editing ? 'none' : 'pan-y'; canvas.style.cursor = editing ? 'crosshair' : 'grab';
    canvas.setAttribute('aria-label', editing ? 'Room design canvas. Hover to outline furniture. Drag a piece to move it, or drop it over the bottom collection to return it. Escape cancels a drag.' : 'Your cozy miniature study room. Drag to look around; click the sleeping cat to pet it.');
    if (!editing) { cancelPlacement(); selectItem(null); } updateMarker(); updateOutline(); requestRender();
  }
  function setTheme(name) {
    theme = ['dusk', 'rain', 'day'].includes(name) ? name : 'dusk';
    const daylight = theme === 'day', night = theme === 'dusk';
    paintSky(theme); rain.setEnabled(theme === 'rain'); skyStars.setEnabled(night);
    if (!night) { shootingStar.setEnabled(false); streakMaterial.alpha = 0; }
    sun.diffuse = color(daylight ? '#fff1d2' : night ? '#c5ccec' : '#d5dfeb');
    sun.intensity = daylight ? 1.6 : night ? 0.62 : 0.82;
    sun.position.set(...(daylight ? [-4, 10, -8] : [-5, 10, 6]));
    sun.direction.set(...(daylight ? [3, -8, 7] : [3, -8, -5])).normalize();
    hemisphere.diffuse = color(daylight ? '#edf4e8' : night ? '#e1d3ed' : '#e0e7ed');
    hemisphere.groundColor = color(daylight ? '#a48b6b' : '#645441');
    hemisphere.intensity = daylight ? 0.90 : night ? 0.44 : 0.70;
    windowGlow.intensity = daylight ? 0.22 : night ? 1.25 : 0.65;
    bulb.emissiveColor = color('#ffd392').scale(daylight ? 0.50 : night ? 1.25 : 0.80);
    bloom.intensity = daylight ? 0.18 : night ? 0.40 : 0.26;
    shadow.darkness = daylight ? 0.34 : 0.24;
    // Light direction changes only here, so the shadow map remains cached.
    requestRender(true);
  }
  function pet() { petStart = performance.now(); heart.setEnabled(true); options.onPet?.(); requestRender(); }
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
  function cancelDrag() {
    const wasDragging = Boolean(drag), pointerId = downPosition?.pointerId;
    if (drag) {
      drag.object.position.copyFrom(drag.originalPosition); drag.object.rotation.y = drag.original.rotation * Math.PI / 2;
      for (const [mesh, visibility] of drag.visibility) if (!mesh.isDisposed()) mesh.visibility = visibility;
    }
    drag = null; downPosition = null; hasPendingPointer = false; releasePointer(pointerId);
    if (wasDragging) {
      options.onDragState?.(null); updateMarker(); outlineKey = ''; updateOutline(); refreshShadows();
    }
    canvas.style.cursor = editing ? 'crosshair' : 'grab';
    return wasDragging;
  }
  function startDrag() {
    const item = layout.items.find(item => item.id === downPosition?.itemId), object = placedObjects.get(item?.id);
    if (!item || !object || !downPosition.floor) return;
    settlingPieces.delete(item.id); object.scaling.setAll(1);
    drag = { active: true, id: item.id, original: { ...item }, candidate: { ...item }, object,
      originalPosition: object.position.clone(), rotation: item.rotation,
      offsetX: downPosition.floor.x - item.x, offsetZ: downPosition.floor.z - item.z,
      visibility: object.getChildMeshes().map(mesh => [mesh, mesh.visibility]),
      removable: canRemove(item), overCollection: false, valid: true, reason: '' };
    hoveredId = null; selectItem(item.id); refreshShadows();
  }
  function updateDrag(event) {
    if (!drag) return;
    const overCollection = Boolean(options.isCollectionDrop?.(event.clientX, event.clientY));
    drag.overCollection = overCollection;
    if (overCollection) {
      drag.valid = drag.removable;
      drag.reason = drag.removable ? '' : 'Keep one study desk so your companion has a place to focus.';
    } else {
      const rect = canvas.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      const floor = inside ? floorPosition(castPointer(event)) : null;
      if (floor) {
        drag.candidate = { ...drag.original, x: snap(floor.x - drag.offsetX), z: snap(floor.z - drag.offsetZ), rotation: drag.rotation };
        const verdict = validatePlacement(layout.items, drag.candidate); drag.valid = verdict.valid; drag.reason = verdict.reason || '';
        drag.object.position.x = drag.candidate.x; drag.object.position.z = drag.candidate.z;
        drag.object.rotation.y = drag.rotation * Math.PI / 2;
      } else { drag.valid = false; drag.reason = 'Drop inside the room, or return this piece to the collection.'; }
    }
    for (const [mesh, visibility] of drag.visibility) mesh.visibility = overCollection && drag.removable ? visibility * 0.13 : visibility;
    if (marker) {
      marker.setEnabled(!overCollection); marker.position.set(drag.candidate.x, 0.30, drag.candidate.z);
      marker.rotation.y = drag.rotation * Math.PI / 2; marker.color = drag.valid ? selectedOutline : invalidOutline;
    }
    canvas.style.cursor = overCollection ? drag.removable ? 'alias' : 'not-allowed' : drag.valid ? 'grabbing' : 'not-allowed';
    updateOutline();
    options.onDragState?.({ id: drag.id, type: drag.original.type, overCollection, removable: drag.removable, valid: drag.valid, reason: drag.reason, clientX: event.clientX, clientY: event.clientY });
    requestRender();
  }
  function finishDrag(event) {
    updateDrag(event);
    const completed = drag;
    cancelDrag();
    if (completed.overCollection && completed.removable) { removeSelection(); options.onNotice?.(`${getFurniture(completed.original.type).name} returned to the collection. Undo brings it back.`); }
    else if (completed.valid && !completed.overCollection) {
      const item = layout.items.find(item => item.id === completed.id);
      if (item && (item.x !== completed.candidate.x || item.z !== completed.candidate.z || item.rotation !== completed.candidate.rotation)) {
        Object.assign(item, completed.candidate); commitLayout(); selectItem(item.id);
      }
    } else options.onNotice?.(completed.reason || 'That spot is occupied. Your piece is back where it started.');
  }
  const onPointerDown = event => {
    if (event.isPrimary === false || (event.button != null && event.button !== 0) || downPosition) return;
    const ray = editing && !placement ? castPointer(event) : null, floor = ray && floorPosition(ray);
    downPosition = { x: event.clientX, y: event.clientY, pointerId: event.pointerId,
      itemId: ray ? hitItem(ray) : null, floor: floor ? { x: floor.x, z: floor.z } : null };
    if (editing && event.pointerId != null) canvas.setPointerCapture(event.pointerId);
    requestRender();
  };
  const onPointerUp = event => {
    if (!downPosition || (event.pointerId != null && downPosition.pointerId != null && event.pointerId !== downPosition.pointerId)) return;
    hasPendingPointer = false;
    const clicked = Math.hypot(event.clientX - downPosition.x, event.clientY - downPosition.y) < 7;
    if (editing && downPosition.itemId && !clicked && !drag) startDrag();
    if (drag) { finishDrag(event); return; }
    const pointerId = downPosition.pointerId; downPosition = null; releasePointer(pointerId); requestRender(); if (!clicked) return;
    const ray = castPointer(event);
    if (!editing) { if (scene.pickWithRay(ray, mesh => mesh.metadata?.cat)?.hit) pet(); return; }
    const floor = floorPosition(ray);
    if (placement) {
      if (floor) updatePlacement(floor.x, floor.z);
      if (!floor || !placement.valid) { options.onNotice?.(placement.reason || 'Choose a clear spot inside the room.'); return; }
      const { id, type, x, z, rotation } = placement; layout.items.push({ id, type, x, z, rotation }); cancelPlacement(); commitLayout(); selectItem(id); return;
    }
    const id = hitItem(ray), hit = layout.items.find(item => item.id === id);
    if (id && !(selectedId && getFurniture(hit?.type)?.category === 'Rugs' && selectedId !== id)) { selectItem(id); return; }
    if (selectedId && floor) { const item = layout.items.find(candidate => candidate.id === selectedId); moveSelection(snap(floor.x) - item.x, snap(floor.z) - item.z); } else selectItem(null);
  };
  const onPointerCancel = event => {
    if (event?.pointerId != null && downPosition?.pointerId != null && event.pointerId !== downPosition.pointerId) return;
    cancelDrag(); hoverItem(null);
  };
  const onPointerLeave = () => { if (!downPosition) { hasPendingPointer = false; hoverItem(null); } };
  const onPointerMove = event => {
    if (downPosition && event.pointerId != null && downPosition.pointerId != null && event.pointerId !== downPosition.pointerId) return;
    if (!editing && downPosition) { canvas.style.cursor = 'grabbing'; requestRender(); return; }
    pendingPointer.clientX = event.clientX; pendingPointer.clientY = event.clientY; pendingPointer.pointerType = event.pointerType; hasPendingPointer = true;
    // One closest-object pick per rendered frame; drag motion only intersects
    // the floor. Pointer capture keeps the same gesture alive over the tray.
    if (visible && !frame) frame = requestAnimationFrame(tick);
  };
  function processPendingPointer() {
    if (!hasPendingPointer) return;
    hasPendingPointer = false;
    if (editing && downPosition?.itemId && !drag && Math.hypot(pendingPointer.clientX - downPosition.x, pendingPointer.clientY - downPosition.y) >= 7) startDrag();
    if (drag) { updateDrag(pendingPointer); return; }
    const ray = castPointer(pendingPointer);
    if (editing && placement) {
      const floor = floorPosition(ray); if (floor) updatePlacement(floor.x, floor.z);
      canvas.style.cursor = 'crosshair'; return;
    }
    if (pendingPointer.pointerType === 'mouse' || pendingPointer.pointerType === 'pen') {
      if (editing) { const id = hitItem(ray); hoverItem(id); canvas.style.cursor = id ? 'grab' : 'crosshair'; }
      else canvas.style.cursor = scene.pickWithRay(ray, mesh => mesh.metadata?.cat, true)?.hit ? 'pointer' : 'grab';
    }
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
  function resize() { const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight); canvasAspect = width / height; engine.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio)); fitRoom(); requestRender(); }
  function setQuality(value) { quality = ['auto', 'battery', 'high'].includes(value) ? value : 'auto'; pixelRatio = Math.min(window.devicePixelRatio || 1, quality === 'battery' ? 1 : quality === 'high' ? 2 : 1.5); engine.setHardwareScalingLevel(1 / pixelRatio); slowSamples = 0; bloom.isEnabled = quality !== 'battery'; resize(); }
  const observer = new ResizeObserver(resize); observer.observe(container);
  syncFurniture(); setTheme(theme); resize();
  function animate(now) {
    const seconds = now / 1000;
    const ambientTime = reducedMotion ? 0 : seconds;
    for (let i = 0; i < swayingLanterns.length; i++) { const lantern = swayingLanterns[i]; lantern.rotation.z = reducedMotion ? 0 : Math.sin(seconds * 0.85 + i * 1.7) * 0.085; lantern.rotation.x = reducedMotion ? 0 : Math.sin(seconds * 0.63 + i * 1.3) * 0.025; }
    hourHand.rotation.z = reducedMotion ? 0 : -(seconds % 43200) * Math.PI / 21600;
    minuteHand.rotation.z = reducedMotion ? 0 : -(seconds % 3600) * Math.PI / 1800;
    secondHand.rotation.z = reducedMotion ? 0 : -(Math.floor(seconds) % 60) * Math.PI / 30;
    pendulum.rotation.z = reducedMotion ? 0 : Math.sin(seconds * 2.8) * 0.17;
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
    moths.setEnabled(!reducedMotion);
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
    const petAge = (now - petStart) / 1000, beingPet = petAge >= 0 && petAge < 1.6;
    const breathPhase = seconds % 4.8;
    // A soft inhale, then a longer exhale; enough flank movement to read from
    // the room camera. One transform moves fur and stripes together.
    const breathing = reducedMotion ? 0 : breathPhase < 1.7
      ? (1 - Math.cos(breathPhase / 1.7 * Math.PI)) / 2
      : (1 + Math.cos((breathPhase - 1.7) / 3.1 * Math.PI)) / 2;
    catTorso.scaling.set(1, 1 + breathing * 0.075, 1 + breathing * 0.028);
    // Keep the underside, paws and head planted. Cat meshes intentionally do
    // not receive the cached self-shadow that previously caused pixel noise.
    catTorso.position.y = breathing * 0.075 * 0.03;
    const petEase = beingPet && !reducedMotion ? Math.sin(petAge / 1.6 * Math.PI) : 0;
    catHead.rotation.z = petEase ? -petEase * 0.025 : 0;
    const tailPhase = (seconds + 4.5) % 13.8 / 1.8;
    const tailFlex = tailPhase < 1 ? Math.sin(tailPhase * Math.PI) ** 2 : 0;
    catTailTip.rotation.y = reducedMotion ? 0 : Math.max(tailFlex, petEase) * 0.11;
    const earPhase = (seconds + 2.6) % 17.3 / 0.8;
    const earTwitch = reducedMotion ? 0 : Math.max(petEase * 0.65, earPhase < 1 ? Math.sin(earPhase * Math.PI) ** 2 : 0);
    for (let i = 0; i < catEars.length; i++) { const ear = catEars[i]; ear.rotation.x = 0.12 - earTwitch * (i ? 0.025 : 0.075); ear.rotation.z = (i ? -0.16 : 0.16) + earTwitch * (i ? 0.012 : -0.025); }
    for (let i = 0; i < animatedObjects.length; i++) { const object = animatedObjects[i]; object.metadata.animate(seconds, focused && object.metadata.itemId === layout.activeDeskId, reducedMotion); }
    let settled = false;
    for (const [id, entry] of settlingPieces) {
      const progress = Math.min(1, Math.max(0, (now - entry.start) / 420));
      if (reducedMotion || progress >= 1) { entry.object.scaling.setAll(1); settlingPieces.delete(id); settled = true; }
      else entry.object.scaling.setAll(0.92 + 0.08 * (1 - (1 - progress) ** 3));
    }
    if (settled) requestRender(true);
    if (beingPet) { heart.setEnabled(true); heart.position.y = 1.12 + (reducedMotion ? 0 : petAge * 0.48); heartMaterial.alpha = Math.min(1, (1.6 - petAge) * 2.6); }
    else heart.setEnabled(false);
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
      slowSamples = (!reducedMotion && fps < 55) || p95SubmitMs > 12 ? slowSamples + 1 : 0; if (slowSamples >= 3 && pixelRatio > 0.75) { pixelRatio = Math.max(0.75, pixelRatio - 0.25); engine.setHardwareScalingLevel(1 / pixelRatio); slowSamples = 0; bloom.isEnabled = quality !== 'battery'; resize(); } }
    statsStart = now; sampleFrames = 0; intervalTotal = 0; intervals.length = 0; submissions.length = 0;
  }
  function tick(now) {
    frame = 0; if (disposed || !visible) return;
    const interval = quality === 'battery' ? 1000 / 30 : 1000 / 60, elapsed = now - lastFrame;
    if (lastFrame && elapsed < interval - 1) { frame = requestAnimationFrame(tick); return; }
    processPendingPointer();
    if (reducedMotion && !needsRender && readyReported && !downPosition && Math.abs(camera.inertialAlphaOffset) + Math.abs(camera.inertialBetaOffset) <= 0.0001 && now - petStart >= 1650) return;
    needsRender = false;
    lastFrame = elapsed > interval * 3 ? now : lastFrame + interval; animate(now);
    const start = performance.now(); engine.beginFrame(); scene.render(); engine.endFrame(); reportStats(now, performance.now() - start); lastRenderedAt = now;
    if (!readyReported && scene.isReady()) { readyReported = true; requestRender(true); options.onReady?.(); }
    if (!reducedMotion || !scene.isReady() || downPosition || Math.abs(camera.inertialAlphaOffset) + Math.abs(camera.inertialBetaOffset) > 0.0001 || now - petStart < 1650) if (!frame) frame = requestAnimationFrame(tick);
  }
  const onMotionChange = event => { reducedMotion = event.matches; requestRender(); }; motionQuery.addEventListener('change', onMotionChange);
  const onVisibility = () => { visible = !document.hidden; if (visible) { lastFrame = 0; lastRenderedAt = 0; statsStart = 0; sampleFrames = 0; intervalTotal = 0; intervals.length = 0; submissions.length = 0; requestRender(); } else { cancelDrag(); hoverItem(null); cancelAnimationFrame(frame); frame = 0; } };
  document.addEventListener('visibilitychange', onVisibility);
  requestRender();

  return {
    setTheme, setLayout, setEditMode, selectItem, beginPlacement, cancelPlacement, cancelDrag, rotateSelection, removeSelection, moveSelection, setActiveDesk, setQuality,
    setFocused(value) { focused = Boolean(value); requestRender(); }, pet,
    setDecor(key, value) { if (!(key in decorVisible)) return; cancelDrag(); decorVisible[key] = Boolean(value); decor[key]?.setEnabled(Boolean(value)); syncFurniture(); },
    resetView() { camera.inertialAlphaOffset = 0; camera.inertialBetaOffset = 0; camera.inertialRadiusOffset = 0; camera.inertialPanningX = 0; camera.inertialPanningY = 0; camera.alpha = alphaHome; camera.beta = betaHome; camera.radius = 19; camera.target.copyFrom(targetHome); fitRoom(); requestRender(); },
    diagnostics() { return { scene, engine, camera, layout: copyLayout(), editing, selectedId, placement: placement ? { ...placement } : null, quality, pixelRatio, hoveredId, dragging: drag ? { id: drag.id, candidate: { ...drag.candidate }, overCollection: drag.overCollection, valid: drag.valid } : null }; },
    dispose() { if (disposed) return; cancelDrag(); disposed = true; cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility); motionQuery.removeEventListener('change', onMotionChange); canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointercancel', onPointerCancel); canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointerleave', onPointerLeave); canvas.removeEventListener('lostpointercapture', onPointerCancel); window.removeEventListener('blur', onPointerCancel); settlingPieces.clear(); animatedObjects.length = 0; instrumentation.dispose(); disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); canvas.remove(); },
  };
}
