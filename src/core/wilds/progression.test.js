import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAdventure,adventureStats,SHOP} from './progression.js';
import {normalizeWilds} from './save.js';
import {CAMPS,SECRETS,HERBS,LANDMARKS} from './world.js';
import {freshState,restoreState,createStateStore} from '../state.js';

function fixture(coins=120) {
  let saved={...freshState(),house:{...freshState().house,coins}};
  const adventure=createAdventure({read:()=>saved,transact:fn=>{const draft=structuredClone(saved);fn(draft);saved=draft;}});
  return {adventure,get saved(){return saved;}};
}
test('old saves gain no Wilds data by entering, walking or leaving',()=>{
  const f=fixture(),before=structuredClone(f.saved);
  f.adventure.step(1,CAMPS[0],null);
  assert.deepEqual(f.saved,before);
  assert.equal(f.adventure.stats.health,120);
  assert.equal(f.adventure.stats.stamina,100);
});
test('eight secrets require proximity and height, reward only once and never pay gold',()=>{
  const f=fixture(),bonds=structuredClone(f.saved.petBonds);
  for(const secret of SECRETS){
    assert.equal(f.adventure.claim(secret.id,{...secret,x:secret.x+4}),false);
    assert.equal(f.adventure.claim(secret.id,{...secret,y:secret.y-5}),false);
    assert.equal(f.adventure.claim(secret.id,secret),true);
    assert.equal(f.adventure.claim(secret.id,secret),false);
  }
  assert.equal(f.saved.wilds.found.length,8);
  assert.equal(f.saved.wilds.xp,310);
  assert.equal(f.saved.house.coins,120);
  assert.deepEqual(f.saved.petBonds,bonds);
  assert.ok(f.adventure.stats.health>120 && f.adventure.stats.stamina>100 && f.adventure.stats.attack>1);
});
test('merchant checks place, level, price, durable ownership and bounded consumables',()=>{
  const f=fixture();
  assert.equal(f.adventure.buy('trail-sword',{x:100,z:100}),false);
  assert.equal(f.adventure.buy('light-armour',LANDMARKS.merchant),false);
  assert.equal(f.adventure.buy('trail-sword',LANDMARKS.merchant),true);
  assert.equal(f.saved.house.coins,85);
  assert.equal(f.adventure.buy('trail-sword',LANDMARKS.merchant),false);
  assert.equal(f.adventure.buy('potion',LANDMARKS.merchant),true);
  assert.equal(f.adventure.drink(),true);
  assert.equal(f.adventure.drink(),false);
  assert.equal(f.saved.house.coins,77);
  const poor=fixture(0);
  for(const item of SHOP)assert.equal(poor.adventure.buy(item.id,LANDMARKS.merchant),false);
  assert.equal(poor.saved.wilds,undefined);
});
test('guardian grants XP, heartwood, trophy, trait and Wolf once without gold or bond changes',()=>{
  const f=fixture(),before=structuredClone(f.saved);
  assert.equal(f.adventure.victory(),true);
  assert.equal(f.adventure.victory(),false);
  assert.equal(f.saved.wilds.xp,160);
  assert.equal(f.saved.wilds.guardian,true);
  assert.equal(f.adventure.state.wolf,true);
  assert.equal(f.adventure.stats.level,3);
  assert.equal(f.saved.house.coins,before.house.coins);
  assert.deepEqual(f.saved.petBonds,before.petBonds);
  assert.ok(f.adventure.state.lastEvent.reward.includes('Heartwood'));
  assert.ok(f.adventure.state.lastEvent.reward.includes('antler'));
});
test('new camp ignites on approach and persists as the defeat checkpoint',()=>{
  const f=fixture();
  f.adventure.step(.1,CAMPS[1],null);
  assert.equal(f.adventure.checkpoint.id,'meadow');
  assert.deepEqual(f.saved.wilds.lit,['clearing','meadow']);
  assert.equal(f.adventure.rest('shore',7),false);
  assert.equal(f.adventure.rest('meadow',7),true);
  assert.equal(f.saved.wilds.hour,7);
  const restored=createAdventure({read:()=>f.saved});
  assert.equal(restored.checkpoint.id,'meadow');
});
test('herbs pick once, pet sniffs secrets, whistle and petting respond without changing bonds',()=>{
  const f=fixture(),before=structuredClone(f.saved.petBonds);
  assert.equal(f.adventure.step(.1,HERBS[0],null).herb,true);
  assert.equal(f.adventure.step(.1,HERBS[0],null).herb,false);
  const cache=SECRETS.find(s=>s.id==='pip-cache'),player={...cache,x:cache.x+7},pet={...player,x:player.x+.7,health:100};
  f.adventure.step(.1,player,pet,{whistle:true,interact:true});
  assert.equal(f.adventure.state.sniff.id,'pip-cache');
  assert.ok(f.adventure.state.petting>0 && f.adventure.state.whistle>0);
  assert.deepEqual(f.saved.petBonds,before);
});
test('save normalization retains discoveries through store refresh and backup restore',()=>{
  const f=fixture();f.adventure.claim(SECRETS[0].id,SECRETS[0]);f.adventure.victory();
  const restored=restoreState(JSON.stringify(f.saved));
  assert.deepEqual(restored.wilds,f.saved.wilds);
  let raw=JSON.stringify(f.saved);const store=createStateStore({getItem:()=>raw,setItem:(_,value)=>{raw=value;}});
  store.update(draft=>{draft.task='Still studying';});
  assert.deepEqual(store.state.wilds,f.saved.wilds);
  assert.deepEqual(normalizeWilds({xp:NaN,found:['root-sword','root-sword','fake'],gear:['fake'],lit:['shore'],checkpoint:'fake',potions:-4,guardian:'true',hour:Infinity}),{version:1,xp:0,found:['root-sword'],gear:[],potions:0,herbs:[],lit:['clearing','shore'],checkpoint:'clearing',guardian:false,hour:16.6});
  assert.equal(adventureStats({xp:1000000}).level,6);
});

