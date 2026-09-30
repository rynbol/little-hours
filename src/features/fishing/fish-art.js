import { speciesOf } from '../../core/fishing.js';

const SHAPES = {
  slim: { h: 15, head: 20, tail: 76, fin: 13 },
  deep: { h: 25, head: 22, tail: 74, fin: 16 },
  round: { h: 30, head: 24, tail: 72, fin: 15 },
  long: { h: 15, head: 14, tail: 80, fin: 14 },
  koi: { h: 18, head: 18, tail: 76, fin: 20 },
  eel: { h: 7, head: 8, tail: 90, fin: 8 },
  sturgeon: { h: 12, head: 8, tail: 82, fin: 15 },
  angel: { h: 18, head: 30, tail: 70, fin: 13 },
  betta: { h: 11, head: 22, tail: 62, fin: 22, veil: true },
  puffer: { h: 23, head: 28, tail: 76, fin: 10, round: true },
  star: { h: 26, head: 26, tail: 84, star: true },
  jelly: { h: 20, head: 34, tail: 76, jelly: true },
};
let serial = 0;

function outline({ h, head, tail }, snout) {
  const top = 40 - h, bottom = 40 + h * .92;
  return `M${head - snout} 41 C${head} ${top - 1} ${tail - 22} ${top} ${tail} ${40 - h * .28} L${tail} ${40 + h * .28} C${tail - 22} ${bottom} ${head} ${bottom + 1} ${head - snout} 41 Z`;
}
function eelPath() {
  const at = (x, side) => { const c = 40 + Math.sin(x / 11) * 6, w = 6.5 * (1 - x / 125) * Math.min(1, Math.sqrt((x - 4) / 10)); return `${x} ${(c + side * w).toFixed(2)}`; };
  const xs = Array.from({ length: 23 }, (_, i) => 4 + i * 4);
  return `M${xs.map(x => at(x, -1)).join(' L')} L${[...xs].reverse().map(x => at(x, 1)).join(' L')} Z`;
}
const hues = (id, dir) => `<linearGradient id="${id}" ${dir}>${[0, 40, 90, 170, 215, 290, 330].map((hue, i) => `<stop offset="${(i / 6).toFixed(2)}" stop-color="hsl(${hue} 90% 72%)"/>`).join('')}</linearGradient>`;
function puffPath({ h, head, tail }) {
  const cx = (head + tail) / 2, rx = (tail - head) / 2, points = [];
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, r = 1 + .05 * Math.sin(a * 3); points.push(`${(cx - Math.cos(a) * rx * r).toFixed(2)} ${(40 - Math.sin(a) * h * r).toFixed(2)}`); }
  return `M${points.join(' L')} Z`;
}
function starPath(outer, inner) {
  const points = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? inner : outer; return [55 + Math.cos(a) * r, 42 + Math.sin(a) * r]; });
  const mid = i => { const [x, y] = points[i % 10], [nx, ny] = points[(i + 1) % 10]; return `${((x + nx) / 2).toFixed(2)} ${((y + ny) / 2).toFixed(2)}`; };
  return `M${mid(0)} ${points.map((_, i) => { const [x, y] = points[(i + 1) % 10]; return `Q${x.toFixed(2)} ${y.toFixed(2)} ${mid(i + 1)}`; }).join(' ')} Z`;
}
function jellyParts(look, silhouette) {
  const fill = silhouette ? 'currentColor' : look.fin;
  const tentacles = Array.from({ length: 7 }, (_, i) => { const x = 38 + i * 5.3, sway = (i % 2 ? 1 : -1) * 3; return `<path d="M${x} 44 q${sway} 8 0 15 t0 14" fill="none" stroke="${fill}" stroke-width="1.3" stroke-linecap="round" opacity="${silhouette ? 1 : .75}"/>`; });
  const arms = [48, 55, 62].map((x, i) => `<path d="M${x} 43 q${4 - i * 4} 10 ${2 - i * 2} 22" fill="none" stroke="${silhouette ? 'currentColor' : look.belly}" stroke-width="3.2" stroke-linecap="round" opacity="${silhouette ? 1 : .85}"/>`);
  return tentacles.join('') + arms.join('');
}
function marks(look, shape, clip) {
  const { mark, patch } = look, out = [];
  const inBody = (i, n) => shape.head + (shape.tail - shape.head) * (i + .5) / n;
  if (mark === 'spots' && shape.star) for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 4 + (i * 7 % 13); out.push(`<circle cx="${(55 + Math.cos(a) * r).toFixed(2)}" cy="${(40 + Math.sin(a) * r).toFixed(2)}" r="${1 + (i % 3) * .45}" fill="${look.belly}" opacity=".85"/>`); }
  else if (mark === 'spots') for (let i = 0; i < 11; i++) out.push(`<circle cx="${inBody(i, 11)}" cy="${40 - shape.h * .45 + (i * 37 % 11) / 11 * shape.h * .7}" r="${1.2 + (i % 3) * .5}" fill="#3d3a33" opacity=".45"/>`);
  if (mark === 'stripes') for (let i = 0; i < 5; i++) out.push(`<rect x="${inBody(i, 6) + 4}" y="${40 - shape.h * 1.2}" width="3.4" height="${shape.h * 2.4}" rx="1.7" fill="${look.stripe || '#4e5a34'}" opacity=".45"/>`);
  if (mark === 'patches') for (const [x, y, rx, ry] of [[34, 30, 9, 6], [52, 34, 7, 8], [66, 30, 6, 4.5], [26, 44, 5, 3]]) out.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${patch}" opacity=".92"/>`);
  if (mark === 'stars') for (let i = 0; i < 9; i++) { const x = inBody(i, 9), y = 40 - shape.h * .55 + (i * 5 % 7) / 7 * shape.h * .9; out.push(`<path d="M${x} ${y - 2.2}L${x + .7} ${y - .7}L${x + 2.2} ${y}L${x + .7} ${y + .7}L${x} ${y + 2.2}L${x - .7} ${y + .7}L${x - 2.2} ${y}L${x - .7} ${y - .7}Z" fill="#fff6d8" opacity=".9"/>`); }
  if (mark === 'plates') for (let i = 0; i < 8; i++) { const x = inBody(i, 8); out.push(`<path d="M${x - 2.5} ${40 - shape.h * .55}l2.5 -2.5l2.5 2.5l-2.5 2.5z" fill="#d9d4e6" opacity=".7"/><path d="M${x - 2} ${40 + shape.h * .2}l2 -2l2 2l-2 2z" fill="#d9d4e6" opacity=".45"/>`); }
  return out.length ? `<g clip-path="url(#${clip})">${out.join('')}</g>` : '';
}

