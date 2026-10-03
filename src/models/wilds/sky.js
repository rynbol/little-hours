import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Vector3, Color3 } from '@babylonjs/core/Maths/math.js';
import { noiseTexture } from './noise-texture.js';

const VERTEX = `precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main() { vDir = position; vec4 p = worldViewProjection * vec4(position, 1.0); gl_Position = p.xyww; }`;

const FRAGMENT = `precision highp float;
varying vec3 vDir;
uniform sampler2D noise;
uniform vec3 zenith, horizon, glow, sunDir, moonDir, sunColor, fogColor, galaxyAxis;
uniform float time, stars, cover, rainbow, night, shower, haze;
float n1(vec2 p) { return texture2D(noise, p).r; }
float n2(vec2 p) { return texture2D(noise, p).g; }
float hash3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
vec3 spectrum(float t) { return clamp(vec3(abs(t * 6.0 - 3.0) - 1.0, 2.0 - abs(t * 6.0 - 2.0), 2.0 - abs(t * 6.0 - 4.0)), 0.0, 1.0); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y, sd = max(dot(d, sunDir), 0.0), md = max(dot(d, moonDir), 0.0);
  vec3 color = mix(horizon, zenith, pow(smoothstep(-0.03, 0.62, h), 0.55));
  float low = 1.0 - smoothstep(0.0, 0.35, h);
  color = mix(color, glow, low * pow(max(dot(normalize(d.xz + 1e-4), normalize(sunDir.xz + 1e-4)), 0.0), 2.0) * 0.65 * (1.0 - night * 0.6));
  color += sunColor * (pow(sd, 7.0) * 0.32 + pow(sd, 64.0) * 0.55) * (1.0 - shower * 0.7) * (1.0 - night);

  vec3 axis = normalize(galaxyAxis);
  float band = exp(-pow(dot(d, axis) / 0.2, 2.0));
  vec2 sp = vec2(atan(d.z, d.x) / 6.2832, asin(clamp(d.y, -1.0, 1.0)) / 3.1416);
  float dust = smoothstep(0.42, 0.7, n2(sp * vec2(3.0, 6.0) + 0.3));
  vec3 galaxy = mix(vec3(0.42, 0.45, 0.78), vec3(0.95, 0.8, 0.72), smoothstep(0.55, 0.95, band)) * band * (0.25 + 0.6 * n1(sp * vec2(2.0, 4.0))) * (1.0 - dust * 0.7);
  vec3 cell = floor(d * 260.0), local = fract(d * 260.0) - 0.5;
  float seed = hash3(cell), twinkle = 0.65 + 0.35 * sin(time * (1.5 + seed * 4.0) + seed * 40.0);
  float star = step(0.986 - band * 0.012, seed) * smoothstep(0.32, 0.0, length(local + (vec3(hash3(cell + 7.1), hash3(cell + 3.7), hash3(cell + 1.3)) - 0.5) * 0.5));
  vec3 starTint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), hash3(cell + 9.0));
  color += (galaxy * 0.55 + starTint * star * twinkle * 1.4) * stars * smoothstep(0.02, 0.2, h);

  float moonRadius = 0.035, md2 = acos(clamp(dot(d, moonDir), -1.0, 1.0));
  vec3 mx = normalize(cross(moonDir, vec3(0.0, 1.0, 0.0))), my = cross(mx, moonDir);
  vec2 mq = vec2(dot(d, mx), dot(d, my)) / moonRadius;
  float disc = smoothstep(1.0, 0.94, length(mq));
  float craters = n1(mq * 0.18 + 0.4) * 0.6 + n2(mq * 0.4 + 0.1) * 0.4;
  float lit = smoothstep(-0.55, 0.2, dot(normalize(vec3(mq, sqrt(max(0.0, 1.0 - dot(mq, mq))))), normalize(vec3(-0.55, 0.25, 0.8))));
  vec3 moon = vec3(0.98, 0.95, 0.86) * (0.55 + 0.45 * smoothstep(0.35, 0.7, craters)) * (0.12 + 0.88 * lit);
  float moonUp = smoothstep(-0.02, 0.04, moonDir.y);
  color = mix(color, moon * 1.6, disc * moonUp * (0.35 + 0.65 * night));
  color += vec3(0.62, 0.7, 0.95) * pow(md, 300.0) * 0.5 * night * moonUp;

  vec3 lit3 = sunDir.y > -0.1 ? sunColor : vec3(0.55, 0.62, 0.85);
  vec3 cloudDir = sunDir.y > -0.1 ? sunDir : moonDir;
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 0.11 + vec2(time * 0.0016, time * 0.0007);
    float base = n1(uv) * 0.62 + n2(uv * 2.7 + 0.13) * 0.38;
    float density = smoothstep(1.0 - cover, 1.0 - cover + 0.32, base) * smoothstep(0.0, 0.12, h);
    vec2 toward = normalize(cloudDir.xz + 1e-4) * 0.018;
    float shade = smoothstep(1.0 - cover, 1.0 - cover + 0.32, n1(uv + toward) * 0.62 + n2((uv + toward) * 2.7 + 0.13) * 0.38);
    float edge = clamp(density - shade * 0.9 + 0.35, 0.0, 1.0);
    vec3 dark = mix(zenith * 0.55 + horizon * 0.35, vec3(0.42, 0.45, 0.52), shower) * (1.0 - night * 0.65);
    vec3 bright = mix(vec3(1.0), lit3, 0.65) * (1.05 - shower * 0.45) * (1.0 - night * 0.75);
    float lining = pow(max(dot(d, cloudDir), 0.0), 5.0) * (1.0 - density) * 2.2;
    vec3 cloud = mix(dark, bright, edge * 0.85 + 0.15) + lit3 * lining * (1.0 - shower) * (1.0 - night * 0.6);
    float wisps = smoothstep(0.55, 0.85, n2(d.xz / (h + 0.3) * vec2(0.05, 0.2) + time * 0.0004)) * (1.0 - cover) * smoothstep(0.08, 0.4, h);
    color = mix(color, mix(horizon, bright, 0.7) + lit3 * pow(sd, 3.0) * 0.4, wisps * 0.35 * (1.0 - night * 0.8));
    color = mix(color, cloud, density * (0.92 - 0.25 * smoothstep(0.7, 0.98, sd)));
  }

  float bow = degrees(acos(clamp(dot(d, -sunDir), -1.0, 1.0)));
  float arc = smoothstep(39.6, 40.8, bow) * (1.0 - smoothstep(42.2, 43.4, bow));
  color += spectrum(1.0 - clamp((bow - 40.0) / 3.0, 0.0, 1.0)) * arc * rainbow * 0.32 * smoothstep(0.0, 0.18, h);
  color += vec3(0.07) * smoothstep(40.0, 30.0, bow) * rainbow * smoothstep(0.0, 0.2, h);

  color = mix(color, fogColor, (1.0 - smoothstep(-0.02, 0.09 + haze * 0.08, h)) * (0.85 + haze * 0.15));
  gl_FragColor = vec4(color, 1.0);
}`;

