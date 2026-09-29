// A local, original postcard. Export happens only on the player's explicit tap;
// no room data or image leaves the browser.
import { ISLAND_ATMOSPHERES, islandSkyArt } from './island-atmosphere.js';

export async function createHousePostcard(source, name, caption, theme, island = true) {
  const capture = document.createElement('canvas'); capture.width = source.width; capture.height = source.height;
  capture.getContext('2d').drawImage(source, 0, 0);
  const card = document.createElement('canvas'); card.width = 1600; card.height = 1200;
  const ctx = card.getContext('2d');
  ctx.fillStyle = '#f6ecdc'; ctx.fillRect(0, 0, 1600, 1200);
  const sky = ctx.createLinearGradient(0, 160, 0, 1010);
  sky.addColorStop(0, island ? ISLAND_ATMOSPHERES[theme].top : '#bdcdb6');
  sky.addColorStop(1, island ? ISLAND_ATMOSPHERES[theme].bottom : '#e8d8bf');
  ctx.fillStyle = sky; ctx.beginPath(); ctx.roundRect(40, 160, 1520, 850, 28); ctx.fill();
  ctx.textAlign = 'center'; ctx.fillStyle = '#665044'; ctx.font = '22px Georgia';
  ctx.fillText('L I T T L E   H O U R S', 800, 68);
  // Fit the full user name, including long unbroken names, without clipping.
  let size = 50; do { ctx.font = `${size--}px Georgia`; } while (ctx.measureText(name).width > 1410 && size > 18);
  ctx.fillText(name, 800, 127);
  const scale = Math.min(1430 / source.width, 780 / source.height);
  const w = source.width * scale, h = source.height * scale;
  if (island) {
    const art = new Image(), url = URL.createObjectURL(new Blob([islandSkyArt(theme, 1520, 850)], { type: 'image/svg+xml' }));
    try { art.src = url; await art.decode(); ctx.drawImage(art, 40, 160); } finally { URL.revokeObjectURL(url); }
  }
  ctx.drawImage(capture, (1600 - w) / 2, 188 + (780 - h) / 2, w, h);
  ctx.fillStyle = '#665044'; ctx.font = 'italic 34px Georgia'; ctx.fillText('a little life, well spent.', 800, 1072);
  ctx.font = '20px sans-serif'; ctx.fillStyle = '#8c7866'; ctx.fillText(caption, 800, 1122);
  const blob = await new Promise((resolve, reject) => card.toBlob(value => value ? resolve(value) : reject(new Error('Empty postcard')), 'image/png'));
  return URL.createObjectURL(blob);
}
