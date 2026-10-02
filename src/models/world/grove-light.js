import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { Vector4 } from '@babylonjs/core/Maths/math.vector.js';
import { createTerrainField, noise2, smooth } from '../../core/world-terrain.js';

export const GROVE_FIELD = Object.freeze({ texels: 512, span: 192, travel: 40, snap: 48 });
export const GROVE_UNIFORMS = Object.freeze(['groveBounds', 'groveStrength']);
export const GROVE_GLSL = `
uniform sampler2D groveField;
uniform vec4 groveBounds;
uniform float groveStrength;
vec4 groveAt(vec2 p, float forest) {
  vec2 uv = (p - groveBounds.xy) / groveBounds.z;
  float edge = smoothstep(0., .045, min(min(uv.x, uv.y), min(1. - uv.x, 1. - uv.y))) * groveStrength;
  return mix(vec4(1., 1., 1., forest), texture2D(groveField, clamp(uv, 0., 1.)), edge);
}
vec3 groveLight(vec3 albedo, vec3 n, vec4 grove) {
  float normalLight = max(dot(n, sun), 0.);
  vec3 ambient = mix(groundAmbient, skyAmbient, n.y * .35 + .55);
  vec3 shade = (mix(shadowTint, ambient, .3) * (.66 + shadowLift * .22) + .18) * mix(.82, 1., grove.b);
  vec3 lit = sunColor * sunStrength * (.78 + normalLight * .25) + ambient * .13;
  float shape = mix(.22 + .78 * smoothstep(-.12, .58, dot(n, sun)), 1., smoothstep(.75, .95, n.y));
  float sunlight = smoothstep(.12, .92, grove.r) * shape;
  vec3 irradiance = mix(shade * mix(vec3(.78, .96, 1.08), vec3(1.), grove.b), max(lit, shade * 1.1), sunlight);
  return albedo * irradiance * mix(.48, 1., grove.g);
}
`;

function splat(data, settings, x, z, rx, rz, turn, channel, opacity, seed = 0, broken = false) {
  const { texels, span, minX, minZ } = settings, step = span / texels, reach = Math.max(rx, rz) * 1.22;
  const fromX = Math.max(0, Math.floor((x - reach - minX) / step)), toX = Math.min(texels - 1, Math.ceil((x + reach - minX) / step));
  const fromZ = Math.max(0, Math.floor((z - reach - minZ) / step)), toZ = Math.min(texels - 1, Math.ceil((z + reach - minZ) / step));
  const cosine = Math.cos(turn), sine = Math.sin(turn);
  for (let j = fromZ; j <= toZ; j++) for (let i = fromX; i <= toX; i++) {
    const dx = minX + (i + .5) * step - x, dz = minZ + (j + .5) * step - z;
    const u = (dx * cosine + dz * sine) / rx, v = (-dx * sine + dz * cosine) / rz;
    const distance = u * u + v * v;
    if (distance > 1.45) continue;
    const warp = broken ? noise2((minX + i * step) / 1.7, (minZ + j * step) / 1.7, seed) * .24 : 0;
    let amount = 1 - smooth(.48, 1.1, distance + warp);
    if (broken) {
      const gaps = smooth(-.12, .38, noise2((minX + i * step) / 1.25, (minZ + j * step) / 1.25, seed + 31));
      amount *= .3 + gaps * .7;
    }
    const at = (j * texels + i) * 4 + channel;
    data[at] = Math.round(data[at] * (1 - opacity * amount));
  }
}

