import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, Scene, Vector3 } from 'three';
import { createEncounterShapes } from './encounter-shapes.js';
import { BOSS_ATTACKS, createEncounter } from '../../core/wilds/encounter.js';
import { createFeelSimulation } from '../../core/wilds/feel.js';
import { heightAt } from '../../core/world-terrain.js';

function fixture() {
  const scene = new Scene(), encounter = createEncounter(), sim = createFeelSimulation();
  const shapes = createEncounterShapes(scene);
  shapes.update(encounter.state, sim.state, 1 / 60, false);
  return { scene, encounter, sim, shapes };
}

test('each threat has grounded anticipation geometry and impact geometry reuses its buffers', () => {
  const { scene, shapes, encounter, sim } = fixture();
  const telegraph = scene.getObjectByName('attack-telegraph'), impact = scene.getObjectByName('attack-impact');
  const telegraphBuffer = telegraph.geometry.attributes.position.array, impactBuffer = impact.geometry.attributes.position.array;
  for (const kind of ['charge', 'sweep', 'stomp', 'roots']) {
    const row = BOSS_ATTACKS[kind];
    Object.assign(encounter.state.boss.action, { kind, elapsed: row.telegraph * .8, duration: row.duration, progress: .2 });
    shapes.update(encounter.state, sim.state, 1 / 60, false);
    assert.equal(telegraph.visible, true, kind);
    assert.ok(telegraph.geometry.drawRange.count > 0);
    for (let i = 0; i < telegraph.geometry.drawRange.count * 3; i += 3) {
      assert.ok(Math.abs(telegraphBuffer[i + 1] - heightAt(telegraphBuffer[i], telegraphBuffer[i + 2]) - .035) < .00001);
    }
    Object.assign(encounter.state.boss.action, { elapsed: row.telegraph + .1 });
    encounter.state.boss.ringRadius = 1; encounter.state.boss.rootLength = 1;
    shapes.update(encounter.state, sim.state, 1 / 60, true);
    assert.equal(telegraph.visible, false);
    if (kind !== 'charge') assert.equal(impact.visible, true, kind);
    assert.equal(telegraph.geometry.attributes.position.array, telegraphBuffer);
    assert.equal(impact.geometry.attributes.position.array, impactBuffer);
  }
});

test('contact shadows follow the pet support even when its attack is airborne', () => {
  const { scene, shapes, encounter, sim } = fixture(), matrix = new Matrix4(), position = new Vector3();
  const pet = encounter.state.pet, shadows = scene.getObjectByName('encounter-contact-shadows');
  pet.ground = heightAt(pet.x, pet.z); pet.y = pet.ground + .65;
  shapes.update(encounter.state, sim.state, 1 / 60, false);
  shadows.getMatrixAt(1, matrix); position.setFromMatrixPosition(matrix);
  assert.ok(Math.abs(position.y - pet.ground - .024) < .00001);
  assert.equal(scene.getObjectByName('ginger-partner-blockout'), undefined);
});

test('phase roots remain planted on their local terrain samples', () => {
  const { scene, shapes, encounter, sim } = fixture(), matrix = new Matrix4(), position = new Vector3(), scale = new Vector3();
  Object.assign(encounter.state.boss.action, { kind: 'phase', elapsed: .7, duration: 1.7, progress: .7 / 1.7 });
  shapes.update(encounter.state, sim.state, 1 / 60, true);
  const roots = scene.getObjectByName('erupting-roots');
  assert.equal(roots.visible, true);
  for (let i = 0; i < roots.count; i++) {
    roots.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix); scale.setFromMatrixScale(matrix);
    assert.ok(Math.abs(position.y - scale.y / 2 - heightAt(position.x, position.z)) < .00001);
  }
});

test('guardian defeat releases leaves and blossoms with stable buffers and respects the action clock',()=>{
  const {scene,shapes,encounter,sim}=fixture(),petals=scene.getObjectByName('guardian-blossoms'),buffer=petals.instanceMatrix.array;
  assert.equal(petals.visible,false);
  Object.assign(encounter.state.boss.action,{kind:'defeat',elapsed:1.5,duration:3,progress:.5});
  shapes.update(encounter.state,sim.state,1/60,false);
  assert.equal(petals.visible,true);
  const positions=Array.from(buffer);
  shapes.update(encounter.state,sim.state,0,false);
  assert.deepEqual(Array.from(buffer),positions);
  assert.equal(petals.instanceMatrix.array,buffer);
  encounter.state.boss.action.elapsed=3;
  shapes.update(encounter.state,sim.state,1/60,false);
  assert.equal(petals.visible,false);
});
