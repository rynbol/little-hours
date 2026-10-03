import { BufferAttribute, BufferGeometry, Color, DepthTexture, HalfFloatType, MathUtils, Matrix4, Mesh, OrthographicCamera, ShaderMaterial, Vector2, Vector3, WebGLRenderTarget } from 'three';

export const POST = Object.freeze({ samples: 4, shrink: 4, threshold: 1.5, bloom: 0.2, shafts: 0.42, rays: 36, reach: 0.55, vignette: 0.26, moonlit: 0.45 });
export const AERIAL = Object.freeze({ density: 0.0018, falloff: 0.008, floor: -10, start: 40, strength: 1, bright: 0.9, blue: 0.8, lowSun: 0.12, highSun: 0.4, sunward: 0.55, tint: '#9db8de' });

const SCREEN = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function pass(fragmentShader, uniforms) {
  return new ShaderMaterial({ vertexShader: SCREEN, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
}

const BRIGHT = `uniform sampler2D scene; uniform vec2 texel; uniform float exposure; uniform float threshold; uniform vec2 sun; uniform float aspect; uniform float reach; varying vec2 vUv;
void main() {
  vec4 total = vec4(0.0);
  for (int i = 0; i < 4; i++) total += texture2D(scene, vUv + texel * vec2(i == 1 || i == 3 ? 1.0 : -1.0, i >= 2 ? 1.0 : -1.0));
  total *= 0.25;
  float sky = 1.0 - clamp(total.a, 0.0, 1.0);
  vec3 colour = total.rgb * mix(exposure, 1.6, sky);
  float light = dot(colour, vec3(0.2126, 0.7152, 0.0722));
  vec3 bloom = colour * smoothstep(threshold * 0.7, threshold * 1.6, light);
  vec2 away = (vUv - sun) * vec2(aspect, 1.0);
  float near = 1.0 - smoothstep(0.0, reach, length(away));
  gl_FragColor = vec4(bloom, sky * near * near * smoothstep(0.35, 1.0, light));
}`;

const BLUR = `uniform sampler2D source; uniform vec2 step; varying vec2 vUv;
void main() {
  vec4 total = texture2D(source, vUv) * 0.227;
  total += (texture2D(source, vUv + step * 1.385) + texture2D(source, vUv - step * 1.385)) * 0.316;
  total += (texture2D(source, vUv + step * 3.231) + texture2D(source, vUv - step * 3.231)) * 0.0703;
  gl_FragColor = total;
}`;

const SHAFTS = `uniform sampler2D source; uniform vec2 sun; varying vec2 vUv;
void main() {
  vec2 delta = (vUv - sun) / ${POST.rays.toFixed(1)} * 0.9, at = vUv;
  float total = 0.0, weight = 1.0;
  for (int i = 0; i < ${POST.rays}; i++) { at -= delta; total += texture2D(source, at).a * weight; weight *= 0.965; }
  gl_FragColor = vec4(vec3(total / ${POST.rays.toFixed(1)}), 1.0);
}`;

const FINAL = `uniform sampler2D scene; uniform sampler2D bloom; uniform sampler2D shafts; uniform float exposure; uniform float bloomStrength; uniform vec3 shaftColour; uniform vec3 lift; uniform vec3 gain; uniform float saturation; uniform float vignette; uniform float moonlit; uniform sampler2D depth; uniform mat4 unproject; uniform mat4 toWorld; uniform vec3 eye; uniform vec3 hazeColour; uniform vec3 hazeSun; uniform vec3 sunDirection; uniform float hazeStrength; uniform float hazeDensity; varying vec2 vUv;
vec3 aerial(vec3 colour, float alpha) {
  float d = texture2D(depth, vUv).r;
  vec4 view = unproject * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec3 ray = (toWorld * vec4(view.xyz / view.w, 1.0)).xyz - eye;
  float dist = length(ray), rise = ray.y * ${AERIAL.falloff};
  float column = abs(rise) > 0.001 ? (1.0 - exp(-rise)) / rise : 1.0;
  float amount = 1.0 - exp(-hazeDensity * exp(-(eye.y - ${AERIAL.floor.toFixed(1)}) * ${AERIAL.falloff}) * max(dist - ${AERIAL.start.toFixed(1)}, 0.0) * column);
  vec3 tint = mix(hazeColour, hazeSun, pow(max(dot(ray / max(dist, 0.001), sunDirection), 0.0), 6.0) * ${AERIAL.sunward});
  return mix(colour, tint, amount * hazeStrength * step(0.5, alpha));
}
vec3 fit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 colour) {
  const mat3 into = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 back = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  return clamp(back * fit(into * (colour * exposure / 0.6)), 0.0, 1.0);
}
void main() {
  vec4 source = texture2D(scene, vUv);
  source.rgb = aerial(source.rgb, source.a);
  vec3 colour = mix(source.rgb, aces(source.rgb), clamp(source.a, 0.0, 1.0));
  colour += texture2D(bloom, vUv).rgb * bloomStrength + texture2D(shafts, vUv).r * shaftColour;
  colour = lift + colour * (gain - lift);
  float grey = dot(colour, vec3(0.2126, 0.7152, 0.0722));
  colour = max(mix(vec3(grey), colour, saturation), 0.0);
  colour = mix(colour, grey * vec3(0.8, 0.96, 1.3), moonlit * (1.0 - smoothstep(0.04, 0.45, grey)) * (1.0 - smoothstep(0.01, 0.1, colour.r - colour.b)));
  vec2 edge = vUv - 0.5;
  colour *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(edge, edge) * 2.0);
  gl_FragColor = vec4(colour, 1.0);
  #include <colorspace_fragment>
}`;

export function createPost(renderer) {
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: POST.samples, depthTexture: new DepthTexture(1, 1) });
  const small = () => new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
  const bright = small(), blurred = small(), rays = small();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const screen = new Mesh(geometry), camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  screen.frustumCulled = false;
  const sun = new Vector2(0.5, 0.5);
  const brightPass = pass(BRIGHT, { scene: { value: target.texture }, texel: { value: new Vector2() }, exposure: { value: 1 }, threshold: { value: POST.threshold }, sun: { value: sun }, aspect: { value: 1 }, reach: { value: POST.reach } });
  const blurPass = pass(BLUR, { source: { value: null }, step: { value: new Vector2() } });
  const shaftPass = pass(SHAFTS, { source: { value: bright.texture }, sun: { value: sun } });
  const finalPass = pass(FINAL, {
    scene: { value: target.texture }, bloom: { value: bright.texture }, shafts: { value: rays.texture }, exposure: { value: 1 }, bloomStrength: { value: POST.bloom },
    shaftColour: { value: new Color() }, lift: { value: new Color(0, 0, 0) }, gain: { value: new Color(1, 1, 1) }, saturation: { value: 1 }, vignette: { value: POST.vignette }, moonlit: { value: 0 },
    depth: { value: target.depthTexture }, unproject: { value: new Matrix4() }, toWorld: { value: new Matrix4() }, eye: { value: new Vector3() }, hazeColour: { value: new Color() }, hazeSun: { value: new Color() }, sunDirection: { value: new Vector3() }, hazeStrength: { value: AERIAL.strength }, hazeDensity: { value: AERIAL.density },
  });
  const passes = [brightPass, blurPass, shaftPass, finalPass];
  const projected = new Vector3(), white = new Color(1, 1, 1), blue = new Color(AERIAL.tint);
  let shaftsOn = false;

  function draw(material, output) {
    screen.material = material;
    renderer.setRenderTarget(output);
    renderer.render(screen, camera);
  }

  return {
    target,
    resize(width, height) {
      target.setSize(width, height);
      const w = Math.max(1, Math.round(width / POST.shrink)), h = Math.max(1, Math.round(height / POST.shrink));
      for (const rt of [bright, blurred, rays]) rt.setSize(w, h);
      brightPass.uniforms.texel.value.set(1 / width, 1 / height);
      brightPass.uniforms.aspect.value = width / height;
    },
    grade(light, camera3d) {
      brightPass.uniforms.exposure.value = light.exposure; finalPass.uniforms.exposure.value = light.exposure;
      projected.copy(camera3d.position).addScaledVector(light.sun, 1000).project(camera3d);
      const ahead = projected.z < 1, off = Math.max(Math.abs(projected.x), Math.abs(projected.y));
      const strength = POST.shafts * (1 - light.night) * (1 - light.cloud) * (ahead ? 1 - Math.min(1, Math.max(0, (off - 1) / 0.6)) : 0) * Math.min(1, Math.max(0, light.sun.y * 6));
      sun.set(projected.x * 0.5 + 0.5, projected.y * 0.5 + 0.5);
      shaftsOn = strength > 0.01;
      finalPass.uniforms.shaftColour.value.copy(light.glow).multiplyScalar(strength);
      finalPass.uniforms.gain.value.copy(white).lerp(light.glow, 0.12);
      finalPass.uniforms.lift.value.copy(light.fog).multiplyScalar(0.03);
      finalPass.uniforms.saturation.value = 1.08 - light.cloud * 0.22 - light.night * 0.1;
      finalPass.uniforms.moonlit.value = light.night * POST.moonlit;
      const { unproject, toWorld, eye, hazeColour, hazeSun, sunDirection, hazeStrength, hazeDensity } = finalPass.uniforms;
      camera3d.updateMatrixWorld();
      unproject.value.copy(camera3d.projectionMatrixInverse); toWorld.value.copy(camera3d.matrixWorld); eye.value.setFromMatrixPosition(camera3d.matrixWorld);
      hazeColour.value.copy(light.fog).lerp(blue, AERIAL.blue * (1 - light.night) * MathUtils.smoothstep(light.sun.y, AERIAL.lowSun, AERIAL.highSun)).multiplyScalar(AERIAL.bright);
      hazeSun.value.copy(light.glow).multiplyScalar(AERIAL.bright); sunDirection.value.copy(light.sun);
      hazeStrength.value = AERIAL.strength * (1 - light.night * 0.6); hazeDensity.value = AERIAL.density * light.haze;
    },
    render(scene, camera3d) {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera3d);
      draw(brightPass, bright);
      if (shaftsOn) draw(shaftPass, rays);
      else { renderer.setRenderTarget(rays); renderer.clear(true, false, false); }
      blurPass.uniforms.source.value = bright.texture; blurPass.uniforms.step.value.set(1 / bright.width, 0); draw(blurPass, blurred);
      blurPass.uniforms.source.value = blurred.texture; blurPass.uniforms.step.value.set(0, 1 / bright.height); draw(blurPass, bright);
      draw(finalPass, null);
    },
    compile() {
      for (const [material, output] of [[brightPass, bright], [shaftPass, rays], [blurPass, blurred], [finalPass, null]]) {
        screen.material = material;
        renderer.setRenderTarget(output);
        renderer.compile(screen, camera);
      }
      renderer.setRenderTarget(null);
    },
    get shafts() { return shaftsOn; },
    dispose() {
      for (const rt of [target, bright, blurred, rays]) rt.dispose();
      for (const material of passes) material.dispose();
      geometry.dispose();
    },
  };
}
