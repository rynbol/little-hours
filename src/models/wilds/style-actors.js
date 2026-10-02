import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/core/Shaders/ShadersInclude/bonesDeclaration.js';
import '@babylonjs/core/Shaders/ShadersInclude/bonesVertex.js';
import '@babylonjs/loaders/glTF/index.js';
import { createContactShadow } from '../furniture.js';
import { worldAtmosphere } from '../world/atmosphere.js';
import { WORLD_GLSL, AIR_UNIFORMS, applyAir, followEye } from '../world/world-glsl.js';

export const STYLE_ACTOR_DEFINITIONS = Object.freeze({
  avatar: Object.freeze({ file: 'style-avatar.glb', height: 1.75, shadow: [.42, .28], softness: .23, strength: .27 }),
  cat: Object.freeze({ file: 'style-cat.glb', height: .7, shadow: [.35, .68], softness: .2, strength: .25 }),
  warden: Object.freeze({ file: 'style-warden.glb', height: 3, shadow: [1.1, 1.8], softness: .38, strength: .24 }),
});

const STYLE_VERTEX = `precision highp float;
attribute vec3 position, normal;
uniform mat4 world, viewProjection;
varying vec3 vWorld, vNormal;
#ifdef VERTEXCOLOR
attribute vec4 color; varying vec4 vColor;
#endif
#include<bonesDeclaration>
void main() {
  mat4 finalWorld = world;
  #include<bonesVertex>
  vec4 point = finalWorld * vec4(position, 1.);
  mat3 normalWorld = mat3(finalWorld);
  vec3 corrected = normal / vec3(dot(normalWorld[0], normalWorld[0]), dot(normalWorld[1], normalWorld[1]), dot(normalWorld[2], normalWorld[2]));
  vWorld = point.xyz; vNormal = normalize(normalWorld * corrected);
  #ifdef VERTEXCOLOR
  vColor = color;
  #endif
  gl_Position = viewProjection * point;
}`;

const STYLE_FRAGMENT = `precision highp float;
varying vec3 vWorld, vNormal;
#ifdef VERTEXCOLOR
varying vec4 vColor;
#endif
uniform vec3 albedo, emission, eye, sun, keyColor, skyFill, groundFill, fogNear, fogFar, fogSun;
uniform float rimStrength, sunStrength, opacity, fogDensity, fogHeight;
${WORLD_GLSL}
vec3 displayColor(vec3 radiance) {
  vec3 positive = max(radiance, vec3(0.));
  return mix(positive * 12.92, 1.055 * pow(positive, vec3(1. / 2.4)) - .055, step(vec3(.0031308), positive));
}
void main() {
  vec3 n = normalize(vNormal), v = normalize(eye - vWorld);
  float facing = dot(n, sun);
  float middle = smoothstep(.11, .19, facing), light = smoothstep(.54, .62, facing);
  vec3 skyAxis = normalize(vec3(-sun.x * .4, 1., -sun.z * .4));
  float skyAmount = .32 + .48 * (.5 + .5 * dot(n, skyAxis));
  float groundAmount = .18 * (.5 - .5 * n.y);
  vec3 fill = skyFill * skyAmount + groundFill * groundAmount;
  vec3 tone = fill + keyColor * sunStrength * (.24 * middle + .26 * light);
  float rim = pow(1. - max(0., dot(n, v)), 3.) * smoothstep(-.2, .7, facing) * rimStrength;
  vec3 base = albedo;
  #ifdef VERTEXCOLOR
  base *= vColor.rgb;
  #endif
  vec3 color = displayColor(base * tone + keyColor * rim + emission);
  gl_FragColor = vec4(worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), opacity);
}`;

