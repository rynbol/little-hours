// Pictures for the wall frames, painted once on a canvas in the room's cozy
// palette. Each drawing fills any aspect ratio, so the same picture works in a
// tall frame and in a landscape frame. Framed records use a sleeve color.
const paper = '#e9d9b7', ink = '#766d56';
function border(ctx, w, h) { ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.strokeRect(w * 0.055, w * 0.055, w - w * 0.11, h - w * 0.11); }
function wash(ctx, w, h, stops) { const g = ctx.createLinearGradient(0, 0, 0, h); stops.forEach((hex, i) => g.addColorStop(i / (stops.length - 1), hex)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
function leaf(ctx, x, y, length, width, angle, hex) { ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = hex; ctx.beginPath(); ctx.ellipse(length / 2, 0, length / 2, width / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }

export const ARTWORKS = {
  herbarium: { name: 'Moon herbarium', draw(ctx, w, h) {
    ctx.fillStyle = paper; ctx.fillRect(0, 0, w, h); border(ctx, w, h);
    const s = Math.min(w / 256, h / 320), cx = w / 2, top = h / 2 - 160 * s;
    ctx.fillStyle = '#9b784d'; ctx.beginPath(); ctx.arc(cx, top + 112 * s, 58 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = paper; ctx.beginPath(); ctx.arc(cx + 20 * s, top + 99 * s, 49 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6e815b'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(cx - 18 * s, top + 274 * s); ctx.quadraticCurveTo(cx + 23 * s, top + 216 * s, cx - 23 * s, top + 175 * s); ctx.stroke();
    for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(cx - 10 * s, top + (252 - i * 15) * s); ctx.rotate(i % 2 ? 0.7 : -0.7); ctx.fillStyle = '#899872'; ctx.beginPath(); ctx.ellipse((i % 2 ? 18 : -18) * s, -8 * s, 23 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  } },
  hills: { name: 'Evening hills', draw(ctx, w, h) {
    wash(ctx, w, h, ['#c7b3c9', '#efcfb2', '#f4dfc0']);
    ctx.fillStyle = '#fbeed2'; ctx.beginPath(); ctx.arc(w * 0.7, h * 0.28, Math.min(w, h) * 0.09, 0, Math.PI * 2); ctx.fill();
    [['#a8b597', 0.58, 0.07], ['#869a7c', 0.68, 0.06], ['#6b8367', 0.8, 0.05]].forEach(([hex, base, wave], layer) => {
      ctx.fillStyle = hex; ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += w / 24) ctx.lineTo(x, h * (base + Math.sin(x / w * 5 + layer * 1.7) * wave)); ctx.lineTo(w, h); ctx.fill();
    });
    ctx.fillStyle = '#5b5046'; ctx.fillRect(w * 0.25, h * 0.7, w * 0.07, h * 0.05); ctx.beginPath(); ctx.moveTo(w * 0.24, h * 0.7); ctx.lineTo(w * 0.285, h * 0.66); ctx.lineTo(w * 0.33, h * 0.7); ctx.fill();
    ctx.fillStyle = '#f6d58c'; ctx.fillRect(w * 0.27, h * 0.715, w * 0.02, h * 0.018);
    border(ctx, w, h);
  } },
  sea: { name: 'Quiet tide', draw(ctx, w, h) {
    wash(ctx, w, h, ['#f1c9b0', '#f3dcc0', '#efe2c8']);
    ctx.fillStyle = '#eba27e'; ctx.beginPath(); ctx.arc(w / 2, h * 0.55, Math.min(w, h) * 0.16, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#7fa3a6'; ctx.fillRect(0, h * 0.55, w, h * 0.45);
    ctx.strokeStyle = '#d9e3d8'; ctx.lineWidth = Math.max(2, w / 110);
    for (let row = 0; row < 5; row++) { const y = h * (0.62 + row * 0.07); ctx.beginPath(); for (let x = w * 0.1; x < w * 0.9; x += w / 9) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w / 36, y - h * 0.012, x + w / 18, y); } ctx.stroke(); }
    ctx.fillStyle = '#6a5a4d'; ctx.beginPath(); ctx.moveTo(w * 0.62, h * 0.53); ctx.lineTo(w * 0.72, h * 0.53); ctx.lineTo(w * 0.69, h * 0.56); ctx.lineTo(w * 0.64, h * 0.56); ctx.fill(); ctx.fillRect(w * 0.665, h * 0.44, w * 0.006, h * 0.09);
    ctx.fillStyle = '#f7ead4'; ctx.beginPath(); ctx.moveTo(w * 0.672, h * 0.45); ctx.lineTo(w * 0.71, h * 0.51); ctx.lineTo(w * 0.672, h * 0.51); ctx.fill();
    border(ctx, w, h);
  } },
  kitten: { name: 'Sleepy kitten', draw(ctx, w, h) {
    ctx.fillStyle = '#efe0c3'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9c7a4'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.68, w * 0.36, h * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    const s = Math.min(w, h), cx = w / 2, cy = h * 0.6;
    ctx.fillStyle = '#d08e57'; ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.27, s * 0.17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d08e57'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx + s * 0.05, cy + s * 0.02, s * 0.25, 0.1, 1.5); ctx.stroke();
    ctx.fillStyle = '#e2a86d'; ctx.beginPath(); ctx.arc(cx - s * 0.2, cy - s * 0.02, s * 0.13, 0, Math.PI * 2); ctx.fill();
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx - s * 0.2 + side * s * 0.1, cy - s * 0.1); ctx.lineTo(cx - s * 0.2 + side * s * 0.05, cy - s * 0.21); ctx.lineTo(cx - s * 0.2 + side * s * 0.005, cy - s * 0.12); ctx.fill(); }
    ctx.strokeStyle = '#6e513b'; ctx.lineWidth = Math.max(2, s * 0.012);
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(cx - s * 0.2 + side * s * 0.05, cy - s * 0.02, s * 0.028, 0.2, Math.PI - 0.2); ctx.stroke(); }
    ctx.fillStyle = '#c47a6b'; ctx.beginPath(); ctx.arc(cx - s * 0.2, cy + s * 0.025, s * 0.012, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b3774a'; ctx.lineWidth = Math.max(2, s * 0.016);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx + s * (0.02 + i * 0.07), cy - s * 0.15); ctx.lineTo(cx + s * (0.04 + i * 0.07), cy - s * 0.08); ctx.stroke(); }
    ctx.fillStyle = '#9b8cb3'; ctx.font = `${Math.round(s * 0.09)}px serif`; ctx.fillText('z', cx + s * 0.1, cy - s * 0.26); ctx.font = `${Math.round(s * 0.065)}px serif`; ctx.fillText('z', cx + s * 0.18, cy - s * 0.34);
    border(ctx, w, h);
  } },
  blossom: { name: 'Cherry branch', draw(ctx, w, h) {
    ctx.fillStyle = '#f4e9dc'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#6a5548'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(3, w / 45);
    ctx.beginPath(); ctx.moveTo(w * 0.12, h * 0.85); ctx.quadraticCurveTo(w * 0.35, h * 0.55, w * 0.55, h * 0.45); ctx.quadraticCurveTo(w * 0.72, h * 0.37, w * 0.86, h * 0.18); ctx.stroke();
    ctx.lineWidth = Math.max(2, w / 80); ctx.beginPath(); ctx.moveTo(w * 0.42, h * 0.52); ctx.quadraticCurveTo(w * 0.4, h * 0.38, w * 0.3, h * 0.27); ctx.stroke();
    const flowers = [[0.3, 0.27], [0.36, 0.34], [0.5, 0.46], [0.6, 0.4], [0.7, 0.33], [0.78, 0.24], [0.86, 0.18], [0.24, 0.66], [0.64, 0.47]];
    flowers.forEach(([fx, fy], i) => {
      const r = Math.min(w, h) * (0.035 + (i % 3) * 0.006);
      for (let p = 0; p < 5; p++) { const a = p * Math.PI * 2 / 5 + i; ctx.fillStyle = i % 2 ? '#e8b3b0' : '#d3979c'; ctx.beginPath(); ctx.arc(w * fx + Math.cos(a) * r, h * fy + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#f6dc9a'; ctx.beginPath(); ctx.arc(w * fx, h * fy, r * 0.35, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#b7584f'; ctx.fillRect(w * 0.78, h * 0.78, w * 0.08, w * 0.08);
    border(ctx, w, h);
  } },
  stars: { name: 'Little constellations', draw(ctx, w, h) {
    wash(ctx, w, h, ['#2c3350', '#3b4264', '#4d4f72']);
    const s = Math.min(w, h);
    ctx.fillStyle = '#f2dfae'; ctx.beginPath(); ctx.arc(w * 0.72, h * 0.22, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3b4264'; ctx.beginPath(); ctx.arc(w * 0.75, h * 0.2, s * 0.085, 0, Math.PI * 2); ctx.fill();
    const stars = [[0.2, 0.3], [0.32, 0.42], [0.45, 0.36], [0.55, 0.52], [0.3, 0.68], [0.45, 0.78], [0.62, 0.72], [0.78, 0.84]];
    ctx.strokeStyle = '#c9b98f'; ctx.lineWidth = Math.max(1.5, s / 170); ctx.beginPath();
    [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7]].forEach(([a, b]) => { ctx.moveTo(w * stars[a][0], h * stars[a][1]); ctx.lineTo(w * stars[b][0], h * stars[b][1]); }); ctx.stroke();
    ctx.fillStyle = '#fff1ce';
    stars.forEach(([x, y], i) => { const r = s * (i % 3 ? 0.012 : 0.018); ctx.beginPath(); ctx.arc(w * x, h * y, r, 0, Math.PI * 2); ctx.fill(); });
    for (let i = 0; i < 40; i++) { ctx.fillStyle = '#fff5da88'; ctx.fillRect((i * 0.618 % 1) * w, (i * 0.377 % 1) * h, 2, 2); }
    ctx.strokeStyle = '#c9b98f'; ctx.lineWidth = 3; ctx.strokeRect(w * 0.055, w * 0.055, w - w * 0.11, h - w * 0.11);
  } },
  fern: { name: 'Fern study', draw(ctx, w, h) {
    ctx.fillStyle = '#ece4cc'; ctx.fillRect(0, 0, w, h);
    const s = Math.min(w, h), base = [w * 0.5, h * 0.88], tip = [w * 0.54, h * 0.12];
    ctx.strokeStyle = '#6e815b'; ctx.lineWidth = Math.max(2, s / 70); ctx.beginPath(); ctx.moveTo(...base); ctx.quadraticCurveTo(w * 0.42, h * 0.5, ...tip); ctx.stroke();
    for (let i = 1; i < 12; i++) {
      const t = i / 12, x = (1 - t) ** 2 * base[0] + 2 * (1 - t) * t * w * 0.42 + t * t * tip[0], y = (1 - t) ** 2 * base[1] + 2 * (1 - t) * t * h * 0.5 + t * t * tip[1];
      const length = s * 0.22 * (1 - t * 0.7);
      leaf(ctx, x, y, length, length * 0.28, -0.5 - t * 0.3, i % 2 ? '#899872' : '#7b8e66');
      leaf(ctx, x, y, length, length * 0.28, Math.PI + 0.5 + t * 0.3, i % 2 ? '#7b8e66' : '#899872');
    }
    ctx.fillStyle = ink; ctx.fillRect(w * 0.3, h * 0.93, w * 0.4, 2);
    border(ctx, w, h);
  } },
};
// Framed records show a sleeve color instead of a painted picture.
export const SLEEVES = { lilac: { name: 'Lilac', color: '#b4aecb' }, coral: { name: 'Coral', color: '#d68f88' }, sage: { name: 'Sage', color: '#a7b89a' }, honey: { name: 'Honey', color: '#e0b56e' } };
export const artName = id => ARTWORKS[id]?.name || SLEEVES[id]?.name || id;
