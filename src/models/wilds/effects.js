import { AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, Color, DoubleSide, DynamicDrawUsage, Mesh, MeshBasicMaterial, NormalBlending, Points, ShaderMaterial } from 'three';

export const KINDS = Object.freeze({
  spark: Object.freeze({ colour: '#ffe7a8', size: 0.11, life: [0.18, 0.34], speed: [4, 9], gravity: 9, drag: 3, glow: 1 }),
  straw: Object.freeze({ colour: '#e6c26a', size: 0.09, life: [0.6, 1.1], speed: [1.6, 3.6], gravity: 5, drag: 2.2, glow: 0 }),
  flash: Object.freeze({ colour: '#fff6dc', size: 1.1, life: [0.09, 0.09], speed: [0, 0], gravity: 0, drag: 0, glow: 1 }),
  dust: Object.freeze({ colour: '#d8c9a4', size: 0.34, life: [0.45, 0.75], speed: [0.6, 1.5], gravity: -0.6, drag: 3.5, glow: 0 }),
  charge: Object.freeze({ colour: '#ffd27a', size: 0.08, life: [0.25, 0.4], speed: [0.4, 1.2], gravity: -1.5, drag: 1, glow: 1 }),
  seed: Object.freeze({ colour: '#fff3c9', size: 0.09, life: [3.2, 4.4], speed: [1.6, 2.4], gravity: -0.15, drag: 0.15, glow: 0 }),
  petal: Object.freeze({ colour: '#ffe1ea', size: 0.13, life: [2.2, 3.2], speed: [0.8, 2], gravity: 0.35, drag: 1.3, glow: 0 }),
  leaf: Object.freeze({ colour: '#a8c766', size: 0.15, life: [1.8, 2.8], speed: [1, 2.2], gravity: 0.7, drag: 1.5, glow: 0 }),
});

const POOL = 160, TRAIL = 48;

function particleMaterial(blending) {
  return new ShaderMaterial({
    transparent: true, depthWrite: false, blending,
    uniforms: { scale: { value: 600 } },
    vertexShader: `attribute float size; attribute vec4 tint; uniform float scale; varying vec4 vTint;
void main() { vTint = tint; vec4 at = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.1, -at.z); gl_Position = projectionMatrix * at; }`,
    fragmentShader: `varying vec4 vTint;
void main() { vec2 p = gl_PointCoord * 2.0 - 1.0; float r = dot(p, p); if (r > 1.0) discard; gl_FragColor = vec4(vTint.rgb, vTint.a * (1.0 - r) * (1.0 - r)); }`,
  });
}

function pool(blending, name) {
  const geometry = new BufferGeometry(), positions = new Float32Array(POOL * 3), tints = new Float32Array(POOL * 4), sizes = new Float32Array(POOL);
  for (const [key, array, size] of [['position', positions, 3], ['tint', tints, 4], ['size', sizes, 1]]) geometry.setAttribute(key, new BufferAttribute(array, size).setUsage(DynamicDrawUsage));
  const points = new Points(geometry, particleMaterial(blending));
  points.frustumCulled = false; points.name = name; points.renderOrder = 20;
  const live = Array.from({ length: POOL }, () => ({ age: 1, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, kind: null, colour: new Color() }));
  let next = 0, count = 0;
  return {
    points,
    spawn(kind, x, y, z, dx, dy, dz, random) {
      const p = live[next]; next = (next + 1) % POOL;
      const speed = kind.speed[0] + (kind.speed[1] - kind.speed[0]) * random();
      p.kind = kind; p.age = 0; p.life = kind.life[0] + (kind.life[1] - kind.life[0]) * random();
      p.x = x; p.y = y; p.z = z; p.vx = dx * speed; p.vy = dy * speed; p.vz = dz * speed; p.colour.set(kind.colour);
    },
    step(dt) {
      count = 0;
      for (const p of live) {
        if (p.age >= p.life) continue;
        p.age += dt;
        const k = p.kind, fade = Math.max(0, 1 - p.age / p.life), slow = Math.exp(-k.drag * dt);
        p.vx *= slow; p.vz *= slow; p.vy = p.vy * slow - k.gravity * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (fade <= 0) continue;
        positions[count * 3] = p.x; positions[count * 3 + 1] = p.y; positions[count * 3 + 2] = p.z;
        tints[count * 4] = p.colour.r; tints[count * 4 + 1] = p.colour.g; tints[count * 4 + 2] = p.colour.b;
        tints[count * 4 + 3] = k === KINDS.flash ? fade : Math.min(1, fade * 1.6) * (k.glow ? 1 : 0.85);
        sizes[count] = k.size * (k === KINDS.flash ? 0.6 + (1 - fade) * 0.8 : k === KINDS.dust ? 0.7 + (1 - fade) * 0.9 : 0.5 + fade * 0.5);
        count++;
      }
      geometry.setDrawRange(0, count);
      for (const key of ['position', 'tint', 'size']) geometry.attributes[key].needsUpdate = count > 0;
      points.visible = count > 0;
    },
    get count() { return count; },
    clear() { for (const p of live) p.age = p.life; count = 0; geometry.setDrawRange(0, 0); points.visible = false; },
  };
}

