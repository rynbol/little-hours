import { BufferAttribute, BufferGeometry, Color, ConeGeometry, CustomBlending, DoubleSide, Euler, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, OneFactor, Points, Quaternion, RingGeometry, ShaderMaterial, SphereGeometry, UniformsLib, UniformsUtils, Vector3, ZeroFactor } from 'three';
import { LIFE, createHerd, createLeaves, lifeAt, stepHerd, stepLeaves } from '../../core/wilds/life.js';
import { TREE } from '../../core/wilds/flora.js';
import { buildDeer } from './deer.js';
import { merge, part } from './shapes.js';

export const LIFE_VIEW = Object.freeze({
  motes: Object.freeze({ count: 280, box: 18, rise: 7, size: 0.07 }),
  fireflies: Object.freeze({ count: 56, box: 26, size: 0.16 }),
  butterflies: Object.freeze({ count: 10, reach: 26, every: 1.5 }),
  birds: Object.freeze({ count: 7, centre: Object.freeze([10, -150]), radius: 95, height: 78, speed: 0.07 }),
  fish: Object.freeze({ every: Object.freeze([4, 11]), flight: 0.95, height: 0.95, near: 14, far: 55 }),
  leaves: Object.freeze({ reach: 40, every: 1 }),
});
const WINGS = Object.freeze(['#fff8e8', '#ffd86a', '#a9d4ff', '#ffb36b', '#f4c6ff']);

const GLOW = Object.freeze({ blending: CustomBlending, blendSrc: OneFactor, blendDst: OneFactor, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor, transparent: true, depthWrite: false });
const WRAP = 'vec3 wrapAround(vec3 seed, vec3 centre, float box) { return vec3(centre.x - box * 0.5 + mod(seed.x * box - centre.x + box * 0.5, box), seed.y, centre.z - box * 0.5 + mod(seed.z * box - centre.z + box * 0.5, box)); }';

function seedGeometry(count, random) {
  const geometry = new BufferGeometry(), seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = random();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('seed', new BufferAttribute(seeds, 4));
  return geometry;
}

function buildMotes(random, time) {
  const M = LIFE_VIEW.motes;
  const material = new ShaderMaterial({
    ...GLOW, lights: true, fog: false,
    uniforms: UniformsUtils.merge([UniformsLib.lights, { time, centre: { value: new Vector3() }, amount: { value: 0 }, tint: { value: new Color() }, sunDirection: { value: new Vector3(0, 1, 0) }, scale: { value: 600 } }]),
    vertexShader: `#include <common>
#include <shadowmap_pars_vertex>
attribute vec4 seed; uniform float time; uniform vec3 centre; uniform float scale; uniform vec3 sunDirection; varying float vGlow;
${WRAP}
void main() {
  vec3 at = wrapAround(seed.xyz, centre, ${M.box.toFixed(1)});
  at.y = centre.y - 1.5 + mod(seed.y * ${M.rise.toFixed(1)} + time * (0.04 + seed.w * 0.05), ${M.rise.toFixed(1)});
  at += vec3(sin(time * 0.21 + seed.w * 31.0), sin(time * 0.17 + seed.x * 17.0) * 0.4, cos(time * 0.19 + seed.z * 23.0)) * 0.6;
  vec4 worldPosition = vec4(at, 1.0);
  vec4 mvPosition = viewMatrix * worldPosition;
  #include <shadowmap_vertex>
  vec3 view = normalize(at - cameraPosition);
  float edge = length(at.xz - centre.xz) / ${(M.box / 2).toFixed(1)};
  float depth = -mvPosition.z;
  vGlow = (0.12 + 2.2 * pow(max(dot(view, sunDirection), 0.0), 5.0)) * (1.0 - smoothstep(0.6, 1.0, edge)) * smoothstep(1.0, 2.5, depth) * (0.6 + 0.4 * sin(time * 2.0 + seed.w * 40.0));
  gl_PointSize = min(9.0, ${M.size.toFixed(2)} * (0.6 + seed.w * 0.8) * scale / max(0.1, depth));
  gl_Position = projectionMatrix * mvPosition;
}`,
    fragmentShader: `#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
uniform vec3 tint; uniform float amount; varying float vGlow;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0; float r = dot(p, p); if (r > 1.0) discard;
  float lit = 1.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    DirectionalLightShadow beam = directionalLightShadows[ 0 ];
    lit = getShadow( directionalShadowMap[ 0 ], beam.shadowMapSize, 1.0, beam.shadowBias, beam.shadowRadius, vDirectionalShadowCoord[ 0 ] );
  #endif
  gl_FragColor = vec4(tint * vGlow * lit * amount * (1.0 - r) * (1.0 - r), 1.0);
}`,
  });
  const points = new Points(seedGeometry(M.count, random), material);
  points.frustumCulled = false; points.receiveShadow = true; points.name = 'wilds-motes-sun'; points.renderOrder = 19;
  return {
    points,
    update(player, amount, light) {
      points.visible = amount > 0.01;
      material.uniforms.amount.value = amount;
      material.uniforms.centre.value.set(player.x, player.y, player.z);
      material.uniforms.tint.value.copy(light.glow).multiplyScalar(0.55);
      material.uniforms.sunDirection.value.copy(light.sun);
    },
  };
}