const vec = value => new Vector3(value[0], value[1], value[2]);

export function createSky(scene) {
  const material = new ShaderMaterial('wilds-sky', scene, { vertexSource: VERTEX, fragmentSource: FRAGMENT }, {
    attributes: ['position'],
    uniforms: ['worldViewProjection', 'zenith', 'horizon', 'glow', 'sunDir', 'moonDir', 'sunColor', 'fogColor', 'galaxyAxis', 'time', 'stars', 'cover', 'rainbow', 'night', 'shower', 'haze'],
    samplers: ['noise'],
  });
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  material.setTexture('noise', noiseTexture(scene));
  material.setVector3('galaxyAxis', new Vector3(.42, .38, -.82));
  const dome = MeshBuilder.CreateSphere('wilds-sky', { diameter: 100, segments: 24, sideOrientation: 1 }, scene);
  dome.material = material; dome.infiniteDistance = true; dome.isPickable = false; dome.applyFog = false;
  dome.alwaysSelectAsActiveMesh = true;
  dome.renderingGroupId = 0;
  return {
    mesh: dome,
    update(sky, seconds) {
      material.setColor3('zenith', Color3.FromArray(sky.zenith));
      material.setColor3('horizon', Color3.FromArray(sky.horizon));
      material.setColor3('glow', Color3.FromArray(sky.glow));
      material.setColor3('fogColor', Color3.FromArray(sky.fog));
      material.setColor3('sunColor', Color3.FromArray(sky.keyFrom === 'sun' ? sky.key.color : [1, .7, .5]));
      material.setVector3('sunDir', vec(sky.sun));
      material.setVector3('moonDir', vec(sky.moon));
      material.setFloat('time', seconds);
      material.setFloat('stars', sky.stars);
      material.setFloat('cover', sky.clouds);
      material.setFloat('rainbow', sky.rainbow);
      material.setFloat('night', sky.night);
      material.setFloat('shower', sky.shower);
      material.setFloat('haze', sky.haze);
    },
  };
}
