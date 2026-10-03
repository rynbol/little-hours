import { ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, MeshDepthMaterial, PCFShadowMap, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { normalizeAvatarAppearance } from '../../core/avatar.js';
import { createFeelSimulation, DUMMY } from '../../core/wilds/feel.js';
import { clockNow } from '../../core/test-pins.js';
import { createFeelBox } from '../../models/wilds/feel-box.js';
import { createWildsCamera } from './camera.js';
import { createWildsInput } from './input.js';
import './wilds.css';

const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12"/></svg>';

export async function createWildsGame({ container, appearance, onLeave }) {
  const avatar = normalizeAvatarAppearance(appearance), events = new AbortController();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motion.matches, paused = false, disposed = false, ready = false, frame = 0, lastTime = 0, lastFrame = 0;
  let locked = false, muted = false, locks = 0, renderCount = 0, lastDisposal = null, impact = 0, lastHit = 0;
  let renderer, scene, camera, model, rig, input;
  const frameTimes = new Float64Array(3600), workTimes = new Float64Array(3600);
  let frameSamples = 0, maxFrame = 0, over20 = 0;
  const sim = createFeelSimulation(), projected = new Vector3();
  container.innerHTML = `<canvas id="wilds-canvas" tabindex="0" aria-label="Wilds training ground. Escape opens controls and the return menu."></canvas>
    <div class="wilds-hud" aria-label="Training status">
      <div id="wilds-stamina" role="meter" aria-label="Stamina" aria-valuemin="0" aria-valuemax="100"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="wilds-ring-track" cx="22" cy="22" r="18"/><circle class="wilds-ring-fill" cx="22" cy="22" r="18"/></svg></div>
      <div id="wilds-target" aria-hidden="true"><i></i><b></b></div>
      <button id="wilds-pause" aria-label="Pause and controls">${pauseIcon}</button>
      <div id="wilds-muted" aria-label="Sound muted" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 5 0 5-4v14l-5-4H3zM17 9l5 6m0-6-5 6"/></svg></div>
    </div>
    <div id="wilds-menu" hidden><section role="dialog" aria-modal="true" aria-labelledby="wilds-menu-title">
      <h1 id="wilds-menu-title">A little practice</h1><p>Find your footing. Try the dummy. Take your time.</p>
      <dl><dt>W A S D</dt><dd>Move · Shift to sprint</dd><dt>Space</dt><dd>Jump</dd><dt>Ctrl / right click</dt><dd>Dodge roll</dd><dt>Left click</dt><dd>Three-hit combo</dd><dt>Hold left click</dt><dd>Charge a heavy attack</dd><dt>F</dt><dd>Lock on / release</dd><dt>Drag / scroll</dt><dd>Orbit / zoom</dd><dt>Gamepad</dt><dd>Left stick move · A jump · B roll<br>X / RT attack · LB lock · L3 sprint</dd></dl>
      <div class="wilds-menu-actions"><button id="wilds-resume">Keep practising</button><button id="wilds-leave">Back to the island</button></div>
    </section></div>`;
  const canvas = container.querySelector('#wilds-canvas'), menu = container.querySelector('#wilds-menu');
  const stamina = container.querySelector('#wilds-stamina'), ring = stamina.querySelector('.wilds-ring-fill');
  const target = container.querySelector('#wilds-target'), health = target.querySelector('b');
  const muteIndicator = container.querySelector('#wilds-muted');
  const get = selector => container.querySelector(selector);
  function stop() { cancelAnimationFrame(frame); frame = 0; lastTime = 0; lastFrame = 0; }
  function resume() {
    if (disposed) return;
    paused = false; menu.hidden = true; input?.release();
    canvas.focus({ preventScroll: true }); start();
  }
  function pause() {
    if (disposed) return;
    paused = true; stop(); input?.release(); menu.hidden = false;
    get('#wilds-resume').focus({ preventScroll: true });
  }
  function toggleLock() {
    if (paused) return;
    const player = sim.state.player;
    locked = !locked && Math.hypot(player.x - DUMMY.x, player.z - DUMMY.z) < 20;
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
    stamina.style.opacity = p.stamina < 99.9 ? '1' : '0';
    stamina.setAttribute('aria-valuenow', String(Math.round(p.stamina)));
    ring.style.strokeDashoffset = String(113.1 * (1 - p.stamina / 100));
    ring.style.stroke = p.stamina < 23 ? '#e8b58b' : '#e6ecd4';
    project(DUMMY.x, model.dummyPosition[1] + 2.18, DUMMY.z, target);
    target.style.opacity = locked || sim.state.dummy.flash > 0 ? '1' : '0';
    health.style.transform = `scaleX(${Math.max(.02, sim.state.dummy.health / 100)})`;
  }
  function tick(timestamp) {
    frame = 0;
    if (paused || disposed || document.hidden) return;
    const began = performance.now(), now = clockNow(), dt = lastTime ? Math.min(.05, Math.max(0, (now - lastTime) / 1000)) : 1 / 60;
    lastTime = now;
    const controls = input.read(rig.yaw, dt);
    if (paused) return;
    if (locked && Math.hypot(sim.state.player.x - DUMMY.x, sim.state.player.z - DUMMY.z) > 22) locked = false;
    sim.step(dt, { ...controls, locked });
    if (sim.state.lastHit?.serial !== lastHit && sim.state.lastHit) { lastHit = sim.state.lastHit.serial; impact = 1; }
    impact = Math.max(0, impact - dt * 8);
    model.update(sim.state, sim.state.hitStop ? 0 : dt, reducedMotion);
    rig.update(sim.state.player, locked, dt, reducedMotion ? 0 : Math.sin(impact * 15) * impact);
    renderer.render(scene, camera); renderCount++; updateHUD();
    if (lastFrame) {
      const elapsed = timestamp - lastFrame;
      frameTimes[frameSamples % frameTimes.length] = elapsed;
      workTimes[frameSamples % workTimes.length] = performance.now() - began;
      frameSamples++; maxFrame = Math.max(maxFrame, elapsed); if (elapsed > 20) over20++;
    }
    lastFrame = timestamp;
    frame = requestAnimationFrame(tick);
  }
  function start() { if (ready && !paused && !disposed && !document.hidden && !frame) { lastTime = 0; lastFrame = 0; frame = requestAnimationFrame(tick); } }
  function disposal() {
    if (disposed) return;
    disposed = true; ready = false; stop(); clearInterval(padPoll); events.abort(); input?.dispose(); observer.disconnect();
    const geometries = new Set(), materials = new Set(), textures = new Set(), targets = new Set();
    scene?.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) for (const material of [].concat(object.material)) materials.add(material);
      if (object.customDepthMaterial) materials.add(object.customDepthMaterial);
      if (object.shadow?.map) targets.add(object.shadow.map);
      if (object.shadow?.mapPass) targets.add(object.shadow.mapPass);
    });
    for (const material of materials) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    for (const material of materials) for (const uniforms of material.userData.wildsUniforms || []) for (const uniform of Object.values(uniforms)) if (uniform.value?.isTexture) textures.add(uniform.value);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    for (const target of targets) target.dispose();
    if (renderer) {
      renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss();
      lastDisposal = { ready: false, disposed: true, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length || 0, contextLost: renderer.getContext().isContextLost(), renderCount };
    }
    scene?.clear(); renderer = null; scene = null; model = null; rig = null; input = null; camera = null;
    container.replaceChildren();
  }
  const observer = new ResizeObserver(resize);
  const padPoll = setInterval(() => { if (paused && !document.hidden) input?.read(rig.yaw, .08); }, 80);
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
    scene = new Scene(); scene.background = new Color('#cadbda'); scene.fog = new Fog('#cadbda', 24, 73);
    camera = new PerspectiveCamera(58, 1, .15, 130);
    const ambient = new HemisphereLight('#daeaf4', '#708066', 2.1);
    const sun = new DirectionalLight('#ffe7bd', 2.3); sun.position.set(-12, 19, 10); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20; sun.shadow.camera.near = 1; sun.shadow.camera.far = 65;
    sun.shadow.normalBias = .035; sun.shadow.bias = -.0001;
    scene.add(ambient, sun, sun.target);
    model = createFeelBox(scene); rig = createWildsCamera(camera);
    const depthMaterial = new MeshDepthMaterial();
    scene.traverse(object => { if (object.castShadow && object.isMesh) object.customDepthMaterial = depthMaterial; });
    input = createWildsInput(canvas, { pause: () => paused ? resume() : pause(), lock: toggleLock, mute: () => { muted = !muted; muteIndicator.hidden = !muted; }, orbit: (dx, dy) => { if (!paused) rig.orbit(dx, dy); }, zoom: delta => { if (!paused) rig.zoom(delta); } });
    get('#wilds-pause').addEventListener('click', pause, { signal: events.signal });
    get('#wilds-resume').addEventListener('click', resume, { signal: events.signal });
    get('#wilds-leave').addEventListener('click', onLeave, { signal: events.signal });
    menu.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      const resumeButton = get('#wilds-resume'), leaveButton = get('#wilds-leave');
      (document.activeElement === resumeButton ? leaveButton : resumeButton).focus();
    }, { signal: events.signal });
    motion.addEventListener('change', event => { reducedMotion = event.matches; }, { signal: events.signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); input.release(); } else start(); }, { signal: events.signal });
    observer.observe(container); resize(); model.update(sim.state, 0, reducedMotion); rig.update(sim.state.player, false, 1);
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
      return { ready, paused, disposed, avatar, position: { x: sim.state.player.x, y: sim.state.player.y, z: sim.state.player.z }, grounded: sim.state.player.grounded, stamina: sim.state.player.stamina, action: { ...sim.state.action }, state: structuredClone(sim.state), locked, muted, camera: rig.diagnostics(), counters: { ...sim.state.counts, jumps: sim.state.counts.jump, dodges: sim.state.counts.dodge, locks }, dummyPosition: { x: DUMMY.x, y: model.dummyPosition[1], z: DUMMY.z }, renderCount, frame: { samples: frameSamples, maxMs: maxFrame, p95Ms: samples[Math.floor(samples.length * .95)] || 0, over20, cpuP95Ms: work[Math.floor(work.length * .95)] || 0 }, resources: { ...renderer.info.memory, programs: renderer.info.programs.length, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio() } };
    },
  };
}
