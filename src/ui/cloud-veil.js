const VERTEX = `#version 300 es
in vec2 corner;
void main() { gl_Position = vec4(corner, 0., 1.); }`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 size;
uniform float cover, depth, seed;
uniform vec2 drift, sun;
uniform vec3 lit, shade, rim, sky;
out vec4 color;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * f * (f * (f * 6. - 15.) + 10.);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
const mat2 turn = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p, int octaves) {
  float sum = 0., amp = .5;
  for (int i = 0; i < 5; i++) { if (i >= octaves) break; sum += amp * noise(p); p = turn * p + 7.3; amp *= .5; }
  return sum;
}

float cloud(vec2 uv) {
  vec2 warp = vec2(fbm(uv * .45 + 3.1, 3), fbm(uv * .45 - 8.7, 3)) - .5;
  vec2 q = uv + warp * .7;
  float body = fbm(q * .55, 3);
  float detail = fbm(q * 2.3 + 4.1, 4);
  return body - (1. - detail) * .13;
}

void main() {
  vec2 p = (gl_FragCoord.xy - .5 * size) / size.y;
  float reach = length(vec2(.5 * size.x / size.y, .5));
  float r = clamp(length(p) / reach, 0., 1.);
  float local = clamp(cover * 1.75 - .75 * (1. - r * r), 0., 1.);
  vec3 sum = vec3(0.);
  float alpha = 0.;
  for (int i = 0; i < 3; i++) {
    float z = 1.2 + float(i) * 1.1, range = z - depth * 1.05;
    vec2 uv = p * range * 2.4 + drift * (2.4 / range) + vec2(seed * 17. + float(i) * 31.7, seed * 9. - float(i) * 13.1);
    float d = cloud(uv);
    float toward = cloud(uv + sun * .16);
    float edge = mix(.7, .02, local) + float(i) * .015;
    float a = smoothstep(edge, edge + .14, d);
    a *= smoothstep(.15, .6, range);
    float light = clamp(.72 + (d - toward) * 5.5 + p.y * .18, 0., 1.);
    light = mix(light, .86, smoothstep(.75, 1., local) * .65);
    vec3 tone = mix(shade, lit, light);
    float fringe = smoothstep(edge, edge + .06, d) * (1. - smoothstep(edge + .06, edge + .16, d));
    tone = mix(tone, rim, fringe * light * .35);
    tone = mix(tone, sky, .08 + float(i) * .16);
    sum += (1. - alpha) * a * tone;
    alpha += (1. - alpha) * a;
  }
  float fog = smoothstep(.6, 1., local);
  vec2 haze = p * 1.1 + drift * .5 + seed * 5.;
  vec3 inside = mix(lit, mix(shade, sky, .5), .16 + .22 * (fbm(haze, 4) - .5) - p.y * .1);
  sum += (1. - alpha) * fog * inside;
  alpha += (1. - alpha) * fog;
  float grain = (hash(gl_FragCoord.xy + seed * 100.) - .5) / 255.;
  color = vec4(sum + grain * alpha, alpha);
}`;

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

export function createCloudPainter(resolution = .5) {
  const canvas = document.createElement('canvas');
  canvas.className = 'place-clouds';
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const compile = (type, source) => { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); return shader; };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  let uniforms = null, lost = false;
  canvas.addEventListener('webglcontextlost', () => { lost = true; });
  function link() {
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);
    const corner = gl.getAttribLocation(program, 'corner');
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
    uniforms = Object.fromEntries(['size', 'cover', 'depth', 'seed', 'drift', 'sun', 'lit', 'shade', 'rim', 'sky'].map(name => [name, gl.getUniformLocation(program, name)]));
    return true;
  }
  function draw(plan, frame, width, height) {
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniforms.size, width, height);
    gl.uniform1f(uniforms.cover, frame.cover);
    gl.uniform1f(uniforms.depth, frame.depth);
    gl.uniform1f(uniforms.seed, plan.seed);
    gl.uniform2f(uniforms.drift, frame.drift[0], frame.drift[1]);
    gl.uniform2f(uniforms.sun, plan.sky.sun[0], plan.sky.sun[1]);
    for (const key of ['lit', 'shade', 'rim', 'sky']) gl.uniform3fv(uniforms[key], rgb(plan.sky[key]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  const painter = {
    canvas,
    get usable() { return !lost && (uniforms !== null || link()); },
    paint(plan, frame) {
      if (!painter.usable) return false;
      draw(plan, frame, Math.max(1, Math.round(innerWidth * resolution)), Math.max(1, Math.round(innerHeight * resolution)));
      return true;
    },
    warm(plan) {
      if (!painter.usable) return;
      draw(plan, { cover: 1, depth: .42, drift: [0, 0] }, 1, 1);
      gl.finish();
    },
  };
  return painter;
}
