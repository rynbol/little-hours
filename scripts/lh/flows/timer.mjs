const seconds = text => { const [m, s] = String(text).split(':').map(Number); return m * 60 + s; };

export default {
  about: 'the focus timer: start counts down and puts the companion to work, pause holds, resume counts again, and the day/night toggle survives a reload, the dial sets 1-120 minutes by drag and keys, and the greenhouse plant follows the session',
  async run(t) {
    const { check, sleep } = t;
    const app = await t.open({ seed: 'three-rooms' });
    await app.settle();
    check('the timer starts at 25:00, idle', await app.text('#timer') === '25:00' && await app.attr('#stage-presence', 'data-presence') === 'idle' && await app.text('#start-button') === 'Start focusing');
    const ring = await app.box('#timer-ring'), onRing = minutes => { const a = minutes / 120 * Math.PI * 2; return { x: ring.x + Math.sin(a) * ring.width * .4, y: ring.y - Math.cos(a) * ring.height * .4 }; };
    await app.drag(onRing(25), onRing(60), 16); await sleep(100);
    check('dragging the seed round the dial sets 60 minutes at once', await app.text('#timer') === '60:00' && await app.attr('#timer-ring', 'aria-valuenow') === '60', await app.text('#timer'));
    await app.key('Home'); await app.key('ArrowRight'); await app.key('ArrowRight');
    await app.waitFor(`document.getElementById('timer').textContent === '03:00'`, { what: 'the keyboard duration to save' });
    check('Home and two right arrows set 3 minutes', await app.text('#timer') === '03:00' && await app.attr('#timer-ring', 'aria-valuetext') === '3 minutes', await app.text('#timer'));
    await app.clickSel('[data-minutes="25"]');
    await app.waitFor(`document.getElementById('timer').textContent === '25:00'`, { what: 'the preset duration to save' });
    check('the 25 minute button still sets 25', await app.text('#timer') === '25:00' && await app.attr('[data-minutes="25"]', 'aria-pressed') === 'true');
    await app.clickSel('#start-button');
    await app.waitFor(`document.getElementById('timer').textContent !== '25:00'`, { what: 'the countdown', timeout: 3000 });
    check('Start focusing starts the countdown', seconds(await app.text('#timer')) < 1500 && await app.text('#start-button') === 'Pause a moment', await app.text('#timer'));
    check('the room shows you are focusing', await app.attr('#stage-presence', 'data-presence') === 'focusing' && await app.text('#room-status') === 'Focusing' && await app.js(`document.body.classList.contains('is-focusing')`));
    const working = await app.waitFor(`document.getElementById('companion-status').dataset.state === 'working'`, { what: 'the companion at work', timeout: 20000 }).catch(() => false);
    check('the companion goes to work at the desk', working, await app.attr('#companion-status', 'data-state'));
    const before = seconds(await app.text('#timer'));
    await app.waitFor(`document.getElementById('timer').textContent !== ${JSON.stringify(await app.text('#timer'))}`, { what: 'another tick', timeout: 3000 });
    check('the timer keeps counting down', seconds(await app.text('#timer')) < before, `${before} → ${await app.text('#timer')}`);
    await app.clickSel('#start-button');
    await app.waitFor(`!document.body.classList.contains('is-focusing')`, { what: 'the pause' });
    const held = await app.text('#timer');
    check('Pause a moment pauses, offering to keep going', await app.text('#start-button') === 'Keep going' && await app.attr('#stage-presence', 'data-presence') === 'break', await app.text('#start-button'));
    const leaves = await app.waitFor(`document.getElementById('companion-status').dataset.state !== 'working'`, { what: 'the companion to leave the desk', timeout: 10000 }).catch(() => false);
    check('the companion leaves work when you pause', leaves, await app.attr('#companion-status', 'data-state'));
    await sleep(1500);
    check('a paused timer holds still', await app.text('#timer') === held, `${held} → ${await app.text('#timer')}`);
    await app.reload();
    await app.settle();
    check('a reload keeps the paused time', await app.text('#timer') === held && await app.text('#start-button') === 'Keep going', `${held} → ${await app.text('#timer')}`);
    await app.clickSel('#start-button');
    await app.waitFor(`document.getElementById('timer').textContent !== ${JSON.stringify(held)}`, { what: 'the countdown to resume', timeout: 3000 });
    check('Keep going resumes from where it paused', seconds(await app.text('#timer')) < seconds(held) && seconds(held) - seconds(await app.text('#timer')) <= 3 && await app.attr('#stage-presence', 'data-presence') === 'focusing', `${held} → ${await app.text('#timer')}`);
    await app.clickSel('#start-button');
    await app.waitFor(`!document.body.classList.contains('is-focusing')`, { what: 'the pause' });

    check('the theme starts at night', await app.js('document.body.dataset.theme') === 'dusk' && await app.text('#time-toggle') === 'Night');
    await app.clickSel('#time-toggle');
    await app.waitFor(`document.body.dataset.theme === 'day'`, { what: 'daylight' });
    check('the toggle switches to daylight', await app.text('#time-toggle') === 'Daylight' && await app.attr('#time-toggle', 'aria-label') === 'Switch to night' && (await app.saved())?.theme === 'day');
    await t.shot(app, 'day');
    await app.reload();
    await app.settle();
    check('daylight survives a reload', await app.js('document.body.dataset.theme') === 'day' && await app.text('#time-toggle') === 'Daylight');
    await app.clickSel('#time-toggle');
    await app.waitFor(`document.body.dataset.theme === 'dusk'`, { what: 'night' });
    check('the toggle switches back to night', await app.text('#time-toggle') === 'Night' && (await app.saved())?.theme === 'dusk');
    await t.close(app);

    for (const [seed, phase] of [['greenhouse-seed', 0], ['greenhouse-youngling', 2], ['greenhouse-bloom', 4]]) {
      const room = await t.open({ seed, label: seed });
      await room.settle();
      check(`${seed}: the seed bed shows that stage`, (await room.room()).plantPhase === phase, (await room.room()).plantPhase);
      await t.close(room);
    }
  },
};
