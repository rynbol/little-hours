export const WORLD_GLSL = `
float worldHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float worldNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(worldHash(i), worldHash(i + vec2(1., 0.)), u.x), mix(worldHash(i + vec2(0., 1.)), worldHash(i + vec2(1., 1.)), u.x), u.y); }
float worldFbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += worldNoise(p) * a; p = p * 2.03 + 17.1; a *= .5; } return s / .9375; }
vec3 worldAir(vec3 color, vec3 world, vec3 eye, vec3 sun, vec3 fogNear, vec3 fogFar, vec3 fogSun, float density, float fogHeight) {
  vec3 ray = world - eye; float d = length(ray); vec3 dir = ray / max(d, 1e-3);
  float heightFade = exp(-max(0., world.y - eye.y * .2) / fogHeight);
  float amount = 1. - exp(-d * density * (.45 + heightFade));
  vec3 air = mix(fogNear, fogFar, smoothstep(200., 4000., d));
  air = mix(air, fogSun, pow(max(dot(dir, sun), 0.), 6.) * .85);
  return mix(color, air, clamp(amount, 0., 1.));
}`;
