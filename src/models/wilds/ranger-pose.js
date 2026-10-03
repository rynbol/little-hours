export const RANGER_JOINTS = Object.freeze(['hips', 'spine', 'chest', 'head', 'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR']);

export const RANGER_STRIDE = Object.freeze({ walk: 1.5, run: 2.3 });

const TAU = Math.PI * 2;
const clamp01 = value => Math.min(1, Math.max(0, value));
const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };
const lerp = (from, to, t) => from + (to - from) * t;

const SLASHES = Object.freeze([
  Object.freeze({ hit: 180 / 420, from: Object.freeze({ twist: .9, lift: 1.35, reach: .5, crouch: .02 }), to: Object.freeze({ twist: -1, lift: 1.45, reach: .15, crouch: .05 }) }),
  Object.freeze({ hit: 200 / 460, from: Object.freeze({ twist: -.8, lift: 1.1, reach: .9, crouch: .03 }), to: Object.freeze({ twist: .95, lift: 1.25, reach: .2, crouch: .06 }) }),
  Object.freeze({ hit: 300 / 620, from: Object.freeze({ twist: .25, lift: 3, reach: .5, crouch: 0 }), to: Object.freeze({ twist: -.1, lift: .55, reach: .1, crouch: .16 }) }),
]);

function restPose() {
  const pose = { lift: 0 };
  for (const joint of RANGER_JOINTS) pose[joint] = [0, 0, 0];
  return pose;
}

function breathe(pose, elapsedMs) {
  const breath = Math.sin(elapsedMs * TAU / 3600);
  pose.chest[0] = -.03 + breath * .025;
  pose.head[0] = .04 - breath * .02;
  pose.upperArmL[2] = -.16 - breath * .015; pose.upperArmR[2] = .16 + breath * .015;
  pose.foreArmL[0] = .18; pose.foreArmR[0] = .3; pose.handR[0] = .1;
}

function stride(pose, phase, running) {
  const swing = Math.sin(phase * TAU), lean = running ? .26 : .08;
  const legs = running ? .85 : .5, arms = running ? .7 : .4;
  pose.lift = Math.abs(Math.cos(phase * TAU)) * (running ? .06 : .03) - (running ? .05 : .01);
  pose.hips[1] = -swing * .1;
  pose.spine[0] = -lean * .5; pose.chest[0] = -lean * .5; pose.chest[1] = swing * .14; pose.head[0] = lean * .6;
  pose.thighL[0] = swing * legs; pose.thighR[0] = -swing * legs;
  pose.shinL[0] = -Math.max(0, -Math.sin(phase * TAU + .9)) * legs * 1.5 - .08;
  pose.shinR[0] = -Math.max(0, Math.sin(phase * TAU + .9)) * legs * 1.5 - .08;
  pose.footL[0] = -pose.thighL[0] * .3; pose.footR[0] = -pose.thighR[0] * .3;
  pose.upperArmL[0] = -swing * arms; pose.upperArmL[2] = -.2;
  pose.upperArmR[0] = swing * arms * .5 + .1; pose.upperArmR[2] = .22;
  pose.foreArmL[0] = .35 + (running ? .8 : .2); pose.foreArmR[0] = .4 + (running ? .3 : 0); pose.handR[0] = .1;
}

function slash(pose, comboIndex, progress) {
  const move = SLASHES[comboIndex] ?? SLASHES[0];
  const windUp = smooth(progress / (move.hit * .7)), cut = smooth((progress - move.hit * .7) / (move.hit * .6)), settle = smooth((progress - .75) / .25);
  const at = key => lerp(lerp(0, move.from[key], windUp), move.to[key], cut) * (1 - settle);
  pose.lift = -at('crouch');
  pose.hips[1] = -at('twist') * .35; pose.chest[1] = -at('twist') * .65; pose.chest[0] = -at('crouch') * 1.2;
  pose.head[1] = at('twist') * .5;
  pose.upperArmR[0] = at('lift'); pose.upperArmR[2] = .25 + at('reach') * .6;
  pose.foreArmR[0] = .1 + at('reach') * .3; pose.handR[0] = -.1;
  pose.upperArmL[0] = -.3 * (1 - settle); pose.upperArmL[2] = -.45 * (1 - settle) - .16 * settle; pose.foreArmL[0] = .5;
  pose.thighL[0] = .45 * (1 - settle); pose.shinL[0] = -.35 * (1 - settle);
  pose.thighR[0] = -.3 * (1 - settle); pose.shinR[0] = -.2 * (1 - settle);
}

function roll(pose, progress) {
  const tuck = Math.sin(clamp01(progress) * Math.PI);
  pose.hips[0] = -smooth(progress) * TAU;
  pose.lift = -.38 * tuck;
  pose.spine[0] = -.5 * tuck; pose.chest[0] = -.4 * tuck; pose.head[0] = -.4 * tuck;
  pose.thighL[0] = pose.thighR[0] = 1.7 * tuck;
  pose.shinL[0] = pose.shinR[0] = -2.1 * tuck;
  pose.upperArmL[0] = pose.upperArmR[0] = .9 * tuck;
  pose.foreArmL[0] = pose.foreArmR[0] = 1.2 * tuck;
}

function airborne(pose, rising) {
  pose.thighL[0] = rising ? .9 : .35; pose.shinL[0] = rising ? -1.1 : -.5;
  pose.thighR[0] = rising ? -.25 : .1; pose.shinR[0] = rising ? -.6 : -.4;
  pose.upperArmL[0] = -.4; pose.upperArmL[2] = rising ? -1.1 : -.8;
  pose.upperArmR[0] = .2; pose.upperArmR[2] = rising ? 1 : .75;
  pose.foreArmL[0] = .4; pose.foreArmR[0] = .6;
  pose.chest[0] = rising ? .1 : -.05; pose.head[0] = rising ? .15 : -.1;
}

function crouch(pose, depth) {
  pose.lift = -.14 * depth;
  pose.thighL[0] = pose.thighR[0] = .7 * depth;
  pose.shinL[0] = pose.shinR[0] = -1.2 * depth;
  pose.footL[0] = pose.footR[0] = .5 * depth;
  pose.chest[0] = -.25 * depth;
  pose.upperArmL[2] = -.4 * depth - .16; pose.upperArmR[2] = .4 * depth + .16;
}

function climb(pose, elapsedMs) {
  const reach = Math.sin(elapsedMs * TAU / 900);
  pose.upperArmL[0] = 2.6 + reach * .35; pose.upperArmR[0] = 2.6 - reach * .35;
  pose.foreArmL[0] = pose.foreArmR[0] = .5;
  pose.thighL[0] = .6 + reach * .4; pose.thighR[0] = .6 - reach * .4;
  pose.shinL[0] = pose.shinR[0] = -.9;
  pose.head[0] = .3;
}

export function rangerPose({ action = 'idle', stride: phase = 0, elapsedMs = 0, combat = null } = {}) {
  const pose = restPose();
  breathe(pose, elapsedMs);
  if (combat?.kind === 'attack') slash(pose, combat.comboIndex, combat.progress);
  else if (combat?.kind === 'dodge') roll(pose, combat.progress);
  else if (action === 'walk' || action === 'run') stride(pose, phase, action === 'run');
  else if (action === 'jump' || action === 'fall') airborne(pose, action === 'jump');
  else if (action === 'land') crouch(pose, 1);
  else if (action === 'climb' || action === 'mantle') climb(pose, elapsedMs);
  return pose;
}
