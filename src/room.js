import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// All of the little things in this room are made here, from simple geometry.
export function createRoom(container, options = {}) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0xf3eee5, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute('aria-label', 'Your cozy miniature study room. Drag to look around; click the sleeping cat to pet it.');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'pan-y';
  container.appendChild(renderer.domElement);

  const camera = new THREE.OrthographicCamera(-5, 5, 4, -4, 0.1, 80);
  const cameraHome = new THREE.Vector3(10.5, 10.3, 12.4);
  const targetHome = new THREE.Vector3(0, 1.45, 0);
  camera.position.copy(cameraHome);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(targetHome);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.rotateSpeed = 0.5;
  controls.minAzimuthAngle = 0.35;
  controls.maxAzimuthAngle = 1.02;
  controls.minPolarAngle = 0.7;
  controls.maxPolarAngle = 1.13;
  controls.update();
  // OrbitControls.connect() sets this to none. Let vertical mobile gestures
  // scroll the page; the browser cancels the orbit when it claims that gesture.
  renderer.domElement.style.touchAction = 'pan-y';

  const textures = [];
  const materials = new Map();
  const material = (color, extra = {}) => {
    const key = `${color}:${JSON.stringify(extra)}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...extra }));
    return materials.get(key);
  };
  const palette = {
    cream: material('#e6dec8'), sage: material('#9fae97'), wood: material('#aa7550'),
    darkWood: material('#72503b'), edge: material('#b68a60'), linen: material('#ebe1cc'),
    green: material('#758876'), dark: material('#4d5148'), brass: material('#bf9762', { metalness: 0.45, roughness: 0.35 }),
    ginger: material('#c8884d'), gingerLight: material('#dda467'), leaf: material('#718b59'),
  };
  const world = new THREE.Group();
  scene.add(world);
  const decor = { plants: new THREE.Group(), lights: new THREE.Group(), rug: new THREE.Group() };
  Object.values(decor).forEach(group => world.add(group));

  function mesh(geometry, mat, position, parent = world, shadow = true) {
    const obj = new THREE.Mesh(geometry, mat);
    obj.position.set(...position);
    obj.castShadow = shadow;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  }
  function box(size, position, mat, radius = 0.025, parent = world) {
    const smallest = Math.min(...size);
    return mesh(new RoundedBoxGeometry(...size, 2, Math.min(radius, smallest * 0.44)), mat, position, parent);
  }
  function sphere(size, position, mat, parent = world) {
    const obj = mesh(new THREE.SphereGeometry(1, 20, 14), mat, position, parent);
    obj.scale.set(...size);
    return obj;
  }
  function cylinder(top, bottom, height, position, mat, parent = world, segments = 20) {
    return mesh(new THREE.CylinderGeometry(top, bottom, height, segments), mat, position, parent);
  }
  function rod(a, b, radius, mat, parent = world) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const obj = cylinder(radius, radius, start.distanceTo(end), [0, 0, 0], mat, parent, 10);
    obj.position.copy(start.clone().add(end).multiplyScalar(0.5));
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    return obj;
  }
  function tube(points, radius, mat, parent = world) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 28, radius, 6, false), mat, [0, 0, 0], parent);
  }
  function canvasTexture(width, height, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    return texture;
  }

  const hemisphere = new THREE.HemisphereLight('#ffdfbb', '#9c8970', 1.45);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#ffc890', 2.8);
  sun.position.set(-3, 8, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 25 });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.0001;
  sun.shadow.radius = 4;
  scene.add(sun);
  const windowLight = new THREE.PointLight('#ffb476', 9, 7, 2);
  windowLight.position.set(-1.5, 2.7, -2.1);
  scene.add(windowLight);
  const fill = new THREE.DirectionalLight('#dae5df', 0.55);
  fill.position.set(5, 5, -1);
  scene.add(fill);

  // A thick, rounded dollhouse base, with real individual floorboards.
  box([7.85, 0.30, 6.0], [0, -0.04, 0], palette.darkWood, 0.13);
  box([7.78, 0.17, 5.93], [0, 0.09, 0], palette.edge, 0.065);
  const boardColors = ['#bf946c', '#c49b74', '#c9a17a', '#bd916b', '#c19a73', '#c6a079'];
  for (let row = 0; row < 16; row++) {
    for (let half = 0; half < 2; half++) {
      const x = row * 0.481 - 3.606;
      const z = half === 0 ? -1.465 : 1.465;
      box([0.473, 0.052, 2.917], [x, 0.193, z], material(boardColors[(row + half * 3) % boardColors.length]), 0.007);
    }
  }
  // Left wall, and four panels framing an actual opening in the back wall.
  box([0.18, 4.2, 5.97], [-3.88, 2.24, 0], palette.cream, 0.018);
  box([7.82, 1.37, 0.18], [0, 0.89, -2.97], palette.sage, 0.015);
  box([7.82, 0.66, 0.18], [0, 4.02, -2.97], palette.sage, 0.015);
  box([0.63, 2.18, 0.18], [-3.525, 2.625, -2.97], palette.sage, 0.01);
  box([4.02, 2.18, 0.18], [1.88, 2.625, -2.97], palette.sage, 0.01);
  box([0.10, 0.19, 5.83], [-3.74, 0.32, 0], palette.linen, 0.01);
  box([7.6, 0.19, 0.10], [0, 0.32, -2.82], palette.linen, 0.01);
  box([0.23, 0.10, 6.02], [-3.86, 4.37, 0], palette.linen, 0.015);
  box([7.86, 0.10, 0.23], [0, 4.37, -2.96], palette.linen, 0.015);

  const skyTexture = canvasTexture(512, 512, () => {});
  const skyMaterial = new THREE.MeshBasicMaterial({ map: skyTexture });
  const sky = mesh(new THREE.PlaneGeometry(3.17, 2.23), skyMaterial, [-1.62, 2.63, -3.0], world, false);
  function paintSky(theme) {
    const ctx = skyTexture.image.getContext('2d');
    const colors = theme === 'day' ? ['#9abdc6', '#e7dcca', '#dfbe8e'] : theme === 'rain' ? ['#717f99', '#abb4ba', '#bfc1b8'] : ['#a299b5', '#e6b6a3', '#f7d596'];
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    colors.forEach((color, i) => gradient.addColorStop(i / 2, color));
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = theme === 'rain' ? '#e2dfcc' : '#fff0c0';
    ctx.beginPath(); ctx.arc(357, theme === 'day' ? 112 : 241, theme === 'day' ? 34 : 47, 0, Math.PI * 2); ctx.fill();
    [[390, '#9caba4'], [432, '#819891'], [482, '#657f79']].forEach(([height, color], layer) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, 512); ctx.lineTo(0, height);
      for (let x = 0; x <= 540; x += 30) ctx.lineTo(x, height + Math.sin(x * 0.017 + layer * 2) * 32 + Math.cos(x * 0.01) * 13);
      ctx.lineTo(512, 512); ctx.fill();
    });
    skyTexture.needsUpdate = true;
  }
  paintSky('dusk');
  const windowFrame = material('#ebdec1');
  [-3.21, -0.035].forEach(x => box([0.13, 2.30, 0.23], [x, 2.62, -2.88], windowFrame, 0.018));
  [1.49, 3.75].forEach(y => box([3.30, 0.13, 0.23], [-1.62, y, -2.88], windowFrame, 0.018));
  box([0.075, 2.18, 0.16], [-1.62, 2.63, -2.83], palette.darkWood, 0.008);
  box([3.10, 0.065, 0.16], [-1.62, 2.72, -2.83], palette.darkWood, 0.008);
  box([3.48, 0.14, 0.48], [-1.62, 1.46, -2.70], palette.edge, 0.035);
  // Folded linen curtains soften the frame without hiding the view.
  const curtain = material('#e4d7bd');
  for (let side = 0; side < 2; side++) {
    for (let fold = 0; fold < 3; fold++) {
      const drape = cylinder(0.08, 0.10, 2.18, [(side ? -0.07 : -3.22) + (fold - 1) * 0.11, 2.57, -2.65], curtain);
      drape.scale.z = 0.55;
    }
  }
  rod([-3.49, 3.87, -2.63], [0.20, 3.87, -2.63], 0.03, palette.brass);
  sphere([0.065, 0.065, 0.065], [-3.52, 3.87, -2.63], palette.brass);
  sphere([0.065, 0.065, 0.065], [0.24, 3.87, -2.63], palette.brass);

  // Desk: laptop, warm lamp, notes, books and a cup with a proper handle.
  box([3.38, 0.15, 1.12], [-1.40, 1.40, -1.95], palette.wood, 0.07);
  [[-2.88, -2.32], [0.07, -2.32], [-2.88, -1.60], [0.07, -1.60]].forEach(([x, z]) => {
    rod([x, 0.25, z], [x + (x < -1 ? 0.05 : -0.05), 1.34, z], 0.065, palette.darkWood);
  });
  box([1.00, 0.29, 0.92], [-2.42, 1.17, -1.96], palette.wood, 0.03);
  box([0.84, 0.19, 0.045], [-2.42, 1.17, -1.47], palette.edge, 0.02);
  box([0.22, 0.03, 0.035], [-2.42, 1.18, -1.435], palette.brass, 0.008);
  const laptop = new THREE.Group(); laptop.position.set(-1.35, 1.51, -1.96); world.add(laptop);
  const laptopMetal = material('#777c71', { metalness: 0.25, roughness: 0.48 });
  box([0.99, 0.055, 0.65], [0, 0, 0.06], laptopMetal, 0.025, laptop);
  box([0.72, 0.008, 0.23], [0, 0.03, -0.055], material('#4b504a'), 0.018, laptop);
  box([0.24, 0.006, 0.13], [0, 0.032, 0.24], material('#a1a698'), 0.012, laptop);
  const screenGroup = new THREE.Group(); screenGroup.position.set(0, 0.035, -0.245); screenGroup.rotation.x = -0.13; laptop.add(screenGroup);
  box([0.99, 0.64, 0.045], [0, 0.31, 0], laptopMetal, 0.035, screenGroup);
  const screenTexture = canvasTexture(512, 320, (ctx, w, h) => {
    ctx.fillStyle = '#d9dfc7'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#becbb0'; ctx.fillRect(0, 0, 130, h);
    ctx.fillStyle = '#7e947d';
    for (let i = 0; i < 5; i++) ctx.fillRect(23, 52 + i * 29, 70 - i * 6, 7);
    ctx.fillStyle = '#f3edda'; ctx.fillRect(164, 35, 300, 240);
    ctx.fillStyle = '#83917b'; ctx.fillRect(188, 64, 142, 12);
    ctx.fillStyle = '#c4c9b2';
    for (let i = 0; i < 7; i++) ctx.fillRect(188, 101 + i * 20, i === 6 ? 120 : 246, 5);
    ctx.fillStyle = '#c39165'; ctx.beginPath(); ctx.arc(433, 246, 12, 0, Math.PI * 2); ctx.fill();
  });
  mesh(new THREE.PlaneGeometry(0.88, 0.53), new THREE.MeshBasicMaterial({ map: screenTexture }), [0, 0.31, 0.027], screenGroup, false);
  const lampGlow = material('#efc77e', { emissive: '#ffba55', emissiveIntensity: 0.65 });
  cylinder(0.19, 0.22, 0.055, [-0.06, 1.51, -2.08], palette.brass);
  rod([-0.06, 1.54, -2.08], [-0.06, 2.02, -2.08], 0.027, palette.brass);
  rod([-0.06, 2.02, -2.08], [-0.24, 2.20, -2.08], 0.025, palette.brass);
  cylinder(0.13, 0.30, 0.24, [-0.24, 2.15, -2.08], material('#d6a052'));
  cylinder(0.25, 0.25, 0.015, [-0.24, 2.025, -2.08], lampGlow);
  const lampLight = new THREE.PointLight('#ffc06d', 3.0, 3.1, 2);
  lampLight.position.set(-0.24, 1.97, -2.05); world.add(lampLight);
  const cupMat = material('#e8dfc5');
  cylinder(0.11, 0.09, 0.20, [-0.49, 1.60, -1.60], cupMat);
  cylinder(0.092, 0.092, 0.008, [-0.49, 1.706, -1.60], material('#6f4b32'));
  const handle = mesh(new THREE.TorusGeometry(0.076, 0.022, 8, 16), cupMat, [-0.36, 1.61, -1.60]);
  handle.rotation.y = 0.25;
  box([0.41, 0.02, 0.30], [-1.99, 1.50, -1.61], palette.linen, 0.012).rotation.y = 0.14;
  rod([-2.10, 1.521, -1.65], [-1.87, 1.521, -1.57], 0.012, palette.darkWood);
  const bookColors = ['#778e88', '#bd8061', '#dfbe81', '#a7ae90', '#79959e', '#d3b3a3'];
  for (let i = 0; i < 3; i++) {
    const book = box([0.50 - i * 0.03, 0.073, 0.38], [-2.58, 1.52 + i * 0.078, -2.13], material(bookColors[i]), 0.01);
    book.rotation.y = i === 1 ? 0.15 : -0.045;
  }

  // A cushioned desk chair, tucked close enough to reach the keyboard.
  const deskChair = new THREE.Group(); deskChair.position.set(-1.38, 0, -1.03); deskChair.rotation.y = -0.15; world.add(deskChair);
  box([0.91, 0.17, 0.85], [0, 0.84, 0], palette.green, 0.09, deskChair);
  box([0.88, 0.65, 0.14], [0, 1.19, 0.37], palette.green, 0.07, deskChair);
  [[-0.33, -0.28], [0.33, -0.28], [-0.33, 0.29], [0.33, 0.29]].forEach(([x, z]) => rod([x * 1.15, 0.24, z * 1.2], [x, 0.80, z], 0.048, palette.darkWood, deskChair));
  [-0.43, 0.43].forEach(x => { rod([x, 0.80, 0.2], [x, 1.16, 0.2], 0.034, palette.darkWood, deskChair); box([0.11, 0.075, 0.55], [x, 1.17, 0], palette.wood, 0.025, deskChair); });

  // A quiet study companion, seen from behind in a soft sweater and headphones.
  const student = new THREE.Group(); deskChair.add(student);
  const sweater = material('#b88770');
  const trousers = material('#767d72');
  const skin = material('#d6ad87');
  box([0.51, 0.22, 0.43], [0, 0.99, -0.08], trousers, 0.10, student);
  const studentTorso = box([0.60, 0.63, 0.43], [0, 1.37, -0.09], sweater, 0.15, student);
  [-0.15, 0.15].forEach(x => {
    rod([x, 0.97, -0.08], [x, 0.87, -0.57], 0.12, trousers, student);
    rod([x, 0.87, -0.57], [x, 0.39, -0.67], 0.085, trousers, student);
    box([0.21, 0.12, 0.35], [x, 0.31, -0.75], palette.linen, 0.06, student);
  });
  cylinder(0.11, 0.13, 0.16, [0, 1.71, -0.14], skin, student);
  const studentHead = new THREE.Group(); studentHead.position.set(0, 1.94, -0.17); student.add(studentHead);
  sphere([0.235, 0.25, 0.22], [0, 0, 0], skin, studentHead);
  sphere([0.244, 0.242, 0.22], [0, 0.065, 0.058], material('#664c3b'), studentHead);
  sphere([0.125, 0.125, 0.10], [0, 0.20, 0.21], material('#664c3b'), studentHead);
  const headband = mesh(new THREE.TorusGeometry(0.255, 0.028, 8, 20, Math.PI), palette.dark, [0, 0.02, 0.015], studentHead);
  [-0.248, 0.248].forEach(x => sphere([0.046, 0.096, 0.085], [x, 0.025, 0.015], palette.green, studentHead));
  const typingHands = [];
  [-1, 1].forEach(side => {
    rod([side * 0.27, 1.55, -0.13], [side * 0.38, 1.36, -0.45], 0.095, sweater, student);
    rod([side * 0.38, 1.36, -0.45], [side * 0.22, 1.57, -0.86], 0.078, sweater, student);
    typingHands.push(sphere([0.075, 0.046, 0.105], [side * 0.22, 1.59, -0.94], skin, student));
  });

  // Bookshelf facing into the room, with varied book spines and little ceramics.
  const shelf = new THREE.Group(); shelf.position.set(-3.46, 0.24, 0.1); shelf.rotation.y = Math.PI / 2; world.add(shelf);
  box([1.82, 2.47, 0.065], [0, 1.26, -0.22], palette.darkWood, 0.012, shelf);
  [-0.94, 0.94].forEach(x => box([0.12, 2.65, 0.51], [x, 1.33, 0], palette.wood, 0.025, shelf));
  [0.08, 0.88, 1.66, 2.61].forEach(y => box([1.9, 0.10, 0.58], [0, y, 0], palette.wood, 0.025, shelf));
  for (let level = 0; level < 3; level++) {
    for (let i = 0; i < (level === 1 ? 4 : 7); i++) {
      const h = 0.36 + ((i * 7 + level * 3) % 5) * 0.045;
      const x = -0.75 + i * 0.17;
      box([0.135, h, 0.30], [x, [0.13, 0.93, 1.71][level] + h / 2, 0.07], material(bookColors[(i + level) % bookColors.length]), 0.008, shelf);
      box([0.098, 0.015, 0.005], [x, [0.13, 0.93, 1.71][level] + h * 0.8, 0.224], palette.linen, 0.002, shelf);
    }
  }
  cylinder(0.15, 0.20, 0.25, [0.48, 1.105, 0.07], material('#d7bb97'), shelf);
  cylinder(0.09, 0.12, 0.20, [0.48, 1.31, 0.07], material('#d7bb97'), shelf);
  box([0.53, 0.24, 0.40], [0.53, 0.27, 0.06], material('#b29c77'), 0.028, shelf);

  // The reading corner: deeply rounded cushions, a draped throw, a tiny table.
  const reading = new THREE.Group(); reading.position.set(2.45, 0.24, -1.7); reading.rotation.y = -0.23; world.add(reading);
  const upholstery = material('#82928a');
  box([1.54, 0.34, 1.40], [0, 0.37, 0], upholstery, 0.15, reading);
  box([1.45, 0.98, 0.30], [0, 0.94, -0.50], upholstery, 0.16, reading);
  [-0.68, 0.68].forEach(x => box([0.28, 0.57, 1.3], [x, 0.72, 0.03], upholstery, 0.13, reading));
  box([1.03, 0.23, 0.95], [0, 0.62, 0.13], material('#99a59b'), 0.11, reading);
  [[-0.58, -0.44], [0.58, -0.44], [-0.58, 0.46], [0.58, 0.46]].forEach(([x, z]) => cylinder(0.045, 0.06, 0.24, [x, 0.12, z], palette.darkWood, reading));
  const cushion = box([0.53, 0.50, 0.18], [0.17, 0.97, -0.25], material('#d8b477'), 0.11, reading);
  cushion.rotation.z = -0.13; cushion.rotation.x = -0.20;
  box([0.38, 0.047, 1.13], [-0.42, 0.766, 0.25], material('#dfcda9'), 0.02, reading);
  box([0.38, 0.49, 0.052], [-0.42, 0.51, 0.80], material('#dfcda9'), 0.02, reading);
  for (let i = 0; i < 6; i++) rod([-0.57 + i * 0.062, 0.29, 0.815], [-0.57 + i * 0.062, 0.22, 0.825], 0.009, palette.linen, reading);
  cylinder(0.40, 0.40, 0.11, [1.09, 0.90, -1.95], palette.wood);
  cylinder(0.065, 0.10, 0.59, [1.09, 0.55, -1.95], palette.darkWood);
  cylinder(0.24, 0.27, 0.05, [1.09, 0.28, -1.95], palette.darkWood);
  box([0.36, 0.06, 0.28], [1.05, 0.99, -1.96], material('#b7785f'), 0.01).rotation.y = 0.20;
  cylinder(0.065, 0.072, 0.14, [1.25, 1.04, -1.91], palette.linen);

  // A woven rug and its soft, slightly irregular tassels.
  box([3.61, 0.033, 2.19], [0.25, 0.235, 1.35], material('#c4b28d'), 0.12, decor.rug);
  box([3.42, 0.012, 2.00], [0.25, 0.257, 1.35], material('#ded0ad'), 0.12, decor.rug);
  box([3.12, 0.006, 1.71], [0.25, 0.266, 1.35], material('#d3bf97'), 0.09, decor.rug);
  box([2.98, 0.006, 1.57], [0.25, 0.271, 1.35], material('#e0d0b0'), 0.08, decor.rug);
  for (let i = 0; i < 24; i++) {
    [-1, 1].forEach(side => rod([0.25 + side * 1.77, 0.246, 0.42 + i * 0.081], [0.25 + side * 1.90, 0.246, 0.42 + i * 0.081], 0.012, material('#d3c29e'), decor.rug));
  }
  cylinder(0.49, 0.51, 0.39, [2.97, 0.44, 0.67], material('#b4936a'));
  cylinder(0.49, 0.49, 0.12, [2.97, 0.69, 0.67], material('#c5a983'));

  function plant(x, y, z, scale = 1, parent = decor.plants) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.scale.setScalar(scale); parent.add(group);
    const terracotta = material('#bd8062');
    cylinder(0.23, 0.16, 0.37, [0, 0.185, 0], terracotta, group);
    cylinder(0.245, 0.245, 0.06, [0, 0.37, 0], terracotta, group);
    cylinder(0.209, 0.209, 0.015, [0, 0.402, 0], palette.darkWood, group);
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4;
      const height = 0.75 + (i % 3) * 0.19;
      const end = [Math.cos(angle) * 0.22, height, Math.sin(angle) * 0.22];
      rod([0, 0.40, 0], end, 0.012, material('#65754b'), group);
      const leaf = sphere([0.13, 0.29, 0.037], [end[0] * 1.3, height + 0.08, end[2] * 1.3], material(i % 2 ? '#758a55' : '#8a9c68'), group);
      leaf.rotation.set(0.40, -angle, -0.55);
    }
    return group;
  }
  plant(3.18, 0.23, -2.43, 1.2);
  plant(-3.15, 0.23, 2.22, 0.9);
  plant(-2.67, 1.55, -2.62, 0.42);
  plant(-3.44, 2.91, -0.42, 0.60);
  const shelfVine = tube([[-3.20, 3.2, -0.46], [-3.1, 2.92, -0.43], [-3.10, 2.63, -0.35], [-3.04, 2.45, -0.31]], 0.018, palette.leaf, decor.plants);
  for (let i = 0; i < 5; i++) sphere([0.10, 0.075, 0.045], [-3.06 + (i % 2) * 0.08, 2.94 - i * 0.095, -0.33], palette.leaf, decor.plants);

  // Small botanical prints: drawn locally, with timber frames.
  const artTexture = canvasTexture(200, 250, (ctx, w, h) => {
    ctx.fillStyle = '#efe5ca'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#7e8d68'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(100, 213); ctx.quadraticCurveTo(130, 132, 95, 52); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const left = i % 2 === 0; ctx.save(); ctx.translate(107, 185 - i * 22); ctx.rotate(left ? -0.7 : 0.7);
      ctx.fillStyle = i % 3 ? '#9da981' : '#728469'; ctx.beginPath(); ctx.ellipse(left ? -22 : 22, -10, 27, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  });
  box([0.81, 1.04, 0.07], [2.04, 3.10, -2.81], palette.darkWood, 0.024);
  mesh(new THREE.PlaneGeometry(0.68, 0.88), new THREE.MeshBasicMaterial({ map: artTexture }), [2.04, 3.10, -2.769], world, false);
  box([0.58, 0.74, 0.07], [3.03, 2.91, -2.81], palette.edge, 0.021);
  mesh(new THREE.PlaneGeometry(0.46, 0.61), new THREE.MeshBasicMaterial({ map: artTexture }), [3.03, 2.91, -2.769], world, false);
  const wallClock = new THREE.Group(); wallClock.position.set(-3.755, 3.47, 1.15); wallClock.rotation.y = Math.PI / 2; world.add(wallClock);
  const clockRim = cylinder(0.29, 0.29, 0.06, [0, 0, 0], palette.wood, wallClock, 32); clockRim.rotation.x = Math.PI / 2;
  const clockFace = cylinder(0.25, 0.25, 0.01, [0, 0, 0.04], palette.linen, wallClock, 32); clockFace.rotation.x = Math.PI / 2;
  rod([0, 0, 0.053], [0.10, 0.12, 0.053], 0.012, palette.darkWood, wallClock);
  rod([0, 0, 0.056], [-0.12, 0.025, 0.056], 0.014, palette.darkWood, wallClock);

  // One sleepy ginger friend, curled up with a striped tail.
  const cat = new THREE.Group(); cat.position.set(0.84, 0.29, 1.59); cat.rotation.y = -0.30; world.add(cat);
  const catBody = sphere([0.56, 0.26, 0.36], [-0.08, 0.23, 0], palette.ginger, cat);
  sphere([0.37, 0.14, 0.26], [0.08, 0.13, 0.19], palette.gingerLight, cat);
  const head = sphere([0.29, 0.245, 0.25], [0.33, 0.26, 0.15], palette.gingerLight, cat);
  [-0.16, 0.15].forEach((x, index) => {
    const ear = mesh(new THREE.ConeGeometry(0.115, 0.24, 3), palette.ginger, [0.33 + x, 0.47, 0.09], cat);
    ear.rotation.set(0.12, index ? -0.15 : 0.15, index ? -0.16 : 0.16);
    const inner = mesh(new THREE.ConeGeometry(0.067, 0.14, 3), material('#cd9779'), [0.33 + x, 0.475, 0.128], cat);
    inner.rotation.copy(ear.rotation);
  });
  const ink = material('#6e513b');
  [-0.105, 0.105].forEach(x => tube([[0.33 + x - 0.037, 0.295, 0.371], [0.33 + x, 0.28, 0.389], [0.33 + x + 0.037, 0.295, 0.378]], 0.012, ink, cat));
  sphere([0.031, 0.019, 0.019], [0.33, 0.225, 0.398], material('#b87869'), cat);
  sphere([0.11, 0.065, 0.07], [0.25, 0.14, 0.31], palette.linen, cat);
  const tail = tube([[-0.52, 0.22, -0.12], [-0.62, 0.13, 0.10], [-0.49, 0.105, 0.37], [-0.22, 0.105, 0.43], [0.04, 0.12, 0.35]], 0.10, palette.gingerLight, cat);
  [-0.32, -0.08, 0.13].forEach(x => {
    const stripe = sphere([0.047, 0.015, 0.22], [x, 0.478 - Math.abs(x + 0.08) * 0.06, -0.045], material('#ac7041'), cat);
    stripe.rotation.z = -0.18;
  });
  const heartTexture = canvasTexture(96, 96, ctx => {
    ctx.fillStyle = '#c77868'; ctx.beginPath(); ctx.moveTo(48, 80); ctx.bezierCurveTo(-11, 40, 14, -6, 48, 25); ctx.bezierCurveTo(82, -6, 107, 40, 48, 80); ctx.fill();
  });
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTexture, transparent: true, depthTest: false }));
  heart.scale.set(0.35, 0.35, 1); heart.visible = false; world.add(heart);

  const wire = material('#7b775f');
  const bulb = material('#ffe2a0', { emissive: '#ffcd77', emissiveIntensity: 1.4 });
  const wirePoints = [];
  for (let i = 0; i <= 12; i++) wirePoints.push([-3.63 + i * 0.607, 4.18 - Math.sin(i / 12 * Math.PI) * 0.37, -2.65]);
  tube(wirePoints, 0.012, wire, decor.lights);
  for (let i = 0; i < 12; i++) {
    const x = -3.42 + i * 0.62;
    const y = 4.18 - Math.sin((i + 0.35) / 12 * Math.PI) * 0.37;
    rod([x, y, -2.65], [x, y - 0.10, -2.65], 0.012, wire, decor.lights);
    sphere([0.048, 0.065, 0.048], [x, y - 0.14, -2.65], bulb, decor.lights);
  }
  const fairyLight = new THREE.PointLight('#ffcf84', 1.6, 6, 2); fairyLight.position.set(1, 3.6, -1.8); decor.lights.add(fairyLight);

  const rainVertices = new Float32Array(56 * 6);
  const rainSeeds = Array.from({ length: 56 }, (_, i) => ({ x: -3.12 + ((i * 0.618033) % 1) * 3.0, y: (i * 0.371) % 1, speed: 0.55 + (i % 4) * 0.12 }));
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainVertices, 3));
  // The positions move every frame; keep a stable bound for the whole window.
  rainGeometry.boundingBox = new THREE.Box3(new THREE.Vector3(-3.15, 1.57, -2.93), new THREE.Vector3(-0.10, 3.70, -2.93));
  rainGeometry.boundingSphere = rainGeometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: '#fffdf5', transparent: true, opacity: 0.60 }));
  rain.visible = false; world.add(rain);

  let theme = 'dusk', focused = false, petStart = -Infinity, disposed = false;
  let frame = 0, lastFrame = 0, visible = !document.hidden;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;
  const onMotionChange = event => { reducedMotion = event.matches; };
  motionQuery.addEventListener('change', onMotionChange);

  function setTheme(name) {
    theme = ['dusk', 'rain', 'day'].includes(name) ? name : 'dusk';
    paintSky(theme);
    rain.visible = theme === 'rain';
    const values = theme === 'day' ? ['#fff1d8', 3.5, '#edf4e8', 2.1, 3.5] : theme === 'rain' ? ['#d5dfeb', 1.5, '#e0e7ed', 1.5, 2.7] : ['#ffc890', 2.8, '#ffdfbb', 1.45, 9];
    sun.color.set(values[0]); sun.intensity = values[1];
    hemisphere.color.set(values[2]); hemisphere.intensity = values[3]; windowLight.intensity = values[4];
    windowLight.color.set(theme === 'rain' ? '#b5ccd8' : theme === 'day' ? '#fff0c1' : '#ffb476');
    lampLight.intensity = theme === 'day' ? 1.5 : 3.0;
    fill.intensity = theme === 'day' ? 0.9 : theme === 'rain' ? 0.7 : 0.55;
  }
  function pet() {
    petStart = performance.now();
    heart.visible = true;
    options.onPet?.();
  }
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPosition = null;
  const onPointerDown = event => { downPosition = { x: event.clientX, y: event.clientY }; };
  const hitCat = event => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObject(cat, true).length > 0;
  };
  const onPointerUp = event => {
    if (downPosition && Math.hypot(event.clientX - downPosition.x, event.clientY - downPosition.y) < 7 && hitCat(event)) pet();
    downPosition = null;
  };
  const onPointerCancel = () => { downPosition = null; renderer.domElement.style.cursor = 'grab'; };
  const onPointerMove = event => { if (event.pointerType === 'mouse') renderer.domElement.style.cursor = hitCat(event) ? 'pointer' : downPosition ? 'grabbing' : 'grab'; };
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerCancel);
  renderer.domElement.addEventListener('pointermove', onPointerMove);

  // Fit all eight corners, including the tall wall tops, in camera space.
  // Re-fitting while orbiting keeps the entire dollhouse visible even on phones.
  const roomCorners = [];
  for (const x of [-4.02, 4.02]) for (const y of [-0.23, 4.53]) for (const z of [-3.12, 3.08]) roomCorners.push(new THREE.Vector3(x, y, z));
  const projectedCorner = new THREE.Vector3();
  let canvasAspect = 1;
  function fitRoom() {
    camera.updateMatrixWorld();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const corner of roomCorners) {
      projectedCorner.copy(corner).applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, projectedCorner.x); maxX = Math.max(maxX, projectedCorner.x);
      minY = Math.min(minY, projectedCorner.y); maxY = Math.max(maxY, projectedCorner.y);
    }
    const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
    const viewHeight = Math.max(maxY - minY, (maxX - minX) / canvasAspect) / 0.88;
    const halfWidth = viewHeight * canvasAspect / 2;
    camera.left = centerX - halfWidth; camera.right = centerX + halfWidth;
    camera.top = centerY + viewHeight / 2; camera.bottom = centerY - viewHeight / 2;
    camera.updateProjectionMatrix();
  }
  const resize = () => {
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    canvasAspect = width / height;
    fitRoom(); renderer.setSize(width, height, false);
    renderer.render(scene, camera);
  };
  const observer = new ResizeObserver(resize); observer.observe(container); resize();

  function tick(now) {
    if (disposed || !visible) return;
    frame = requestAnimationFrame(tick);
    if (now - lastFrame < 1000 / 30) return;
    lastFrame = now;
    controls.update();
    fitRoom();
    const seconds = now / 1000;
    catBody.scale.y = 0.26 * (reducedMotion ? 1 : 1 + Math.sin(seconds * (focused ? 1.35 : 1.7)) * 0.035);
    studentHead.rotation.x = reducedMotion ? 0 : Math.sin(seconds * 0.65) * 0.016;
    typingHands.forEach((hand, index) => { hand.position.y = 1.59 + (focused && !reducedMotion ? Math.sin(seconds * 7 + index * Math.PI) * 0.009 : 0); });
    const petAge = (now - petStart) / 1000;
    if (petAge < 1.6) {
      heart.visible = true;
      heart.position.set(1.18, 1.12 + (reducedMotion ? 0 : petAge * 0.48), 1.62);
      heart.material.opacity = Math.min(1, (1.6 - petAge) * 2.6);
      if (!reducedMotion) head.rotation.z = Math.sin(petAge * 8) * 0.07;
    } else { heart.visible = false; head.rotation.z = 0; }
    if (rain.visible) {
      rainSeeds.forEach((seed, i) => {
        const y = 1.57 + ((seed.y - (reducedMotion ? 0 : seconds * seed.speed) % 1 + 1) % 1) * 2.08;
        const offset = i * 6;
        rainVertices.set([seed.x, y, -2.93, seed.x - 0.025, Math.min(y + 0.18, 3.70), -2.93], offset);
      });
      rainGeometry.attributes.position.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }
  const onVisibility = () => { visible = !document.hidden; if (visible) { lastFrame = 0; frame = requestAnimationFrame(tick); } else cancelAnimationFrame(frame); };
  document.addEventListener('visibilitychange', onVisibility);
  if (visible) frame = requestAnimationFrame(tick);

  return {
    setTheme,
    setFocused(value) { focused = Boolean(value); },
    pet,
    setDecor(key, value) { if (decor[key]) decor[key].visible = Boolean(value); },
    resetView() {
      // Consume any remaining orbit velocity before applying the home pose.
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      camera.position.copy(cameraHome);
      controls.target.copy(targetHome);
      controls.update();
      controls.enableDamping = damping;
      fitRoom();
      if (visible) renderer.render(scene, camera);
    },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', onMotionChange);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      const geometrySet = new Set(), materialSet = new Set();
      scene.traverse(object => {
        if (object.geometry) geometrySet.add(object.geometry);
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materialSet.add(m));
      });
      geometrySet.forEach(geometry => geometry.dispose()); materialSet.forEach(mat => mat.dispose()); textures.forEach(texture => texture.dispose());
      sun.shadow.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
