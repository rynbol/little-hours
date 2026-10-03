import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, ShaderMaterial, Vector3 } from 'three';

export const RAIN = Object.freeze({ drops: 1600, box: 30, height: 20, speed: 17, length: 0.7, width: 0.016, slant: 0.12 });

export function rainGeometry(random, drops = RAIN.drops) {
  const seeds = new Float32Array(drops * 4 * 4), corners = new Float32Array(drops * 4 * 2), index = new Uint32Array(drops * 6);
  for (let i = 0; i < drops; i++) {
    const seed = [random(), random(), random(), random()];
    for (let c = 0; c < 4; c++) {
      seeds.set(seed, (i * 4 + c) * 4);
      corners.set([c % 2 ? 1 : -1, c < 2 ? 0 : 1], (i * 4 + c) * 2);
    }
    index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(drops * 4 * 3), 3));
  geometry.setAttribute('seed', new BufferAttribute(seeds, 4));
  geometry.setAttribute('corner', new BufferAttribute(corners, 2));
  geometry.setIndex(new BufferAttribute(index, 1));
  return geometry;
}

export function buildRain(random, time) {
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: DoubleSide,
    uniforms: { time, centre: { value: new Vector3() }, amount: { value: 0 }, tint: { value: new Vector3(0.78, 0.82, 0.9) } },
    vertexShader: `attribute vec4 seed; attribute vec2 corner; uniform float time; uniform vec3 centre; uniform float amount; varying float vFade;
void main() {
  float box = ${RAIN.box.toFixed(1)}, height = ${RAIN.height.toFixed(1)};
  vec3 base = vec3(centre.x - box * 0.5 + mod(seed.x * box - centre.x + box * 0.5, box), 0.0, centre.z - box * 0.5 + mod(seed.y * box - centre.z + box * 0.5, box));
  base.y = centre.y + height * 0.6 - mod(seed.z * height + time * ${RAIN.speed.toFixed(1)} * (0.85 + seed.w * 0.3), height);
  vec3 fall = vec3(${RAIN.slant.toFixed(2)}, -1.0, 0.05) * ${RAIN.length.toFixed(2)};
  vec4 top = viewMatrix * vec4(base, 1.0), bottom = viewMatrix * vec4(base + fall, 1.0);
  vec2 along = normalize(bottom.xy - top.xy + vec2(0.0001, 0.0)), across = vec2(-along.y, along.x);
  vec4 at = mix(top, bottom, corner.y);
  at.xy += across * corner.x * ${RAIN.width.toFixed(3)} * (1.0 + -at.z * 0.02);
  float spread = length(base.xz - centre.xz) / (box * 0.5);
  vFade = step(seed.w, amount) * (1.0 - smoothstep(0.6, 1.0, spread)) * smoothstep(0.5, 2.0, -at.z) * (1.0 - corner.y * 0.7);
  gl_Position = projectionMatrix * at;
}`,
    fragmentShader: `uniform vec3 tint; varying float vFade;
void main() { if (vFade <= 0.0) discard; gl_FragColor = vec4(tint, vFade * 0.32); }`,
  });
  const mesh = new Mesh(rainGeometry(random), material);
  mesh.frustumCulled = false; mesh.renderOrder = 22; mesh.name = 'wilds-rain'; mesh.visible = false;
  return {
    mesh,
    update(eye, amount, colour) {
      mesh.visible = amount > 0.005;
      material.uniforms.amount.value = amount;
      material.uniforms.centre.value.copy(eye);
      material.uniforms.tint.value.set(colour.r, colour.g, colour.b);
    },
  };
}
