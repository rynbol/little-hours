// Original UI marks drawn in JavaScript. Inline SVG keeps them sharp at every
// density and lets the interface animate the individual pieces without images.
const svg = (name, content) => `<svg class="ui-art ui-art-${name}" viewBox="0 0 64 64" fill="none" aria-hidden="true">${content}</svg>`;
export function coinArt() {
  return svg('coin', '<circle cx="32" cy="34" r="24" fill="#b78048"/><circle cx="32" cy="30" r="24" fill="#e6bb76"/><circle cx="32" cy="30" r="18" fill="#f2d39e" stroke="#d4a367" stroke-width="1.5"/><path d="M31 41V28m0 6c-12 0-13-10-13-10 11-1 13 10 13 10Zm0-5c0-11 13-12 13-12-1 11-13 12-13 12Z" stroke="#a67847" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="m16 13 3-2m25 41 3-2" stroke="#fff0ce" stroke-width="2" stroke-linecap="round"/>');
}
