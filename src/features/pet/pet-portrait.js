import { petScene, friendshipScene } from './pet-scenes.js';
import { petName, bondLevel, BOND_LEVELS, PET_PERSONALITIES } from '../../core/pet-bonds.js';
import { friendshipBetween, petEntity, FRIENDSHIP_LEVELS } from '../../core/friendships.js';

const frameColors = ['#d8c5ae', '#be909a', '#93a187', '#a597b3'];

export async function createPetPortrait(state, friendId = null) {
  const id = state.pet, bond = state.petBonds[id];
  if (!state.pets.includes(id) || !bond) throw new Error('Choose a pet you own for a portrait.');
  if (friendId !== null && (friendId === id || !state.pets.includes(friendId))) throw new Error('Choose two different pets you own for a friendship portrait.');
  const pair = friendId === null ? null : friendshipBetween(state.friendships, petEntity(id), petEntity(friendId));
  const level = pair ? FRIENDSHIP_LEVELS[pair.level.index] : bondLevel(bond);
  const keepsake = Boolean(pair && pair.level.index >= 1), accent = pair ? frameColors[pair.level.index] : BOND_LEVELS[bond.ribbon].color;
  const firstName = petName(state, id), secondName = pair ? petName(state, friendId) : '';
  const dedication = state.petFamily ? `Loved by ${state.petFamily}` : '♡';
  const scene = pair ? friendshipScene(id, friendId) : petScene(id, BOND_LEVELS[bond.ribbon].color);
  const staticScene = scene.replace('<svg ', `<svg width="${pair ? 1040 : 880}" height="${pair ? 660 : 780}" `)
    .replace('aria-hidden="true"', 'aria-hidden="true" style="overflow:visible"')
    .replace(/(<g class="pet-scene-(?:snack-prop|quiet-prop|leaf)")/g, '$1 style="opacity:0"');
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 1500;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Portrait unavailable');
  const image = new Image(), url = URL.createObjectURL(new Blob([staticScene], { type: 'image/svg+xml' }));
  try { image.src = url; await image.decode(); } finally { URL.revokeObjectURL(url); }
  ctx.fillStyle = '#faf3e8'; ctx.fillRect(0, 0, 1200, 1500);
  ctx.strokeStyle = keepsake ? accent : '#d8c5ae'; ctx.lineWidth = keepsake ? 3 : 2;
  ctx.beginPath(); ctx.roundRect(44, 44, 1112, 1412, 32); ctx.stroke();
  if (keepsake) {
    ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(58, 58, 1084, 1384, 25); ctx.stroke();
    for (const [x, y, turn] of [[84, 84, 0], [1116, 84, Math.PI / 2], [1116, 1416, Math.PI], [84, 1416, -Math.PI / 2]]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(turn); ctx.fillStyle = accent;
      for (const [leafX, leafY, angle] of [[0, 20, -.55], [20, 0, .55], [0, 0, -.8]]) { ctx.beginPath(); ctx.ellipse(leafX, leafY, 5, 11, angle, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }
  ctx.textAlign = 'center';
  const text = (value, y, size, color, { serif = true, width = 960, x = 600 } = {}) => {
    ctx.fillStyle = color; let fontSize = size;
    do { ctx.font = `${fontSize}px ${serif ? 'Georgia, serif' : 'sans-serif'}`; if (ctx.measureText(value).width <= width) break; fontSize--; } while (fontSize >= 18);
    ctx.fillText(value, x, y, width);
  };
  text('L I T T L E   H O U R S', 137, 24, '#7a6455', { serif: false });
  if (pair) {
    ctx.drawImage(image, 80, 242, 1040, 660);
    text(firstName, 987, 63, '#634b40', { width: 425, x: 340 });
    text('&', 986, 43, '#b68c79', { width: 55 });
    text(secondName, 987, 63, '#634b40', { width: 425, x: 860 });
  } else {
    ctx.drawImage(image, 176, 177, 848, 752);
    text(firstName, 1005, 83, '#634b40');
    text(PET_PERSONALITIES[id].trait, 1060, 29, '#846b5b');
  }
  ctx.strokeStyle = '#ddcbb7'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(380, 1096); ctx.lineTo(820, 1096); ctx.stroke();
  text(level.title, 1162, 42, '#785a49');
  const progress = pair || bond;
  text(`${progress.minutes} min · ${progress.sessions} ${progress.sessions === 1 ? 'session' : 'sessions'}`, 1220, 27, '#7d6a59', { serif: false });
  if (keepsake) {
    ctx.save(); ctx.translate(600, 1290); ctx.strokeStyle = accent; ctx.fillStyle = '#f3e7d7'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = accent;
    for (const x of [-8, 8]) { ctx.beginPath(); ctx.moveTo(x, 11); ctx.bezierCurveTo(x - 18, 0, x - 9, -17, x, -7); ctx.bezierCurveTo(x + 9, -17, x + 18, 0, x, 11); ctx.fill(); }
    ctx.restore();
  }
  text(dedication, 1380, 32, '#785f4f');
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Portrait unavailable')), 'image/png'));
}
