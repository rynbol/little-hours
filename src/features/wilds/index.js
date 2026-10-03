import { ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, MeshDepthMaterial, PCFShadowMap, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { normalizeAvatarAppearance } from '../../core/avatar.js';
import { createFeelSimulation, DUMMY } from '../../core/wilds/feel.js';
import { createEncounter, STONES } from '../../core/wilds/encounter.js';
import { createAdventure } from '../../core/wilds/progression.js';
import { createValleyWorld, CAMPS, LANDMARKS } from '../../core/wilds/world.js';
import { createValley } from '../../models/wilds/valley.js';
import { loadMossheart } from '../../models/wilds/mossheart.js';
import { wildsMenu } from './menus.js';
import { heightAt } from '../../core/world-terrain.js';
import { clockNow } from '../../core/test-pins.js';
import { createFeelBox } from '../../models/wilds/feel-box.js';
import { createEncounterShapes } from '../../models/wilds/encounter-shapes.js';
import { createWildsCamera } from './camera.js';
import { createWildsInput } from './input.js';
import { createWildsAudio } from './audio.js';
import './wilds.css';

const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12"/></svg>';

export async function createWildsGame({ container, appearance, pet = 'cat', bond = 0, readSave, updateSave, onLeave }) {
  const avatar = normalizeAvatarAppearance(appearance), events = new AbortController();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motion.matches, paused = false, disposed = false, ready = false, frame = 0, lastTime = 0, lastFrame = 0;
  let locked = false, muted = false, locks = 0, renderCount = 0, lastDisposal = null, impact = 0, lastHit = 0;
  let renderer, scene, camera, model, shapes, valley, stag, rig, input, respawn = 0, lastVictory = 0, menuMode = 'controls', sun, herbsHealed=0;
  const adventure = createAdventure({read:readSave,transact:updateSave}), world=createValleyWorld();
  const frameTimes = new Float64Array(3600), workTimes = new Float64Array(3600);
  let frameSamples = 0, maxFrame = 0, over20 = 0;
  const encounter = createEncounter({ bond, world, stats:adventure.stats, checkpoint:()=>adventure.checkpoint, exploration:()=>adventure.state }), sound = createWildsAudio();
  const sim = createFeelSimulation({ target: encounter.target, obstacles: STONES, world, bounds:null, posts:[], stats:adventure.stats }), projected = new Vector3();
  sim.reset(adventure.checkpoint);
  container.innerHTML = `<canvas id="wilds-canvas" tabindex="0" aria-label="The Wilds. Escape opens controls, your satchel and the return menu."></canvas>
    <div class="wilds-hud" aria-label="Adventure status">
      <div id="wilds-stamina" role="meter" aria-label="Stamina" aria-valuemin="0" aria-valuemax="100"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="wilds-ring-track" cx="22" cy="22" r="18"/><circle class="wilds-ring-fill" cx="22" cy="22" r="18"/></svg></div>
      <div id="wilds-target" aria-hidden="true"><i></i><b></b></div>
      <div id="wilds-vitals" hidden><div id="wilds-health" role="meter" aria-label="Health" aria-valuemin="0" aria-valuemax="100"><b></b></div><div id="wilds-partner" role="meter" aria-label="Partner health" aria-valuemin="0" aria-valuemax="100"><b></b></div><svg id="wilds-partner-skill" viewBox="0 0 24 24" aria-label="Partner skill ready"><path d="M8 16c-4 7 12 7 8 0l-4-5z"/><circle cx="5" cy="9" r="2"/><circle cx="10" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="20" cy="9" r="2"/></svg></div>
      <div id="wilds-boss-health" role="meter" aria-label="Guardian health" hidden><b></b></div>
      <div id="wilds-recovery" aria-hidden="true"></div>
      <button id="wilds-pause" aria-label="Pause and controls">${pauseIcon}</button>
      <div id="wilds-muted" aria-label="Sound muted" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 5 0 5-4v14l-5-4H3zM17 9l5 6m0-6-5 6"/></svg></div>
    </div>
    <div id="wilds-interact" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 12V5a2 2 0 0 1 4 0v5-6a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v8q0 7-7 7H9l-5-6q-2-4 1-4l4 3"/></svg></div>
    <div id="wilds-discovery" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 4 29 19 44 24 29 29 24 44 19 29 4 24 19 19Z"/></svg></div>
    <div id="wilds-menu" hidden></div>`;
  const canvas = container.querySelector('#wilds-canvas'), menu = container.querySelector('#wilds-menu');
  const stamina = container.querySelector('#wilds-stamina'), ring = stamina.querySelector('.wilds-ring-fill');
  const target = container.querySelector('#wilds-target'), health = target.querySelector('b');
  const muteIndicator = container.querySelector('#wilds-muted');
  const get = selector => container.querySelector(selector);
  function stop() { cancelAnimationFrame(frame); frame = 0; lastTime = 0; lastFrame = 0; }
  function resume() {
    if (disposed) return;
    paused = false; menu.hidden = true; input?.release();
    canvas.focus({ preventScroll: true }); sound.unlock(); start();
  }
  function renderMenu() {
    const p=sim.state.player, atMerchant=Math.hypot(p.x-LANDMARKS.merchant.x,p.z-LANDMARKS.merchant.z)<6;
    const atCamp=CAMPS.some(c=>Math.hypot(p.x-c.x,p.z-c.z)<4 && Math.abs(p.y-c.y)<2);
    menu.innerHTML=wildsMenu(adventure,menuMode,atMerchant,atCamp);
  }
  function pause(mode='controls') {
    if (disposed) return;
    paused = true; stop(); sound.suspend(); input?.release(); menuMode=typeof mode==='string'?mode:'controls';renderMenu();menu.hidden = false;
    get('#wilds-resume').focus({ preventScroll: true });
  }
  function toggleLock() {
    if (paused) return;
    const player = sim.state.player;
    const focus = encounter.target();
    locked = !locked && Boolean(focus) && Math.hypot(player.x - focus.x, player.z - focus.z) < 20;
    if (locked) locks++;
  }
  function resize() {
    if (!renderer) return;
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2800000 / (width * height))));
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  function project(x, y, z, element) {
    projected.set(x, y, z).project(camera);
    element.style.left = `${(projected.x * .5 + .5) * container.clientWidth}px`;
    element.style.top = `${(-projected.y * .5 + .5) * container.clientHeight}px`;
    element.style.visibility = projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2 ? 'visible' : 'hidden';
  }
  function updateHUD() {
    const p = sim.state.player;
    project(p.x, p.y + 1.2, p.z, stamina);
    stamina.style.opacity = p.stamina < p.maxStamina-.1 ? '1' : '0';
    stamina.setAttribute('aria-valuemax',String(p.maxStamina));
    stamina.setAttribute('aria-valuenow', String(Math.round(p.stamina)));
    ring.style.strokeDashoffset = String(113.1 * (1 - p.stamina / p.maxStamina));
    ring.style.stroke = p.stamina < 23 ? '#e8b58b' : '#e6ecd4';
    const focus = encounter.target(), fight = encounter.state, active = fight.status === 'fighting';
    project(focus.x, heightAt(focus.x, focus.z) + (focus.height || 1.8) + .4, focus.z, target);
    target.style.opacity = locked || sim.state.dummy.flash > 0 ? '1' : '0';
    health.style.transform = `scaleX(${Math.max(.02, active ? fight.boss.health / fight.boss.maxHealth : sim.state.dummy.health / 100)})`;
    get('#wilds-vitals').hidden = fight.status === 'dormant' && fight.player.health===fight.player.maxHealth;
    const interact=get('#wilds-interact');interact.style.opacity=adventure.state.near?'1':'0';project(p.x,p.y+1.7,p.z,interact);
    get('#wilds-discovery').style.opacity=String(Math.min(1,adventure.state.glow));
    get('#wilds-health b').style.transform = `scaleX(${fight.player.health / fight.player.maxHealth})`;
    get('#wilds-health').setAttribute('aria-valuenow', String(Math.round(fight.player.health / fight.player.maxHealth * 100)));
    get('#wilds-partner b').style.transform = `scaleX(${fight.pet.health / fight.pet.maxHealth})`;
    get('#wilds-partner').setAttribute('aria-valuenow', String(Math.round(fight.pet.health / fight.pet.maxHealth * 100)));
    get('#wilds-partner-skill').style.opacity = fight.pet.skillCooldown > 0 ? '.25' : '1';
    get('#wilds-boss-health').hidden = !active;
    get('#wilds-boss-health b').style.transform = `scaleX(${fight.boss.health / fight.boss.maxHealth})`;
    get('#wilds-boss-health').setAttribute('aria-valuenow', String(Math.round(fight.boss.health / fight.boss.maxHealth * 100)));
    get('#wilds-recovery').style.opacity = fight.status === 'recovering' ? '.9' : '0';
  }
  function tick(timestamp) {
    frame = 0;
    if (paused || disposed || document.hidden) return;
    const began = performance.now(), now = clockNow(), dt = lastTime ? Math.min(.05, Math.max(0, (now - lastTime) / 1000)) : 1 / 60;
    lastTime = now;
    const controls = input.read(rig.yaw, dt);
    if (paused) return;
    const focus = encounter.target();
    if (locked && Math.hypot(sim.state.player.x - focus.x, sim.state.player.z - focus.z) > 22) locked = false;
    const gameDt = dt * encounter.state.slowMotion;
    sim.step(gameDt, { ...controls, locked });
    encounter.step(gameDt, sim.state, controls);
    const exploration=adventure.step(gameDt,sim.state.player,encounter.state.pet,{...controls,fighting:encounter.state.status==='fighting'});
    if(adventure.state.counts.herbs>herbsHealed){encounter.heal(18*(adventure.state.counts.herbs-herbsHealed));herbsHealed=adventure.state.counts.herbs;}
    if(encounter.state.victory && encounter.state.victory!==lastVictory){lastVictory=encounter.state.victory;adventure.victory();}
    if(exploration.menu){
      if(exploration.menu.kind==='camp'){adventure.rest(exploration.menu.id);encounter.heal();}
      pause(exploration.menu.kind);return;
    }
    if (encounter.state.status === 'won' || encounter.state.status === 'recovering') locked = false;
    if (encounter.state.respawn?.serial !== respawn && encounter.state.respawn?.serial) {
      respawn = encounter.state.respawn.serial; sim.reset(encounter.state.respawn); rig.reset(); input.release(); locked = false; lastHit = 0;
    }
    if (sim.state.lastHit?.serial !== lastHit && sim.state.lastHit) { lastHit = sim.state.lastHit.serial; impact = 1; }
    impact = Math.max(0, impact - dt * 8);
    model.update(sim.state, sim.state.hitStop || sim.state.hitStopped ? 0 : gameDt, reducedMotion);
    shapes.update(encounter.state, sim.state, sim.state.hitStop || sim.state.hitStopped ? 0 : gameDt, reducedMotion);
    stag.update(encounter.state, sim.state, sim.state.hitStop || sim.state.hitStopped ? 0 : gameDt, reducedMotion);
    sound.update(encounter.state, sim.state);
    valley.update(sim.state,encounter.state,adventure.state,gameDt,reducedMotion);
    sun.target.position.set(sim.state.player.x,sim.state.player.y,sim.state.player.z-10);
    sun.position.set(sun.target.position.x-35,sun.target.position.y+45,sun.target.position.z+25);
    rig.update(sim.state.player, locked, dt, reducedMotion ? 0 : Math.sin(impact * 15) * impact);
    renderer.render(scene, camera); renderCount++; updateHUD();
    if (lastFrame) {
      const elapsed = timestamp - lastFrame;
      frameTimes[frameSamples % frameTimes.length] = elapsed;
      workTimes[frameSamples % workTimes.length] = performance.now() - began;
      frameSamples++; maxFrame = Math.max(maxFrame, elapsed); if (elapsed > 20) over20++;
    }
    lastFrame = timestamp;
    if(!paused)frame = requestAnimationFrame(tick);
  }
  function start() { if (ready && !paused && !disposed && !document.hidden && !frame) { lastTime = 0; lastFrame = 0; frame = requestAnimationFrame(tick); } }
  function disposal() {
    if (disposed) return;
    disposed = true; ready = false; stop(); sound.dispose(); clearInterval(padPoll); events.abort(); input?.dispose(); observer.disconnect();
    const geometries = new Set(), materials = new Set(), textures = new Set(), targets = new Set();
    scene?.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.skeleton?.boneTexture) textures.add(object.skeleton.boneTexture);
      if (object.material) for (const material of [].concat(object.material)) materials.add(material);
      if (object.customDepthMaterial) materials.add(object.customDepthMaterial);
      if (object.shadow?.map) targets.add(object.shadow.map);
      if (object.shadow?.mapPass) targets.add(object.shadow.mapPass);
    });
    for (const material of materials) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    for (const material of materials) for (const uniforms of material.userData.wildsUniforms || []) for (const uniform of Object.values(uniforms)) if (uniform.value?.isTexture) textures.add(uniform.value);
    stag?.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    for (const target of targets) target.dispose();
    if (renderer) {
      renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss();
      lastDisposal = { ready: false, disposed: true, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length || 0, contextLost: renderer.getContext().isContextLost(), renderCount };
    }
    valley?.dispose?.(); scene?.clear(); renderer = null; scene = null; model = null; shapes = null; valley = null; stag = null; sun = null; rig = null; input = null; camera = null;
    container.replaceChildren();
  }
  const observer = new ResizeObserver(resize);
  const padPoll = setInterval(() => { if (paused && !document.hidden) input?.read(rig.yaw, .08); }, 80);
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
    scene = new Scene(); scene.background = new Color('#b8d0d6'); scene.fog = new Fog('#b8d0d6', 180, 6000);
    camera = new PerspectiveCamera(60, 1, .15, 9500);
    const ambient = new HemisphereLight('#d0e3f3', '#65796b', 1.5);
    sun = new DirectionalLight('#ffe4b8', 2.7); sun.position.set(-12, 19, 10); sun.castShadow = true;
    sun.target.position.z = -16; sun.position.z -= 16;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -28; sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -28; sun.shadow.camera.near = 1; sun.shadow.camera.far = 160;
    sun.shadow.normalBias = .035; sun.shadow.bias = -.0001;
    scene.add(ambient, sun, sun.target);
    model = createFeelBox(scene,{training:false,world}); shapes = createEncounterShapes(scene);
    stag=await loadMossheart(scene,{world});
    stag.update(encounter.state,sim.state,0,reducedMotion);
    valley=createValley(scene,{world});valley.skyUniforms.top.value.set('#4b91cc');valley.skyUniforms.horizon.value.set('#b6d4df');
    rig = createWildsCamera(camera, { target: encounter.target, obstacles: STONES, world, heading:-.33 });
    const depthMaterial = new MeshDepthMaterial();
    scene.traverse(object => { if (object.castShadow && object.isMesh) object.customDepthMaterial = depthMaterial; });
    input = createWildsInput(canvas, { onInteraction: sound.unlock, pause: () => paused ? resume() : pause(), lock: toggleLock, mute: () => { muted = !muted; sound.setMuted(muted); muteIndicator.hidden = !muted; }, orbit: (dx, dy) => { if (!paused) rig.orbit(dx, dy); }, zoom: delta => { if (!paused) rig.zoom(delta); } });
    get('#wilds-pause').addEventListener('click', pause, { signal: events.signal });
    menu.addEventListener('click', async event=>{
      const command=event.target.closest('[data-wilds-action]')?.dataset.wildsAction;
      if(!command)return;
      if(command==='resume'){resume();return;}
      if(command==='leave'){onLeave();return;}
      if(command.startsWith('tab-'))menuMode=command.slice(4);
      if(command.startsWith('buy:')){event.target.closest('button').disabled=true;await adventure.buy(command.slice(4),sim.state.player);}
      if(command==='potion' && await adventure.drink())encounter.heal(encounter.state.player.maxHealth*.5);
      if(command.startsWith('rest-')){
        const p=sim.state.player,camp=CAMPS.find(c=>Math.hypot(p.x-c.x,p.z-c.z)<4 && Math.abs(p.y-c.y)<2);
        if(camp && await adventure.rest(camp.id,command==='rest-morning'?7:21)){encounter.heal();sim.state.player.stamina=adventure.stats.stamina;}
      }
      if(!disposed)renderMenu();
    },{signal:events.signal});
    menu.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      const buttons=[...menu.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);
      buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();
    }, { signal: events.signal });
    motion.addEventListener('change', event => { reducedMotion = event.matches; }, { signal: events.signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); sound.suspend(); input.release(); } else start(); }, { signal: events.signal });
    observer.observe(container); resize(); model.update(sim.state, 0, reducedMotion); shapes.update(encounter.state, sim.state, 0, reducedMotion); rig.update(sim.state.player, false, 1);
    await renderer.compileAsync(scene, camera);
    renderer.render(scene, camera); renderer.getContext().finish();
    ready = true; start(); canvas.focus({ preventScroll: true });
  } catch (error) { disposal(); throw error; }
  return {
    pause, resume, dispose: disposal,
    diagnostics() {
      if (disposed) return lastDisposal;
      const samples = Array.from(frameTimes.slice(0, Math.min(frameSamples, frameTimes.length))).sort((a, b) => a - b);
      const work = Array.from(workTimes.slice(0, Math.min(frameSamples, workTimes.length))).sort((a, b) => a - b);
      return { ready, paused, disposed, avatar, pet, landmarks:{cliff:world.solids.find(s=>s.id==='cliff'),camps:CAMPS}, exploration:{...structuredClone(adventure.state),save:adventure.save,stats:{...adventure.stats},checkpoint:adventure.checkpoint,coins:adventure.coins}, valley:valley.diagnostics?.(), actors:{stag:stag.diagnostics()}, encounter: structuredClone(encounter.state), position: { x: sim.state.player.x, y: sim.state.player.y, z: sim.state.player.z }, grounded: sim.state.player.grounded, stamina: sim.state.player.stamina, action: { ...sim.state.action }, state: structuredClone(sim.state), locked, muted, camera: rig.diagnostics(), counters: { ...sim.state.counts, jumps: sim.state.counts.jump, dodges: sim.state.counts.dodge, locks }, dummyPosition: { x: DUMMY.x, y: model.dummyPosition[1], z: DUMMY.z }, renderCount, frame: { samples: frameSamples, maxMs: maxFrame, p95Ms: samples[Math.floor(samples.length * .95)] || 0, over20, cpuP95Ms: work[Math.floor(work.length * .95)] || 0 }, resources: { ...renderer.info.memory, programs: renderer.info.programs.length, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio() } };
    },
  };
}
