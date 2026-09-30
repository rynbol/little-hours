export const SPOTS = Object.freeze({
  fireplace: { pose: 'warm', front: true, lines: ['So toasty ✦', 'Warm toes!', 'Crackle crackle'], when: spot => !spot.off },
  plant: { pose: 'sniff', lines: ['Hello, leaves!', 'Grow big ♡', 'Smells green'] },
  'moon-tree': { pose: 'sniff', lines: ['Moon leaves!', 'Sparkly branches'] },
  monstera: { pose: 'sniff', lines: ['Big leaf, little me', 'Hello, leaves!'] },
  'hanging-plant': { pose: 'sniff', lines: ['Swing, swing', 'Hello up here!'] },
  'seed-bed': { pose: 'sniff', lines: ['Grow, little seeds', 'Sprouts soon!'] },
  'floor-lamp': { pose: 'perch', lines: ['Best seat up here', 'Warm and glowy ✧'] },
  'lantern-cluster': { pose: 'perch', lines: ['Little lights ✧', 'Glowy!'] },
  bookcase: { pose: 'read', lines: ['Ooh, this one has pictures', 'Shh, reading…', 'One more page'] },
  'apothecary-shelf': { pose: 'read', lines: ['What’s in this jar?', 'Tiny bottles!'] },
  'wall-shelf': { pose: 'perch', lines: ['A shelf for me', 'Up high!'] },
  'low-cabinet': { pose: 'dance', lines: ['♪ ♫', 'Dance with me!', 'This one’s my song ♪'], when: spot => !spot.off },
  'study-desk': { pose: 'perch', lines: ['Pencils!', 'Tidy desk, tidy mind'] },
  'writing-desk': { pose: 'perch', lines: ['Pencils!', 'Dear diary…'] },
  'fish-tank': { pose: 'peek', front: true, lines: ['Blub blub', 'Hi, fishies!'] },
  globe: { pose: 'twirl', lines: ['Where to next?', 'Spin spin!'] },
  telescope: { pose: 'gaze', lines: ['I can see the moon!', 'A shooting star!'] },
  'side-table': { pose: 'sniff', lines: ['Tea time?', 'Smells like honey'] },
  'tea-cart': { pose: 'sniff', lines: ['Tea time?', 'Biscuits!'] },
  'lounge-chair': { pose: 'bounce', lines: ['Boing!', 'So squishy'] },
  'bean-bag': { pose: 'bounce', lines: ['Boing boing!', 'Squish!'] },
  ottoman: { pose: 'bounce', lines: ['Boing!'] },
  daybed: { pose: 'bounce', lines: ['Nap spot?', 'Boing!'] },
  'moon-clock': { pose: 'perch', lines: ['Tick, tock'] },
  'wall-clock': { pose: 'perch', lines: ['Tick, tock'] },
  'room-window': { pose: 'gaze', lines: ['What a view', 'Hello, sky', 'I’ll go out there next time!'] },
});
export const SPOT_TYPES = new Set(Object.keys(SPOTS));

export const CHATS = Object.freeze([
  ['Whatcha thinking about?', 'Oh, lots of little things.'],
  ['I like it here ♡', 'Me too, Pip.'],
  ['Ready for another round?', 'Soon. Snack first.'],
  ['Look, a dust bunny!', 'Ha, let’s leave it be.'],
  ['You’re doing great!', 'Aw, thank you.'],
  ['Can we explore later?', 'Next focus session, promise.'],
  ['Tell me a story?', 'Once upon a time, a tiny sprite…'],
  ['Hehe, your hair is fluffy', 'Hey! It’s a look.'],
]);
export const PERCH_REPLIES = Object.freeze(['Comfy up there?', 'Hi, little one.', 'Hello, hat.']);
export const LEAVE_LINES = Object.freeze(['Off to explore!', 'Back soon with treasure ✦', 'Adventure time!']);
export const RETURN_LINES = Object.freeze(['I found something!', 'Look what I brought you!']);
export const WELCOME_LINES = Object.freeze(['You’re back! ♡', 'I missed you!', 'Yay, it’s you!']);
export const GREET_REPLIES = Object.freeze(['Ooh, what did you find?', 'Welcome back, Pip!', 'You found something!']);

