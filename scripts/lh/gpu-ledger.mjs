export const GPU_LEDGER = `(() => {
  const contexts = new Set(), state = new WeakMap();
  const TEXEL = { 0x881A: 8, 0x8814: 16, 0x8D62: 2, 0x8229: 1, 0x822B: 2, 0x822D: 2, 0x822F: 4, 0x8230: 8, 0x822E: 4, 0x1909: 1, 0x190A: 2, 0x1907: 3, 0x8C41: 3 };
  const texelBytes = format => TEXEL[format] ?? 4;
  const objects = gl => { let entry = state.get(gl); if (!entry) { entry = { sizes: new Map(), buffers: new Map(), textures: new Map(), unit: 0, renderbuffer: null }; state.set(gl, entry); contexts.add(new WeakRef(gl)); } return entry; };
  const record = (gl, object, key, bytes) => { if (!object) return; const sizes = objects(gl).sizes; let parts = sizes.get(object); if (!parts) sizes.set(object, parts = new Map()); parts.set(key, bytes); };
  const boundTexture = (gl, target) => objects(gl).textures.get(objects(gl).unit + ':' + (target >= 0x8515 && target <= 0x851A ? 0x8513 : target));
  const sourceSize = source => [source?.videoWidth || source?.naturalWidth || source?.displayWidth || source?.width || 0, source?.videoHeight || source?.naturalHeight || source?.displayHeight || source?.height || 0];
  const wrap = (proto, name, after) => { const original = proto[name]; if (!original) return; proto[name] = function (...args) { const result = original.apply(this, args); try { after(this, args, result); } catch {} return result; }; };
  for (const proto of [WebGLRenderingContext.prototype, window.WebGL2RenderingContext?.prototype].filter(Boolean)) {
    wrap(proto, 'bindBuffer', (gl, [target, buffer]) => objects(gl).buffers.set(target, buffer));
    wrap(proto, 'bufferData', (gl, [target, data, usage, offset = 0, length]) => record(gl, objects(gl).buffers.get(target), 'data', typeof data === 'number' ? data : length ? length * (data.BYTES_PER_ELEMENT || 1) : data.byteLength - offset * (data.BYTES_PER_ELEMENT || 1)));
    wrap(proto, 'activeTexture', (gl, [unit]) => { objects(gl).unit = unit; });
    wrap(proto, 'bindTexture', (gl, [target, texture]) => objects(gl).textures.set(objects(gl).unit + ':' + target, texture));
    wrap(proto, 'texImage2D', (gl, args) => { const [target, level, format] = args, [w, h] = args.length >= 8 ? [args[3], args[4]] : sourceSize(args[5]); record(gl, boundTexture(gl, target), target + ':' + level, w * h * texelBytes(format)); });
    wrap(proto, 'texImage3D', (gl, [target, level, format, w, h, d]) => record(gl, boundTexture(gl, target), target + ':' + level, w * h * d * texelBytes(format)));
    wrap(proto, 'compressedTexImage2D', (gl, [target, level, , , , , data]) => record(gl, boundTexture(gl, target), target + ':' + level, data?.byteLength ?? 0));
    wrap(proto, 'texStorage2D', (gl, [target, levels, format, w, h]) => { let bytes = 0; for (let i = 0; i < levels; i++) bytes += Math.max(1, w >> i) * Math.max(1, h >> i) * texelBytes(format); record(gl, boundTexture(gl, target), 'storage', bytes * (target === 0x8513 ? 6 : 1)); });
    wrap(proto, 'texStorage3D', (gl, [target, levels, format, w, h, d]) => { let bytes = 0; for (let i = 0; i < levels; i++) bytes += Math.max(1, w >> i) * Math.max(1, h >> i) * d * texelBytes(format); record(gl, boundTexture(gl, target), 'storage', bytes); });
    wrap(proto, 'bindRenderbuffer', (gl, [, renderbuffer]) => { objects(gl).renderbuffer = renderbuffer; });
    wrap(proto, 'renderbufferStorage', (gl, [, format, w, h]) => record(gl, objects(gl).renderbuffer, 'storage', w * h * texelBytes(format)));
    wrap(proto, 'renderbufferStorageMultisample', (gl, [, samples, format, w, h]) => record(gl, objects(gl).renderbuffer, 'storage', w * h * texelBytes(format) * Math.max(1, samples)));
    for (const name of ['deleteBuffer', 'deleteTexture', 'deleteRenderbuffer']) wrap(proto, name, (gl, [object]) => objects(gl).sizes.delete(object));
  }
  window.__gpuLedger = () => {
    let bytes = 0, count = 0, live = 0, attached = 0;
    for (const ref of contexts) {
      const gl = ref.deref();
      if (!gl) { contexts.delete(ref); continue; }
      if (gl.isContextLost()) continue;
      live++; if (gl.canvas.isConnected) attached++;
      for (const parts of state.get(gl).sizes.values()) { count++; for (const size of parts.values()) bytes += size; }
    }
    return { bytes, objects: count, contexts: live, attached };
  };
})();`;
