/* MeQueda · Guardado local: perfil en localStorage y prendas (PNG) en IndexedDB. */
(function () {
  const MQ = (window.MQ = window.MQ || {});
  const PKEY = 'mequeda:profile:v2';
  const DB = 'mequeda-v3', ST = 'garments';

  MQ.loadProfile = function () {
    try { const s = localStorage.getItem(PKEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  };
  MQ.saveProfile = function (p) {
    try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) { /* sin espacio o bloqueado */ }
  };

  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res) => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' });
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then((d) => new Promise((res) => {
      if (!d) return res(null);
      try {
        const t = d.transaction(ST, mode);
        const out = fn(t.objectStore(ST));
        t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
        t.onerror = () => res(null);
      } catch (e) { res(null); }
    }));
  }
  MQ.listGarments = () => tx('readonly', (s) => s.getAll()).then((r) => (r || []).sort((a, b) => a.addedAt - b.addedAt));
  MQ.putGarment = (g) => tx('readwrite', (s) => s.put(g));
  MQ.deleteGarment = (id) => tx('readwrite', (s) => s.delete(id));
})();