function glowPoints(count, name) {
  const geometry = new BufferGeometry(), positions = new Float32Array(count * 3), tints = new Float32Array(count * 4), sizes = new Float32Array(count);
  for (const [key, array, size] of [['position', positions, 3], ['tint', tints, 4], ['size', sizes, 1]]) geometry.setAttribute(key, new BufferAttribute(array, size));
  const material = new ShaderMaterial({
    ...GLOW, uniforms: { scale: { value: 600 } },
    vertexShader: `attribute float size; attribute vec4 tint; uniform float scale; varying vec4 vTint;
void main() { vTint = tint; vec4 at = modelViewMatrix * vec4(position, 1.0); vTint.a *= smoothstep(1.2, 3.0, -at.z); gl_PointSize = min(12.0, size * scale / max(0.1, -at.z)); gl_Position = projectionMatrix * at; }`,
    fragmentShader: `varying vec4 vTint;
void main() { vec2 p = gl_PointCoord * 2.0 - 1.0; float r = dot(p, p); if (r > 1.0) discard; float core = exp(-r * 6.0); gl_FragColor = vec4(vTint.rgb * (core * 1.6 + (1.0 - r) * 0.35) * vTint.a, 1.0); }`,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false; points.name = name; points.renderOrder = 19;
  return { points, positions, tints, sizes, geometry };
}

function buildFireflies(random) {
  const F = LIFE_VIEW.fireflies, glow = glowPoints(F.count, 'wilds-fireflies'), seeds = Array.from({ length: F.count }, () => [random(), random(), random(), random()]), colour = new Color('#d8ff7a');
  const spot = (seed, centre) => centre - F.box / 2 + (((seed * F.box - centre + F.box / 2) % F.box) + F.box) % F.box;
  return {
    points: glow.points,
    update(player, amount, seconds, floor) {
      glow.points.visible = amount > 0.01;
      if (!glow.points.visible) return;
      seeds.forEach(([sx, sy, sz, sw], i) => {
        const x = spot(sx, player.x) + Math.sin(seconds * 0.3 + sw * 20) * 1.4, z = spot(sz, player.z) + Math.cos(seconds * 0.27 + sx * 17) * 1.4;
        const y = floor(x, z) + 0.5 + sy * 1.8 + Math.sin(seconds * 0.8 + sz * 13) * 0.3, edge = Math.hypot(x - player.x, z - player.z) / (F.box / 2);
        const blink = 0.15 + 0.85 * Math.max(0, Math.sin(seconds * (0.9 + sw * 0.8) + sw * 50)) ** 2;
        glow.positions.set([x, y, z], i * 3);
        glow.tints.set([colour.r, colour.g, colour.b, blink * amount * Math.max(0, 1 - edge)], i * 4);
        glow.sizes[i] = F.size * (0.7 + sw * 0.6);
      });
      for (const key of ['position', 'tint', 'size']) glow.geometry.attributes[key].needsUpdate = true;
    },
  };
}

function wingGeometry(span, depth) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, depth * 0.5, span, 0, depth * 0.2, span * 0.8, 0, -depth * 0.5, 0, 0, -depth * 0.3, -span, 0, depth * 0.2, -span * 0.8, 0, -depth * 0.5]), 3));
  geometry.setAttribute('side', new BufferAttribute(new Float32Array([0, 1, 1, 0, -1, -1]), 1));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 4, 5, 0, 5, 3]);
  return geometry;
}

