import { normalizeWilds } from './save.js';
import { CAMPS, HERBS, LANDMARKS, SECRETS } from './world.js';

export const SHOP = Object.freeze([
  {id:'trail-sword',label:'Wayfarer sword',description:'A balanced steel blade. Hits harder, lasts forever.',price:35,level:1},
  {id:'wind-cape',label:'Windwoven cape',description:'A sturdier weave for longer climbs and glides.',price:45,level:2},
  {id:'light-armour',label:'Soft leather armour',description:'Light protection, made for a long way home.',price:55,level:3},
  {id:'potion',label:'Meadow tonic',description:'Restores half your health. Carry it for the guardian.',price:8,level:1},
].map(Object.freeze));
const LEVELS=[0,60,160,320,560,880];
export function adventureStats(save) {
  const w=normalizeWilds(save),level=LEVELS.filter(xp=>w.xp>=xp).length;
  return {level,health:120+(level-1)*20+(w.found.includes('falls-heart')?20:0)+(w.gear.includes('light-armour')?18:0),stamina:100+(level-1)*12+(w.found.includes('cliff-seed')?20:0)+(w.gear.includes('wind-cape')?20:0),attack:1+(level-1)*.15+(w.gear.includes('trail-sword')?.4:w.found.includes('root-sword')?.25:0),nextXP:LEVELS[level]??null};
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const careReady=(player,pet)=>Boolean(pet && pet.health>0 && player.grounded && player.mode==='ground' && !pet.swimming && !pet.climbing && Number.isFinite(pet.ground) && Math.abs(pet.y-pet.ground)<.1 && distance(player,pet)<2.2 && Math.abs(player.y-pet.y)<1.6 && Math.hypot(player.vx||0,player.vz||0)<=.5);
const after=(result,finish)=>result?.then?result.then(finish):finish(result);
export function createAdventure({ read=()=>({}), transact }={}) {
  let local={wilds:normalizeWilds(read().wilds),house:{coins:read().house?.coins||0}};
  let save=normalizeWilds(read().wilds),eventSerial=0;
  const pending=new Set();
  const stats=adventureStats(save),state={found:save.found,lit:save.lit,herbs:save.herbs,wolf:save.guardian,sniff:null,petting:0,whistle:0,glow:0,lastEvent:null,near:null,counts:{secrets:0,rests:0,pets:0,whistles:0,herbs:0,purchases:0,checkpoints:0}};
  const current=()=>transact?read():local;
  function change(mutate,key='change') {
    if(pending.has(key))return false;
    pending.add(key);
    let changed=false;
    const apply=draft=>{
      const next=normalizeWilds(draft.wilds),result=mutate(next,draft);
      if(result===false)return;
      draft.wilds=next;changed=true;
    };
    const finish=()=>{
      pending.delete(key);
      if(!changed)return false;
      const before=stats.level;
      save=normalizeWilds(current().wilds);Object.assign(stats,adventureStats(save));
      Object.assign(state,{found:save.found,lit:save.lit,herbs:save.herbs,wolf:save.guardian});
      if(stats.level>before){state.glow=3;state.lastEvent={serial:++eventSerial,kind:'level',level:stats.level};}
      return true;
    };
    if(!transact){apply(local);return finish();}
    const result=transact(apply);
    return result?.then?result.then(finish,()=>{pending.delete(key);return false;}):finish();
  }
  function event(kind,data={}) {state.lastEvent={serial:++eventSerial,kind,...data};state.glow=2.5;}
  function claim(id,player) {
    const secret=SECRETS.find(s=>s.id===id);
    if(!secret || save.found.includes(id) || distance(player,secret)>2.2 || Math.abs(player.y-secret.y)>2)return false;
    const before=stats.level;
    return after(change(w=>{if(w.found.includes(id))return false;w.found.push(id);w.xp+=secret.xp;},`secret:${id}`),success=>{
      if(!success)return false;state.counts.secrets++;event('find',{id,label:secret.label,reward:secret.reward,level:stats.level>before?stats.level:null});return true;
    });
  }
  function buy(id,player) {
    const item=SHOP.find(row=>row.id===id);
    if(!item || distance(player,LANDMARKS.merchant)>6 || stats.level<item.level || item.id!=='potion' && save.gear.includes(id) || id==='potion' && save.potions>=99)return false;
    const success=change((w,draft)=>{
      if((draft.house?.coins||0)<item.price || adventureStats(w).level<item.level || id!=='potion' && w.gear.includes(id) || id==='potion' && w.potions>=99)return false;
      draft.house.coins-=item.price;
      if(id==='potion')w.potions++;else w.gear.push(id);
    },`buy:${id}`);
    return after(success,done=>{if(done){state.counts.purchases++;event('purchase',{id,label:item.label});}return done;});
  }
  function victory() {
    if(save.guardian)return false;
    const before=stats.level;
    return after(change(w=>{if(w.guardian)return false;w.guardian=true;w.xp+=160;},'guardian'),success=>{
      if(!success)return false;event('guardian',{label:'A promise of spring',reward:'Heartwood · Mossheart antler · Wolf companion · Gentle resolve',level:stats.level>before?stats.level:null});return true;
    });
  }
  function petCompanion(player,pet) {
    if(!careReady(player,pet))return false;
    player.heading=Math.atan2(pet.x-player.x,player.z-pet.z);
    state.petting=2.5;state.counts.pets++;event('pet');return true;
  }
  function step(dt,player,pet,{interact=false,whistle=false,fighting=false}={}) {
    state.petting=Math.max(0,state.petting-dt);state.whistle=Math.max(0,state.whistle-dt);state.glow=Math.max(0,state.glow-dt);
    if(fighting || !careReady(player,pet))state.petting=0;
    const camp=CAMPS.find(c=>distance(player,c)<3.8 && Math.abs(player.y-c.y)<2);
    if(camp && !fighting && save.checkpoint!==camp.id)after(change(w=>{if(!w.lit.includes(camp.id))w.lit.push(camp.id);w.checkpoint=camp.id;},`camp:${camp.id}`),success=>{if(success){state.counts.checkpoints++;event('camp',{id:camp.id});}});
    const nearSecret=SECRETS.filter(s=>!save.found.includes(s.id)).sort((a,b)=>distance(a,player)-distance(b,player))[0];
    state.sniff=nearSecret && distance(nearSecret,player)<16?nearSecret:null;
    const secret=nearSecret && distance(nearSecret,player)<2.2 && Math.abs(player.y-nearSecret.y)<2?nearSecret:null;
    const herb=HERBS.find(h=>!save.herbs.includes(h.id) && distance(player,h)<1.1 && Math.abs(player.y-h.y)<1.2);
    if(herb)after(change(w=>{if(w.herbs.includes(herb.id))return false;w.herbs.push(herb.id);},`herb:${herb.id}`),success=>{if(success){state.counts.herbs++;event('herb',{id:herb.id});}});
    const merchant=distance(player,LANDMARKS.merchant)<3 && Math.abs(player.y-LANDMARKS.merchant.y)<2;
    state.near=secret?{kind:'secret',id:secret.id}:merchant?{kind:'merchant'}:camp?{kind:'camp',id:camp.id}:careReady(player,pet)?{kind:'pet'}:null;
    if(whistle){state.whistle=2;state.counts.whistles++;event('whistle');}
    if(interact && !fighting){
      if(secret)claim(secret.id,player);
      else if(state.near?.kind==='pet')petCompanion(player,pet);
    }
    return {herb:Boolean(herb),menu:interact && !fighting && ['camp','merchant'].includes(state.near?.kind)?state.near:null};
  }
  function rest(id,hour) {
    if(!save.lit.includes(id) || !CAMPS.some(c=>c.id===id))return false;
    return after(change(w=>{w.checkpoint=id;if(Number.isFinite(hour))w.hour=(hour%24+24)%24;},'rest'),success=>{if(success){state.counts.rests++;event('rest',{id,hour});}return success;});
  }
  function drink() {if(!save.potions)return false;return after(change(w=>{if(!w.potions)return false;w.potions--;},'potion'),success=>{if(success)event('potion');return success;});}
  return {state,stats,step,claim,buy,victory,rest,drink,petCompanion,get save(){return structuredClone(save);},get coins(){return current().house?.coins||0;},get checkpoint(){return CAMPS.find(c=>c.id===save.checkpoint)||CAMPS[0];}};
}
