// Little speech bubbles that float above the pet and the companion. The room
// reports where each head is on screen; this module owns the words, the
// timing and the DOM. One bubble per speaker, never a stack of them.
export const PET_LINES = {
  cat: {
    pet: ['prrrr… ♡', 'Mrrp!', 'Miso leans into your hand.', '*slow blink* ♡', 'Miso purrs like a tiny engine.', 'Mrow ♡', 'Miso nuzzles your fingers.'],
    sleepy: ['*sleepy purr* ♡', 'Mm… five more minutes.', 'Miso stretches one paw, then purrs.'],
    carry: ['Mrrow?', 'Mrrp! Where are we going?', '*dangles politely*'],
    hello: ['Miso curls up in the bed. ♡', 'Mrrp! Miso is home.'],
    friend: ['prrr… ♡', '*content purr*', 'Mrrp. ♡'],
  },
  dog: {
    pet: ['Wag wag wag! ♡', '*happy snuffle*', 'Mochi melts into your hand.', 'Boop! ♡', 'Mochi’s tail won’t stop.', 'Arf! ♡', 'Mochi gives your hand a lick.'],
    sleepy: ['*sleepy tail thump* ♡', 'Mm… belly rubs…', 'Mochi yawns and wiggles closer.'],
    carry: ['Wheee!', 'Arf? An adventure!', '*wiggles happily*'],
    hello: ['Mochi hops into the bed and wags! ♡', 'Arf! Mochi is home.'],
    friend: ['*tail thump* ♡', '*happy sigh*', 'Wag wag. ♡'],
  },
};

// The companion speaks at the edges of focus, never during it.
export const AVATAR_LINES = {
  start: ['Okay. One little thing at a time.', 'Let’s do this. ✎', 'Deep breath. Here we go.', 'I’ll be right here with you.'],
  resume: ['Back to it.', 'Okay, where were we?', 'Refreshed. Let’s go.'],
  pause: ['A little break? Good idea.', 'Stretching my legs. Back soon.', 'Tea break!'],
  finish: ['We did it! ✧', 'That was a good one.', 'Look at us go. Time for a break.', 'Well done, you.'],
  welcome: ['Welcome back! ✧', 'Oh, hi! I kept your seat warm.', 'There you are. The room missed you.'],
  rest: ['Ahh, cozy.', 'This is the best seat in the room.', 'Mm, just a quiet minute.'],
  doze: ['(yawns) Just resting my eyes…', 'Zzz… five more minutes…'],
  // One small thing in the room at the start of a break.
  activity: {
    warm: ['Mm, the fire feels lovely.', 'Warming my hands a minute.', 'Toasty. ✧'],
    window: ['Look at that sky.', 'Watching the world a minute.', 'What a view.'],
    water: ['A little drink for you, plant.', 'There you go, little leaves.', 'Grow, grow, grow.'],
    record: ['Something soft to listen to. ♪', 'This one is my favorite. ♪', 'A little music. ♪'],
    pet: ['Who is a good friend? ♡', 'So soft. ♡', 'Hello, sleepyhead.'],
    lamp: ['A little more light.', 'There. Cozier already.', 'Click. ✧'],
    read: ['Just one more chapter.', 'Where was I…', 'Ooh, this part is good.'],
  },
  tap: {
    working: ['Mm-hm, focusing… ✎', 'Almost done with this bit.', '(quietly typing)'],
    idle: ['Ready when you are.', 'Pick one thing, and we’ll start.', 'Hi there!', 'What are we working on today?'],
    resting: ['Ahh, cozy.', 'Five more minutes?', 'Breaks are part of the work.'],
    sleeping: ['Zzz… mm… chapter three…', 'Mmh… five more minutes…'],
    walking: ['Just finding a comfy spot.', 'Back in a moment!'],
    returning: ['On my way!', 'Coming back to the desk.'],
    'resting-at-desk': ['Just a little pause here.', 'Resting my eyes at the desk.'],
  },
};

// A line from the list, never the same one twice in a row.
export function pickLine(lines, last, random = Math.random) {
  const choices = lines.length > 1 ? lines.filter(line => line !== last) : lines;
  return choices[Math.floor(random() * choices.length) % choices.length];
}
// Long enough to read, short enough to stay light.
export function bubbleDuration(text) { return Math.min(5200, 1900 + text.length * 55); }

export function createSpeech(layer, { anchor, reducedMotion = () => false }) {
  const bubbles = new Map(), last = new Map();
  function bubble(who) {
    if (!bubbles.has(who)) {
      const element = document.createElement('div');
      // The outer box follows the head; the inner text pops, so its scale
      // never stretches the position.
      element.className = 'speech-bubble'; element.dataset.speaker = who; element.hidden = true;
      element.setAttribute('role', 'status'); element.setAttribute('aria-live', 'polite');
      const text = document.createElement('span'); text.className = 'speech-text'; element.appendChild(text);
      layer.appendChild(element); bubbles.set(who, { element, text, timer: 0, shown: false });
    }
    return bubbles.get(who);
  }
  function place(who, entry) {
    const point = anchor(who);
    entry.element.classList.toggle('is-offstage', !point?.visible);
    if (point?.visible) entry.element.style.transform = `translate3d(${Math.round(point.x)}px, ${Math.round(point.y)}px, 0)`;
  }
  function hide(who) {
    const entry = bubbles.get(who); if (!entry?.shown) return;
    clearTimeout(entry.timer); entry.shown = false; entry.element.classList.remove('is-visible');
    entry.timer = setTimeout(() => { entry.element.hidden = true; }, reducedMotion() ? 0 : 220);
  }
  return {
    // `lines` may be one line or a list to pick from.
    say(who, lines, { duration } = {}) {
      const text = Array.isArray(lines) ? pickLine(lines, last.get(who)) : lines; if (!text) return null;
      const entry = bubble(who); last.set(who, text);
      clearTimeout(entry.timer); entry.text.textContent = text; entry.element.hidden = false; entry.shown = true;
      place(who, entry);
      // The next frame starts the fade and pop, after the bubble is placed.
      requestAnimationFrame(() => { if (entry.shown) entry.element.classList.add('is-visible'); });
      entry.timer = setTimeout(() => hide(who), duration ?? bubbleDuration(text));
      return text;
    },
    hide, hideAll() { for (const who of bubbles.keys()) hide(who); },
    // Called after each rendered frame: bubbles follow the heads.
    update() { for (const [who, entry] of bubbles) if (entry.shown) place(who, entry); },
    showing(who) { return Boolean(bubbles.get(who)?.shown); },
  };
}
