export const ATTACKS = Object.freeze(Object.fromEntries(Object.entries({
  'sword-1': { durationMs: 420, hitMs: 180, range: 4, heightRange: 2.5, facingCosine: .1, multiplier: 1, hitStopMs: 45 },
  'sword-2': { durationMs: 460, hitMs: 200, range: 4, heightRange: 2.5, facingCosine: .1, multiplier: 1.1, hitStopMs: 50 },
  'sword-3': { durationMs: 620, hitMs: 300, range: 4, heightRange: 2.5, facingCosine: .1, multiplier: 1.4, hitStopMs: 65 },
  'pet-strike': { durationMs: 650, hitMs: 180, range: 2.5, heightRange: 2.5, recoveryMs: 1100, hitStopMs: 35 },
  'pet-skill': { durationMs: 650, hitMs: 240, range: 2.5, heightRange: 2.5, commandRange: 12, hitStopMs: 55 },
  'warden-charge': { clip: 'attack-1', hitMs: 1100, durationMs: 2000, damage: 22, radius: 1.4, contactRadius: 1.75, speed: 15, length: 30, width: 2.8, recoveryMs: 1100, hitStopMs: 60 },
  'warden-sweep': { clip: 'attack-2', hitMs: 800, damage: 16, radius: 4.6, length: 0, width: 0, recoveryMs: 1200, hitStopMs: 50 },
  'warden-slam': { clip: 'attack-3', hitMs: 1000, damage: 20, radius: 5.2, length: 0, width: 0, recoveryMs: 1400, hitStopMs: 60 },
  'warden-roots': { clip: 'attack-4', hitMs: 1200, damage: 18, radius: 0, length: 20, width: 2.6, recoveryMs: 1400, hitStopMs: 50 },
}).map(([id, spec]) => [id, Object.freeze({ id, ...spec })])));

export const SWORD_COMBO = Object.freeze(['sword-1', 'sword-2', 'sword-3'].map(id => ATTACKS[id]));
export const DODGE = Object.freeze({ durationMs: 500, speed: 9, invulnerableFromMs: 80, invulnerableToMs: 340 });