export function createStylePaint(scene, source, theme = 'day') {
  const paint = new ShaderMaterial(`wilds-style-${source.name}`, scene, { vertexSource: STYLE_VERTEX, fragmentSource: STYLE_FRAGMENT }, {
    attributes: ['position', 'normal'], uniforms: ['world', 'viewProjection', 'albedo', 'emission', 'keyColor', 'skyFill', 'groundFill', 'sunStrength', 'rimStrength', 'opacity', ...AIR_UNIFORMS],
    needAlphaBlending: source.alpha < 1,
  });
  const albedo = source.albedoColor?.clone() ?? source.diffuseColor?.toLinearSpace(true) ?? Color3.White();
  paint.setColor3('albedo', albedo);
  paint.setColor3('emission', source.emissiveColor?.clone() ?? Color3.Black());
  paint.setFloat('opacity', source.alpha ?? 1);
  paint.backFaceCulling = source.backFaceCulling;
  paint.metadata = { styleFrame: true, authoredMaterial: source.name, albedo: albedo.toGammaSpace(true).asArray(), colorSpace: 'linear', bones: true };
  followEye(scene, paint, true);
  function setTheme(next) {
    const atmosphere = worldAtmosphere(next);
    applyAir(paint, atmosphere);
    const linear = key => Color3.FromHexString(atmosphere[key]).toLinearSpace(true);
    const tint = (color, amount) => {
      const luminance = color.r * .2126 + color.g * .7152 + color.b * .0722;
      return Color3.Lerp(Color3.White(), color.scale(1 / Math.max(.02, luminance)), amount);
    };
    paint.setColor3('keyColor', linear('sunColor'));
    paint.setColor3('skyFill', tint(Color3.Lerp(linear('skyAmbient'), linear('shadowTint'), .2), .35));
    paint.setColor3('groundFill', tint(Color3.Lerp(linear('groundAmbient'), linear('dirt'), .65), .45));
    paint.setFloat('sunStrength', atmosphere.sunStrength);
    paint.setFloat('rimStrength', { day: .16, dusk: .2, rain: .1 }[next] ?? .16);
  }
  setTheme(theme);
  return { paint, setTheme };
}

function groundShadow(shadow, authored, position, yaw, surfaceAt) {
  const transform = Matrix.RotationY(yaw), positions = authored.slice();
  for (let i = 0; i < positions.length; i += 3) {
    const offset = Vector3.TransformCoordinates(Vector3.FromArray(authored, i), transform);
    positions[i] = position.x + offset.x;
    positions[i + 2] = position.z + offset.z;
    positions[i + 1] = (surfaceAt(positions[i], positions[i + 2])?.height ?? position.y) + .012;
  }
  shadow.setVerticesData(VertexBuffer.PositionKind, positions);
  shadow.refreshBoundingInfo();
}

