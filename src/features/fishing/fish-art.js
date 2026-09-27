import { speciesOf } from '../../core/fishing.js';

const SHAPES = {
  slim: { h: 15, head: 20, tail: 76, fin: 13 },
  deep: { h: 25, head: 22, tail: 74, fin: 16 },
  round: { h: 30, head: 24, tail: 72, fin: 15 },
  long: { h: 15, head: 14, tail: 80, fin: 14 },
  koi: { h: 18, head: 18, tail: 76, fin: 20 },
  eel: { h: 7, head: 8, tail: 90, fin: 8 },
  sturgeon: { h: 12, head: 8, tail: 82, fin: 15 },
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
function marks(look, shape, clip) {
  const { mark, patch } = look, out = [];
  const inBody = (i, n) => shape.head + (shape.tail - shape.head) * (i + .5) / n;
  if (mark === 'spots') for (let i = 0; i < 11; i++) out.push(`<circle cx="${inBody(i, 11)}" cy="${40 - shape.h * .45 + (i * 37 % 11) / 11 * shape.h * .7}" r="${1.2 + (i % 3) * .5}" fill="#3d3a33" opacity=".45"/>`);
  if (mark === 'stripes') for (let i = 0; i < 5; i++) out.push(`<rect x="${inBody(i, 6) + 4}" y="${40 - shape.h}" width="3.4" height="${shape.h * 1.3}" rx="1.7" fill="#4e5a34" opacity=".45"/>`);
  if (mark === 'patches') for (const [x, y, rx, ry] of [[34, 30, 9, 6], [52, 34, 7, 8], [66, 30, 6, 4.5], [26, 44, 5, 3]]) out.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${patch}" opacity=".92"/>`);
  if (mark === 'stars') for (let i = 0; i < 9; i++) { const x = inBody(i, 9), y = 40 - shape.h * .55 + (i * 5 % 7) / 7 * shape.h * .9; out.push(`<path d="M${x} ${y - 2.2}L${x + .7} ${y - .7}L${x + 2.2} ${y}L${x + .7} ${y + .7}L${x} ${y + 2.2}L${x - .7} ${y + .7}L${x - 2.2} ${y}L${x - .7} ${y - .7}Z" fill="#fff6d8" opacity=".9"/>`); }
  if (mark === 'plates') for (let i = 0; i < 8; i++) { const x = inBody(i, 8); out.push(`<path d="M${x - 2.5} ${40 - shape.h * .55}l2.5 -2.5l2.5 2.5l-2.5 2.5z" fill="#d9d4e6" opacity=".7"/><path d="M${x - 2} ${40 + shape.h * .2}l2 -2l2 2l-2 2z" fill="#d9d4e6" opacity=".45"/>`); }
  return out.length ? `<g clip-path="url(#${clip})">${out.join('')}</g>` : '';
}

export function fishArt(id, { silhouette = false } = {}) {
  const species = speciesOf(id);
  if (!species) return '';
  const { look } = species, shape = SHAPES[look.shape], n = ++serial, clip = `fish-clip-${n}`, grad = `fish-grad-${n}`, glow = `fish-glow-${n}`;
  const eel = look.shape === 'eel', snout = look.shape === 'sturgeon' ? 8 : 3;
  const body = eel ? eelPath() : outline(shape, snout);
  const { h, tail, head, fin } = shape, fillBody = silhouette ? 'currentColor' : `url(#${grad})`, finFill = silhouette ? 'currentColor' : look.fin;
  const flowing = look.shape === 'koi';
  const tailFin = eel ? '' : `<path d="M${tail - 2} 40 C${tail + 6} ${40 - fin * .4} ${tail + 10} ${40 - fin * 1.05} ${tail + 16} ${40 - fin * (flowing ? 1.3 : 1)} C${tail + 12} ${40 - fin * .2} ${tail + 12} ${40 + fin * .2} ${tail + 16} ${40 + fin * (flowing ? 1.3 : 1)} C${tail + 10} ${40 + fin * 1.05} ${tail + 6} ${40 + fin * .4} ${tail - 2} 40 Z" fill="${finFill}" opacity="${silhouette ? 1 : .92}"/>`;
  const dorsal = eel ? `<path d="M${Array.from({ length: 18 }, (_, i) => { const x = 20 + i * 4; return `${x} ${(40 + Math.sin(x / 11) * 6 - 6.5 * (1 - x / 125) - 1.5).toFixed(2)}`; }).join(' L')}" fill="none" stroke="${finFill}" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>`
    : `<path d="M${head + (tail - head) * .32} ${40 - h * .9} C${head + (tail - head) * .42} ${40 - h - fin * .75} ${head + (tail - head) * .62} ${40 - h - fin * .55} ${head + (tail - head) * .74} ${40 - h * .72} Z" fill="${finFill}"/>`;
  const pectoral = eel || silhouette ? '' : `<path d="M${head + 12} ${40 + h * .25} q7 ${fin * .35} ${flowing ? 13 : 8} ${fin * (flowing ? .75 : .45)} q-9 -2 -${flowing ? 13 : 8} -${fin * (flowing ? .75 : .45)}z" fill="${look.fin}" opacity=".8"/>`;
  const whiskers = look.whiskers && !silhouette ? `<path d="M${head - snout + 1} 42 q-6 4 -8 11 M${head - snout + 2} 43 q-3 5 -2 12" fill="none" stroke="${look.fin}" stroke-width="1.1" stroke-linecap="round"/>` : '';
  const eye = `<circle cx="${head + (eel ? 3 : 4)}" cy="${eel ? 38.6 : 40 - h * .3}" r="${eel ? 1.6 : 2.6}" fill="${silhouette ? 'currentColor' : '#23201d'}"/>${silhouette ? '' : `<circle cx="${head + (eel ? 3.5 : 4.9)}" cy="${(eel ? 38.6 : 40 - h * .3) - .9}" r=".8" fill="#fff"/>`}`;
  const shine = silhouette ? '' : `<path d="M${head + 6} ${40 - h * .62} Q${(head + tail) / 2} ${40 - h * .95} ${tail - 8} ${40 - h * .5}" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".35"/>`;
  const gill = eel || silhouette ? '' : `<path d="M${head + 9} ${40 - h * .5} q3 ${h * .5} 0 ${h}" fill="none" stroke="${look.fin}" stroke-width="1" opacity=".6"/>`;
  return `<svg class="fish-art${silhouette ? ' is-silhouette' : ''}" viewBox="0 0 110 80" role="img" aria-label="${silhouette ? 'An undiscovered fish' : species.name}">
    <defs><linearGradient id="${grad}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${look.body}"/><stop offset=".55" stop-color="${look.body}"/><stop offset="1" stop-color="${look.belly}"/></linearGradient>
    <clipPath id="${clip}"><path d="${body}"/></clipPath>${look.glow && !silhouette ? `<filter id="${glow}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feFlood flood-color="${look.glow}" flood-opacity=".75"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : ''}</defs>
    <g${look.glow && !silhouette ? ` filter="url(#${glow})"` : ''}>${tailFin}${dorsal}<path d="${body}" fill="${fillBody}"/>${silhouette ? '' : marks(look, shape, clip)}${gill}${pectoral}${shine}${whiskers}${eye}</g></svg>`;
}
