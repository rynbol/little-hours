import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { steps } from '../steps.mjs';
import { enterWilds, leaveWilds } from '../wilds.mjs';
import { fightState, inputResponse, recordFight, walkTo } from '../encounter.mjs';

export default {
  about: 'saved wardrobe and active pets become weighted Forest actors with baked movement and care animations',
  async run(t) {
    const app = await t.open({ seed: 'three-rooms', scale: 2 }); await app.settle();
    await steps.openAvatar(app);
    for (const [section, part, value] of [['face', 'style', 'bob'], ['outfit', 'outfit', 'hoodie'], ['outfit', 'bottomStyle', 'shorts'], ['details', 'accessory', 'glasses']]) {
      await app.clickSel(`[data-avatar-section="${section}"]`);
      await app.clickSel(`[data-avatar-part="${part}"][data-avatar-value="${value}"]`);
      await app.waitFor(`window.__littleHours.state.avatar.${part} === '${value}'`, { what: `${part} wardrobe choice` });
    }
    await steps.closeAvatar(app);
    const appearance = await app.js('structuredClone(window.__littleHours.state.avatar)');
    const evidence = [];
    for (const species of ['dog', 'cat']) {
      await app.clickSel('#pet-button');
      if (!await app.visible(`[data-pet-choice="${species}"]`)) await app.clickSel('#pet-collection > summary');
      await app.clickSel(`[data-pet-choice="${species}"]`);
      await app.waitFor(`window.__littleHours.state.pet === '${species}'`, { what: `active ${species}` });
      await app.clickSel('#close-panel'); await app.settle();
      await steps.openHouse(app); await enterWilds(app);
      const arrival = await fightState(app), actors = arrival.actors;
      t.check(`${species}: the Forest hero preserves all saved wardrobe fields`, JSON.stringify(actors.hero.appearance) === JSON.stringify(appearance), { expected: appearance, actor: actors.hero });
      t.check(`${species}: selected meshes replace the other garment variants`, ['Hair_bob', 'Outfit_hoodie', 'Bottom_shorts', 'Accessory_glasses'].every(name => actors.hero.visible.some(mesh => mesh === name || mesh.startsWith(name + '_'))) && !actors.hero.visible.includes('Hair_bun') && !actors.hero.visible.includes('Outfit_cardigan'), actors.hero.visible);
      t.check(`${species}: the active partner and hero load weighted rigs`, actors.partner.species === species && actors.partner.skinnedMeshes > 0 && actors.partner.bones > 10 && actors.hero.skinnedMeshes > 0 && actors.hero.bones > 10, actors);
      const stop = await recordFight(app, join(t.out, species));
      const response = {};
      response.move = await inputResponse(app, () => app.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW' }), 'game.actors.hero.clip === "run" || game.actors.hero.clip === "walk"');
      await t.sleep(350); await app.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW' });
      response.jump = await inputResponse(app, () => app.key(' ', 'Space'), 'game.actors.hero.clip === "jump"'); await t.sleep(950);
      response.dodge = await inputResponse(app, () => app.key('Control', 'ControlLeft'), 'game.actors.hero.clip === "dodge"'); await t.sleep(750);
      response.whistle = await inputResponse(app, () => app.key('r', 'KeyR'), 'game.actors.hero.clip === "whistle"'); await t.sleep(2200);
      await walkTo(app, 0, 2); await t.sleep(700);
      await app.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW' }); await t.sleep(80);
      await app.key('Escape'); await app.waitFor('!document.querySelector("#wilds-menu").hidden', { what: 'Forest menu' });
      await app.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW' });
      const coasting = await fightState(app);
      t.check(`${species}: the care menu test pauses while still moving`, Math.hypot(coasting.state.player.vx, coasting.state.player.vz) > .5, coasting.state.player);
      await app.clickSel('[data-wilds-action="tab-camp"]'); await app.clickSel('[data-wilds-action="pet"]');
      await app.waitFor('window.__littleHours.forest.diagnostics().game.exploration.petting > 0', { what: 'camp companion care' });
      await app.waitFor('window.__littleHours.forest.diagnostics().game.actors.partner.clip === "pet"', { what: 'baked companion cuddle', timeout: 5000 });
      const care = await fightState(app); t.check(`${species}: camp care plays the hero and partner baked pet clips`, care.actors.hero.clip === 'pet' && care.actors.partner.clip === 'pet', care.actors);
      t.check(`${species}: baked move, jump, dodge and whistle respond to real input`, Object.values(response).every(value => value.responded && value.ms < 100), response);
      const frames = await stop(); evidence.push({ species, arrival, response, care, frames }); await t.shot(app, `${species}-care`); await leaveWilds(app); await steps.backToRoom(app);
    }
    writeFileSync(join(t.out, 'actor-evidence.json'), JSON.stringify(evidence, null, 2)); await t.close(app);
  }
};
