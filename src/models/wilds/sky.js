import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

export const SKY = Object.freeze({ zenith: '#6f9fd4', middle: '#a9cbe6', horizon: '#d9e4e2', sun: '#fff1d0', radius: 1500 });

export function buildSky(sunDirection, { time }) {
  const material = new ShaderMaterial({
    side: BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: {
      zenith: { value: new Color(SKY.zenith) }, middle: { value: new Color(SKY.middle) }, horizon: { value: new Color(SKY.horizon) },
      sunColor: { value: new Color(SKY.sun) }, sunDirection: { value: new Vector3().copy(sunDirection).normalize() }, time,
    },
    vertexShader: `varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `uniform vec3 zenith; uniform vec3 middle; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDirection; uniform float time;
varying vec3 vDirection;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float clouds(vec2 p) { float total = 0.0, size = 0.5; for (int i = 0; i < 4; i++) { total += noise(p) * size; p = p * 2.03 + 7.1; size *= 0.5; } return total; }
void main() {
  vec3 d = normalize(vDirection);
  float h = d.y;
  vec3 colour = mix(horizon, middle, smoothstep(0.0, 0.18, h));
  colour = mix(colour, zenith, smoothstep(0.18, 0.75, h));
  float toward = max(dot(d, sunDirection), 0.0);
  colour += sunColor * (pow(toward, 6.0) * 0.18 + pow(toward, 60.0) * 0.35);
  colour = mix(colour, sunColor * 1.3, smoothstep(0.9993, 0.9996, toward));
  if (h > 0.0) {
    vec2 at = d.xz / (h + 0.18) * 1.6 + vec2(time * 0.006, time * 0.002);
    float shape = clouds(at), band = smoothstep(0.52, 0.66, shape), lit = smoothstep(0.5, 0.8, clouds(at + sunDirection.xz * 0.12));
    vec3 cloud = mix(vec3(0.98, 0.93, 0.86), vec3(0.79, 0.81, 0.9), lit * 0.8) + sunColor * pow(toward, 4.0) * 0.25;
    colour = mix(colour, cloud, band * smoothstep(0.02, 0.16, h) * 0.85);
  }
  gl_FragColor = vec4(colour, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  const mesh = new Mesh(new SphereGeometry(SKY.radius, 32, 16), material);
  mesh.frustumCulled = false; mesh.renderOrder = 10; mesh.name = 'wilds-sky';
  return mesh;
}
