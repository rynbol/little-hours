// Original UI marks drawn in JavaScript. Inline SVG keeps them sharp at every
// density and lets the interface animate the individual pieces without images.
const svg = (name, content) => `<svg class="ui-art ui-art-${name}" viewBox="0 0 64 64" fill="none" aria-hidden="true">${content}</svg>`;
export function blossomArt() {
  const petals = Array.from({ length: 5 }, (_, i) => `<ellipse class="blossom-petal" cx="32" cy="20" rx="9" ry="13" fill="#c98c9c" transform="rotate(${i * 72} 32 32)"/>`).join('');
  return svg('blossom', `${petals}<circle cx="32" cy="32" r="8" fill="#f4d7a0"/><circle cx="29" cy="31" r="1" fill="#916251"/><circle cx="35" cy="31" r="1" fill="#916251"/><path d="M30 35q2 2 4 0" stroke="#916251" stroke-width="1.2" stroke-linecap="round"/>`);
}
export function coinArt() {
  return svg('coin', '<circle cx="32" cy="34" r="24" fill="#b78048"/><circle cx="32" cy="30" r="24" fill="#e6bb76"/><circle cx="32" cy="30" r="18" fill="#f2d39e" stroke="#d4a367" stroke-width="1.5"/><path d="M31 41V28m0 6c-12 0-13-10-13-10 11-1 13 10 13 10Zm0-5c0-11 13-12 13-12-1 11-13 12-13 12Z" stroke="#a67847" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="m16 13 3-2m25 41 3-2" stroke="#fff0ce" stroke-width="2" stroke-linecap="round"/>');
}
export function sproutArt() {
  return svg('sprout', '<path d="M33 46V31" stroke="#7b8e68" stroke-width="3" stroke-linecap="round"/><path d="M32 37C14 38 13 20 13 20c15-2 24 6 19 17Z" fill="#a9bb8f"/><path d="M33 29c-2-14 17-16 17-16 0 14-7 21-17 16Z" fill="#819b73"/><path d="m32 36-11-9m12 4 10-10" stroke="#637f60" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="32" cy="49" rx="17" ry="3" fill="#b5b994" opacity=".25"/><path d="m13 9 1.5 4L19 14l-4.5 1-1.5 4-1.5-4L7 14l4.5-1Z" fill="#d4aa78"/>');
}