test('queued browser save transactions settle before live progression updates and deduplicate frame requests',async()=>{
  const {createSharedStateStore}=await import('../shared-store.js');
  const initial=freshState();initial.house.coins=120;let raw=JSON.stringify(initial);
  const store=createSharedStateStore({getItem:()=>raw,setItem:(_,value)=>{raw=value;}},{locks:{request:async(_,work)=>{await Promise.resolve();return work();}}});
  const adventure=createAdventure({read:()=>store.state,transact:async fn=>(await store.update(fn)).state});
  const purchase=adventure.buy('trail-sword',LANDMARKS.merchant);
  assert.equal(adventure.save.gear.length,0);
  assert.equal(adventure.buy('trail-sword',LANDMARKS.merchant),false);
  assert.equal(await purchase,true);assert.equal(adventure.coins,85);assert.ok(adventure.save.gear.includes('trail-sword'));
  for(let i=0;i<60;i++)adventure.step(.016,HERBS[0],null);
  await store.settled();await Promise.resolve();await Promise.resolve();
  assert.equal(adventure.state.counts.herbs,1);assert.equal(adventure.save.herbs.length,1);
  for(let i=0;i<60;i++)adventure.step(.016,CAMPS[1],null);
  await store.settled();await Promise.resolve();await Promise.resolve();
  assert.equal(adventure.state.counts.checkpoints,1);assert.equal(adventure.checkpoint.id,'meadow');
  assert.equal(await adventure.rest('meadow',21),true);assert.equal(adventure.save.hour,21);
  assert.equal(await adventure.claim(SECRETS[1].id,SECRETS[1]),true);assert.equal(adventure.save.xp,35);
  assert.equal(await adventure.victory(),true);assert.equal(adventure.save.xp,195);assert.equal(adventure.coins,85);
});
