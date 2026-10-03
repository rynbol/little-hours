export const WOLF = Object.freeze({ size: 1.9, notice: 1.4, sight: 26, bow: 2.2, heel: Object.freeze([-1.3, -1.7]), arrive: 0.6, walk: 3.4, run: 8, accel: 18, turn: 7, leash: 34 });

const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export function createWolf({ x, z, facing = 0, ground, waiting = false }) {
  return { id: 'wolf', x, z, y: ground(x, z), vx: 0, vz: 0, facing, state: waiting ? 'watch' : 'follow', time: 0, events: [] };
}

function enter(wolf, state) { wolf.state = state; wolf.time = 0; wolf.events.push({ type: `wolf-${state}` }); }

function turn(wolf, toward, dt) {
  const gap = angleTo(wolf.facing, toward);
  wolf.facing += Math.sign(gap) * Math.min(Math.abs(gap), WOLF.turn * dt);
}

function heel(player) {
  const fx = Math.sin(player.facing), fz = Math.cos(player.facing), [side, back] = WOLF.heel;
  return [player.x - fz * side + fx * back, player.z + fx * side + fz * back];
}

export function placeWolf(wolf, x, z, ground) {
  Object.assign(wolf, { x, z, y: ground(x, z), vx: 0, vz: 0 });
}

export function stepWolf(wolf, { player, ground }, dt) {
  wolf.time += dt;
  const toPlayer = Math.atan2(player.x - wolf.x, player.z - wolf.z);
  if (wolf.state === 'watch') {
    turn(wolf, toPlayer, dt);
    if (wolf.time >= WOLF.notice && Math.hypot(player.x - wolf.x, player.z - wolf.z) < WOLF.sight) enter(wolf, 'bow');
  } else if (wolf.state === 'bow') {
    turn(wolf, toPlayer, dt);
    if (wolf.time >= WOLF.bow) enter(wolf, 'follow');
  } else {
    const [hx, hz] = heel(player), dx = hx - wolf.x, dz = hz - wolf.z, distance = Math.hypot(dx, dz);
    if (distance > WOLF.leash) placeWolf(wolf, hx, hz, ground);
    const speed = distance < WOLF.arrive ? 0 : distance > 4 ? WOLF.run : WOLF.walk * Math.min(1, distance / 1.5);
    const wantX = distance > 1e-6 ? dx / distance * speed : 0, wantZ = distance > 1e-6 ? dz / distance * speed : 0;
    const gx = wantX - wolf.vx, gz = wantZ - wolf.vz, gap = Math.hypot(gx, gz), step = Math.min(gap, WOLF.accel * dt);
    if (gap > 1e-6) { wolf.vx += gx / gap * step; wolf.vz += gz / gap * step; }
    if (Math.hypot(wolf.vx, wolf.vz) > 0.3) turn(wolf, Math.atan2(wolf.vx, wolf.vz), dt);
    else turn(wolf, player.facing, dt);
  }
  wolf.x += wolf.vx * dt * (wolf.state === 'follow' ? 1 : 0); wolf.z += wolf.vz * dt * (wolf.state === 'follow' ? 1 : 0);
  wolf.y = ground(wolf.x, wolf.z);
  return wolf.events;
}
