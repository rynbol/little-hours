import { createSession, remainingAt, startSession, pauseSession, isDuration, normalizeSession, sessionStarted, isFocusing } from './session.js';
import { createLayout, normalizeLayout, PRESETS } from './layout.js';
import { createHouse, normalizeHouse, activeHouseRoom, expansionVerdict, focusCoins, cleanName, recordSession } from './house.js';
import { fitRoomType } from './room-types.js';
import { AVATAR_DEFAULT, normalizeAvatarAppearance } from './avatar.js';
import { clockNow, clockRandom } from './test-pins.js';
import { emptyPond, normalizePond, addBait, landCatch, toggleTank } from './fishing.js';
import { normalizeOwnedPets, adoptionVerdict, FREE_PETS } from './pets.js';
import { normalizePetBonds, normalizePetWish, recordPetFocus, shareRitual, feedPet, choosePetFabric, welcomePet, cleanPetName, bondLevel, petName, focusPetId } from './pet-bonds.js';
import { archivePetFriendships } from './pet-legacy.js';
import { petGifts } from './pet-gifts.js';
import { emptyBuddy, normalizeBuddy, recordAdventure, waitingFind, BUDDY_COLORS } from './buddy.js';
import { emptyGarden, normalizeGarden, focusGardenPlantId, plantGardenSeed, placeGardenPlant, growGarden, gardenGrowth } from './garden-plants.js';
import { normalizeWilds } from './wilds/progress.js';

export const storageKey = 'little-hours-v1';
// The save as it was just before a backup replaced it.
export const recoveryKey = 'little-hours-v1-before-restore';

export function freshState() {
  const layout = createLayout();
  return { theme: 'dusk', pet: 'cat', pets: [...FREE_PETS], petBonds: normalizePetBonds(null, FREE_PETS), petWish: null, petFamily: '', avatar: { ...AVATAR_DEFAULT }, seenAt: 0, task: '', decor: { plants: true, lights: true, rug: true }, layout, rooms: {}, house: createHouse(layout), session: createSession(), history: [], pond: emptyPond(), garden: emptyGarden(), buddy: emptyBuddy() };
}

