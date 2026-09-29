import { createStateStore } from './state.js';

export function createSharedStateStore(storage, { locks = globalThis.navigator?.locks, now } = {}) {
  const coordinated = typeof locks?.request === 'function';
  const snapshots = new Map();
  const source = coordinated ? storage : {
    getItem(key) {
      if (!snapshots.has(key)) {
        try { snapshots.set(key, storage.getItem(key)); } catch { snapshots.set(key, null); }
      }
      return snapshots.get(key);
    },
    setItem() { throw new Error('Shared saves require browser coordination.'); },
  };
  const store = createStateStore(source, now);
  let pending = Promise.resolve();
  const shared = {
    get state() { return store.state; },
    refresh: () => store.refresh(),
    hasRecovery: () => store.hasRecovery(),
    get coordinated() { return coordinated; },
    settled: () => pending,
  };
  for (const [name, method] of Object.entries(store)) {
    if (typeof method !== 'function' || name in shared) continue;
    shared[name] = (...args) => {
      const run = () => coordinated ? locks.request('little-hours-home-write', () => method.apply(store, args)) : method.apply(store, args);
      const result = pending.then(run).catch(() => ({ state: store.state, completion: null, persisted: false }));
      pending = result;
      return result;
    };
  }
  return shared;
}
