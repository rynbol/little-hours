const pins = import.meta.env?.DEV ? globalThis.__littleHoursTest : undefined;

export const clockNow = typeof pins?.now === 'function' ? pins.now : () => Date.now();
export const clockRandom = typeof pins?.random === 'function' ? pins.random : () => Math.random();
export const pinnedStorage = pins?.storage;
export const isPinned = Boolean(pins);
