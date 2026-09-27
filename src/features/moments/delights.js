import './delights.css';

const drawings = {
  star: '<path d="m24 0 5.6 17.7L48 24l-18.4 6.3L24 48l-5.6-17.7L0 24l18.4-6.3Z"/>',
  heart: '<path d="M24 43 5 25C-7 12 9-4 24 10 39-4 55 12 43 25Z"/>',
  leaf: '<path d="M6 40C-5 9 18 2 43 4c3 28-15 45-37 36Z"/><path d="m8 39 24-23" fill="none" stroke="#fff9e9" stroke-width="2"/>',
  note: '<path d="M18 5v28c-12-4-16 12-4 12 6 0 9-4 9-9V15l16-4v16c-12-3-15 12-4 12 6 0 9-4 9-9V0Z"/>',
};
const settings = {
  finish: { shape: 'star', label: 'A little win', color: '#f5cc78' },
  start: { shape: 'star', label: 'One thing at a time', color: '#d7dca4' },
  cuddle: { shape: 'heart', label: 'Right here with you', color: '#e4a8b6' },
  play: { shape: 'star', label: 'A tiny happy dance', color: '#f2ce7e' },
  treat: { shape: 'leaf', label: 'Saved you a little something', color: '#bfd197' },
  hello: { shape: 'heart', label: 'Your favorite company', color: '#e8b9b2' },
  adopt: { shape: 'heart', label: 'Welcome home', color: '#f0b5bd' },
  bond: { shape: 'star', label: 'A little closer', color: '#cbb7e2' },
  water: { shape: 'leaf', label: 'A little care', color: '#bfd197' },
  tea: { shape: 'heart', label: 'Time for a little pause', color: '#e6bc93' },
  read: { shape: 'star', label: 'One more page', color: '#dcc998' },
  record: { shape: 'note', label: 'Your kind of quiet', color: '#c6b5df' },
  rest: { shape: 'heart', label: 'You can rest here', color: '#dcb8bf' },
};
export function createDelights(host, { room, unavailable, signal }) {
  const layer = document.createElement('div'); layer.className = 'room-delights'; layer.setAttribute('aria-hidden', 'true'); host.append(layer);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)'), active = new Map();
  const clear = who => { const entry = active.get(who); if (!entry) return; clearTimeout(entry.timer); entry.node.remove(); active.delete(who); };
  function update() {
    if (!active.size) return;
    if (document.hidden || unavailable()) { for (const who of active.keys()) clear(who); return; }
    for (const [who, entry] of active) {
      const point = room.anchor(who);
      entry.node.hidden = !point?.visible;
      if (point?.visible) entry.node.style.transform = `translate(${point.x}px, ${point.y}px)`;
    }
  }
  function show(kind, who = 'avatar') {
    if (document.hidden || unavailable()) return;
    const effect = settings[kind]; if (!effect) return;
    clear(who);
    const node = document.createElement('div'); node.className = 'room-delight'; node.dataset.kind = kind; node.dataset.speaker = who; node.style.setProperty('--delight-color', effect.color);
    node.innerHTML = `<span class="delight-medallion"><svg viewBox="0 0 48 48">${drawings[effect.shape]}</svg></span>${motion.matches ? '' : Array.from({ length: kind === 'finish' || kind === 'adopt' ? 9 : 5 }, (_, i) => `<i style="--dx:${Math.cos(i * 2.4) * (34 + i * 4)}px;--dy:${-22 - (i % 4) * 18}px;--delay:${i * .07}s;--turn:${i % 2 ? 55 : -45}deg"><svg viewBox="0 0 48 48">${drawings[i % 3 ? 'star' : effect.shape]}</svg></i>`).join('')}`;
    node.setAttribute('data-label', effect.label); layer.append(node);
    active.set(who, { node, timer: setTimeout(() => clear(who), motion.matches ? 1800 : 3400) }); update();
  }
  const reset = () => { for (const who of active.keys()) clear(who); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); }, { signal });
  motion.addEventListener('change', reset, { signal });
  return { show, update, dispose() { reset(); layer.remove(); } };
}