function flapper(geometry, count, name, { flap, beat = '0.9', colours, time }) {
  const material = new ShaderMaterial({
    side: DoubleSide, fog: true,
    uniforms: UniformsUtils.merge([UniformsLib.fog, { time, light: { value: new Color(1, 1, 1) } }]),
    vertexShader: `attribute float side; attribute float phase; attribute vec3 wing; uniform float time; varying vec3 vColour;
#include <fog_pars_vertex>
void main() {
  float beat = sin(time * ${flap.toFixed(1)} * (0.8 + phase * 0.4) + phase * 40.0) * (${beat});
  vec3 p = position;
  float lift = abs(side) * beat;
  p.y += abs(p.x) * lift; p.x *= 1.0 - abs(lift) * 0.35;
  vColour = wing * (0.75 + 0.25 * abs(side));
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 light; varying vec3 vColour;
#include <fog_pars_fragment>
void main() { gl_FragColor = vec4(vColour * light, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
  });
  const mesh = new InstancedMesh(geometry, material, count), phases = new Float32Array(count), wings = new Float32Array(count * 3), tint = new Color();
  for (let i = 0; i < count; i++) { phases[i] = i / count; tint.set(colours[i % colours.length]); wings.set([tint.r, tint.g, tint.b], i * 3); }
  geometry.setAttribute('phase', new InstancedBufferAttribute(phases, 1));
  geometry.setAttribute('wing', new InstancedBufferAttribute(wings, 3));
  mesh.frustumCulled = false; mesh.name = name;
  return { mesh, material };
}

function buildButterflies(flowers, time) {
  const B = LIFE_VIEW.butterflies, { mesh, material } = flapper(wingGeometry(0.07, 0.09), B.count, 'wilds-butterflies', { flap: 15, colours: WINGS, time });
  const homes = Array.from({ length: B.count }, () => null), matrix = new Matrix4(), turn = new Quaternion(), euler = new Euler(), at = new Vector3(), size = new Vector3();
  let clock = B.every;
  return {
    mesh,
    update(player, amount, seconds, dt, floor, light) {
      mesh.visible = amount > 0.01;
      if (!mesh.visible) return;
      material.uniforms.light.value.copy(light.sky).lerp(light.light, 0.5).multiplyScalar(0.55 + light.strength * 0.15);
      if ((clock += dt) >= B.every) {
        clock = 0;
        const near = flowers.filter(([x, z]) => Math.abs(x - player.x) < B.reach && Math.abs(z - player.z) < B.reach);
        homes.forEach((home, i) => { if (!home || Math.abs(home[0] - player.x) > B.reach || Math.abs(home[1] - player.z) > B.reach) homes[i] = near.length ? near[(i * 7919) % near.length] : null; });
      }
      homes.forEach((home, i) => {
        if (!home) { matrix.makeScale(0, 0, 0); mesh.setMatrixAt(i, matrix); return; }
        const t = seconds * (0.6 + (i % 3) * 0.15) + i * 2.1, x = home[0] + Math.sin(t) * 1.3 + Math.sin(t * 2.3) * 0.3, z = home[1] + Math.cos(t * 0.8) * 1.3;
        const y = floor(x, z) + 0.45 + Math.sin(t * 3.1) * 0.25 + 0.25, heading = Math.atan2(Math.cos(t) * 1.3, -Math.sin(t * 0.8) * 1.04);
        matrix.compose(at.set(x, y, z), turn.setFromEuler(euler.set(0.3, heading, 0)), size.setScalar(amount));
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

function buildBirds(time) {
  const B = LIFE_VIEW.birds, beat = '0.12 + 0.75 * smoothstep(0.3, 0.7, sin(time * 0.6 + phase * 9.0) * 0.5 + 0.5)';
  const { mesh, material } = flapper(wingGeometry(0.55, 0.32), B.count, 'wilds-birds', { flap: 7, beat, colours: ['#3c3530', '#4a4038'], time });
  const matrix = new Matrix4(), turn = new Quaternion(), euler = new Euler(), at = new Vector3(), size = new Vector3();
  return {
    mesh,
    update(amount, seconds, light) {
      mesh.visible = amount > 0.01;
      if (!mesh.visible) return;
      material.uniforms.light.value.copy(light.sky).multiplyScalar(0.5);
      for (let i = 0; i < B.count; i++) {
        const angle = seconds * B.speed * (1 + (i % 3) * 0.08) + i * 0.55, radius = B.radius + Math.sin(i * 2.7) * 22 + Math.sin(seconds * 0.05 + i) * 8;
        const x = B.centre[0] + Math.cos(angle) * radius, z = B.centre[1] + Math.sin(angle) * radius, y = B.height + Math.sin(i * 1.9) * 10 + Math.sin(seconds * 0.3 + i) * 2;
        matrix.compose(at.set(x, y, z), turn.setFromEuler(euler.set(0, -angle, Math.sin(seconds * 0.4 + i) * 0.15 - 0.25)), size.setScalar(amount));
        mesh.setMatrixAt(i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

function buildLeaves(painterly) {
  const leafShape = new BufferGeometry();
  leafShape.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0.07, 0.035, 0, 0.0, 0, 0.012, -0.06, -0.035, 0, 0.0]), 3));
  leafShape.setAttribute('normal', new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  leafShape.setIndex([0, 1, 2, 0, 2, 3]);
  const material = painterly.material('#ffffff', { side: DoubleSide, rim: false });
  const leaves = createLeaves(), mesh = new InstancedMesh(leafShape, material, leaves.length), tint = new Color();
  const palette = ['#9cc25a', '#c8b84a', '#e0a446', '#7fae4c'], petals = ['#ffd8e4', '#fff0f4', '#ffc4d6'];
  leaves.forEach((_, i) => mesh.setColorAt(i, tint.set(palette[i % palette.length])));
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.name = 'wilds-leaves';
  const matrix = new Matrix4(), turn = new Quaternion(), euler = new Euler(), at = new Vector3(), size = new Vector3(), sources = [];
  const petalled = leaves.map(() => false);
  let clock = LIFE_VIEW.leaves.every;
  return {
    mesh,
    update(player, trees, ground, water, flow, dt, still) {
      if ((clock += dt) >= LIFE_VIEW.leaves.every) {
        clock = 0; sources.length = 0;
        for (const tree of trees) if (tree.hero && Math.hypot(tree.x - player.x, tree.z - player.z) < LIFE_VIEW.leaves.reach) sources.push({ x: tree.x, z: tree.z, y: tree.y + TREE.height[tree.kind] * tree.scale * 0.72, radius: 2.4 * tree.scale });
      }
      if (!still) stepLeaves(leaves, dt, { sources, floor: ground, water, flow });
      leaves.forEach((leaf, i) => {
        if (leaf.petal !== petalled[i]) { petalled[i] = leaf.petal; mesh.setColorAt(i, tint.set(leaf.petal ? petals[i % petals.length] : palette[i % palette.length])); mesh.instanceColor.needsUpdate = true; }
        const shown = leaf.state === 'wait' ? 0 : leaf.fade * (leaf.petal ? 1.3 : 2);
        const tumble = leaf.state === 'fall' ? leaf.time * leaf.spin * 3 : 0;
        euler.set(leaf.state === 'fall' ? Math.sin(tumble) * 1.2 : 0, leaf.phase + tumble * 0.4, leaf.state === 'fall' ? Math.cos(tumble * 0.7) * 0.9 : 0);
        matrix.compose(at.set(leaf.x, leaf.y + (leaf.state === 'fall' ? 0 : 0.015), leaf.z), turn.setFromEuler(euler), size.setScalar(shown));
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

function buildFish(painterly, effects, random) {
  const F = LIFE_VIEW.fish;
  const body = new Mesh(merge([
    part(new SphereGeometry(0.1, 8, 6), '#8fa9b8', { scale: [0.7, 0.8, 2.2], shade: (x, y) => (y > 0 ? 0.75 : 1.1) }),
    part(new ConeGeometry(0.09, 0.16, 4), '#7894a6', { position: [0, 0, -0.27], rotation: [-Math.PI / 2, 0, 0], scale: [0.25, 1, 1] }),
  ]), painterly.material('#ffffff', { vertexColors: true }));
  body.name = 'wilds-fish'; body.visible = false;
  const ring = new Mesh(new RingGeometry(0.4, 0.5, 24).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: '#eaf6f8', transparent: true, opacity: 0, depthWrite: false }));
  ring.name = 'wilds-fish-ring'; ring.visible = false; ring.renderOrder = 4;
  const jump = { x: 0, z: 0, level: 0, heading: 0, time: -1 }, splash = { x: 0, z: 0, level: 0, time: 9 };
  let wait = F.every[0];
  const ripple = (x, z, level) => { Object.assign(splash, { x, z, level, time: 0 }); effects.splash(x, level + 0.05, z); };
  return {
    meshes: [body, ring],
    get jumping() { return jump.time >= 0; },
    update(player, ground, water, dt, still) {
      if (still) return;
      if (jump.time < 0 && (wait -= dt) <= 0) {
        wait = F.every[0] + random() * (F.every[1] - F.every[0]);
        const angle = random() * Math.PI * 2, distance = F.near + random() * (F.far - F.near), x = player.x + Math.cos(angle) * distance, z = player.z + Math.sin(angle) * distance, level = water(x, z);
        if (level > ground(x, z) + 0.8) { Object.assign(jump, { x, z, level, heading: random() * Math.PI * 2, time: 0 }); ripple(x, z, level); }
      }
      if (jump.time >= 0) {
        jump.time += dt;
        const t = jump.time / F.flight;
        if (t >= 1) { jump.time = -1; body.visible = false; ripple(jump.x + Math.sin(jump.heading) * 1.3, jump.z + Math.cos(jump.heading) * 1.3, jump.level); }
        else {
          body.visible = true;
          body.position.set(jump.x + Math.sin(jump.heading) * 1.3 * t, jump.level + 4 * F.height * t * (1 - t) - 0.1, jump.z + Math.cos(jump.heading) * 1.3 * t);
          body.rotation.set(-Math.atan2(4 * F.height * (1 - 2 * t), 1.3), jump.heading, Math.sin(jump.time * 30) * 0.2, 'YXZ');
        }
      }
      splash.time += dt;
      ring.visible = splash.time < 1.2;
      if (ring.visible) { ring.position.set(splash.x, splash.level + 0.03, splash.z); ring.scale.setScalar(0.4 + splash.time * 1.8); ring.material.opacity = 0.55 * (1 - splash.time / 1.2); }
    },
  };
}

export function buildLife(sim, painterly, effects, { time, random, flowers }) {
  const motes = buildMotes(random, time), fireflies = buildFireflies(random), butterflies = buildButterflies(flowers, time), birds = buildBirds(time);
  const leaves = buildLeaves(painterly), fish = buildFish(painterly, effects, random), herd = createHerd(LIFE.deer.herd, random), deer = buildDeer(herd.length, painterly);
  const amounts = lifeAt(sim.hour);
  return {
    meshes: [motes.points, fireflies.points, butterflies.mesh, birds.mesh, leaves.mesh, ...fish.meshes, ...deer.meshes],
    herd, amounts,
    get fishJumping() { return fish.jumping; },
    resize(scale) { motes.points.material.uniforms.scale.value = scale; fireflies.points.material.uniforms.scale.value = scale; },
    update({ player, hour, light, seconds, dt, still, ground, water, flow, eye }) {
      lifeAt(hour, amounts);
      const floor = (x, z) => Math.max(ground(x, z), water(x, z));
      if (!still) stepHerd(herd, player, dt, { random, blocked: (x, z) => water(x, z) > ground(x, z) - 0.2 || x < TREE.span[0] || x > TREE.span[1] || z < TREE.span[2] || z > TREE.span[3] });
      deer.update(herd, ground, eye, dt, still);
      motes.update(player, amounts.motes * Math.min(1, Math.max(0, light.sun.y * 5)), light);
      fireflies.update(player, amounts.fireflies, seconds, floor);
      butterflies.update(player, amounts.butterflies, seconds, dt, floor, light);
      birds.update(amounts.birds, seconds, light);
      leaves.update(player, sim.trees, ground, water, flow, dt, still);
      fish.update(player, ground, water, dt, still);
    },
  };
}
