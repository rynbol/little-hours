export const SECRET_IDS = Object.freeze(['root-sword','cliff-seed','falls-heart','wind-chest','pip-cache','shrine-charm','ruin-cape','shore-trophy']);
export const GEAR_IDS = Object.freeze(['trail-sword','wind-cape','light-armour']);
const unique = (value, allowed) => [...new Set(Array.isArray(value) ? value.filter(id=>allowed.includes(id)) : [])];
const integer = (value,max) => Number.isSafeInteger(value) ? Math.max(0,Math.min(max,value)) : 0;
export function normalizeWilds(value) {
  const lit=unique(value?.lit,['clearing','meadow','shore']);
  if(!lit.includes('clearing'))lit.unshift('clearing');
  return {version:1,xp:integer(value?.xp,1000000),found:unique(value?.found,SECRET_IDS),gear:unique(value?.gear,GEAR_IDS),potions:integer(value?.potions,99),herbs:unique(value?.herbs,Array.from({length:8},(_,i)=>`herb-${i}`)),lit,checkpoint:lit.includes(value?.checkpoint)?value.checkpoint:'clearing',guardian:value?.guardian===true,hour:typeof value?.hour==='number' && Number.isFinite(value.hour)?(value.hour%24+24)%24:16.6};
}
