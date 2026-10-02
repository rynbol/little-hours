import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { edgePoint, onIsland, ISLAND, STREAMS } from './house-island.js';
import { inPond, DOCK } from './house-pond.js';
import { pathDistance, PATH_WIDTH } from './house-paths.js';
import { forestPathDistance, FOREST_PATH_WIDTH } from './island-forest.js';
import { PLANT_SPOTS } from './garden-model.js';
import { ARBOUR, BENCH, NEST } from './house-garden.js';

const GROUND = -.175;
export const GRASS = Object.freeze({ tries: 60000, height: [.12, .26], width: .05 });
export const HOUSE_YARD = Object.freeze({ minX: -5.6, maxX: 5.3, minZ: -2.65, maxZ: 2.7 });

const hash = n => { const s = Math.sin(n * 91.7 + 17.3) * 43758.5453; return s - Math.floor(s); };

export function grassy(x, z) {
  const { minX, maxX, minZ, maxZ } = HOUSE_YARD;
  return onIsland(x, z, .22) && !inPond(x, z, .3)
    && !(x > minX && x < maxX && z > minZ && z < maxZ)
    && !(Math.abs(x - DOCK.x) < DOCK.width / 2 + .15 && z > DOCK.to - .15 && z < DOCK.from + .3)
    && pathDistance(x, z) > PATH_WIDTH / 2 + .04 && forestPathDistance(x, z) > FOREST_PATH_WIDTH / 2 + .1
    && PLANT_SPOTS.every(([px, pz]) => Math.hypot(x - px, z - pz) > .72)
    && [ARBOUR, BENCH].every(([px, pz]) => Math.hypot(x - px, z - pz) > .5) && Math.hypot(x - NEST[0], z - NEST[1]) > .35
    && STREAMS.flat().every(([sx, sz]) => Math.hypot(x - sx, z - sz) > .34);
}

export function grassBlades() {
  const blades = [], { tries, height: [low, high] } = GRASS;
  for (let i = 0; i < tries; i++) {
    const x = -8 + hash(i) * 21.7, z = -5.4 + hash(i * 1.93 + 4.1) * 10.9;
    if (!grassy(x, z)) continue;
    const patch = Math.sin(x * .8 + z * .35) * .5 + Math.sin(z * 1.6 - x * .45 + 1) * .5;
    blades.push({ x, z, height: low + (high - low) * (.35 + .65 * hash(i * 3.3)) * (.8 + patch * .2), lean: hash(i * 5.1) * Math.PI * 2, tone: hash(i * 7.7), patch });
  }
  return blades;
}

export const RIM_BLADES = 1800;
export function rimBlades() {
  const blades = [], { cx, cz } = ISLAND;
  for (let i = 0; i < RIM_BLADES; i++) {
    const a = (i + hash(i * 2.7) * .8) / RIM_BLADES * Math.PI * 2, [rx, rz] = edgePoint(a), dx = rx - cx, dz = rz - cz, l = Math.hypot(dx, dz);
    const inset = .015 + hash(i * 4.3) * .06, ex = rx - dx / l * inset, ez = rz - dz / l * inset;
    if (STREAMS.some(course => Math.hypot(ex - course.at(-1)[0], ez - course.at(-1)[1]) < .5)) continue;
    const [nx, nz] = edgePoint(a + .01), height = .14 + hash(i * 6.1) * .2;
    blades.push({ x: ex, z: ez, height, lean: Math.atan2(nz - ez, nx - ex), tone: hash(i * 7.9), patch: .2 + hash(i * 1.1) * .5, drop: [dx / l * height * .7, -height * (.55 + hash(i * 3.9) * .5), dz / l * height * .7] });
  }
  return blades;
}

function bladeGeometry(blades) {
  const positions = new Float32Array(blades.length * 9), shape = new Float32Array(blades.length * 9), normals = new Float32Array(blades.length * 9);
  blades.forEach(({ x, z, height, lean, tone, drop }, i) => {
    const w = GRASS.width * (.7 + tone * .6), cx = Math.cos(lean) * w, cz = Math.sin(lean) * w, tip = .06 * height;
    const top = drop ? [x + drop[0], GROUND + drop[1], z + drop[2]] : [x + Math.cos(lean + 1.4) * tip, GROUND + height, z + Math.sin(lean + 1.4) * tip];
    positions.set([x - cx, GROUND, z - cz, x + cx, GROUND, z + cz, ...top], i * 9);
    const phase = tone * 6.28, sway = drop ? height * .4 : height;
    shape.set([phase, 0, sway, phase, 0, sway, phase, 1, sway], i * 9);
    normals.set([0, 1, 0, 0, 1, 0, 0, 1, 0], i * 9);
  });
  return { positions, shape, normals, indices: new Uint32Array(blades.length * 3).map((_, i) => i) };
}

