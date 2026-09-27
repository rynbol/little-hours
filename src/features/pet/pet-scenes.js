import { petArt } from './pet-art.js';

const coats = {
  cat: { fur: '#d4904f', cream: '#f5e6cb', dark: '#b5703b' },
  dog: { fur: '#efddbd', cream: '#fcf6ea', dark: '#a9683f' },
  bunny: { fur: '#ead8c2', cream: '#fbf6ee', dark: '#cbb395' },
  fox: { fur: '#df7a3c', cream: '#fbf1e2', dark: '#bd5f32' },
  panda: { fur: '#b9552c', cream: '#f6ead9', dark: '#6b2f1c' },
};
const knownSpecies = value => Object.hasOwn(coats, value) ? value : 'cat';
const ribbon = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : '#d9af65';

function tail(species, coat) {
  if (species === 'bunny') return `<circle cx="77" cy="105" r="11" fill="${coat.cream}"/>`;
  if (species === 'fox') return `<path d="M67 115C104 119 108 78 87 74c3 17-7 24-23 26Z" fill="${coat.fur}"/><path d="M87 74c13 2 15 18 8 30-5-4-8-9-9-13 3-5 3-10 1-17Z" fill="${coat.cream}"/>`;
  if (species === 'panda') return `<path d="M68 112c25 9 32-8 24-22-4-7-14-12-14-12" fill="none" stroke="${coat.dark}" stroke-width="17" stroke-linecap="round"/><path d="m78 110 7-12m8 5-13-6m5-12-9 9" fill="none" stroke="${coat.fur}" stroke-width="7"/>`;
  if (species === 'dog') return `<path d="M68 106c25 1 23-25 13-25" fill="none" stroke="${coat.dark}" stroke-width="11" stroke-linecap="round"/>`;
  return `<path d="M67 112c30 10 37-7 24-14" fill="none" stroke="${coat.fur}" stroke-width="12" stroke-linecap="round"/><path d="m85 113 2-7m8 0-3-5" fill="none" stroke="${coat.dark}" stroke-width="3" stroke-linecap="round"/>`;
}

function pet(species, color, side) {
  const coat = coats[species], face = petArt(species).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  return `<g class="pet-scene-character pet-scene-character-${side}" data-species="${species}">
    <g class="pet-scene-tail">${tail(species, coat)}</g>
    <path d="M27 85c1-15 11-23 23-23s24 8 25 25l4 23c-7 13-52 13-58 0Z" fill="${coat.fur}"/>
    <ellipse cx="50" cy="97" rx="17" ry="20" fill="${coat.cream}"/>
    <path d="M29 87c-4 8-3 18 0 26m42-26c4 8 3 18 0 26" fill="none" stroke="${coat.dark}" stroke-width="2" opacity=".35" stroke-linecap="round"/>
    <ellipse cx="34" cy="117" rx="13" ry="8" fill="${coat.fur}"/><ellipse cx="65" cy="117" rx="13" ry="8" fill="${coat.fur}"/>
    <path d="M31 117v4m6-4v4m25-4v4m6-4v4" fill="none" stroke="${coat.dark}" stroke-width="1.4" opacity=".45" stroke-linecap="round"/>
    <g class="pet-scene-head">${face}</g>
    <g class="pet-scene-ribbon" fill="${color}"><path d="M48 82c-10-10-17-6-13 4 2 4 8 1 13-2m4-2c10-10 17-6 13 4-2 4-8 1-13-2"/><path d="m46 85-5 9 7-2 2-7m4 0 5 9-7-2-2-7"/><circle cx="50" cy="83" r="4"/></g>
  </g>`;
}

function flower(x, y, size = 1) {
  return `<g transform="translate(${x} ${y}) scale(${size})"><path d="M0 0v35m0-13c-10-1-13-9-13-9 10-2 13 9 13 9m0 5c10-2 13-10 13-10-10-2-13 10-13 10" fill="#a7b28c" stroke="#899b75" stroke-width="2" stroke-linecap="round"/><g fill="#fff9e9"><ellipse cy="-7" rx="5" ry="8"/><ellipse cy="7" rx="5" ry="8"/><ellipse cx="-7" rx="8" ry="5"/><ellipse cx="7" rx="8" ry="5"/></g><circle r="5" fill="#d9b766"/></g>`;
}

