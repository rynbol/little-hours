import './wilds.css';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { createWildsView } from './scene.js';

export function enterWilds(container, state, { onProgress } = {}) {
  const canvas = container.ownerDocument.createElement('canvas');
  canvas.id = 'wilds-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'The Wilds');
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', outline: 'none' });
  container.append(canvas);
  let engine;
  try {
    engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: false });
    engine.setHardwareScalingLevel(1 / Math.min(2, container.ownerDocument.defaultView.devicePixelRatio || 1));
    return createWildsView(engine, canvas, state, undefined, undefined, { onProgress });
  } catch (error) {
    engine?.dispose();
    canvas.remove();
    throw error;
  }
}
