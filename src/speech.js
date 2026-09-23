// Little speech bubbles that float above the pet and the companion. The room
// reports where each head is on screen; this module owns the words, the
// timing and the DOM. One bubble per speaker, never a stack of them.
export const PET_LINES = {
  cat: {
    pet: ['prrrr… ♡', 'Mrrp!', 'Miso leans into your hand.', '*slow blink* ♡', 'Miso purrs like a tiny engine.', 'Mrow ♡', 'Miso nuzzles your fingers.'],
    sleepy: ['*sleepy purr* ♡', 'Mm… five more minutes.', 'Miso stretches one paw, then purrs.'],
    carry: ['Mrrow?', 'Mrrp! Where are we going?', '*dangles politely*'],
    hello: ['Miso curls up in the bed. ♡', 'Mrrp! Miso is home.'],
  },
  dog: {
    pet: ['Wag wag wag! ♡', '*happy snuffle*', 'Mochi melts into your hand.', 'Boop! ♡', 'Mochi’s tail won’t stop.', 'Arf! ♡', 'Mochi gives your hand a lick.'],
    sleepy: ['*sleepy tail thump* ♡', 'Mm… belly rubs…', 'Mochi yawns and wiggles closer.'],
    carry: ['Wheee!', 'Arf? An adventure!', '*wiggles happily*'],
    hello: ['Mochi hops into the bed and wags! ♡', 'Arf! Mochi is home.'],
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
