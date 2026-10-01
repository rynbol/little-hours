import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { createLightning } from '../../core/lightning.js';
import { createWorldLightning } from '../../models/world/lightning-sky.js';

export const ROOM_FLASH = Object.freeze({ wall: 1.4, backdrop: '#485878' });

export function createWindowLightning({ outdoor, spill, backdrop, onThunder, random, sunBreak = () => 0 }) {
  const sky = outdoor ? createWorldLightning(outdoor) : null;
  const lightning = createLightning({ random, onStrike: () => onThunder?.(lightning.thunderDelay) });
  const cool = Color3.FromHexString(ROOM_FLASH.backdrop);
  let shown = 0, lit = null;

  function paintBackdrop(level) {
    const material = backdrop();
    if (lit && lit !== material) lit.emissiveColor.set(0, 0, 0);
    lit = material;
    material?.emissiveColor.copyFromFloats(cool.r * level, cool.g * level, cool.b * level);
  }
  return {
    lightning, sky,
    ready: () => sky?.ready(),
    strike: () => lightning.strike(),
    get level() { return lightning.level; },
    update(seconds, storming, still) {
      const level = lightning.update(seconds, storming && sunBreak() <= 0, still);
      if (level === 0 && shown === 0) return level;
      shown = level;
      sky?.show(level, lightning.shape);
      spill.flash(level * ROOM_FLASH.wall);
      paintBackdrop(level);
      return level;
    },
  };
}
