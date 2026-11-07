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
        const r = indexedDB.open(DB, 2);
        r.onupgradeneeded = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains(ST)) d.createObjectStore(ST, { keyPath: 'id' });
          if (!d.objectStoreNames.contains('renders')) d.createObjectStore('renders', { keyPath: 'id' });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
    return dbp;
  }
  function tx(mode, fn, store = ST) {
    return db().then((d) => new Promise((res) => {
      if (!d) return res(null);
      try {
        const t = d.transaction(store, mode);
        const out = fn(t.objectStore(store));
        t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
        t.onerror = () => res(null);
      } catch (e) { res(null); }
    }));
  }
  MQ.listGarments = () => tx('readonly', (s) => s.getAll()).then((r) => (r || []).sort((a, b) => a.addedAt - b.addedAt));
  MQ.putGarment = (g) => tx('readwrite', (s) => s.put(g));
  MQ.deleteGarment = (id) => tx('readwrite', (s) => s.delete(id));
  // Fotos generadas por la IA y tu foto de cuerpo completo (para no volver a pagar por lo mismo)
  MQ.getRender = (id) => tx('readonly', (s) => s.get(id), 'renders').then((r) => (r && r.url) || null);
  MQ.putRender = (id, url) => tx('readwrite', (s) => s.put({ id, url, at: Date.now() }), 'renders');
  MQ.deleteRender = (id) => tx('readwrite', (s) => s.delete(id), 'renders');
})();