export function bladeColors(blades, tones) {
  const [root, blade, sunlit] = ['root', 'blade', 'sunlit'].map(key => Color3.FromHexString(tones[key]));
  const colors = new Float32Array(blades.length * 12), tip = new Color3(), base = new Color3();
  blades.forEach(({ tone, patch }, i) => {
    const warm = Math.min(1, Math.max(0, .5 + patch * .35 + (tone - .5) * .3)), shade = .9 + tone * .18;
    Color3.LerpToRef(blade, sunlit, warm, tip); tip.scaleToRef(shade, tip); root.scaleToRef(shade, base);
    for (let k = 0; k < 3; k++) { const c = k === 2 ? tip : base; colors.set([c.r, c.g, c.b, 1], i * 12 + k * 4); }
  });
  return colors;
}

class GrassWindPlugin extends MaterialPluginBase {
  constructor(material) { super(material, 'GrassWind', 160, {}, true, true); this.time = 0; this.gustTint = [1, 1, .8]; }
  getClassName() { return 'GrassWindPlugin'; }
  isCompatible(shaderLanguage) { return shaderLanguage === 0; }
  getAttributes(attributes) { attributes.push('grassBlade'); }
  getUniforms() {
    return {
      ubo: [{ name: 'grassTime', size: 1, type: 'float' }, { name: 'grassGust', size: 3, type: 'vec3' }],
      vertex: 'uniform float grassTime;', fragment: 'uniform vec3 grassGust;',
    };
  }
  bindForSubMesh(uniformBuffer) { uniformBuffer.updateFloat('grassTime', this.time); uniformBuffer.updateFloat3('grassGust', ...this.gustTint); }
  getCustomCode(shaderType) {
    if (shaderType === 'vertex') return {
      CUSTOM_VERTEX_DEFINITIONS: 'attribute vec3 grassBlade; varying float vGrassGust;',
      CUSTOM_VERTEX_UPDATE_POSITION: `
        float grassBend = grassBlade.y * grassBlade.y;
        float grassWave = sin(dot(positionUpdated.xz, vec2(.55, .22)) - grassTime * 1.7);
        float grassGustNow = smoothstep(.35, 1., grassWave) * (.6 + .4 * sin(grassTime * .37 + positionUpdated.z * .3));
        float grassFlutter = sin(grassTime * 3.1 + grassBlade.x + positionUpdated.x * 2.3) * .25;
        positionUpdated.xz += vec2(.94, .34) * grassBend * (.035 + grassGustNow * .09 + grassFlutter * .02) * (grassBlade.z * 4.);
        positionUpdated.y -= grassBend * grassGustNow * .03;
        vGrassGust = grassGustNow * grassBlade.y;`,
    };
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: 'varying float vGrassGust;',
      CUSTOM_FRAGMENT_UPDATE_DIFFUSE: 'baseColor.rgb = mix(baseColor.rgb, grassGust, vGrassGust * .4);',
    };
  }
}

export const GRASS_TONES = Object.freeze({
  day: { root: '#5b7f36', blade: '#8fb046', sunlit: '#cfd978', gust: '#e6ec9c' },
  dusk: { root: '#34464c', blade: '#5e7b62', sunlit: '#9fae84', gust: '#b9c49a' },
  rain: { root: '#3f5c44', blade: '#6f9166', sunlit: '#a9c092', gust: '#c2d4ac' },
});

export function createIslandGrass(scene, theme = 'day') {
  const blades = [...grassBlades(), ...rimBlades()], { positions, shape, normals, indices } = bladeGeometry(blades);
  const mesh = new Mesh('island-grass', scene);
  const data = new VertexData(); Object.assign(data, { positions, normals, indices, colors: bladeColors(blades, GRASS_TONES[theme] || GRASS_TONES.day) }); data.applyToMesh(mesh, true);
  mesh.setVerticesData('grassBlade', shape, false, 3);
  const material = new StandardMaterial('island-grass-paint', scene);
  material.diffuseColor = Color3.White(); material.specularColor.setAll(0); material.emissiveColor.setAll(.08); material.backFaceCulling = false;
  const wind = new GrassWindPlugin(material);
  mesh.material = material; mesh.receiveShadows = true; mesh.isPickable = false; mesh.metadata = { castShadow: false }; mesh.alwaysSelectAsActiveMesh = true; mesh.freezeWorldMatrix();
  function setTheme(next) {
    const tones = GRASS_TONES[next] || GRASS_TONES.day;
    mesh.updateVerticesData('color', bladeColors(blades, tones));
    const gust = Color3.FromHexString(tones.gust); wind.gustTint = [gust.r, gust.g, gust.b];
  }
  setTheme(theme);
  return {
    mesh, count: blades.length, setTheme,
    animate(seconds) { wind.time = seconds; },
    dispose() { material.dispose(); mesh.dispose(); },
  };
}
