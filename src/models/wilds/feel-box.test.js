import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from 'three';
import { createFeelBox } from './feel-box.js';
import { createFeelSimulation } from '../../core/wilds/feel.js';

test('slash trail joins actual blade endpoints, freezes with hit-stop and clears between attacks', () => {
  const scene = new Scene(), sim = createFeelSimulation();
  let x = 2;
  const model = createFeelBox(scene, {training:false,bladeEndpoints:(base,tip)=>{base.set(x,1,3);tip.set(x,1.5,2);return true;}});
  const trail = scene.getObjectByName('blade-trail'), buffer = trail.geometry.attributes.position.array;
  Object.assign(sim.state.action, {kind:'light1',elapsed:.15,serial:1});
  model.update(sim.state,1/60,false);
  assert.equal(trail.visible,false);
  x = 3; model.update(sim.state,1/60,false);
  assert.equal(trail.visible,true);
  assert.deepEqual(Array.from(buffer.slice(0,18)),[3,1,3,3,1.5,2,2,1,3,2,1,3,3,1.5,2,2,1.5,2]);
  const frozen = Array.from(buffer);x = 4;model.update(sim.state,0,false);
  assert.deepEqual(Array.from(buffer),frozen);
  sim.state.action.elapsed = .4;model.update(sim.state,1/60,false);assert.equal(trail.visible,false);
  Object.assign(sim.state.action,{elapsed:.15,serial:2});model.update(sim.state,1/60,false);
  assert.equal(trail.visible,false);
  assert.equal(trail.geometry.attributes.position.array,buffer);
});
