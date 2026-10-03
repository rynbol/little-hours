import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

export const SKY = Object.freeze({ zenith: '#6f9fd4', middle: '#a9cbe6', horizon: '#d9e4e2', sun: '#fff1d0', radius: 2800 });

export function buildSky(sunDirection, { time }) {
  const material = new ShaderMaterial({
    side: BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: {
      zenith: { value: new Color(SKY.zenith) }, middle: { value: new Color(SKY.middle) }, horizon: { value: new Color(SKY.horizon) },
      sunColor: { value: new Color(SKY.sun) }, sunDirection: { value: new Vector3().copy(sunDirection).normalize() }, moonDirection: { value: new Vector3(0, 1, 0) }, night: { value: 0 }, cloud: { value: 0 }, rainbow: { value: 0 }, time,
    },
    vertexShader: `varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `uniform vec3 zenith; uniform vec3 middle; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDirection; uniform vec3 moonDirection; uniform float night; uniform float cloud; uniform float rainbow; uniform float time;
varying vec3 vDirection;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float clouds(vec2 p) { float total = 0.0, size = 0.5; for (int i = 0; i < 4; i++) { total += noise(p) * size; p = p * 2.03 + 7.1; size *= 0.5; } return total; }
vec3 spectrum(float t) { return clamp(abs(fract(t * 0.78 + vec3(0.0, 0.6667, 0.3333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
void main() {
  vec3 d = normalize(vDirection);
  float h = d.y;
  vec3 colour = mix(horizon, middle, smoothstep(0.0, 0.18, h));
  colour = mix(colour, zenith, smoothstep(0.18, 0.75, h));
  float toward = max(dot(d, sunDirection), 0.0), day = 1.0 - night, clear = 1.0 - cloud * 0.85;
  colour += sunColor * (pow(toward, 6.0) * 0.18 + pow(toward, 60.0) * 0.35) * day * clear;
  colour = mix(colour, sunColor * 1.3, smoothstep(0.9993, 0.9996, toward) * day * smoothstep(-0.02, 0.01, sunDirection.y) * (1.0 - cloud));
  float up = smoothstep(0.02, 0.3, h);
  vec2 sphere = vec2(atan(d.z, d.x), acos(clamp(d.y, -1.0, 1.0)));
  float lane = dot(d, normalize(vec3(0.42, 0.5, 0.76))), galaxy = exp(-lane * lane * 30.0);
  if (night * galaxy * up > 0.01) {
    vec2 plane = vec2(d.x * 0.8 + d.z * 0.6, d.y + d.z * 0.3);
    float milk = galaxy * smoothstep(0.3, 0.75, clouds(plane * 7.0 + 3.7)) * (1.0 - smoothstep(0.58, 0.7, clouds(plane * 17.0 + 1.1)) * 0.6);
    colour += vec3(0.5, 0.52, 0.78) * milk * 0.2 * night * up * clear;
  }
  vec2 cell = floor(sphere * 260.0);
  float star = step(0.9972 - galaxy * 0.0035, hash(cell)) * (0.55 + 0.45 * sin(time * 1.7 + hash(cell + 3.1) * 40.0));
  colour += vec3(0.95, 0.96, 1.0) * star * night * up * clear;
  float moon = dot(d, moonDirection), disc = smoothstep(0.99955, 0.9997, moon);
  if (disc > 0.0) {
    vec3 right = normalize(cross(moonDirection, vec3(0.0, 1.0, 0.0))), above = cross(right, moonDirection);
    vec2 face = vec2(dot(d, right), dot(d, above)) / 0.0255;
    float limb = sqrt(max(0.0, 1.0 - dot(face, face)));
    float maria = smoothstep(0.45, 0.7, noise(face * 1.7 + 4.0) * 0.65 + noise(face * 4.1 + 1.3) * 0.35);
    vec2 pit = face * 3.2, id = floor(pit), offset = fract(pit) - 0.5 - (vec2(hash(id), hash(id + 9.1)) - 0.5) * 0.35;
    float size = 0.13 + hash(id + 4.7) * 0.16, r = length(offset), crater = step(0.4, hash(id + 2.3));
    float bowl = smoothstep(size, size * 0.55, r) * crater, lip = (smoothstep(size * 1.35, size, r) - smoothstep(size, size * 0.8, r)) * crater;
    vec3 surface = vec3(0.92, 0.94, 1.0) * (0.7 + 0.3 * limb) * (1.0 - maria * 0.24) * (1.0 - bowl * 0.2 + lip * 0.08);
    colour = mix(colour, surface, disc * night * (1.0 - cloud * 0.7));
  }
  colour += vec3(0.32, 0.4, 0.6) * pow(max(moon, 0.0), 40.0) * 0.35 * night;
  if (h > 0.0) {
    vec2 at = d.xz / (h + 0.18) * 1.6 + vec2(time * 0.006, time * 0.002);
    float shape = clouds(at), cover = mix(0.52, 0.26, cloud), band = smoothstep(cover, cover + 0.14, shape), lit = smoothstep(0.5, 0.8, clouds(at + sunDirection.xz * 0.12));
    float rim = band * (1.0 - smoothstep(cover + 0.05, cover + 0.2, shape));
    vec3 cloudColour = mix(vec3(0.98, 0.93, 0.86), vec3(0.79, 0.81, 0.9), lit * 0.8) * mix(vec3(1.0), horizon * 1.1, 0.35) + sunColor * pow(toward, 4.0) * 0.25 * day;
    cloudColour += sunColor * rim * (pow(toward, 3.0) * 1.4 + 0.12) * day * clear;
    cloudColour = mix(cloudColour, middle * 0.75 + vec3(0.02, 0.03, 0.05), night);
    cloudColour = mix(cloudColour, horizon * mix(0.62, 0.95, lit), cloud * 0.75);
    colour = mix(colour, cloudColour, band * smoothstep(0.02, 0.16, h) * mix(mix(0.85, 0.6, night), 0.97, cloud));
    float arc = acos(clamp(dot(d, -sunDirection), -1.0, 1.0)), across = (arc - 0.7) / 0.036;
    float bow = rainbow * smoothstep(0.0, 0.06, h) * (1.0 - smoothstep(0.35, 0.6, h));
    colour += spectrum(1.0 - clamp(across, 0.0, 1.0)) * sin(clamp(across, 0.0, 1.0) * 3.14159) * 0.3 * bow;
    colour += vec3(0.05, 0.05, 0.045) * step(arc, 0.7) * bow;
  }
  gl_FragColor = vec4(colour, 0.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  const mesh = new Mesh(new SphereGeometry(SKY.radius, 32, 16), material);
  mesh.frustumCulled = false; mesh.renderOrder = 10; mesh.name = 'wilds-sky';
  return mesh;
}
