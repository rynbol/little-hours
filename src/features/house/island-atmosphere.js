export const ISLAND_ATMOSPHERES = {
  dusk: { top: '#252b50', bottom: '#787bac', sky: '#bccaf5', ground: '#798baf', sun: '#ffe4bd', fill: .64, key: .86, deep: '#498daa', shallow: '#8ed7d7' },
  day: { top: '#4f8fd8', bottom: '#d9ebf1', sky: '#dcecff', ground: '#8a9f78', sun: '#fff3d6', fill: .7, key: 1, deep: '#3f94b4', shallow: '#8fd6d0' },
  rain: { top: '#344e68', bottom: '#92adb4', sky: '#c2e0ed', ground: '#758d95', sun: '#e0e9e6', fill: .72, key: .65, deep: '#588b9b', shallow: '#a2cbc5' },
};

export const ISLAND_SUN = Object.freeze({ direction: Object.freeze([.6, -1, -.75]), darkness: 0 });

const STARS = [
  [.05, .04, 1], [.23, .03, 1.2], [.35, .08, .8], [.48, .025, 1.1], [.62, .1, 1.4], [.75, .045, .8],
  [.86, .17, 1], [.95, .25, .9], [.05, .28, 1.3], [.25, .2, .9], [.44, .15, .7], [.7, .22, 1.1],
  [.91, .4, .8], [.025, .53, 1], [.97, .64, 1.2], [.13, .76, .8], [.84, .84, .8],
];

const RANGES = {
  day: { far: '#bcd3ea', mid: '#94b6d8', near: '#7299b9', cloud: '#ffffff', shade: '#c4d7ec' },
  dusk: { far: '#5d5f93', mid: '#4d4f84', near: '#3f4274', cloud: '#a9a3cf', shade: '#6f6ca3' },
  rain: { far: '#6f8a9c', mid: '#5f7b8f', near: '#526d82', cloud: '#c9d6de', shade: '#8ea3b1' },
};
const skyHash = n => { const s = Math.sin(n * 71.3 + 5.7) * 43758.5453; return s - Math.floor(s); };

export function mountainRange(width, height, base, rise, seed, mesas) {
  const pillars = mesas ? Array.from({ length: 7 }, (_, i) => [skyHash(seed + i * 3.1), .018 + skyHash(seed + i * 4.7) * .03, .8 + skyHash(seed + i * 6.3) * 1.1]) : [];
  const steps = 90, points = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, ridge = .45 + Math.sin(u * 7 + seed) * .22 + Math.sin(u * 17 + seed * 2) * .1 + Math.sin(u * 41 + seed) * .04;
    const towers = pillars.reduce((top, [at, reach, tall]) => Math.max(top, tall / (1 + ((u - at) / reach) ** 4)), 0);
    points.push(`${(u * width).toFixed(1)} ${(height * base - height * rise * Math.max(ridge, towers)).toFixed(1)}`);
  }
  return `M0 ${height} L${points.join(' L')} L${width} ${height} Z`;
}

function cloudBank(x, y, scale, fill, shade, seed) {
  const puffs = Array.from({ length: 8 }, (_, i) => {
    const px = (i - 3.5) * 30 * scale + (skyHash(seed + i) - .5) * 16 * scale, lift = Math.sin((i + .5) / 8 * Math.PI);
    const rx = (22 + skyHash(seed + i * 2) * 18 + lift * 14) * scale, ry = (16 + lift * 20 + skyHash(seed + i * 5) * 8) * scale;
    return `<ellipse cx="${(x + px).toFixed(1)}" cy="${(y - ry * .45).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"/>`;
  }).join('');
  const id = `island-bank-${seed}`;
  return `<clipPath id="${id}"><rect x="${x - 200 * scale}" y="${y - 120 * scale}" width="${400 * scale}" height="${120 * scale}"/></clipPath><g filter="url(#island-cloud-soft)" clip-path="url(#${id})" fill="url(#island-puff)">${puffs}</g>`;
}

function skyScenery(theme, width, height) {
  const r = RANGES[theme] || RANGES.day;
  const wisps = [[.3, .36, 1.3], [.62, .1, 1], [.84, .22, 1.2], [.46, .3, .8]].map(([x, y, s], i) => `<ellipse cx="${x * width}" cy="${y * height}" rx="${160 * s}" ry="${9 * s}" fill="${r.cloud}" opacity="${theme === 'day' ? .55 : .25}" transform="rotate(${-4 + i * 2} ${x * width} ${y * height})"/>`).join('');
  const banks = [[.1, .6, 1, 1], [.9, .55, 1.2, 2], [.3, .86, 1.3, 3], [.74, .9, 1.5, 4]].map(([x, y, s, seed]) => cloudBank(x * width, y * height, s * Math.min(1.2, width / 1200), r.cloud, r.shade, seed)).join('');
  return `<defs><linearGradient id="island-puff" x1="0" y1="0" x2="0" y2="1"><stop offset=".15" stop-color="${r.cloud}"/><stop offset=".95" stop-color="${r.shade}"/></linearGradient><filter id="island-cloud-soft" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="3.5"/></filter><filter id="island-wisp" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="7"/></filter><linearGradient id="island-range-mist" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="${r.far}" stop-opacity="0"/><stop offset="1" stop-color="${r.far}" stop-opacity=".9"/></linearGradient></defs>`
    + `<g filter="url(#island-wisp)">${wisps}</g>`
    + `<path d="${mountainRange(width, height, .74, .16, 3, true)}" fill="${r.far}"/>`
    + `<path d="${mountainRange(width, height, .84, .13, 11, true)}" fill="${r.mid}"/>`
    + `<path d="${mountainRange(width, height, .95, .1, 23, false)}" fill="${r.near}"/>`
    + `<rect x="0" y="${height * .5}" width="${width}" height="${height * .5}" fill="url(#island-range-mist)"/>`
    + banks;
}

export function islandSkyArt(theme, width, height) {
  const night = theme === 'dusk', day = theme === 'day';
  const size = Math.min(1, width / 680), x = width * .16, y = Math.max(44, height * .27);
  const stars = night ? STARS.map(([sx, sy, r], i) => `<circle cx="${sx * width}" cy="${sy * height}" r="${r}" fill="#e0e6ff" opacity="${.35 + i % 3 * .18}"/>`).join('') : '';
  const moon = night ? `<defs><radialGradient id="island-moon-halo"><stop stop-color="#ece6ff" stop-opacity=".13"/><stop offset="1" stop-color="#ece6ff" stop-opacity="0"/></radialGradient></defs><g data-celestial="moon" transform="translate(${x} ${y}) scale(${Math.max(.72, size)})"><circle r="65" fill="url(#island-moon-halo)"/><path d="M20-30A35 35 0 1 0 28 26C-15 30-25-10 20-30Z" fill="#fff1cf"/><circle cx="-21" cy="9" r="4" fill="#d8c8ad" opacity=".25"/><circle cx="-12" cy="24" r="2.3" fill="#d8c8ad" opacity=".22"/></g>` : '';
  const sun = day ? `<g data-celestial="sun" transform="translate(${x} ${y})"><circle r="42" fill="#fff8d9" opacity=".12"/><circle r="29" fill="#fff8d9" opacity=".2"/><circle r="${18 * Math.max(.8, size)}" fill="#fff9e1" opacity=".9"/></g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${stars}${moon}${sun}${skyScenery(theme, width, height)}</svg>`;
}
