export const PLANK = { width: 0.2, gap: 0.008, minLength: 1.1, maxLength: 2.6 };

const hash = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };

export function floorBoards({ left, right, back, front }, tones) {
  const rows = Math.round((right - left) / (PLANK.width + PLANK.gap)), pitch = (right - left) / rows, boards = [];
  let previous = [];
  for (let row = 0; row < rows; row++) {
    const joints = [];
    let z = back, piece = 0;
    while (z < front) {
      let end = z + (piece === 0 ? 0.25 + hash(row, 1) * PLANK.maxLength : PLANK.minLength + hash(row, piece + 2) * (PLANK.maxLength - PLANK.minLength));
      while (previous.some(joint => Math.abs(joint - end) < 0.3)) end += 0.31;
      if (front - end < PLANK.minLength / 2) end = front;
      boards.push({
        x: left + (row + 0.5) * pitch, z: (z + end) / 2, width: pitch - PLANK.gap, length: end - z - PLANK.gap,
        tone: tones[Math.floor(hash(row, piece + 40) * tones.length)], grain: [hash(row, piece + 80), hash(row, piece + 120)],
      });
      if (end < front) joints.push(end);
      z = end; piece++;
    }
    previous = joints;
  }
  return boards;
}

export function woodGrain(context, width, height) {
  context.fillStyle = '#f6efe6'; context.fillRect(0, 0, width, height);
  for (let line = 0; line < 46; line++) {
    const x0 = hash(line, 7) * width, sway = 3 + hash(line, 9) * 9, wave = 1.5 + hash(line, 11) * 3;
    context.strokeStyle = `rgba(92, 56, 32, ${0.05 + hash(line, 13) * 0.1})`; context.lineWidth = 0.6 + hash(line, 15) * 1.8;
    context.beginPath();
    for (let y = 0; y <= height; y += 8) {
      const x = x0 + Math.sin(y / height * Math.PI * 2 * wave + line) * sway;
      if (y === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
  }
  for (let knot = 0; knot < 3; knot++) {
    const x = hash(knot, 17) * width, y = hash(knot, 19) * height;
    for (let ring = 0; ring < 4; ring++) {
      context.strokeStyle = `rgba(84, 50, 28, ${0.16 - ring * 0.03})`; context.lineWidth = 1.2;
      context.beginPath(); context.ellipse(x, y, 3 + ring * 3, 9 + ring * 7, 0, 0, Math.PI * 2); context.stroke();
    }
  }
}
