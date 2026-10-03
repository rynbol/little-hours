import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bladeContact} from './blade-contact.js';
const row={hitStart:.1,hitEnd:.3,blade:[[.2,-.2,1,-.2],[0,-.2,0,-1],[-.2,-.2,-1,-.2]]};
test('blade contact uses only the swept authored edge during the active interval',()=>{
  assert.equal(bladeContact(row,0,.09,.6,-.2,.05),false);
  assert.equal(bladeContact(row,.1,.15,.65,-.4,.05),true);
  assert.equal(bladeContact(row,.1,.15,-.65,-.4,.05),false);
  assert.equal(bladeContact(row,.25,.3,-.65,-.4,.05),true);
  assert.equal(bladeContact(row,.1,.3,0,-.65,.05),true);
  assert.equal(bladeContact(row,.1,.3,0,1,.05),false);
  assert.equal(bladeContact(row,.1,.3,0,-1.2,.05),false);
  assert.equal(bladeContact(row,.1,.3,0,-1.2,.21),true);
  assert.equal(bladeContact(row,.31,.4,0,-.65,.05),false);
});
test('a stationary edge still contacts its target without treating a degenerate triangle as the whole plane',()=>{
  assert.equal(bladeContact(row,.2,.2,0,-.65,.05),true);
  assert.equal(bladeContact(row,.2,.2,.8,3,.05),false);
});
