/* Saves everything on this device (IndexedDB, with localStorage as a fallback). */
'use strict';

const Store = (() => {
  const DB = 'hinton-water', OS = 'kv', LS = 'hinton-water-state';
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      if (!('indexedDB' in self)) return rej(new Error('no idb'));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(OS);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function idb(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction(OS, mode), st = tx.objectStore(OS), q = fn(st);
      tx.oncomplete = () => res(q && q.result);
      tx.onerror = tx.onabort = () => rej(tx.error);
    });
  }
  async function get(key) {
    try { return await idb('readonly', s => s.get(key)); }
    catch (e) { try { return JSON.parse(localStorage.getItem(LS + ':' + key)); } catch (e2) { return null; } }
  }
  async function put(key, val) {
    try { await idb('readwrite', s => s.put(val, key)); }
    catch (e) { try { localStorage.setItem(LS + ':' + key, JSON.stringify(val)); } catch (e2) { throw e2; } }
  }
  /* Ask the browser not to clear our data when space is low. */
  async function persist() {
    try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) {}
    return false;
  }
  async function persisted() {
    try { if (navigator.storage && navigator.storage.persisted) return await navigator.storage.persisted(); } catch (e) {}
    return false;
  }
  return { get, put, persist, persisted };
})();
