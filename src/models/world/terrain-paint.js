import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Vector4 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { WORLD } from '../../core/world-terrain.js';
import { GROVE_GLSL, GROVE_UNIFORMS } from './grove-light.js';
import { WORLD_GLSL, AIR_UNIFORMS, applyAir, followEye } from './world-glsl.js';

const GROUND_PALETTE = Object.freeze(['grass', 'grassLight', 'grassWarm', 'grassTip', 'grassFar', 'flowerWhite', 'flowerYellow', 'flowerLilac', 'forestFloor', 'rock', 'rockDark', 'dirt', 'sand', 'snow']);
const GROUND_LIGHT = Object.freeze(['sunColor', 'skyAmbient', 'groundAmbient', 'shadowTint']);
export const RIDGE_UNIFORMS = Object.freeze(['ridgeLight', 'ridgeLift', 'ridgeFog']);
export const GROUND_UNIFORMS = Object.freeze([...AIR_UNIFORMS, ...GROUND_PALETTE, ...GROUND_LIGHT, 'sunStrength', 'shadowLift', 'crestGlow', 'gusts', 'contactShadow', ...RIDGE_UNIFORMS]);
export const WIND = Object.freeze([0.8, -0.6]);
export const CLOUD_SHADOW = Object.freeze({ size: 2600, depth: 0.42 });
export const FAR_ROCK = Object.freeze({ from: 1000, to: 2000, until: 4800, fade: 0.55 });

const glslFloat = value => value.toFixed(3);

const [NEAR_RANGE, MID_RANGE] = WORLD.ranges;
export const RIDGE_FOG = Object.freeze({ crest: 1.2, clear: 0.3, from: 0.75, to: 1.15 });
export const RIDGE_LIFT_GLSL = `uniform vec3 ridgeLight; uniform float ridgeLift, ridgeFog;
vec3 liftRidges(vec3 color, float height, float dist) {
  float crest = ${glslFloat(RIDGE_FOG.crest)} * mix(${glslFloat(NEAR_RANGE.rise)}, ${glslFloat(MID_RANGE.rise)}, smoothstep(${glslFloat(NEAR_RANGE.crest + NEAR_RANGE.width * 0.6)}, ${glslFloat(MID_RANGE.crest - MID_RANGE.width * 0.6)}, dist)), rise = height / crest;
  float band = smoothstep(700., 1500., dist);
  color = mix(color, ridgeLight, ridgeLift * band * (1. - smoothstep(2800., 4800., dist)) * (1. - smoothstep(${glslFloat(RIDGE_FOG.clear)}, .95, rise)));
  return mix(color, fogFar, ridgeFog * band * smoothstep(${glslFloat(RIDGE_FOG.from)}, ${glslFloat(RIDGE_FOG.to)}, rise));
}`;

export function applyRidges(paint, atmosphere) {
  paint.setColor3('ridgeLight', Color3.FromHexString(atmosphere.ridgeLight)); paint.setFloat('ridgeLift', atmosphere.ridgeLift); paint.setFloat('ridgeFog', atmosphere.ridgeFog);
}

function routeGLSL(definition) {
  if (!definition) return `float riverOffset(vec2 p) { return abs(p.y - (${glslFloat(WORLD.river.z)} + sin(p.x / 410.) * ${glslFloat(WORLD.river.sway)} + sin(p.x / 157. + 1.3) * 38.)); }
float pathOffset(vec2 p) {
  float ahead = -p.y;
  return abs(p.x - (-3. - ahead * .6 + sin(ahead / 13.) * 3. + sin(ahead / 37. + 2.) * 3.)) + (1. - smoothstep(5., 8., ahead)) * 99. + smoothstep(260., 340., ahead) * 99.;
}
`;
  const path = definition.path, center = `${glslFloat(path.offset)} + ahead * ${glslFloat(path.drift)}` + path.waves.map(wave => ` + sin(ahead / ${glslFloat(wave.scale)} + ${glslFloat(wave.phase)}) * ${glslFloat(wave.amplitude)}`).join('');
  const shore = definition.water.map(body => `(length((p - vec2(${glslFloat(body.x)}, ${glslFloat(body.z)})) / vec2(${glslFloat(body.radiusX)}, ${glslFloat(body.radiusZ)})) - 1.) * ${glslFloat(Math.min(body.radiusX, body.radiusZ))} + ${glslFloat(WORLD.river.width)}`);
  return `float riverOffset(vec2 p) { return ${shore.reduce((a, b) => `min(${a}, ${b})`, '100000.')}; }
float pathOffset(vec2 p) {
  float ahead = clamp(-p.y, ${glslFloat(path.start)}, ${glslFloat(path.end)});
  return length(vec2(p.x - (${center}), -p.y - ahead)) * ${glslFloat(1.4 / path.width)};
}
`;
}