export function fishArt(id, { silhouette = false } = {}) {
  const species = speciesOf(id);
  if (!species) return '';
  const { look } = species, shape = SHAPES[look.shape], n = ++serial, clip = `fish-clip-${n}`, grad = `fish-grad-${n}`, glow = `fish-glow-${n}`, fins = `fish-fins-${n}`;
  const eel = look.shape === 'eel', snout = look.shape === 'sturgeon' ? 8 : 3, rainbow = look.mark === 'rainbow' && !silhouette;
  const body = eel ? eelPath() : shape.star ? starPath(34, 14) : shape.jelly ? 'M30 44 C30 16 80 16 80 44 Q76 47 72.5 44 Q69 47 65.5 44 Q62 47 58.5 44 Q55 47 51.5 44 Q48 47 44.5 44 Q41 47 37.5 44 Q34 47 30 44 Z' : shape.round ? puffPath(shape) : outline(shape, snout);
  const { h, tail, head, fin } = shape, fillBody = silhouette ? 'currentColor' : `url(#${grad})`, finFill = silhouette ? 'currentColor' : rainbow ? `url(#${fins})` : look.fin;
  const flowing = look.shape === 'koi', angel = look.shape === 'angel', betta = look.shape === 'betta';
  const veil = `M${tail - 3} 40 C${tail + 8} ${40 - fin * .6} ${tail + 20} ${40 - fin * 1.5} ${tail + 38} ${40 - fin * 1.25} Q${tail + 33} ${40 - fin * .6} ${tail + 40} ${40 - fin * .15} Q${tail + 34} 40 ${tail + 40} ${40 + fin * .3} Q${tail + 33} ${40 + fin * .8} ${tail + 38} ${40 + fin * 1.35} C${tail + 20} ${40 + fin * 1.5} ${tail + 8} ${40 + fin * .6} ${tail - 3} 40 Z`;
  const tailFin = eel || shape.star || shape.jelly ? '' : betta ? `<path d="${veil}" fill="${finFill}" opacity="${silhouette ? 1 : .88}"/>${silhouette ? '' : Array.from({ length: 5 }, (_, i) => `<path d="M${tail} 40 Q${tail + 18} ${40 + (i - 2) * fin * .35} ${tail + 36} ${40 + (i - 2) * fin * .55}" fill="none" stroke="#fff" stroke-width=".8" opacity=".35"/>`).join('')}`
    : `<path d="M${tail - 2} 40 C${tail + 6} ${40 - fin * .4} ${tail + 10} ${40 - fin * 1.05} ${tail + 16} ${40 - fin * (flowing ? 1.3 : 1)} C${tail + 12} ${40 - fin * .2} ${tail + 12} ${40 + fin * .2} ${tail + 16} ${40 + fin * (flowing ? 1.3 : 1)} C${tail + 10} ${40 + fin * 1.05} ${tail + 6} ${40 + fin * .4} ${tail - 2} 40 Z" fill="${finFill}" opacity="${silhouette ? 1 : .92}"/>`;
  const sail = side => `<path d="M${head + 12} ${40 + side * h * .82} C${head + 22} ${40 + side * (h + 12)} ${tail} ${40 + side * (h + 18)} ${tail + 8} ${40 + side * (h + 20)} C${tail + 2} ${40 + side * (h + 8)} ${tail - 2} ${40 + side * h * .6} ${tail - 6} ${40 + side * h * .42} Z" fill="${finFill}" opacity="${silhouette ? 1 : .9}"/>`;
  const flare = side => `<path d="M${head + 8} ${40 + side * h * .75} C${head + 18} ${40 + side * (h + 14)} ${tail} ${40 + side * (h + 16)} ${tail + 6} ${40 + side * (h + 8)} C${tail + 2} ${40 + side * h} ${tail - 2} ${40 + side * h * .5} ${tail - 4} ${40 + side * h * .3} Z" fill="${finFill}" opacity="${silhouette ? 1 : .88}"/>`;
  const dorsal = shape.star || shape.jelly ? '' : angel ? sail(-1) + sail(1) : betta ? flare(-1) + flare(1)
    : eel ? `<path d="M${Array.from({ length: 18 }, (_, i) => { const x = 20 + i * 4; return `${x} ${(40 + Math.sin(x / 11) * 6 - 6.5 * (1 - x / 125) - 1.5).toFixed(2)}`; }).join(' L')}" fill="none" stroke="${finFill}" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>`
    : shape.round ? `<path d="M${head + 26} ${40 - h * .95} q5 -9 12 -6 q-3 5 -3 8z" fill="${finFill}"/>`
    : `<path d="M${head + (tail - head) * .32} ${40 - h * .9} C${head + (tail - head) * .42} ${40 - h - fin * .75} ${head + (tail - head) * .62} ${40 - h - fin * .55} ${head + (tail - head) * .74} ${40 - h * .72} Z" fill="${finFill}"/>`;
  const spikes = shape.round ? Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2 + .2, cx = (head + tail) / 2, rx = (tail - head) / 2 + 1, x = cx - Math.cos(a) * rx, y = 40 - Math.sin(a) * (h + 1), dx = -Math.cos(a) * 4.5, dy = -Math.sin(a) * 4.5, px = -Math.sin(a) * 1.6, py = Math.cos(a) * 1.6; return `<path d="M${(x + px).toFixed(2)} ${(y + py).toFixed(2)} L${(x + dx).toFixed(2)} ${(y + dy).toFixed(2)} L${(x - px).toFixed(2)} ${(y - py).toFixed(2)} Z" fill="${finFill}"/>`; }).join('') : '';
  const streamers = angel && !silhouette ? `<path d="M${head + 12} ${40 + h * .5} q4 ${h * .9} 12 ${h + 16} M${head + 15} ${40 + h * .5} q4 ${h * .8} 14 ${h + 14}" fill="none" stroke="${look.fin}" stroke-width="1.2" stroke-linecap="round"/>` : '';
  const pectoral = eel || silhouette || shape.star || shape.jelly ? '' : `<path d="M${head + 12} ${40 + h * .25} q7 ${fin * .35} ${flowing || betta ? 13 : 8} ${fin * (flowing || betta ? .75 : .45)} q-9 -2 -${flowing || betta ? 13 : 8} -${fin * (flowing || betta ? .75 : .45)}z" fill="${look.fin}" opacity=".8"/>`;
  const whiskers = look.whiskers && !silhouette ? `<path d="M${head - snout + 1} 42 q-6 4 -8 11 M${head - snout + 2} 43 q-3 5 -2 12" fill="none" stroke="${look.fin}" stroke-width="1.1" stroke-linecap="round"/>` : '';
  const eyeAt = shape.star ? [[51, 38], [59, 38]] : shape.jelly ? [] : [[head + (eel ? 3 : shape.round ? 7 : 4), eel ? 38.6 : 40 - h * (shape.round ? .2 : .3)]], eyeR = eel ? 1.6 : shape.star ? 2 : shape.round ? 3.6 : 2.6;
  const eye = eyeAt.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${eyeR}" fill="${silhouette ? 'currentColor' : '#23201d'}"/>${silhouette ? '' : `<circle cx="${x + eyeR * .35}" cy="${y - eyeR * .35}" r="${eyeR * .32}" fill="#fff"/>`}`).join('');
  const smile = shape.star && !silhouette ? '<path d="M52.5 43 q2.5 2.4 5 0" fill="none" stroke="#23201d" stroke-width="1" stroke-linecap="round"/>' : '';
  const blush = !silhouette && (shape.round || shape.star || angel || betta) ? (shape.star ? [[47.5, 42], [62.5, 42]] : [[head + 9, 40 + h * .08]]).map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.6" fill="#f08c8c" opacity=".45"/>`).join('') : '';
  const shine = silhouette || shape.star ? '' : shape.jelly ? '<path d="M40 30 Q46 22 56 22" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>' : `<path d="M${head + 6} ${40 - h * .62} Q${(head + tail) / 2} ${40 - h * .95} ${tail - 8} ${40 - h * .5}" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".35"/>`;
  const gill = eel || silhouette || shape.star || shape.jelly || shape.round ? '' : `<path d="M${head + 9} ${40 - h * .5} q3 ${h * .5} 0 ${h}" fill="none" stroke="${look.fin}" stroke-width="1" opacity=".6"/>`;
  const skin = rainbow ? hues(grad, 'x1="0" y1="0" x2="1" y2="0"') + hues(fins, 'x1="0" y1="0" x2="1" y2="1"')
    : `<linearGradient id="${grad}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${look.body}"/><stop offset=".55" stop-color="${look.body}"/><stop offset="1" stop-color="${look.belly}"/></linearGradient>`;
  const belly = rainbow ? `<path d="${body}" fill="${look.belly}" opacity=".35" clip-path="url(#${clip})" transform="translate(0 ${h * .9})"/>` : '';
  const under = shape.jelly ? jellyParts(look, silhouette) : '';
  return `<svg class="fish-art${silhouette ? ' is-silhouette' : ''}" viewBox="0 0 110 80" role="img" aria-label="${silhouette ? 'An undiscovered fish' : species.name}">
    <defs>${skin}
    <clipPath id="${clip}"><path d="${body}"/></clipPath>${look.glow && !silhouette ? `<filter id="${glow}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feFlood flood-color="${look.glow}" flood-opacity=".75"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : ''}</defs>
    <g${look.glow && !silhouette ? ` filter="url(#${glow})"` : ''}>${under}${tailFin}${dorsal}${spikes}${streamers}<path d="${body}" fill="${fillBody}" opacity="${shape.jelly && !silhouette ? .85 : 1}"/>${belly}${silhouette ? '' : marks(look, shape, clip)}${gill}${pectoral}${shine}${whiskers}${blush}${eye}${smile}</g></svg>`;
}
