import { petArt } from './pet-art.js';
import { petName, bondLevel, BOND_LEVELS, PET_PERSONALITIES } from '../../core/pet-bonds.js';

export async function createPetPortrait(state) {
  const id = state.pet, bond = state.petBonds[id], canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 1500;
  const ctx = canvas.getContext('2d');
  const image = new Image(), url = URL.createObjectURL(new Blob([petArt(id).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" ')], { type: 'image/svg+xml' }));
  try { image.src = url; await image.decode(); } finally { URL.revokeObjectURL(url); }
  ctx.fillStyle = '#f9f1e5'; ctx.fillRect(0, 0, 1200, 1500);
  ctx.strokeStyle = '#dbc8b5'; ctx.lineWidth = 2; ctx.strokeRect(45, 45, 1110, 1410);
  ctx.textAlign = 'center'; ctx.fillStyle = '#806c61'; ctx.font = '24px sans-serif'; ctx.fillText('L I T T L E   H O U R S', 600, 134);
  ctx.fillStyle = '#efe0ce'; ctx.beginPath(); ctx.ellipse(600, 540, 340, 340, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a88467'; ctx.font = '64px Georgia'; ctx.fillText('✧', 890, 340); ctx.fillText('✦', 280, 700);
  ctx.drawImage(image, 310, 240, 580, 580);
  ctx.fillStyle = BOND_LEVELS[bond.ribbon].color;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(600 + side * 28, 776, 39, 23, side * -.3, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath(); ctx.arc(600, 776, 20, 0, Math.PI * 2); ctx.fill();
  const text = (value, y, size, color, serif = true) => {
    ctx.fillStyle = color;
    do { ctx.font = `${size--}px ${serif ? 'Georgia, serif' : 'sans-serif'}`; } while (ctx.measureText(value).width > 960 && size > 18);
    ctx.fillText(value, 600, y);
  };
  text(petName(state), 970, 92, '#634b40');
  text(PET_PERSONALITIES[id].trait, 1030, 30, '#947968');
  text(bondLevel(bond).title, 1150, 40, '#876552');
  text(`${bond.minutes} quiet minutes · ${bond.sessions} little ${bond.sessions === 1 ? 'session' : 'sessions'}`, 1210, 26, '#89776c', false);
  text(state.petFamily ? `Loved by ${state.petFamily}` : 'A little life, shared with you.', 1360, 32, '#856c5c');
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Portrait unavailable')), 'image/png'));
}
