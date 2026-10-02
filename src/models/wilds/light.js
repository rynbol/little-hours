import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector.js';

export const WILDS_SHADOW = Object.freeze({ size: 2048, reach: 72, fade: 14, depth: 280, bias: 0.0004 });
export const SHADOW_UNIFORMS = Object.freeze(['shadowMatrix', 'shadowField', 'shadowForm']);
export const SHADOW_SAMPLERS = Object.freeze(['shadowMap']);

export const SHADOW_GLSL = `uniform sampler2D shadowMap; uniform mat4 shadowMatrix; uniform vec4 shadowField; uniform vec3 shadowForm;
float shadowNear(vec3 p) { return shadowForm.y * (1. - smoothstep(shadowField.z, shadowField.w, distance(p.xz, shadowField.xy))); }
float shadowTap(vec2 uv, float depth) { return step(texture2D(shadowMap, uv).r + shadowForm.z, depth); }
float sunShadow(vec3 p, float spread) {
  float near = shadowNear(p);
  if (near <= 0.) return 0.;
  vec4 lit = shadowMatrix * vec4(p, 1.); vec2 uv = lit.xy * .5 + .5; float depth = lit.z * .5 + .5, sum = 0.;
  float turn = fract(sin(dot(floor(p.xz * 24.), vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;
  mat2 spin = mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * shadowForm.x * spread;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) sum += shadowTap(uv + spin * vec2(float(i), float(j)), depth);
  return sum / 9. * near;
}`;

const castsShadow = mesh => /^world-trees-.*-near$/.test(mesh.name) || Boolean(mesh.metadata?.pet) || (!mesh.metadata?.world && mesh.metadata?.castShadow !== false && mesh.getTotalVertices() > 0);

export function createWildsShadows(scene, { atmosphere, paints }) {
  const owned = !scene.getLightByName('wilds-sun'), sun = scene.getLightByName('wilds-sun') ?? new DirectionalLight('wilds-sun', Vector3.FromArray(atmosphere.sun).scaleInPlace(-1), scene);
  if (owned) sun.intensity = 0;
  sun.autoUpdateExtends = false; sun.autoCalcShadowZBounds = false;
  sun.shadowFrustumSize = WILDS_SHADOW.reach * 2; sun.shadowMinZ = 1; sun.shadowMaxZ = WILDS_SHADOW.depth;
  const generator = new ShadowGenerator(WILDS_SHADOW.size, sun, true);
  generator.bias = WILDS_SHADOW.bias; generator.normalBias = 0.02; generator.usePoissonSampling = true;
  const map = generator.getShadowMap(), field = new Vector4(0, 0, WILDS_SHADOW.reach - WILDS_SHADOW.fade, WILDS_SHADOW.reach), form = new Vector3(1 / WILDS_SHADOW.size, 0, WILDS_SHADOW.bias);
  const texel = WILDS_SHADOW.reach * 2 / WILDS_SHADOW.size, toward = new Vector3(), right = new Vector3(), up = new Vector3();
  let known = -1, disposed = false;
  function setTheme(next) {
    Vector3.FromArrayToRef(next.sun, 0, toward); toward.scaleInPlace(-1).normalize();
    sun.direction.copyFrom(toward);
    Vector3.CrossToRef(Vector3.UpReadOnly, toward, right); right.normalize(); Vector3.CrossToRef(toward, right, up);
    form.y = next.shadowStrength; generator.darkness = 1 - next.shadowStrength * .55;
  }
  function follow(x, y, z) {
    const across = Math.round((x * right.x + y * right.y + z * right.z) / texel) * texel, along = Math.round((x * up.x + y * up.y + z * up.z) / texel) * texel, deep = x * toward.x + y * toward.y + z * toward.z - WILDS_SHADOW.depth / 2;
    sun.position.set(right.x * across + up.x * along + toward.x * deep, right.y * across + up.y * along + toward.y * deep, right.z * across + up.z * along + toward.z * deep);
    field.x = x; field.y = z;
  }
  const watch = scene.onBeforeRenderObservable.add(() => {
    if (scene.meshes.length !== known) {
      known = scene.meshes.length;
      map.renderList = scene.meshes.filter(castsShadow);
      for (const mesh of map.renderList) if (!mesh.metadata?.world) mesh.receiveShadows = true;
    }
    for (const paint of paints) { paint.setMatrix('shadowMatrix', generator.getTransformMatrix()); paint.setVector4('shadowField', field); paint.setVector3('shadowForm', form); }
  });
  for (const paint of paints) paint.setTexture('shadowMap', map);
  setTheme(atmosphere); follow(0, 0, 0);
  return {
    sun, generator, setTheme, follow,
    casters: () => (disposed ? [] : map.renderList.map(mesh => mesh.name)),
    dispose() {
      if (disposed) return;
      disposed = true; scene.onBeforeRenderObservable.remove(watch); generator.dispose();
      if (owned) sun.dispose();
    },
  };
}
