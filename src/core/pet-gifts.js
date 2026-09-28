export const PET_GIFTS = Object.freeze([
  Object.freeze({ id: 'daisy', at: 25, label: 'A daisy for you' }),
  Object.freeze({ id: 'star', at: 75, label: 'A paper star' }),
  Object.freeze({ id: 'moon', at: 150, label: 'A moon nightlight' }),
]);

export function petGifts(bond) {
  const minutes = Number.isSafeInteger(bond?.minutes) && bond.minutes >= 0 ? bond.minutes : 0;
  const earned = PET_GIFTS.filter(gift => minutes >= gift.at), next = PET_GIFTS[earned.length] || null;
  return {
    earned, next, remaining: next ? next.at - minutes : 0,
    selected: earned.find(gift => gift.id === bond?.gift) || earned.at(-1) || null,
  };
}
