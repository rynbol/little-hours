import { gardenSpecies, gardenGrowth } from '../../core/garden-plants.js';

export function gardenPlantArt(plant, mature = false) {
  const species = gardenSpecies(plant?.species) || gardenSpecies('cosmos'), growth = mature ? 1 : gardenGrowth(plant);
  const leaf = (x, y, flip = 1) => `<path d="M${x} ${y}q${-26 * flip} -2 ${-26 * flip} -23q${27 * flip} -1 ${26 * flip} 23" fill="${species.leaf}"/>`;
  const flower = (x, y, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})">${Array.from({ length: species.id === 'sunflower' ? 12 : 8 }, (_, i) => `<ellipse cy="-13" rx="${species.id === 'sunflower' ? 6 : 9}" ry="17" fill="${species.color}" transform="rotate(${i * (species.id === 'sunflower' ? 30 : 45)})"/>`).join('')}<circle r="${species.id === 'sunflower' ? 12 : 8}" fill="${species.center}"/><circle cx="-2" cy="-2" r="2" fill="#fff5cd" opacity=".6"/></g>`;
  let foliage = '';
  if (growth > 0) {
    const top = 135 - Math.min(1, growth * 1.6) * 77;
    foliage = `<path d="M80 156Q73 118 80 ${top}" fill="none" stroke="${species.leaf}" stroke-width="4" stroke-linecap="round"/>${leaf(79, 135)}${leaf(78, 112, -1)}`;
    if (growth >= .5) foliage += `${leaf(79, 93)}<path d="M79 119Q106 96 110 84M79 138Q49 116 47 106" fill="none" stroke="${species.leaf}" stroke-width="3"/>`;
    if (growth >= 1) foliage += species.id === 'lavender' ? [0, 1, 2].map(i => `<g transform="translate(${i === 0 ? 80 : i === 1 ? 110 : 47} ${i === 0 ? 55 : i === 1 ? 78 : 99})">${Array.from({ length: 6 }, (_, k) => `<ellipse cx="${k % 2 ? 5 : -5}" cy="${-k * 5}" rx="7" ry="6" fill="${k % 2 ? species.color : species.center}"/>`).join('')}</g>`).join('') : flower(80, top) + flower(110, 84, .6) + flower(47, 106, .45);
    else if (growth >= .75) foliage += `<ellipse cx="80" cy="${top}" rx="10" ry="14" fill="${species.color}"/>`;
  } else foliage = `<path d="M76 146q-10-16 4-18q12 5-4 18" fill="#ac8660"/><path d="M76 146l4-14" stroke="#dfc49d" fill="none"/>`;
  return `<svg class="garden-plant-art" viewBox="0 0 160 190" aria-hidden="true"><ellipse cx="80" cy="174" rx="44" ry="8" fill="#887553" opacity=".13"/><path d="M49 147h62l-8 23q-23 12-46 0Z" fill="#cc997d"/><ellipse cx="80" cy="147" rx="31" ry="10" fill="#deb39a"/><ellipse cx="80" cy="146" rx="26" ry="6" fill="#81664e"/><g class="garden-foliage">${foliage}</g><path d="M61 155l3 11" stroke="#eac5aa" stroke-width="3" stroke-linecap="round"/></svg>`;
}
