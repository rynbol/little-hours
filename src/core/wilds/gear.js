const piece = (slot, label, note, traits, shop = null) => Object.freeze({ slot, label, note, traits: Object.freeze(traits), ...shop && { price: shop[0], level: shop[1] } });

export const GEAR = Object.freeze({
  'rootwood-sword': piece('sword', 'Rootwood sword', 'Grown, not forged. Hits a little harder.', { power: 1.15 }),
  'steel-sword': piece('sword', 'Steel sword', 'A plain, honest blade that hits harder.', { power: 1.3 }, [60, 1]),
  'moonsteel-sword': piece('sword', 'Moonsteel sword', 'Pale and light. Hits much harder.', { power: 1.6 }, [220, 3]),
  'sturdy-cape': piece('cape', 'Sturdy cape', 'Waxed canvas. Glides for less stamina and turns a little harm.', { glide: 0.8, guard: 0.05 }, [90, 1]),
  'windleaf-cape': piece('cape', 'Windleaf cape', 'Woven from leaves that hold the air. Long, cheap glides.', { glide: 0.7, sink: 0.85 }),
  'leather-jerkin': piece('armour', 'Leather jerkin', 'Light armour that takes the edge off every blow.', { guard: 0.15 }, [150, 2]),
  'kestrel-feather': piece('charm', 'Kestrel feather', 'Tucked in your hood. You sink more slowly as you glide.', { sink: 0.88 }),
  'lake-pearl': piece('charm', 'Lake pearl', 'Worn on a cord. Swimming costs far less.', { swim: 0.6 }),
});

export const SLOTS = Object.freeze(['sword', 'cape', 'armour']);
export const STOCK = Object.freeze(['steel-sword', 'sturdy-cape', 'leather-jerkin', 'moonsteel-sword']);
export const POTION = Object.freeze({ price: 15, carry: 5, heal: 0.5, label: 'Herb potion', note: 'Restores half your health. Press H to drink.' });

export function wornTraits(wilds) {
  const traits = { power: 1, guard: 0, glide: 1, sink: 1, swim: 1 };
  const pieces = [...SLOTS.map(slot => wilds.wear[slot]), ...wilds.owned.filter(id => GEAR[id].slot === 'charm')].filter(Boolean).map(id => GEAR[id].traits);
  for (const worn of pieces) {
    traits.power *= worn.power ?? 1; traits.guard += worn.guard ?? 0;
    traits.glide *= worn.glide ?? 1; traits.sink *= worn.sink ?? 1; traits.swim *= worn.swim ?? 1;
  }
  return traits;
}

export function takeGear(wilds, id) {
  if (!GEAR[id] || wilds.owned.includes(id)) return false;
  wilds.owned.push(id);
  const { slot } = GEAR[id];
  if (slot !== 'charm') {
    const worn = wilds.wear[slot] && GEAR[wilds.wear[slot]];
    if (!worn || (slot === 'sword' ? GEAR[id].traits.power > worn.traits.power : true)) wilds.wear[slot] = id;
  }
  return true;
}

export function wearGear(wilds, id) {
  if (!wilds.owned.includes(id) || GEAR[id].slot === 'charm') return false;
  wilds.wear[GEAR[id].slot] = id;
  return true;
}

export function shelf(wilds, coins, level) {
  return [...STOCK.map(id => {
    const { price, level: needs } = GEAR[id], owned = wilds.owned.includes(id);
    return { id, price, level: needs, owned, ready: !owned && level >= needs && coins >= price, reason: owned ? 'owned' : level < needs ? 'level' : coins < price ? 'coins' : null };
  }), { id: 'potion', price: POTION.price, level: 1, owned: false, ready: wilds.potions < POTION.carry && coins >= POTION.price, reason: wilds.potions >= POTION.carry ? 'full' : coins < POTION.price ? 'coins' : null }];
}

export function purchase(wilds, house, id, level) {
  const row = shelf(wilds, house.coins, level).find(entry => entry.id === id);
  if (!row?.ready) return { ok: false, reason: row?.reason ?? 'unknown' };
  house.coins -= row.price;
  if (id === 'potion') wilds.potions += 1;
  else takeGear(wilds, id);
  return { ok: true, price: row.price };
}

export function drinkPotion(wilds) {
  if (wilds.potions <= 0) return false;
  wilds.potions -= 1;
  return true;
}
