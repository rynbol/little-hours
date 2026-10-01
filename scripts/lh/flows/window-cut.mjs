import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SEAT = 'window.__littleHours.room.diagnostics()';
const INSTALL = `(() => {
  window.__windowCut = picture => {
    const d = ${SEAT}, { scene, engine } = d, gl = engine._gl, outdoor = d.seat.world.outdoorScene, width = engine.getRenderWidth(), height = engine.getRenderHeight();
    let box = null;
    const watch = outdoor.onAfterRenderObservable.add(() => { box = gl.isEnabled(gl.SCISSOR_TEST) ? Array.from(gl.getParameter(gl.SCISSOR_BOX)) : [0, 0, width, height]; });
    engine.beginFrame(); d.draw();
    outdoor.onAfterRenderObservable.remove(watch);
    const shot = picture ? engine.getRenderingCanvas().toDataURL('image/jpeg', 0.92) : null;
    engine.clear(new scene.clearColor.constructor(0, 0, 0, 0), true, true, true);
    const autoClear = scene.autoClear; scene.autoClear = false; scene.render(); scene.autoClear = autoClear;
    const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); engine.endFrame();
    let open = 0, outside = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] === 255) continue;
      open++;
      if (!box || x < box[0] || y < box[1] || x >= box[0] + box[2] || y >= box[1] + box[3]) outside++;
    }
    return { state: d.seat.state, yaw: Number(d.seat.look.yaw.toFixed(2)), box, drawnShare: box ? Number((box[2] * box[3] / width / height).toFixed(3)) : 0, openShare: Number((open / width / height).toFixed(3)), outside, outsideLimit: Math.ceil(width * height * 1e-4), shot };
  };
  window.__windowFlight = state => new Promise(resolve => {
    const frames = [], until = performance.now() + 10000;
    let began = false;
    const step = () => {
      const d = ${SEAT}, now = d.seat.state === state;
      began ||= now;
      if (now && d.seat.world.enabled && d.seat.world.outdoor) frames.push(window.__windowCut(frames.length === 0));
      if ((now || !began) && performance.now() < until) requestAnimationFrame(step);
      else resolve(frames);
    };
    requestAnimationFrame(step);
  });
  return true;
})()`;

export default {
  about: 'From the chair the outdoor world draws only inside the window openings, at rest, looking round and mid-flight, and the room covers every pixel outside them',
  async run(t) {
    const { check } = t;
    const app = await t.open({ seed: 'three-rooms' });
    await app.settle();
    await app.waitFor(`${SEAT}.seat.world.outdoor !== false`, { what: 'the outdoor world to be built', timeout: 30000 });
    await app.js(INSTALL);
    const save = (label, frame) => { if (frame?.shot) { writeFileSync(join(t.out, `window-cut-${label}.jpg`), Buffer.from(frame.shot.split(',')[1], 'base64')); frame.shot = undefined; } return frame; };
    const sound = frame => frame.outside <= frame.outsideLimit;
    const flightIn = app.js(`window.__windowFlight('entering')`);
    await app.clickSel('#focus-mode-enter');
    const entering = (await flightIn).map((frame, i) => save(i ? '' : 'flight-in', frame));
    await app.waitFor(`${SEAT}.seat.state === 'seated'`, { what: 'the view to settle in the chair', timeout: 30000 });
    check('the fly-in reaches the chair with the outdoor world drawing for some frames', entering.length > 0, entering.length);
    check('every fly-in frame inside the room leaves no uncovered pixel outside the outdoor world\'s drawn rectangle, so no cut edge shows', entering.length > 0 && entering.every(sound), entering.filter(frame => !sound(frame)).slice(0, 3));
    const rest = save('rest', await app.js(`window.__windowCut(true)`));
    check('at rest the outdoor world draws only the window\'s screen rectangle, at most 70% of the canvas, instead of the whole canvas', rest.box && rest.drawnShare <= 0.7, rest);
    check('at rest the room covers every pixel outside that rectangle', sound(rest), rest);
    const box = await app.box('#room-canvas'), turns = [];
    for (let quarter = 1; quarter <= 4; quarter++) {
      for (const step of [187, 187]) await app.drag({ x: box.x - step / 2, y: box.y }, { x: box.x + step / 2, y: box.y });
      await app.settle();
      turns.push(save(`turn-${quarter}`, await app.js(`window.__windowCut(true)`)));
    }
    check('turning round the chair, every view keeps the uncovered pixels inside the outdoor world\'s drawn rectangle', turns.every(sound), turns);
    check('turning round the chair, some view draws well under the whole canvas of outdoor world', turns.some(frame => frame.drawnShare < 0.5), turns.map(frame => [frame.yaw, frame.drawnShare]));
    const flightOut = app.js(`window.__windowFlight('leaving')`);
    await app.key('Escape');
    const leaving = (await flightOut).map((frame, i) => save(i ? '' : 'flight-out', frame));
    await app.waitFor(`${SEAT}.seat.state === 'room' && !${SEAT}.moving`, { what: 'the view to fly back out', timeout: 30000 });
    check('every fly-out frame inside the room leaves no uncovered pixel outside the outdoor world\'s drawn rectangle', leaving.length > 0 && leaving.every(sound), { frames: leaving.length, bad: leaving.filter(frame => !sound(frame)).slice(0, 3) });
    await t.close(app);
  },
};
