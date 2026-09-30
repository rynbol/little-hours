export const ISLAND_ATMOSPHERES = {
  dusk: { top: '#252b50', bottom: '#787bac', sky: '#bccaf5', ground: '#798baf', sun: '#ffe4bd', fill: .64, key: .86, deep: '#498daa', shallow: '#8ed7d7' },
  day: { top: '#b4dedb', bottom: '#f3e6c9', sky: '#e4f3ff', ground: '#849b83', sun: '#fff0cc', fill: .68, key: .96, deep: '#419baf', shallow: '#92d9cc' },
  rain: { top: '#344e68', bottom: '#92adb4', sky: '#c2e0ed', ground: '#758d95', sun: '#e0e9e6', fill: .72, key: .65, deep: '#588b9b', shallow: '#a2cbc5' },
};

const STARS = [
  [.05, .04, 1], [.23, .03, 1.2], [.35, .08, .8], [.48, .025, 1.1], [.62, .1, 1.4], [.75, .045, .8],
  [.86, .17, 1], [.95, .25, .9], [.05, .28, 1.3], [.25, .2, .9], [.44, .15, .7], [.7, .22, 1.1],
  [.91, .4, .8], [.025, .53, 1], [.97, .64, 1.2], [.13, .76, .8], [.84, .84, .8],
];

export function islandSkyArt(theme, width, height) {
  const night = theme === 'dusk', day = theme === 'day';
  const size = Math.min(1, width / 680), x = width * .14, y = Math.max(44, height * .13);
  const stars = night ? STARS.map(([sx, sy, r], i) => `<circle cx="${sx * width}" cy="${sy * height}" r="${r}" fill="#e0e6ff" opacity="${.35 + i % 3 * .18}"/>`).join('') : '';
  const moon = night ? `<defs><radialGradient id="island-moon-halo"><stop stop-color="#ece6ff" stop-opacity=".13"/><stop offset="1" stop-color="#ece6ff" stop-opacity="0"/></radialGradient></defs><g data-celestial="moon" transform="translate(${x} ${y}) scale(${Math.max(.72, size)})"><circle r="65" fill="url(#island-moon-halo)"/><path d="M20-30A35 35 0 1 0 28 26C-15 30-25-10 20-30Z" fill="#fff1cf"/><circle cx="-21" cy="9" r="4" fill="#d8c8ad" opacity=".25"/><circle cx="-12" cy="24" r="2.3" fill="#d8c8ad" opacity=".22"/></g>` : '';
  const sun = day ? `<g data-celestial="sun" transform="translate(${x} ${y})"><circle r="42" fill="#fff8d9" opacity=".12"/><circle r="29" fill="#fff8d9" opacity=".2"/><circle r="${18 * Math.max(.8, size)}" fill="#fff9e1" opacity=".9"/></g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${stars}${moon}${sun}</svg>`;
}