function trail() {
  const geometry = new BufferGeometry(), positions = new Float32Array(TRAIL * 2 * 3), colours = new Float32Array(TRAIL * 2 * 4), index = [];
  for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; index.push(a, b, c, b, d, c); }
  geometry.setIndex(index);
  geometry.setAttribute('position', new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('color', new BufferAttribute(colours, 4).setUsage(DynamicDrawUsage));
  const material = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending, fog: false });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false; mesh.renderOrder = 21; mesh.name = 'wilds-trail';
  const samples = Array.from({ length: TRAIL }, () => ({ root: [0, 0, 0], tip: [0, 0, 0], age: 9, heat: 0 }));
  const colour = new Color(), cool = new Color('#cfe2ff'), warm = new Color('#ffcf73');
  let head = 0, filled = 0;
  return {
    mesh,
    add(segment, heat) {
      const s = samples[head]; head = (head + 1) % TRAIL; filled = Math.min(TRAIL, filled + 1);
      for (let i = 0; i < 3; i++) { s.root[i] = segment.root[i] + (segment.tip[i] - segment.root[i]) * 0.35; s.tip[i] = segment.tip[i]; }
      s.age = 0; s.heat = heat;
    },
    cut() { filled = 0; },
    step(dt, life = 0.16) {
      let visible = 0;
      for (let n = 0; n < TRAIL; n++) {
        const s = samples[(head - 1 - n + TRAIL * 2) % TRAIL];
        if (n < filled) s.age += dt;
        const alive = n < filled && s.age < life, fade = alive ? (1 - s.age / life) ** 1.5 : 0;
        colour.copy(cool).lerp(warm, s.heat);
        for (let side = 0; side < 2; side++) {
          const v = n * 2 + side, from = side ? s.tip : s.root;
          positions[v * 3] = from[0]; positions[v * 3 + 1] = from[1]; positions[v * 3 + 2] = from[2];
          const alpha = fade * (side ? 0.85 : 0.0);
          colours[v * 4] = colour.r; colours[v * 4 + 1] = colour.g; colours[v * 4 + 2] = colour.b; colours[v * 4 + 3] = alpha;
        }
        if (alive) visible++;
      }
      geometry.attributes.position.needsUpdate = visible > 0; geometry.attributes.color.needsUpdate = visible > 0;
      mesh.visible = visible > 1;
      if (!visible) filled = 0;
    },
  };
}

function blob() {
  const material = new MeshBasicMaterial({ color: '#25331c', transparent: true, opacity: 0.32, depthWrite: false, fog: false });
  const mesh = new Mesh(new CircleGeometry(0.36, 20).rotateX(-Math.PI / 2), material);
  mesh.renderOrder = 2; mesh.name = 'wilds-blob';
  material.polygonOffset = true; material.polygonOffsetFactor = -2; material.polygonOffsetUnits = -2;
  return {
    mesh,
    place(x, ground, height, z) {
      const lift = Math.max(0, height - ground), size = Math.max(0.45, 1 - lift * 0.18);
      mesh.position.set(x, ground + 0.03, z); mesh.scale.setScalar(size);
      material.opacity = 0.32 * Math.max(0.35, 1 - lift * 0.22);
    },
  };
}

export function buildEffects(random) {
  const bright = pool(AdditiveBlending, 'wilds-sparks'), soft = pool(NormalBlending, 'wilds-motes'), swish = trail(), shadow = blob();
  const direction = [0, 0, 0];
  const scatter = (spread, lift) => {
    const angle = random() * Math.PI * 2, rise = lift + (random() - 0.5) * spread;
    const flat = Math.sqrt(Math.max(0, 1 - rise * rise));
    direction[0] = Math.cos(angle) * flat; direction[1] = rise; direction[2] = Math.sin(angle) * flat;
    return direction;
  };
  const emit = (target, kind, count, x, y, z, toward, spread, lift) => {
    for (let i = 0; i < count; i++) {
      const [dx, dy, dz] = scatter(spread, lift), bias = toward ? 0.6 : 0;
      const ax = dx + (toward?.[0] ?? 0) * bias, ay = dy + (toward?.[1] ?? 0) * bias, az = dz + (toward?.[2] ?? 0) * bias, length = Math.hypot(ax, ay, az) || 1;
      target.spawn(kind, x, y, z, ax / length, ay / length, az / length, random);
    }
  };
  return {
    meshes: [bright.points, soft.points, swish.mesh, shadow.mesh],
    trail: swish, shadow,
    hit(x, y, z, toward, heavy) {
      emit(bright, KINDS.flash, 1, x, y, z, null, 0, 0);
      emit(bright, KINDS.spark, heavy ? 22 : 12, x, y, z, toward, 1.2, 0.35);
      emit(soft, KINDS.straw, heavy ? 16 : 8, x, y, z, toward, 1.4, 0.45);
    },
    dust(x, y, z, amount) { emit(soft, KINDS.dust, Math.round(4 + amount * 6), x, y + 0.05, z, null, 0.3, 0.15); },
    charge(x, y, z) { emit(bright, KINDS.charge, 1, x, y, z, null, 1.5, 0.3); },
    drift(x, y, z) { emit(soft, KINDS.seed, 1, x, y, z, null, 0.1, 0.95); },
    blossom(x, y, z) { emit(soft, KINDS.petal, 1, x, y, z, null, 0.8, 0.55); emit(soft, KINDS.leaf, 1, x, y, z, null, 0.8, 0.4); },
    step(dt, trailDt = dt) { bright.step(dt); soft.step(dt); swish.step(trailDt); },
    resize(height, fov) { const scale = height / (2 * Math.tan(fov * Math.PI / 360)); bright.points.material.uniforms.scale.value = scale; soft.points.material.uniforms.scale.value = scale; },
    get live() { return bright.count + soft.count; },
    clear() { bright.clear(); soft.clear(); swish.cut(); },
  };
}
