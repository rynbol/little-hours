const W = 1080, H = 1920, PAPER = '#f6ecdc', INK = '#5d4535', SOFT = '#8c7866';
const hours = minutes => minutes >= 60 ? `${Math.round(minutes / 6) / 10} h` : `${Math.round(minutes)} min`;

function fitText(ctx, text, max, size, style = '') {
  do { ctx.font = `${style} ${size--}px Georgia, serif`; } while (ctx.measureText(text).width > max && size > 18);
}

function drawSky(ctx, sky, x, y, w, h) {
  const gradient = ctx.createLinearGradient(0, y, 0, y + h);
  gradient.addColorStop(0, '#111b36'); gradient.addColorStop(1, '#2d3a5e');
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 28); ctx.clip();
  ctx.fillStyle = gradient; ctx.fillRect(x, y, w, h);
  const sx = w / 256, sy = h / 160;
  ctx.strokeStyle = '#f7e5b5aa'; ctx.lineWidth = 3; ctx.beginPath();
  sky.lines.forEach((star, i) => i ? ctx.lineTo(x + star.x * sx, y + star.y * sy) : ctx.moveTo(x + star.x * sx, y + star.y * sy)); ctx.stroke();
  for (const star of sky.stars) {
    ctx.fillStyle = star.bright ? '#ffe9a8' : '#fff6e0bb';
    ctx.beginPath(); ctx.arc(x + star.x * sx, y + star.y * sy, star.bright ? 7 : 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawSprout(ctx, x, y, stage, color) {
  const tall = [34, 70, 104, 116][stage];
  ctx.strokeStyle = '#617853'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - tall); ctx.stroke();
  ctx.fillStyle = '#809362';
  for (let i = 0; i < (stage ? 4 : 2); i++) { const side = i % 2 ? 1 : -1, ly = y - (stage ? tall * (0.3 + 0.2 * Math.floor(i / 2)) : tall); ctx.beginPath(); ctx.ellipse(x + side * 16, ly, 16, 7, side * -0.5, 0, Math.PI * 2); ctx.fill(); }
  if (stage === 2) { ctx.fillStyle = '#a6b77d'; ctx.beginPath(); ctx.arc(x, y - tall - 6, 9, 0, Math.PI * 2); ctx.fill(); }
  if (stage === 3) {
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 13, y - tall - 6 + Math.sin(a) * 13, 11, 7, a, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#d9a441'; ctx.beginPath(); ctx.arc(x, y - tall - 6, 7, 0, Math.PI * 2); ctx.fill();
  }
}

export async function createShareCard(room, { houseName, roomName, kind, minutes, sessions, sky }) {
  const card = document.createElement('canvas'); card.width = W; card.height = H;
  const ctx = card.getContext('2d');
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.fillStyle = SOFT; ctx.font = '26px Georgia, serif';
  ctx.fillText('L I T T L E   H O U R S', W / 2, 110);
  ctx.fillStyle = INK; fitText(ctx, roomName, 900, 76); ctx.fillText(roomName, W / 2, 200);
  ctx.fillStyle = SOFT; fitText(ctx, houseName, 900, 32, 'italic'); ctx.fillText(houseName, W / 2, 252);

  const top = 300, box = 900, scale = Math.max(box / room.width, 760 / room.height), w = room.width * scale, h = room.height * scale;
  ctx.save(); ctx.beginPath(); ctx.roundRect((W - box) / 2, top, box, 760, 36); ctx.clip();
  ctx.fillStyle = '#231c25'; ctx.fillRect((W - box) / 2, top, box, 760);
  ctx.drawImage(room, (W - w) / 2, top + (760 - h) / 2, w, h); ctx.restore();

  ctx.fillStyle = INK; ctx.font = '600 92px Georgia, serif';
  ctx.fillText(hours(minutes), W / 2, 1180);
  ctx.fillStyle = SOFT; ctx.font = 'italic 34px Georgia, serif';
  ctx.fillText(`of focus · ${sessions} ${sessions === 1 ? 'session' : 'sessions'}`, W / 2, 1232);

  if (kind === 'attic') drawSky(ctx, sky, 90, 1290, 900, 420);
  else {
    ctx.fillStyle = '#6b4a36'; ctx.beginPath(); ctx.roundRect(W / 2 - 110, 1600, 220, 34, 17); ctx.fill();
    drawSprout(ctx, W / 2, 1606, 3, '#e6a3a0');
  }
  ctx.fillStyle = SOFT; ctx.font = 'italic 34px Georgia, serif';
  ctx.fillText(kind === 'attic' ? 'every star is a session I finished' : 'grown one session at a time', W / 2, 1800);
  const blob = await new Promise((resolve, reject) => card.toBlob(value => value ? resolve(value) : reject(new Error('Empty card')), 'image/png'));
  return URL.createObjectURL(blob);
}
