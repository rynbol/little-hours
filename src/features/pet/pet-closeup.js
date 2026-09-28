import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { createPetModel } from './pets.js';
import { createPetBelongings } from './pet-belongings.js';
import { disposeFurnitureAssets } from '../../models/furniture.js';
import { PET_BELONGINGS } from '../../core/pet-care.js';
import { clockNow } from '../../core/test-pins.js';

export function createPetCloseup(host, { onPet }) {
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); host.append(canvas);
  const engine = new Engine(canvas, true, { alpha: true, stencil: false, preserveDrawingBuffer: false }, false);
  engine.canvasTabIndex = -1; canvas.tabIndex = -1;
  const scene = new Scene(engine); scene.clearColor = new Color4(0, 0, 0, 0);
  const camera = new ArcRotateCamera('pet-closeup-camera', -Math.PI / 2 - .2, 1.3, 2.1, new Vector3(0, .46, 0), scene);
  camera.fov = .58; camera.minZ = .01;
  const sky = new HemisphericLight('pet-closeup-fill', new Vector3(.2, 1, -.4), scene);
  sky.intensity = .48; sky.groundColor = Color3.FromHexString('#b6a798');
  const key = new DirectionalLight('pet-closeup-window', new Vector3(.6, -1, .6), scene);
  key.diffuse = Color3.FromHexString('#ffebd8'); key.intensity = .65;
  const rim = new DirectionalLight('pet-closeup-rim', new Vector3(-1, -.4, -.2), scene);
  rim.diffuse = Color3.FromHexString('#e4dffb'); rim.intensity = .25;
  const cushion = CreateSphere('pet-closeup-cushion', { diameter: 2, segments: 18 }, scene);
  cushion.scaling.set(.68, .065, .48); cushion.position.y = -.062;
  const velvet = new StandardMaterial('pet-closeup-velvet', scene); velvet.specularColor = Color3.Black(); cushion.material = velvet;
  const props = createPetBelongings(scene);
  props.blanket.position.set(0, -.12, .08); props.blanket.scaling.set(1.5, 1, 1.3);
  props.bowl.setEnabled(false); props.food.setEnabled(false); props.toy.setEnabled(false);
  const motion = matchMedia('(prefers-reduced-motion: reduce)'), listeners = new AbortController();
  const pose = { action: 'sit', moving: false, walked: 0, petAge: Infinity, ritual: null, ritualAge: Infinity, hearts: [], look: { x: 0, y: 0 } };
  const pointer = { x: 0, y: 0 };
  let model = null, signature = '', appearance = '', species = '', studying = false, visible = true, disposed = false, frame = 0, previous = 0, seconds = 0, reactedAt = -Infinity, reactionKind = 'cuddle', reactionWake = 0;
  function draw(at) {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const dt = Math.min(.05, previous ? (at - previous) / 1000 : 1 / 30); previous = at; seconds += dt;
    if (model) {
      const age = (clockNow() - reactedAt) / 1000;
      pose.action = studying ? 'sleep' : 'sit'; pose.petAge = age < 2.6 ? age : Infinity;
      pose.ritual = age < 6 ? reactionKind : null; pose.ritualAge = age;
      pose.hearts = age < 1.7 ? [{ age, size: 1, sway: -.05 }, { age: age - .3, size: .65, sway: .1 }] : [];
      const blend = motion.matches ? 1 : 1 - Math.exp(-dt * 5);
      pose.look.x += ((studying ? 0 : pointer.x) - pose.look.x) * blend; pose.look.y += ((studying ? 0 : pointer.y) - pose.look.y) * blend;
      model.animate(pose, dt, seconds, motion.matches);
      model.hearts.forEach((heart, i) => { heart.position.x = -.32 - i * .13; heart.position.y = .92 + (motion.matches ? 0 : Math.min(age, 1.7) * .08); heart.scaling.scaleInPlace(.7); });
      props.toy.setEnabled(pose.ritual === 'play'); props.bowl.setEnabled(pose.ritual === 'treat'); props.food.setEnabled(pose.ritual === 'treat');
      if (pose.ritual === 'play') props.toy.position.set(.4 + (motion.matches ? 0 : Math.sin(age * 3) * .08), 0, -.4);
      props.bowl.position.set(.28, 0, -.48); props.food.position.copyFrom(props.bowl.position);
    }
    engine.beginFrame(); scene.render(); engine.endFrame();
    if (!motion.matches || !scene.isReady()) frame = requestAnimationFrame(schedule);
  }
  function schedule(at) { frame = 0; if (at - previous >= 32) draw(at); else if (!disposed && visible && !document.hidden) frame = requestAnimationFrame(schedule); }
  function wake() { if (disposed || frame || !visible || document.hidden) return; frame = requestAnimationFrame(draw); }
  const resize = new ResizeObserver(() => { if (disposed) return; engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, 1.5)); engine.resize(); wake(); }); resize.observe(host);
  const viewport = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (!visible) { cancelAnimationFrame(frame); frame = 0; previous = 0; } else wake(); }); viewport.observe(host);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previous = 0; } else wake(); }, { signal: listeners.signal });
  motion.addEventListener('change', wake, { signal: listeners.signal });
  host.addEventListener('pointermove', event => { const box = host.getBoundingClientRect(); pointer.x = (event.clientX - box.left) / box.width * 2 - 1; pointer.y = 1 - (event.clientY - box.top) / box.height * 2; wake(); }, { signal: listeners.signal });
  host.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; wake(); }, { signal: listeners.signal });
  host.addEventListener('click', () => onPet(species), { signal: listeners.signal });
  return {
    update({ id, name, ribbon, care, gift, focusing }) {
      const nextAppearance = JSON.stringify([id, name, ribbon, care.fabric, care.food, gift, focusing]);
      if (appearance === nextAppearance) return; appearance = nextAppearance;
      if (species !== id) { reactedAt = -Infinity; clearTimeout(reactionWake); pointer.x = pointer.y = pose.look.x = pose.look.y = 0; delete host.dataset.reaction; }
      const key = `${id}:${ribbon}`;
      if (signature !== key) { model?.dispose(); model = createPetModel(scene, id, ribbon); model.contact.setEnabled(false); species = id; signature = key; }
      camera.radius = id === 'bunny' ? 2.85 : 2.55; camera.target.y = id === 'bunny' ? .57 : .54;
      studying = focusing; host.setAttribute('aria-label', `Pet ${name}`); host.dataset.species = id; host.dataset.mode = focusing ? 'studying' : 'awake';
      velvet.diffuseColor = Color3.FromHexString((PET_BELONGINGS.find(item => item.id === care.fabric) || PET_BELONGINGS[0]).color);
      props.setStyle(care, id, gift); props.gift.mesh.position.set(-.5, 0, -.2); props.gift.mesh.scaling.setAll(.85); props.gift.mesh.rotation.y = -.2; wake();
    },
    react(kind) { reactedAt = clockNow(); reactionKind = kind; host.dataset.reaction = kind; clearTimeout(reactionWake); reactionWake = setTimeout(wake, 6200); wake(); },
    diagnostics() { return { scene, engine, species, studying, frames: scene.getFrameId(), meshes: scene.meshes.length }; },
    dispose() { if (disposed) return; disposed = true; cancelAnimationFrame(frame); clearTimeout(reactionWake); resize.disconnect(); viewport.disconnect(); listeners.abort(); model?.dispose(); props.dispose(); disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); canvas.remove(); },
  };
}
