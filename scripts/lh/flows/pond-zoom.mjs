import { steps } from '../steps.mjs';
import { slow } from '../chrome.mjs';

const VIEW = `(() => {
  const lake = window.__littleHours.lake.diagnostics(), scene = lake.scene, m = scene.getTransformMatrix().m;
  const project = v => { const w = v.x * m[3] + v.y * m[7] + v.z * m[11] + m[15]; return (v.x * m[1] + v.y * m[5] + v.z * m[9] + m[13]) / w; };
  const body = scene.getMeshByName('companion-articulated-body'); body.computeWorldMatrix(true);
  const ys = body.getBoundingInfo().boundingBox.vectorsWorld.map(project);
  const house = scene.getMeshByName('lake-house'), q = house?.getVerticesData('position');
  let left = Infinity, right = -Infinity, top = -Infinity;
  if (q) for (let i = 0; i < q.length; i += 3) { left = Math.min(left, q[i]); right = Math.max(right, q[i]); top = Math.max(top, q[i + 1]); }
  return { phase: lake.phase, avatar: (Math.max(...ys) - Math.min(...ys)) * innerHeight / 2, rooms: window.__littleHours.state.house.rooms.length, house: q ? { width: right - left, top } : null };
})()`;
const BITE = `!document.querySelector('#lake-bite').hidden`;

export default {
  about: "the pond camera eases in on the dock, avatar and bobber from the cast until the line is idle again, and the house beside the pond is the player's own, following the rooms in the save",
  async run(t) {
    const houses = {};
    for (const [seed, width, height] of [['pond', 1440, 1000], ['pond', 390, 844], ['one-room', 1440, 1000]]) {
      const app = await t.open({ seed, theme: 'dusk', width, height, reducedMotion: true });
      await steps.openLake(app);
      const label = `${seed} ${width}x${height}`, idle = await app.js(VIEW);
      houses[seed] = idle;
      t.check(`${label}: the pond house is built from the save`, Boolean(idle.house), idle);
      await app.clickSel('#lake-cast');
      await app.waitFor(`['wait', 'bite'].includes(window.__littleHours.lake.diagnostics()?.ui)`, { what: 'the cast to land', timeout: 30000 });
      const near = await app.js(VIEW);
      t.check(`${label}: casting brings the camera in close on the avatar`, near.avatar > idle.avatar * 1.8, { idle, near });
      await t.shot(app, `waiting-${seed}-${width}`);
      await app.waitFor(BITE, { what: 'a bite', timeout: 8000 * slow });
      await app.waitFor(`!(${BITE}) && window.__littleHours.lake.diagnostics().phase === 'idle'`, { what: 'the fish to slip away and the line to come home', timeout: 10000 * slow });
      const back = await app.js(VIEW);
      t.check(`${label}: once the line is idle the camera returns to the whole pond`, Math.abs(back.avatar - idle.avatar) < idle.avatar * .1, { idle, back });
      await t.close(app);
    }
    const [three, one] = [houses.pond, houses['one-room']];
    t.check('the pond house follows the rooms in the save', three.rooms === 3 && one.rooms === 1 && three.house && one.house && three.house.width > one.house.width + 1.5 && three.house.top > one.house.top, { three: three.house, one: one.house });
  },
};