function props(x, y) {
  return `<g transform="translate(${x} ${y})">
    <ellipse class="pet-scene-prop-shadow" cy="6" rx="22" ry="5" fill="#ae9474" opacity=".15"/>
    <g class="pet-scene-play-prop"><g class="pet-scene-ball"><circle cy="-9" r="14" fill="#aebd95"/><path d="M-13-13c9 4 17 4 26 0M-12-2c8 3 16 3 24 0" fill="none" stroke="#e7edce" stroke-width="4"/><ellipse cx="-5" cy="-15" rx="3" ry="2" fill="#eff2dc"/></g><g class="pet-scene-leaf"><path d="M16-58c15-18 30-8 28-8 2 22-17 28-28 8" fill="#9eae7b"/><path d="m17-57 20-12" fill="none" stroke="#f7f4db" stroke-width="2"/></g></g>
    <g class="pet-scene-snack-prop"><ellipse cy="2" rx="25" ry="8" fill="#d0a498"/><ellipse cy="-1" rx="22" ry="7" fill="#efd1be"/><g class="pet-scene-treat"><path d="M-17-7q-2-10 8-10l8 3q6 8-2 11l-11 1Z" fill="#d5a368"/><path d="m5-7q-1-11 8-11t9 9q-1 7-10 7Z" fill="#e1b675"/><path d="m-10-12 3 2m18-3 3 3" stroke="#b98250" stroke-width="2" stroke-linecap="round"/></g></g>
    <g class="pet-scene-quiet-prop"><path d="M0-69C-26-84-16-104 0-89c16-15 26 5 0 20Z" fill="#d39fa8"/><path d="m-29-86-4-6m63 6 4-6" stroke="#dfbd7a" stroke-width="3" stroke-linecap="round"/></g>
  </g>`;
}

export function petScene(species, ribbonColor = '#d9af65') {
  const id = knownSpecies(species);
  return `<svg class="pet-scene pet-scene-solo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 390" aria-hidden="true" focusable="false">
    <path d="M65 329V167a155 155 0 0 1 310 0v162Z" fill="#eee7d8"/>
    <path d="M91 315V168a129 129 0 0 1 258 0v147Z" fill="#f7f0df"/>
    <path d="M220 39v215M94 167h252" fill="none" stroke="#e4d7bc" stroke-width="7"/>
    <circle cx="284" cy="107" r="29" fill="#edcf8a"/><circle cx="275" cy="98" r="7" fill="#f8e9ba" opacity=".6"/>
    <path d="M95 275q67-58 125-9t128-4v59H95Z" fill="#dce2c7"/>
    <path d="M65 329q155-31 310 0" fill="none" stroke="#dac9ad" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="223" cy="357" rx="150" ry="17" fill="#d9c7b0" opacity=".27"/>
    <path d="M104 336c5-29 227-30 235 0l-6 12c-32 22-193 23-223 0Z" fill="#d3a59d"/>
    <ellipse cx="220" cy="335" rx="117" ry="22" fill="#e6beb1"/><path d="M124 338c42 18 151 18 193-1" fill="none" stroke="#f3d6c7" stroke-width="2" stroke-dasharray="4 6"/>
    ${flower(73, 292, .85)}${flower(366, 282, .7)}
    <g transform="translate(118 90) scale(2)">${pet(id, ribbon(ribbonColor), 'solo')}</g>
    ${props(342, 341)}
    <path d="m95 107 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="#d3b472"/><circle cx="356" cy="203" r="3" fill="#d6b383"/>
  </svg>`;
}

export function friendshipScene(speciesA, speciesB) {
  const a = knownSpecies(speciesA), b = knownSpecies(speciesB);
  return `<svg class="pet-scene pet-scene-duo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 330" aria-hidden="true" focusable="false">
    <path d="M28 269V170a145 145 0 0 1 145-145h174a145 145 0 0 1 145 145v99Z" fill="#f2eadb"/>
    <circle cx="260" cy="118" r="69" fill="#faf4e6"/><circle cx="260" cy="118" r="52" fill="#f5e5bd"/>
    <path d="M61 219q112-71 199-12t199 1v63H61Z" fill="#e3e6d1"/>
    <path d="M48 259q212-38 424 0" fill="none" stroke="#c9d3b3" stroke-width="2"/>
    <ellipse cx="260" cy="294" rx="214" ry="19" fill="#d4bea5" opacity=".2"/>
    <ellipse cx="160" cy="280" rx="81" ry="14" fill="#e7c6b5"/><ellipse cx="361" cy="280" rx="81" ry="14" fill="#d7ddc0"/>
    <path d="M96 281q63 17 128 0m73 0q64 17 128 0" fill="none" stroke="#fcf4e7" stroke-width="2" stroke-dasharray="4 5"/>
    ${flower(58, 237, .7)}${flower(465, 232, .85)}
    <g transform="translate(79 80) scale(1.6)">${pet(a, '#cf9f9f', 'left')}</g>
    <g transform="translate(281 80) scale(1.6)">${pet(b, '#9eaf87', 'right')}</g>
    ${props(260, 284)}
    <path d="m207 71 3 9 9 3-9 3-3 9-3-9-9-3 9-3Zm103 20 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" fill="#dbbd7d"/>
    <path d="M250 143c-17-12-9-24 0-15 9-9 17 3 0 15Z" fill="#cc9b9f" opacity=".8"/>
  </svg>`;
}
