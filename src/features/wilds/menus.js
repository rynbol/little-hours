import {SHOP} from '../../core/wilds/progression.js';
import {SECRETS} from '../../core/wilds/world.js';

export function wildsMenu(adventure, mode='controls', atMerchant=false, atCamp=false) {
  const save=adventure.save,stats=adventure.stats;
  const tabs=`<nav class="wilds-tabs"><button data-wilds-action="tab-controls">Journey</button><button data-wilds-action="tab-inventory">Satchel</button>${atCamp?'<button data-wilds-action="tab-camp">Campfire</button>':''}${atMerchant?'<button data-wilds-action="tab-merchant">Merchant</button>':''}</nav>`;
  let content='';
  if(mode==='merchant' && atMerchant){
    content=`<h1 id="wilds-menu-title">A little further</h1><p>The wandering merchant · ${adventure.coins} study gold</p><div class="wilds-shop">${SHOP.map(item=>{
      const owned=item.id!=='potion' && save.gear.includes(item.id),locked=stats.level<item.level,poor=adventure.coins<item.price,full=item.id==='potion' && save.potions>=99;
      return `<article><div><h2>${item.label}</h2><p>${item.description}</p></div><button data-wilds-action="buy:${item.id}" ${owned||locked||poor||full?'disabled':''}>${owned?'Yours':locked?`Level ${item.level}`:`${item.price} gold`}</button></article>`;
    }).join('')}</div><p>Gold comes from focused study. Everything you buy stays yours.</p>`;
  }else if(mode==='camp' && atCamp){
    content='<h1 id="wilds-menu-title">Stay a little</h1><p>You and your companion are safe here. Rest restores your strength and makes this fire your way home.</p><div class="wilds-rest"><button data-wilds-action="rest-morning">Rest until morning</button><button data-wilds-action="rest-night">Watch the stars</button><button data-wilds-action="pet">Pet your companion</button></div>';
  }else if(mode==='inventory'){
    content=`<h1 id="wilds-menu-title">Things worth finding</h1><p>Level ${stats.level} · ${save.xp} XP${stats.nextXP?` · ${stats.nextXP-save.xp} to the next level`:''}<br>${Math.round(stats.health)} heart · ${Math.round(stats.stamina)} stamina · ${adventure.coins} study gold</p><div class="wilds-keepsakes">${save.found.length?save.found.map(id=>{const s=SECRETS.find(s=>s.id===id);return `<article><h2>${s.label}</h2><p>${s.reward}</p></article>`;}).join(''):'<p>Your satchel is waiting for a story. Look off the trail, behind the falls and above the trees.</p>'}${save.guardian?'<article><h2>A promise of spring</h2><p>Heartwood · A glowing Mossheart antler for your room · Gentle resolve<br>Your first earned companion: Wolf. Its combat will come in another valley.</p></article>':''}</div><button data-wilds-action="potion" ${save.potions?'':'disabled'}>Drink a meadow tonic · ${save.potions} in your satchel</button>`;
  }else{
    content='<h1 id="wilds-menu-title">A valley to wander</h1><p>Beyond the beeches, a lake holds the afternoon. Follow what catches your eye. Your companion might notice something first.</p><dl><dt>W A S D</dt><dd>Move · Shift to sprint</dd><dt>Space</dt><dd>Jump · press again in the air to glide</dd><dt>Walk into a wall</dt><dd>Climb · Space to leap upward</dd><dt>Ctrl / right click</dt><dd>Dodge roll</dd><dt>Left click / hold</dt><dd>Three-hit combo / charged heavy</dd><dt>F</dt><dd>Lock on / release</dd><dt>E · R · Q</dt><dd>Interact or pet · whistle · partner skill</dd><dt>Drag / scroll</dt><dd>Orbit / zoom</dd><dt>M</dt><dd>Mute</dd><dt>Gamepad</dt><dd>Left stick move · A jump/glide · B roll<br>X / RT attack · LB lock · L3 sprint<br>Y interact · LT partner · D-pad up whistle</dd></dl><p>At the stone ring, dodge the wind-up and strike during recovery. Lure a charge into a stone to open the guardian’s heart. Defeat costs nothing.</p>';
  }
  return `<section role="dialog" aria-modal="true" aria-labelledby="wilds-menu-title">${tabs}${content}<div class="wilds-menu-actions"><button id="wilds-resume" data-wilds-action="resume">Keep exploring</button><button id="wilds-leave" data-wilds-action="leave">Back to the island</button></div></section>`;
}
