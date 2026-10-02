const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render driver/i;
export const SOFTWARE_PIXEL_RATIO = 0.75;

export const isSoftwareRenderer = renderer => SOFTWARE_RENDERER.test(renderer ?? '');

export function pixelRatioCeiling({ quality = 'auto', devicePixelRatio = 1, renderer = '' } = {}) {
  const display = Math.min(devicePixelRatio || 1, quality === 'battery' ? 1 : 2);
  return quality !== 'high' && isSoftwareRenderer(renderer) ? Math.min(display, SOFTWARE_PIXEL_RATIO) : display;
}