async function loadActor(scene, id, { theme, signal, loadContainer }) {
  const definition = STYLE_ACTOR_DEFINITIONS[id];
  let container, root, shadow;
  const paints = [];
  try {
    container = await loadContainer(`${import.meta.env?.BASE_URL ?? '/'}wilds/${definition.file}`, scene, { pluginExtension: '.glb', pluginOptions: { gltf: { animationStartMode: 0 } } });
    if (signal?.aborted || scene.isDisposed) throw new DOMException('Style actor creation cancelled', 'AbortError');
    const clips = new Map(container.animationGroups.map(group => [group.name, group]));
    if (!clips.has('idle')) throw new Error(`The style ${id} is missing its authored idle clip`);
    root = new TransformNode(`wilds-style-${id}`, scene);
    container.addAllToScene();
    for (const node of container.rootNodes) node.parent = root;
    const materials = new Map();
    const painted = source => {
      if (!materials.has(source)) {
        const entry = createStylePaint(scene, source, theme);
        paints.push(entry); materials.set(source, entry.paint);
      }
      return materials.get(source);
    };
    for (const mesh of container.meshes) {
      mesh.isPickable = false;
      if (!mesh.material) continue;
      if (mesh.material.subMaterials) mesh.material.subMaterials = mesh.material.subMaterials.map(painted);
      else mesh.material = painted(mesh.material);
    }
    for (const group of clips.values()) group.stop();
    const idle = clips.get('idle');
    idle.start(true, 1); idle.pause(); idle.goToFrame(idle.from);
    shadow = createContactShadow(`wilds-style-${id}-contact`, ...definition.shadow, scene, { soft: definition.softness, strength: definition.strength });
    const shadowPositions = shadow.getVerticesData(VertexBuffer.PositionKind).slice();
    let disposed = false, pose = null;
    function place({ x, z, yaw = 0 }, surfaceAt) {
      if (disposed) return false;
      const support = surfaceAt(x, z);
      if (!support) return false;
      const radius = id === 'warden' ? .65 : .25;
      const dx = (surfaceAt(x + radius, z)?.height ?? support.height) - (surfaceAt(x - radius, z)?.height ?? support.height);
      const dz = (surfaceAt(x, z + radius)?.height ?? support.height) - (surfaceAt(x, z - radius)?.height ?? support.height);
      const normal = new Vector3(-dx, radius * 2, -dz).normalize();
      root.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), normal, new Quaternion()).multiply(Quaternion.RotationAxis(Vector3.Up(), yaw));
      root.position.set(x, support.height + .006, z);
      root.computeWorldMatrix(true);
      groundShadow(shadow, shadowPositions, root.position, yaw, surfaceAt);
      pose = { x, y: root.position.y, z, yaw, normal: normal.asArray().map(value => value || 0) };
      return true;
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      shadow.dispose(); container.dispose(); root.dispose();
      for (const { paint } of paints) paint.dispose();
    }
    return {
      root, shadow, place,
      setTheme(next) { for (const paint of paints) paint.setTheme(next); },
      setVisible(visible, shadows = true) { root.setEnabled(visible); shadow.setEnabled(visible && shadows); },
      diagnostics: () => ({ id, source: definition.file, pose, height: definition.height, visible: root.isEnabled(), clips: [...clips.keys()], skeletons: container.skeletons.length, materials: paints.map(({ paint }) => ({ ...paint.metadata })), vertices: container.meshes.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0), disposed }),
      dispose,
    };
  } catch (error) {
    shadow?.dispose(); container?.dispose(); root?.dispose();
    for (const { paint } of paints) paint.dispose();
    throw error;
  }
}

export async function loadStyleActors(scene, { theme = 'day', signal, loadContainer = LoadAssetContainerAsync } = {}) {
  const results = await Promise.allSettled(Object.keys(STYLE_ACTOR_DEFINITIONS).map(id => loadActor(scene, id, { theme, signal, loadContainer })));
  const rejected = results.find(result => result.status === 'rejected');
  if (rejected || signal?.aborted || scene.isDisposed) {
    for (const result of results) if (result.status === 'fulfilled') result.value.dispose();
    throw rejected?.reason ?? new DOMException('Style actor creation cancelled', 'AbortError');
  }
  const actors = Object.fromEntries(Object.keys(STYLE_ACTOR_DEFINITIONS).map((id, index) => [id, results[index].value]));
  let disposed = false;
  const observer = scene.onDisposeObservable.add(dispose);
  signal?.addEventListener('abort', dispose, { once: true });
  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.onDisposeObservable.remove(observer); signal?.removeEventListener('abort', dispose);
    for (const actor of Object.values(actors)) actor.dispose();
  }
  return {
    actors,
    place(poses, surfaceAt) { for (const [id, pose] of Object.entries(poses)) actors[id]?.place(pose, surfaceAt); },
    setTheme(next) { for (const actor of Object.values(actors)) actor.setTheme(next); },
    setSubject(subject, { shadows = true } = {}) { for (const [id, actor] of Object.entries(actors)) actor.setVisible(subject === 'group' || subject === id, shadows); },
    diagnostics: () => Object.fromEntries(Object.entries(actors).map(([id, actor]) => [id, actor.diagnostics()])),
    dispose,
  };
}
