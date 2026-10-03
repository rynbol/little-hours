import { sleep } from './chrome.mjs';
import { fightState, movement, walkTo } from './encounter.mjs';

export async function followTrail(app, points, observe = () => {}) {
  for (const [x, z] of points) {
    const before = await fightState(app), length = Math.hypot(x - before.position.x, z - before.position.z);
    const game = await walkTo(app, x, z, { tolerance: .6, sprint: true, timeout: Math.ceil(length / 2.5 * 1000) + 15000 });
    observe(game);
  }
}

export async function climbFace(app, cliff, observe = () => {}) {
  const controls = movement(app);
  await controls.stop();
  await app.waitFor('window.__littleHours.forest.diagnostics().game.grounded && window.__littleHours.forest.diagnostics().game.stamina >= window.__littleHours.forest.diagnostics().game.state.player.maxStamina - 1', { what: 'catching a breath at the cliff before climbing', timeout: 12000 });
  const start = await fightState(app), end = Date.now() + 35000;
  try {
    while (Date.now() < end) {
      const game = await fightState(app);
      observe(game);
      if (game.state.counts.climb > start.state.counts.climb && game.grounded && game.position.y >= cliff.top - .15) return game;
      if (game.encounter.status === 'fighting') throw new Error('Exploration route entered the guardian fight');
      await controls.toward(game, cliff.x, cliff.z);
      await sleep(70);
    }
    throw new Error('Walking toward the cliff did not climb and mantle onto its summit');
  } finally { await controls.stop(); }
}

export async function glideToward(app, x, z, observe = () => {}) {
  const controls = movement(app), start = await fightState(app), end = Date.now() + 45000;
  let opened = false, closed = false;
  try {
    await controls.toward(start, x, z);
    await app.key(' ', 'Space');
    await app.waitFor('!window.__littleHours.forest.diagnostics().game.grounded', { what: 'jumping from the summit', timeout: 2000 });
    await app.key(' ', 'Space');
    await app.waitFor('window.__littleHours.forest.diagnostics().game.state.player.mode === "glide"', { what: 'the cape opening in the air', timeout: 2000 });
    opened = true;
    while (Date.now() < end) {
      const game = await fightState(app);
      observe(game);
      if (game.grounded || game.state.player.mode === 'swim') return { game, opened, closed, distance: Math.hypot(game.position.x - start.position.x, game.position.z - start.position.z) };
      if (!closed && Math.hypot(game.position.x - x, game.position.z - z) < 3 && game.state.player.mode === 'glide') { await app.key(' ', 'Space'); closed = true; await controls.stop(); }
      else if (!closed) await controls.toward(game, x, z);
      await sleep(70);
    }
    throw new Error('The gliding player did not reach a supported landing or the water');
  } finally { await controls.stop(); }
}

export async function seekShore(app, x, z, observe = () => {}) {
  const controls = movement(app), end = Date.now() + 90000;
  try {
    while (Date.now() < end) {
      const game = await fightState(app);
      observe(game);
      if (game.grounded && game.state.player.mode === 'ground' && Math.hypot(game.position.x - x, game.position.z - z) < 2) return game;
      await controls.toward(game, x, z);
      await sleep(80);
    }
    throw new Error('Swimming and walking did not return the player to the shoreline');
  } finally { await controls.stop(); }
}