export function groundGLSL(definition, grove = false) {
  const basins = definition?.water.filter(body => body.basin) ?? [];
  const shore = basins.map(body => `(1. - smoothstep(.1, 1.2, abs(y - ${glslFloat(body.level)}))) * (1. - smoothstep(1., ${glslFloat(1 + body.basin.blend / Math.min(body.radiusX, body.radiusZ))}, length((p - vec2(${glslFloat(body.x)}, ${glslFloat(body.z)})) / vec2(${glslFloat(body.radiusX)}, ${glslFloat(body.radiusZ)}))))`).reduce((a, b) => `max(${a}, ${b})`, '0.');
  return `${WORLD_GLSL}
uniform vec3 eye, sun, fogNear, fogFar, fogSun, sunColor, skyAmbient, groundAmbient, shadowTint;
uniform vec3 grass, grassLight, grassWarm, grassTip, grassFar, flowerWhite, flowerYellow, flowerLilac, forestFloor, rock, rockDark, dirt, sand, snow;
uniform float fogDensity, fogHeight, time, sunStrength, shadowLift, crestGlow, gusts;
uniform vec4 contactShadow;${grove ? '\n' + GROVE_GLSL : ''}
${RIDGE_LIFT_GLSL}
const vec2 windDir = vec2(${glslFloat(WIND[0])}, ${glslFloat(WIND[1])});
${routeGLSL(definition)}float groundGust(vec2 p) {
  float phase = dot(p, windDir) * .16 - time * 1.7 + worldNoise(p / 37.) * 4.;
  return gusts * (.5 + .5 * sin(phase) * sin(phase * .37 + 1.3));
}
float cloudCover(vec2 p) { return worldNoise((p - windDir * time * 7.) / ${glslFloat(CLOUD_SHADOW.size)} + vec2(3.1, 7.7)); }
vec4 groundAlbedo(vec2 p, float y, vec3 n, float canopy, float dist) {
  float near = 1. - smoothstep(30., 240., dist), sharp = 1. - smoothstep(500., 2600., dist);
  float big = worldFbm(p / 150.), warm = worldNoise(p / 320. + vec2(4.3, 9.)), mid = worldNoise(p / 31.), fine = worldNoise(p / ${definition ? '.65' : '4.3'});
  vec3 g = mix(grass * .9, grassLight, smoothstep(.38, .66, big));
  g = mix(g, grassWarm, smoothstep(.6, .78, warm) * .7);
  g *= 1. + (mid - .5) * .22 * (1. - smoothstep(200., 900., dist)) + (fine - .5) * .12 * near;
  if (dist < 400.) {
    float stroke = worldNoise(vec2(dot(p, windDir), dot(p, vec2(-windDir.y, windDir.x)) * 3.) / 2.5);
    float comb = worldNoise(vec2(dot(p, windDir) * .9, dot(p, vec2(-windDir.y, windDir.x)) * 4.) / 1.1);
    g *= 1. + (stroke - .5) * ${definition ? '.045' : '.26'} * smoothstep(8., 20., dist) * (1. - smoothstep(150., 400., dist)) + (comb - .5) * ${definition ? '.035' : '.18'} * smoothstep(20., 45., dist) * (1. - smoothstep(110., 220., dist));
  }
  g = mix(g, grassFar, smoothstep(220., 700., dist) * (1. - smoothstep(2600., 6000., dist)) * .95);
  g = mix(g, forestFloor, smoothstep(.35, .85, canopy));
  if (dist < ${definition ? '240.' : '1100.'}) g = mix(g, mix(grassLight, grassTip, .35) * 1.12, smoothstep(.55, .95, groundGust(p)) * (1. - smoothstep(${definition ? '40., 240.' : '300., 1100.'}, dist)) * (1. - canopy) * ${definition ? '.10' : '.42'});
  float steep = smoothstep(.3, .44, 1. - n.y + (mid - .5) * .16) * (1. - ${glslFloat(FAR_ROCK.fade)} * smoothstep(${glslFloat(FAR_ROCK.from)}, ${glslFloat(FAR_ROCK.to)}, dist) * (1. - smoothstep(${glslFloat(FAR_ROCK.until - 1000)}, ${glslFloat(FAR_ROCK.until)}, dist)));
  if (steep > 0.) {
    float layer = y / 19. + worldNoise(p / 90.) * 1.6 + worldNoise(p / 17.) * .35, band = fract(layer), id = floor(layer);
    vec3 stone = mix(rockDark, rock, mix(.65, smoothstep(.0, .5, band) * .45 + .55 * worldNoise(p / 25. + id), sharp)) * mix(.9, 1.1, worldHash(vec2(id, 3.)));
    stone = mix(stone, stone * vec3(1.12, 1., .84), step(.72, worldHash(vec2(id, 7.))) * .7 * sharp);
    stone *= .93 + (fine - .5) * .14 * near;
    float ledge = smoothstep(.8, .93, band) * smoothstep(.42, .62, n.y) * sharp;
    g = mix(g, mix(stone, g * .92, ledge), steep);
  }
  float bank = ${basins.length ? shore : `(1. - smoothstep(${glslFloat(WORLD.river.width * 0.75)}, ${glslFloat(WORLD.river.width * 1.6)}, riverOffset(p) + (mid - .5) * 14.))`} * (1. - steep);
  g = mix(g, ${basins.length ? 'mix(dirt, sand, .12 + worldNoise(p / 6.) * .12) * .86' : 'mix(dirt, sand, smoothstep(.3, .7, fine * .5 + mid * .5))'}, bank);
  float track = pathOffset(p) + (fine - .5) * .6 + (mid - .5) * .5, trail = 1. - smoothstep(1., 1.7, track);
  g = mix(g, mix(g, grassWarm, ${definition ? '.16' : '.55'}) * ${definition ? '1.' : '1.04'}, (1. - smoothstep(1.6, 3.2, track)) * (1. - steep));
  g = mix(g, mix(dirt, sand, .12) * (.76 + .14 * fine), trail * (1. - steep));
  float frost = smoothstep(560., 640., y + (big - .5) * 70.) * smoothstep(.45, .7, n.y);
  return vec4(mix(g, mix(snow, rock * 1.18, smoothstep(2500., 7000., dist)), frost), steep * (1. - frost));
}
float contactShade(vec2 p) {
  if (contactShadow.w <= 0.) return 1.;
  vec2 delta = (p - contactShadow.xy) / vec2(contactShadow.z, contactShadow.z * .72);
  return 1. - exp(-dot(delta, delta) * 2.4) * contactShadow.w;
}
vec3 groundLight(vec3 n, float occlusion) {
  float lit = smoothstep(-.12, .14 + .3 * sun.y, dot(n, sun)) * (1. - occlusion);
  vec3 ambient = mix(groundAmbient, skyAmbient, n.y * .5 + .5);
  vec3 shade = mix(shadowTint, ambient, .5) * (.62 + shadowLift) * vec3(.94, 1.04, .98);
  return mix(shade, max(sunColor * sunStrength + shade * .3, shade * 1.08), lit);
}
vec3 rockPlanes(vec3 n, vec2 p, float y, float rocky) {
  if (rocky <= 0.) return n;
  vec2 q = vec2(p.x + p.y, y) / 11.;
  vec3 tilt = vec3(worldNoise(q) - .5, 0., worldNoise(q + 5.3) - .5);
  return normalize(n + tilt * 1.1 * rocky);
}`;

}

