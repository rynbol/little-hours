const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software/i;
const SOFTWARE_RATIO = 0.6;

export function renderRatioCeiling(devicePixelRatio, renderer) {
  return Math.min(devicePixelRatio || 1, SOFTWARE_RENDERER.test(renderer || '') ? SOFTWARE_RATIO : 2);
}