export function* groveFieldSteps({ trees, definition, atmosphere, surface, center = { x: 0, z: 0 }, texels = GROVE_FIELD.texels, span = GROVE_FIELD.span }) {
  const minX = center.x - span / 2, minZ = center.z - span / 2, settings = { texels, span, minX, minZ };
  const data = new Uint8Array(texels * texels * 4), field = createTerrainField(definition), step = span / texels;
  data.fill(255);
  for (let j = 0; j < texels; j++) {
    for (let i = 0; i < texels; i++) data[(j * texels + i) * 4 + 3] = Math.round(field.canopyAt(minX + (i + .5) * step, minZ + (j + .5) * step) * 255);
    if (j % 32 === 31) yield;
  }
  const [sunX, sunY, sunZ] = atmosphere.sun, sunHeight = Math.max(.15, sunY), sunTurn = Math.atan2(sunZ, sunX), rainy = atmosphere.theme === 'rain';
  for (let i = 0; i < trees.count; i++) {
    const x = trees.x[i], z = trees.z[i], width = trees.width[i], height = trees.height[i], spreading = trees.kind[i] === 2;
    const rootY = trees.y[i] + width * .5, crownY = trees.y[i] + height * (spreading ? 6.5 : 7.3), reach = width * (spreading ? 6.3 : 4.2);
    if (x < minX - 100 || x > minX + span + 100 || z < minZ - 100 || z > minZ + span + 100) continue;
    splat(data, settings, x, z, width * .95, width * .95, 0, 1, .8);
    const canopyShade = definition.trees?.canopyShade ?? 0;
    splat(data, settings, x, z, reach * .95, reach * .8, trees.turn[i], 2, .27 + canopyShade);
    if (canopyShade) splat(data, settings, x, z, reach * 1.04, reach * .91, trees.turn[i], 0, canopyShade * (rainy ? .6 : 1));
    let fall = crownY - rootY, shadowX = x - sunX * fall / sunHeight, shadowZ = z - sunZ * fall / sunHeight;
    for (let probe = 0; probe < 2; probe++) {
      fall = Math.max(0, crownY - (surface?.(shadowX, shadowZ)?.height ?? field.heightAt(shadowX, shadowZ)));
      shadowX = x - sunX * fall / sunHeight; shadowZ = z - sunZ * fall / sunHeight;
    }
    const elongation = 1 + (1 - sunY) * .58;
    for (let lobe = 0; lobe < 4; lobe++) {
      const angle = trees.turn[i] + lobe * 2.39996, offset = reach * (lobe ? .4 : 0), cx = shadowX + Math.cos(angle) * offset, cz = shadowZ + Math.sin(angle) * offset;
      splat(data, settings, cx, cz, reach * .63 * elongation, reach * .6, sunTurn, 0, rainy ? .22 : .61, 801 + i % 13, true);
    }
    const trunkFall = Math.max(0, height * 3), trunkX = x - sunX * trunkFall / sunHeight, trunkZ = z - sunZ * trunkFall / sunHeight;
    const length = Math.hypot(trunkX - x, trunkZ - z);
    if (length > .1) splat(data, settings, (x + trunkX) * .5, (z + trunkZ) * .5, length * .57, width * .35, sunTurn, 0, rainy ? .14 : .38);
    if (i % 6 === 5) yield;
  }
  for (const rock of definition.rocks) {
    splat(data, settings, rock.x, rock.z, rock.size[0] * .66, rock.size[2] * .66, rock.turn ?? 0, 1, .68);
    const fall = rock.size[1] * .5, sx = rock.x - sunX * fall / sunHeight, sz = rock.z - sunZ * fall / sunHeight;
    splat(data, settings, sx, sz, rock.size[0] * .7, rock.size[2] * .7, rock.turn ?? 0, 0, rainy ? .2 : .48);
  }
  for (const mark of definition.landmarks) if (mark.kind === 'hearth') splat(data, settings, mark.x, mark.z, mark.radius * 1.1, mark.radius * .9, 0, 1, .55);
  return { data, ...settings, center: { ...center } };
}

export function buildGroveField(options) {
  const steps = groveFieldSteps(options);
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}

export function createGroveLight(scene, { definition, atmosphere, surface }) {
  const initial = new Uint8Array(GROVE_FIELD.texels * GROVE_FIELD.texels * 4); initial.fill(255);
  const texture = new RawTexture(initial, GROVE_FIELD.texels, GROVE_FIELD.texels, Constants.TEXTUREFORMAT_RGBA, scene, false, false, Constants.TEXTURE_BILINEAR_SAMPLINGMODE, Constants.TEXTURETYPE_UNSIGNED_BYTE);
  texture.name = 'world-grove-light'; texture.wrapU = texture.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
  const bounds = new Vector4(-GROVE_FIELD.span / 2, -GROVE_FIELD.span / 2, GROVE_FIELD.span, 0), paints = new Set();
  let trees, current = atmosphere, center = { x: 0, z: 0 }, wanted = center, pending = false, disposed = false, timer = null, generation = 0, painted = 0, needsBuild = false;
  const apply = field => {
    if (disposed) return;
    texture.update(field.data); center = field.center; bounds.set(field.minX, field.minZ, field.span, 1); painted++;
    for (const paint of paints) { paint.setVector4('groveBounds', bounds); paint.setFloat('groveStrength', 1); }
  };
  function rebuild() {
    if (disposed || pending || !trees || !needsBuild) return;
    pending = true; needsBuild = false;
    const version = ++generation, steps = groveFieldSteps({ trees, definition, atmosphere: current, surface, center: wanted });
    const tick = () => {
      timer = null;
      if (disposed || version !== generation) return;
      const next = steps.next();
      if (next.done) { apply(next.value); pending = false; rebuild(); }
      else timer = setTimeout(tick, 0);
    };
    timer = setTimeout(tick, 0);
  }
  return {
    bind(paint) { paints.add(paint); paint.setTexture('groveField', texture); paint.setVector4('groveBounds', bounds); paint.setFloat('groveStrength', bounds.w); paint.onDisposeObservable.add(() => paints.delete(paint)); },
    *setTrees(planted) {
      trees = planted;
      const steps = groveFieldSteps({ trees, definition, atmosphere: current, surface, center });
      for (;;) { const next = steps.next(); if (next.done) { apply(next.value); return; } yield; }
    },
    setTheme(next) { if (current.theme === next.theme) return; current = next; needsBuild = true; rebuild(); },
    follow(x, z) {
      if (Math.hypot(x - wanted.x, z - wanted.z) < GROVE_FIELD.travel) return;
      wanted = { x: Math.round(x / GROVE_FIELD.snap) * GROVE_FIELD.snap, z: Math.round(z / GROVE_FIELD.snap) * GROVE_FIELD.snap }; needsBuild = true; rebuild();
    },
    refresh() { needsBuild = true; rebuild(); },
    diagnostics: () => ({ center: { ...center }, pending, painted, texels: GROVE_FIELD.texels, span: GROVE_FIELD.span }),
    dispose() { if (disposed) return; disposed = true; pending = false; needsBuild = false; generation++; if (timer !== null) clearTimeout(timer); texture.dispose(); paints.clear(); },
  };
}
