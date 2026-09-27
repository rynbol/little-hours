// Little speech bubbles that float above the pet and the companion. The room
// reports where each head is on screen; this module owns the words, the
// timing and the DOM. One bubble per speaker, never a stack of them.
import { clockRandom } from '../../core/test-pins.js';
export const PET_LINES = {
  cat: {
    carry: ['Mrrow?', 'Mrrp!', 'Mew?'],
    hello: ['Mrrp.', 'Prrr…'],
    friend: ['Prrr…', 'Mrrp.'],
  },
  dog: {
    carry: ['Arf?', 'Wuff!', 'Yip!'],
    hello: ['Arf!', 'Wuff.'],
    friend: ['Snff…', 'Wuff.'],
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
  customize: ['Okay, I’m ready for a little glow-up. ✨', 'Let’s find a look that feels like me.', 'Ooh, a little getting-ready moment.'],
  customizeDone: ['Cute. Let’s get comfy again. ✨', 'All ready. Back to my little corner.'],
  doze: ['(yawns) Just resting my eyes…', 'Zzz… five more minutes…'],
  // One small thing in the room at the start of a break.
  activity: {
    tea: ['A little sip. A little slower.', 'This is just what I needed.', 'There’s always time for tea.'],
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
export function pickLine(lines, last, random = clockRandom) {
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
      layer.appendChild(element); bubbles.set(who, { element, text, timer: 0, shown: false, x: null, y: null, offstage: null, onstage: false, ax: 0, ay: 0, lift: 0, width: 0, height: 0 });
    }
    return bubbles.get(who);
  }
  // Each shown bubble sits above its head. When two would overlap (the
  // companion kneels beside the pet), the higher one rises clear of the other.
  function layoutBubbles() {
    const onstage = [];
    for (const [who, entry] of bubbles) {
      if (!entry.shown) continue;
      const point = anchor(who); entry.onstage = Boolean(point?.visible); entry.lift = 0;
      if (entry.onstage) { entry.ax = point.x; entry.ay = point.y; onstage.push(entry); }
    }
    if (onstage.length === 2) {
      const [upper, lower] = onstage[0].ay <= onstage[1].ay ? onstage : [onstage[1], onstage[0]];
      const apart = Math.abs(upper.ax - lower.ax) >= (upper.width + lower.width) / 2 + 6, overlap = upper.ay - (lower.ay - lower.height - 8);
      if (!apart && overlap > 0) upper.lift = overlap;
    }
    for (const entry of bubbles.values()) if (entry.shown) write(entry);
  }
  // The DOM is written only when the rounded spot or the visibility changes.
  function write(entry) {
    const offstage = !entry.onstage;
    if (offstage !== entry.offstage) { entry.offstage = offstage; entry.element.classList.toggle('is-offstage', offstage); }
    if (offstage) return;
    const x = Math.round(entry.ax), y = Math.round(entry.ay - entry.lift);
    if (x !== entry.x || y !== entry.y) { entry.x = x; entry.y = y; entry.element.style.transform = `translate3d(${x}px, ${y}px, 0)`; }
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
      // One size read per line, for stacking.
      entry.width = entry.element.offsetWidth; entry.height = entry.element.offsetHeight;
      layoutBubbles();
      // The next frame starts the fade and pop, after the bubble is placed.
      requestAnimationFrame(() => { if (entry.shown) entry.element.classList.add('is-visible'); });
      entry.timer = setTimeout(() => hide(who), duration ?? bubbleDuration(text));
      return text;
    },
    hide, hideAll() { for (const who of bubbles.keys()) hide(who); },
    // Called after each rendered frame: bubbles follow the heads.
    update: layoutBubbles,
    showing(who) { return Boolean(bubbles.get(who)?.shown); },
  };
}