export const OFFSETS = Object.freeze({
  shoulder: [.34, .06], perch: [0, .3], chat: [-.48, .04], boop: [.25, .08], spot: [0, .18], loop: [.3, .1], around: [0, .1],
});

const range = (random, [low, high]) => low + random() * (high - low);
const pickOne = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
const wanderPoints = random => Array.from({ length: 4 + Math.floor(random() * 2) }, () => [(random() < .5 ? -1 : 1) * range(random, [.3, .6]), range(random, [-.05, .35]), range(random, [-.3, .3])]);

export function planActivity({ spots = [], pet = null, avatar = null, holding = false, last = null }, random) {
  const walking = avatar?.moving;
  const options = [
    { kind: 'shoulder', weight: walking ? 5 : 1.6, make: () => ({ kind: 'shoulder', target: 'head', offset: OFFSETS.shoulder, pose: 'hover', seconds: range(random, [4, 7]) }) },
    { kind: 'orbit', weight: walking ? 2 : 2.2, make: () => ({ kind: 'orbit', target: 'head', offset: OFFSETS.around, pose: 'zoom', seconds: range(random, [5, 8]), motion: { type: 'orbit', radius: range(random, [.46, .56]), speed: (random() < .5 ? -1 : 1) * range(random, [1.4, 2]) } }) },
    { kind: 'perch', weight: walking ? 0 : .9, make: () => ({ kind: 'perch', target: 'head', offset: OFFSETS.perch, pose: 'perch', seconds: range(random, [5, 8]), reply: random() < .5 ? pickOne(PERCH_REPLIES, random) : null }) },
    { kind: 'chat', weight: walking ? 0 : 1.2, make: () => { const [line, reply] = pickOne(CHATS, random); return { kind: 'chat', target: 'head', offset: OFFSETS.chat, pose: 'chat', seconds: range(random, [5, 7]), line, reply }; } },
    { kind: 'wander', weight: walking ? 0 : 2.4, make: () => { const points = wanderPoints(random), hop = range(random, [1.1, 1.6]); return { kind: 'wander', target: 'head', offset: OFFSETS.around, pose: 'hover', seconds: points.length * hop, motion: { type: 'path', hop, points } }; } },
    { kind: 'peekaboo', weight: walking ? 0 : 1.2, make: () => ({ kind: 'peekaboo', target: 'head', offset: OFFSETS.around, pose: 'hover', seconds: 5.6, line: 'Peekaboo!', motion: { type: 'path', hop: 1.4, points: [[0, 0, .38], [.36, .1, -.14], [0, 0, .38], [-.36, .1, -.14]] } }) },
    { kind: 'loop', weight: walking ? 0 : 1.1, make: () => ({ kind: 'loop', target: 'head', offset: OFFSETS.loop, pose: 'loop', seconds: 3.2, motion: { type: 'loop', radius: .2, speed: 4.2 } }) },
    { kind: 'twirl', weight: walking ? 0 : .8, make: () => ({ kind: 'twirl', target: 'head', offset: OFFSETS.shoulder, pose: 'twirl', seconds: 3 }) },
  ];
  if (!holding && !walking) {
    if (pet && !pet.moving && !pet.held && pet.state === 'sitting') options.push({ kind: 'boop', weight: 1.2, make: () => ({ kind: 'boop', target: 'pet', offset: OFFSETS.boop, pose: 'boop', seconds: range(random, [4, 6]), line: 'Boop!' }) });
    const usable = spots.filter(spot => SPOTS[spot.type] && (SPOTS[spot.type].when?.(spot) ?? true));
    if (usable.length) options.push({ kind: 'spot', weight: 1.8, make: () => {
      const spot = pickOne(usable, random), plan = SPOTS[spot.type];
      return { kind: 'spot', spot: spot.type, target: plan.front && spot.front ? spot.front : spot.point, offset: OFFSETS.spot, pose: plan.pose, seconds: range(random, [5, 8]), line: random() < .7 ? pickOne(plan.lines, random) : null };
    } });
  }
  const open = options.filter(option => option.weight > 0 && !(last && option.kind === last && option.kind !== 'shoulder'));
  const total = open.reduce((sum, option) => sum + option.weight, 0);
  let roll = random() * total;
  return (open.find(option => (roll -= option.weight) < 0) || open[0]).make();
}