export function localDate(timestamp = clockNow(), timeZone) {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(timestamp));
    const part = type => parts.find(entry => entry.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function restoreState(raw) {
  const initial = freshState();
  let saved;
  try { saved = JSON.parse(raw); } catch { return initial; }
  if (!saved || typeof saved !== 'object') return initial;
  if (Object.hasOwn(saved, 'wilds')) initial.wilds = normalizeWilds(saved.wilds);
  if (['dusk', 'rain', 'day'].includes(saved.theme)) initial.theme = saved.theme;
  if (typeof saved.task === 'string') initial.task = saved.task.slice(0, 180);
  initial.avatar = normalizeAvatarAppearance(saved.avatar);
  initial.pets = normalizeOwnedPets(saved.pets);
  initial.petBonds = normalizePetBonds(saved.petBonds, initial.pets);
  initial.petWish = normalizePetWish(saved.petWish, initial.pets);
  initial.petFamily = cleanPetName(saved.petFamily, '');
  if (saved.friendships || saved.legacyPetFriendships) initial.legacyPetFriendships = archivePetFriendships(saved.legacyPetFriendships || saved.friendships, initial.pets.map(id => `pet:${id}`));
  initial.pond = normalizePond(saved.pond);
  initial.garden = normalizeGarden(saved.garden);
  if (initial.pets.includes(saved.pet)) initial.pet = saved.pet;
  if (Number.isSafeInteger(saved.seenAt) && saved.seenAt > 0) initial.seenAt = saved.seenAt;
  for (const key of Object.keys(initial.decor)) {
    if (typeof saved.decor?.[key] === 'boolean') initial.decor[key] = saved.decor[key];
  }
  if (saved.layout !== undefined) initial.layout = normalizeLayout(saved.layout);
  for (const preset of PRESETS) {
    const room = saved.rooms?.[preset.id];
    if (room && room.presetId === preset.id) initial.rooms[preset.id] = normalizeLayout(room);
  }
  if (initial.layout.presetId) initial.rooms[initial.layout.presetId] = structuredClone(initial.layout);
  initial.session = normalizeSession(saved.session);
  if (sessionStarted(initial.session) && initial.session.taskSnapshot === undefined) initial.session.taskSnapshot = initial.task;
  if (!initial.pets.includes(initial.session.petId)) delete initial.session.petId;
  if (saved.session && Object.hasOwn(saved.session, 'plantId')) initial.session.plantId = initial.garden.plants.some(plant => plant.id === saved.session.plantId) ? saved.session.plantId : null;
  if (Array.isArray(saved.history)) {
    initial.history = saved.history.filter(entry => entry && typeof entry === 'object'
      && typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && isDuration(entry.minutes))
      .slice(-365).map(entry => {
        const record = { date: entry.date, minutes: entry.minutes };
        if (typeof entry.id === 'string' && entry.id.length <= 160) record.id = entry.id;
        if (typeof entry.task === 'string') record.task = entry.task.slice(0, 180);
        if (Number.isSafeInteger(entry.at) && entry.at >= 0 && entry.at <= 8.64e15) record.at = entry.at;
        if (typeof entry.timeZone === 'string') {
          try { new Intl.DateTimeFormat('en', { timeZone: entry.timeZone }); record.timeZone = entry.timeZone; } catch {}
        }
        return record;
      });
  }
  initial.buddy = normalizeBuddy(saved.buddy);
  if (!saved.buddy) initial.buddy.minutes = initial.history.reduce((sum, entry) => sum + entry.minutes, 0);
  initial.house = normalizeHouse(saved.house, initial.layout, initial.history);
  if (saved.layout !== undefined) {
    initial.layout = fitRoomType(initial.layout, activeHouseRoom(initial.house).type);
    activeHouseRoom(initial.house).layout = structuredClone(initial.layout);
  } else initial.layout = structuredClone(activeHouseRoom(initial.house).layout);
  return initial;
}

function completeDueSession(state, now) {
  if (!state.session.running || remainingAt(state.session, now) > 0) return null;
  // A browser reopened tomorrow still credits the day this session ended.
  const { id, kind, endsAt, duration, taskSnapshot, timeZone } = state.session;
  state.session = { ...state.session, phase: 'completed', remaining: 0, running: false, endsAt: null, completedAt: endsAt };
  if (kind === 'break') return { id, kind, at: endsAt, minutes: duration / 60_000, coins: 0 };
  if (state.history.some(entry => entry.id && entry.id === id)) return null;
  state.history.push({ id, date: localDate(endsAt, timeZone), at: endsAt, minutes: duration / 60_000, task: taskSnapshot ?? '', ...(timeZone ? { timeZone } : {}) });
  state.history = state.history.slice(-365);
  state.house.coins = Math.min(1_000_000_000, state.house.coins + focusCoins(duration / 60_000));
  recordSession(state.house, { at: endsAt, minutes: duration / 60_000 });
  addBait(state.pond, duration / 60_000, endsAt);
  const adventure = recordAdventure(state.buddy, duration / 60_000, endsAt, clockRandom);
  const reward = recordPetFocus(state, duration / 60_000, endsAt), petId = reward.id || state.session.petId || state.pet;
  const gifts = Object.freeze(reward.gifts.map(({ id: giftId, label }) => Object.freeze({ id: giftId, label })));
  return { id, kind: 'focus', at: endsAt, minutes: duration / 60_000, coins: focusCoins(duration / 60_000), garden: growGarden(state, duration / 60_000), buddy: adventure, pet: { id: petId, name: petName(state, petId), hearts: reward.earned, bondTitle: bondLevel(state.petBonds[petId]).title, gifts } };
}

export function createStateStore(storage, now = clockNow) {
  let state = freshState();
  let lastPersisted = null;

  function readLatest() {
    try {
      const raw = storage.getItem(storageKey);
      // Preserve this visit's state if writes are blocked or storage is full.
      // A genuinely newer value from another tab still takes precedence.
      if (raw === lastPersisted) return state;
      lastPersisted = raw;
      return restoreState(raw);
    } catch { return state; }
  }
  state = readLatest();

  function update(mutate = () => {}) {
    const timestamp = now();
    const next = structuredClone(readLatest());
    const completion = completeDueSession(next, timestamp);
    next.rooms ||= {};
    if (next.layout.presetId) next.rooms[next.layout.presetId] = structuredClone(next.layout);
    activeHouseRoom(next.house).layout = structuredClone(next.layout);
    mutate(next, { now: timestamp });
    next.layout = fitRoomType(next.layout, activeHouseRoom(next.house).type);
    if (next.layout.presetId) next.rooms[next.layout.presetId] = structuredClone(next.layout);
    activeHouseRoom(next.house).layout = structuredClone(next.layout);
    state = next;
    let persisted = false;
    try {
      const raw = JSON.stringify(state);
      storage.setItem(storageKey, raw);
      lastPersisted = raw;
      persisted = true;
    } catch { /* The current visit remains usable without storage. */ }
    return { state, completion, persisted };
  }

  return {
    get state() { return state; },
    refresh() { state = readLatest(); return state; },
    update,
    useRoom(presetId, reset = false) {
      if (!PRESETS.some(preset => preset.id === presetId)) return update();
      return update(draft => { draft.layout = structuredClone(!reset && draft.rooms[presetId] || createLayout(presetId)); });
    },
    saveLayout(layout, roomId) {
      return update(draft => {
        const owner = draft.house.rooms.find(entry => entry.id === roomId);
        if (!owner) return;
        owner.layout = fitRoomType(normalizeLayout(layout), owner.type);
        if (draft.house.activeId === roomId) draft.layout = structuredClone(owner.layout);
      });
    },
    enterHouseRoom(id) {
      return update(draft => {
        if (isFocusing(draft.session)) return;
        const destination = draft.house.rooms.find(room => room.id === id);
        if (!destination) return;
        draft.house.activeId = id;
        draft.layout = structuredClone(destination.layout);
      });
    },
    buildRoom(slotId, presetId, name) {
      let verdict;
      const result = update(draft => {
        verdict = expansionVerdict(draft.house, slotId, presetId);
        if (!verdict.ok) return;
        draft.house.coins -= verdict.slot.price;
        // Start from the chosen furnished design, leaving archived arrangements intact.
        draft.house.rooms.push({ id: slotId, type: verdict.slot.type, name: cleanName(name, verdict.slot.label), layout: fitRoomType(createLayout(presetId), verdict.slot.type) });
      });
      return { ...result, built: verdict.ok, reason: verdict.reason };
    },
    adoptPet(id, name) {
      let verdict;
      const result = update((draft, { now: at }) => {
        verdict = adoptionVerdict(draft, id);
        if (!verdict.ok) return;
        draft.house.coins -= verdict.pet.price;
        draft.pets = [...draft.pets, id];
        draft.pet = id;
        welcomePet(draft, id, name, at);
      });
      return { ...result, adopted: verdict.ok, reason: verdict.reason };
    },
    petRitual(id, kind) {
      let ritual;
      const result = update((draft, { now: at }) => { ritual = shareRitual(draft, id, kind, localDate(at), at); });
      return { ...result, ritual };
    },
    renamePet(id, name) { return update(draft => { if (!draft.pets.includes(id)) return; const bond = draft.petBonds[id]; bond.name = cleanPetName(name, bond.name); }); },
    setPetRibbon(id, ribbon) { return update(draft => { if (!draft.pets.includes(id)) return; const bond = draft.petBonds[id]; if (Number.isInteger(ribbon) && ribbon >= 0 && ribbon <= bondLevel(bond).index) bond.ribbon = ribbon; }); },
    selectPetGift(id, gift) {
      return update(draft => {
        if (!draft.pets.includes(id)) return;
        const bond = draft.petBonds[id];
        if (petGifts(bond).earned.some(entry => entry.id === gift)) bond.gift = gift;
      });
    },
    feedPet(id, food) {
      let meal;
      const result = update((draft, { now: at }) => { meal = feedPet(draft, id, food, at); });
      return { ...result, meal };
    },
    choosePetFabric(id, fabric) {
      let fabricResult;
      const result = update(draft => { fabricResult = choosePetFabric(draft, id, fabric); });
      return { ...result, fabric: fabricResult };
    },
    landFish(baitIndex, rolled = null) {
      let caught = null;
      const result = update((draft, { now: timestamp }) => { caught = landCatch(draft.pond, baitIndex, clockRandom, timestamp, rolled); });
      return { ...result, caught };
    },
    toggleTankFish(id) {
      let inTank = null;
      const result = update(draft => { inTank = toggleTank(draft.pond, id); });
      return { ...result, inTank };
    },
    openBuddyFind() {
      let opened = null;
      const result = update(draft => { const entry = waitingFind(draft.buddy); if (entry) { entry.opened = true; opened = { ...entry }; } });
      return { ...result, opened };
    },
    renameBuddy(name) { return update(draft => { if (typeof name === 'string' && name.trim()) draft.buddy.name = name.trim().slice(0, 20); }); },
    setBuddyColor(id) { return update(draft => { if (BUDDY_COLORS.some(color => color.id === id)) draft.buddy.color = id; }); },
    renameHouse(name) { return update(draft => { draft.house.name = cleanName(name, draft.house.name); }); },
    plantSeed(species, slot, expectedId) {
      let planted;
      const result = update(draft => { planted = plantGardenSeed(draft, species, slot, expectedId); });
      return { ...result, planted };
    },
    tendPlant(id) { return update(draft => { if (draft.garden.plants.some(plant => plant.id === id && gardenGrowth(plant) < 1)) draft.garden.activeId = id; }); },
    placePlant(id, slot) { return update(draft => { placeGardenPlant(draft.garden, id, slot); }); },
    renamePlant(id, name) { return update(draft => { const plant = draft.garden.plants.find(item => item.id === id); if (plant) plant.name = typeof name === 'string' ? name.trim().slice(0, 28) : plant.name; }); },
    renameRoom(id, name) { return update(draft => { const room = draft.house.rooms.find(entry => entry.id === id); if (room) room.name = cleanName(name, room.name); }); },
    // Replace the whole home with a restored copy, keeping the current save
    // aside first. Nothing changes if that copy cannot be kept.
    restore(next) {
      try { storage.setItem(recoveryKey, storage.getItem(storageKey) ?? JSON.stringify(state)); } catch { return { state, persisted: false, restored: false }; }
      const replacement = structuredClone(next);
      return { ...update(draft => { for (const key of Object.keys(draft)) delete draft[key]; Object.assign(draft, replacement); }), completion: null, restored: true };
    },
    hasRecovery() {
      try { return Boolean(storage.getItem(recoveryKey)); } catch { return false; }
    },
    // Swap back to the home from before the last restore.
    undoRestore() {
      let raw;
      try { raw = storage.getItem(recoveryKey); } catch { raw = null; }
      if (!raw) return { state, persisted: false, restored: false };
      return this.restore(restoreState(raw));
    },
    setRunning(running, expectedId) {
      return update((draft, { now: timestamp }) => {
        if (expectedId !== undefined && draft.session.id !== expectedId) return;
        if (!running) { draft.session = pauseSession(draft.session, timestamp); return; }
        if (draft.session.running) return;
        if (draft.session.kind === 'break') draft.session = createSession(draft.session.focusMinutes || 25);
        const continuing = sessionStarted(draft.session), petId = focusPetId(draft), plantId = focusGardenPlantId(draft);
        draft.session = { ...startSession(draft.session, timestamp), petId, plantId };
        if (!continuing) {
          draft.session.taskSnapshot = draft.task;
          draft.session.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
      });
    },
    resumeFocus(expectedId) {
      return update((draft, { now: timestamp }) => {
        if (draft.session.id === expectedId && sessionStarted(draft.session) && !draft.session.running) draft.session = startSession(draft.session, timestamp);
      });
    },
    resetSession(minutes, expectedId) {
      return update(draft => {
        if (expectedId !== undefined && draft.session.id !== expectedId) return;
        const duration = minutes ?? (draft.session.kind === 'break' ? draft.session.focusMinutes : draft.session.duration / 60_000);
        if (isDuration(duration)) draft.session = createSession(duration);
      });
    },
    startBreak(minutes, expectedId) {
      return update((draft, { now: timestamp }) => {
        if (![5, 15].includes(minutes) || draft.session.running || (expectedId !== undefined && draft.session.id !== expectedId)) return;
        if (draft.session.kind !== 'focus' || draft.session.remaining !== 0) return;
        draft.session = { ...startSession(createSession(minutes, 'break'), timestamp), focusMinutes: draft.session.duration / 60_000 };
      });
    },
    endBreak(expectedId) {
      return update(draft => {
        if (draft.session.kind === 'break' && (expectedId === undefined || draft.session.id === expectedId)) draft.session = createSession(draft.session.focusMinutes || 25);
      });
    },
  };
}