export const GROUND_GLSL = groundGLSL();

const TERRAIN_VERTEX = `precision highp float;
attribute vec3 position, normal; attribute vec4 color; uniform mat4 world, viewProjection;
varying vec3 vWorld, vNormal; varying vec4 vCover;
void main() { vec4 p = world * vec4(position, 1.); vWorld = p.xyz; vNormal = normal; vCover = color; gl_Position = viewProjection * p; }`;

const terrainFragment = (definition, grove) => `precision highp float;
varying vec3 vWorld, vNormal; varying vec4 vCover;
${groundGLSL(definition, grove)}
void main() {
  vec3 n = normalize(vNormal);
  float dist = distance(vWorld, eye);
  ${grove ? 'vec4 grove = groveAt(vWorld.xz, vCover.r);' : ''}
  vec4 ground = groundAlbedo(vWorld.xz, vWorld.y, normalize(mix(n, vec3(0., 1., 0.), vCover.b) - vec3(0., (1. - vCover.a) * (1. - vCover.b) * .8, 0.)), ${grove ? 'grove.a * .55' : 'vCover.r'}, dist);
  float cover = cloudCover(vWorld.xz), shade = smoothstep(.5, .8, cover) * smoothstep(250., 600., dist);
  vec3 color = ground.rgb * mix(vec3(1.), vec3(1.14, 1.06, .88), (1. - vCover.a) * ground.a) * groundLight(rockPlanes(n, vWorld.xz, vWorld.y, ground.a), max(smoothstep(.45, .9, vCover.r) * .7, shade * ${glslFloat(CLOUD_SHADOW.depth)}));
  ${grove ? 'color = groveLight(ground.rgb, n, grove);' : ''}
  color *= 1. + smoothstep(.36, .16, cover) * smoothstep(200., 500., dist) * (1. - smoothstep(3000., 6000., dist)) * .2;
  float crest = pow(1. - abs(dot(n, normalize(eye - vWorld))), 2.) * smoothstep(.3, .7, dot(n, sun)) * (1. - shade);
  color += sunColor * sunStrength * crest * crestGlow * ground.rgb * ${grove ? '.45 * grove.r' : '1.6'};
  color *= contactShade(vWorld.xz);
  gl_FragColor = vec4(liftRidges(worldAir(color, vWorld, eye, sun, fogNear, fogFar, fogSun, fogDensity, fogHeight), vWorld.y, dist), 1.);
}`;

export function applyGround(paint, atmosphere) {
  applyAir(paint, atmosphere);
  for (const key of [...GROUND_PALETTE, ...GROUND_LIGHT]) paint.setColor3(key, Color3.FromHexString(atmosphere[key]));
  paint.setFloat('sunStrength', atmosphere.sunStrength); paint.setFloat('shadowLift', atmosphere.shadowLift); paint.setFloat('crestGlow', atmosphere.crestGlow);
  applyRidges(paint, atmosphere);
}

export function createTerrainPaint(scene, { still = false, definition, grove } = {}) {
  const paint = new ShaderMaterial('world-terrain-paint', scene, { vertexSource: TERRAIN_VERTEX, fragmentSource: terrainFragment(definition, !!grove) }, { attributes: ['position', 'normal', 'color'], uniforms: ['world', 'viewProjection', ...GROUND_UNIFORMS, ...(grove ? GROVE_UNIFORMS : [])], samplers: grove ? ['groveField'] : [] });
  grove?.bind(paint);
  paint.backFaceCulling = false;
  paint.setFloat('gusts', still ? 0 : 1);
  const shadow = new Vector4(0, 0, 1, 0); paint.setVector4('contactShadow', shadow);
  followEye(scene, paint, still);
  return { paint, setTheme: atmosphere => applyGround(paint, atmosphere), setContactShadow(x, z, radius, strength) { shadow.set(x, z, radius, strength); paint.setVector4('contactShadow', shadow); } };
}
