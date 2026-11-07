/* MeQueda · Interfaz del estudio de prueba. */
(function () {
  const MQ = window.MQ;
  const $ = (id) => document.getElementById(id);
  const SKINS = ['#f2d3bd', '#e8bd98', '#d6a07a', '#bb835c', '#99633f', '#6c432a'];
  const DEMOS = [
    { file: 'camiseta-rayas.jpg', name: 'Camiseta a rayas' },
    { file: 'jean-indigo.jpg', name: 'Jean recto índigo' },
    { file: 'hoodie-verde.jpg', name: 'Hoodie verde' },
    { file: 'sueter-camel.jpg', name: 'Suéter camel' },
    { file: 'camiseta-terracota.jpg', name: 'Camiseta terracota' },
    { file: 'short-beige.jpg', name: 'Short beige' },
  ];

  const state = {
    profile: Object.assign({ gender: 'men', height: 175, weight: 72, pref: 'normal', skin: SKINS[2], overrides: {}, photo: null, done: false }, MQ.loadProfile() || {}),
    garments: [],
    outfit: { top: null, bottom: null }, // ids
    active: 'top',
    sizes: {}, // garmentId -> talla elegida (si el usuario la cambió)
    filter: 'all',
  };
  const hrefs = {}; // garmentId -> blob URL

  const body = () => MQ.estimateBody(state.profile);
  const byId = (id) => state.garments.find((g) => g.id === id);
  function hrefOf(g) {
    if (hrefs[g.id]) return hrefs[g.id];
    try {
      const bin = atob(g.png.split(',')[1]);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      hrefs[g.id] = URL.createObjectURL(new Blob([arr], { type: 'image/png' }));
    } catch (e) { hrefs[g.id] = g.png; }
    return hrefs[g.id];
  }
  function sizeFor(g, b) {
    const r = MQ.rankSizes(g, b, state.profile.pref);
    const chosen = state.sizes[g.id];
    return { size: chosen && r.results.some((x) => x.size === chosen) ? chosen : r.best, ranked: r };
  }
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ------------------------------------------------------------ render
  function outfitFor(b, override) {
    const o = {};
    for (const slot of ['top', 'bottom']) {
      const g = byId(state.outfit[slot]);
      if (!g) continue;
      const size = override && override.slot === slot ? override.size : sizeFor(g, b).size;
      o[slot] = { garment: g, size, href: hrefOf(g) };
    }
    return o;
  }

  function render() {
    const b = body(), p = state.profile;
    const opts = { skin: p.skin, photo: p.photo };
    const r = MQ.renderAvatar(b, outfitFor(b), opts);
    $('avatar').innerHTML = r.svg;

    // Pestañas de prenda activa (arriba / abajo)
    $('slots').innerHTML = ['top', 'bottom'].map((slot) => {
      const g = byId(state.outfit[slot]);
      return '<button type="button" role="tab" data-slot="' + slot + '" aria-selected="' + (state.active === slot) + '"' + (g ? '' : ' disabled') + '>' +
        (slot === 'top' ? 'Arriba' : 'Abajo') + (g ? ' · ' + sizeFor(g, b).size : '') + '</button>';
    }).join('');

    const g = byId(state.outfit[state.active]) || byId(state.outfit.top) || byId(state.outfit.bottom);
    if (!g) {
      $('nowPlaying').innerHTML = '<b>Agrega una prenda</b><span>Pega o arrastra la foto de una prenda</span>';
      $('sizeDock').innerHTML = ''; $('verdict').innerHTML = ''; $('fitList').innerHTML = ''; $('minis').innerHTML = ''; $('source').textContent = '';
      renderRail();
      return;
    }
    if (g.category !== state.active) state.active = g.category;
    const sel = sizeFor(g, b);
    const cur = sel.ranked.results.find((x) => x.size === sel.size);
    $('nowPlaying').innerHTML = '<b>' + esc(g.name) + '</b><span>' + esc(g.store || (g.demo ? 'Prenda de ejemplo' : 'Tu prenda')) +
      (g.url ? ' · <a href="' + esc(g.url) + '" target="_blank" rel="noopener">Ver en la tienda</a>' : '') + '</span>';

    $('sizeDock').innerHTML = sel.ranked.results.map((x) =>
      '<button type="button" class="sz ' + x.status + '" data-size="' + esc(x.size) + '" aria-pressed="' + (x.size === sel.size) + '">' +
      esc(x.size) + (x.size === sel.ranked.best ? '<i aria-label="recomendada">★</i>' : '') + '</button>').join('');

    const verdictTxt = { good: 'Te queda bien', warn: 'Te queda, con detalles', bad: 'No es tu talla' }[cur.status];
    $('verdict').innerHTML = '<div class="big ' + cur.status + '"><span class="lab">Talla ' + esc(sel.size) + '</span><b>' + verdictTxt + '</b></div>' +
      '<p class="rec">Tu talla recomendada: <b>' + esc(sel.ranked.best) + '</b>' + (sel.size !== sel.ranked.best ? ' <button type="button" class="link" data-size="' + esc(sel.ranked.best) + '">verla</button>' : '') + '</p>';
    const notes = cur.items.slice();
    if (r.overLength > 1 && g.category === 'bottom') notes.push({ label: 'Bota', status: 'warn', text: 'Se arruga en el zapato', detail: '≈' + Math.round(r.overLength) + ' cm de más' });
    $('fitList').innerHTML = notes.map((it) => '<li class="' + it.status + '"><i></i><div><b>' + it.label + '</b><span>' + it.text + '</span></div><small>' + it.detail + '</small></li>').join('');
    $('source').innerHTML = sel.ranked.fromTable
      ? '<span class="dot good"></span>Medidas tomadas de la tabla de tallas de la tienda'
      : '<span class="dot warn"></span>Medidas estimadas desde la foto. Con la extensión se usan las de la tienda.';

    $('minis').innerHTML = sel.ranked.results.map((x) => {
      const o = outfitFor(b, { slot: g.category, size: x.size });
      return '<button type="button" class="mini ' + x.status + '" data-size="' + esc(x.size) + '" aria-pressed="' + (x.size === sel.size) + '">' +
        MQ.renderAvatar(b, o, opts).svg + '<span>' + esc(x.size) + (x.size === sel.ranked.best ? ' ★' : '') + '</span></button>';
    }).join('');
    renderRail();
  }

  function renderRail() {
    const list = state.garments.filter((g) => state.filter === 'all' || g.category === state.filter);
    const b = body();
    $('rail').innerHTML = '<button type="button" class="card add" id="addCard"><span class="plus">+</span><b>Agregar prenda</b><small>Pega, arrastra o sube una foto</small></button>' +
      list.slice().reverse().map((g) => {
        const on = state.outfit.top === g.id || state.outfit.bottom === g.id;
        return '<div class="card' + (on ? ' on' : '') + '" data-id="' + g.id + '" role="button" tabindex="0" aria-pressed="' + on + '">' +
          '<img src="' + hrefOf(g) + '" alt="" loading="lazy" />' +
          '<b>' + esc(g.name) + '</b><small>' + (g.category === 'top' ? 'Arriba' : 'Abajo') + ' · talla ' + esc(sizeFor(g, b).ranked.best) + (g.demo ? ' · ejemplo' : '') + '</small>' +
          '<button type="button" class="del" data-del="' + g.id + '" aria-label="Quitar ' + esc(g.name) + '">×</button></div>';
      }).join('');
    document.querySelectorAll('#filters button').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.f === state.filter)));
  }

  function renderProfile() {
    const p = state.profile, b = body();
    $('chipName').textContent = p.done ? (p.gender === 'women' ? 'Mujer' : 'Hombre') : 'Crea tu avatar';
    $('chipStats').textContent = p.height + ' cm · ' + p.weight + ' kg';
    $('chipFace').style.backgroundImage = p.photo ? 'url(' + p.photo.src + ')' : '';
    $('chipFace').classList.toggle('empty', !p.photo);
    $('height').value = p.height; $('weight').value = p.weight;
    seg('genderSeg', p.gender); seg('prefSeg', p.pref);
    $('skinSwatches').innerHTML = SKINS.map((c) => '<button type="button" style="--c:' + c + '" data-c="' + c + '" aria-pressed="' + (c === p.skin) + '" aria-label="Tono"></button>').join('') +
      (SKINS.includes(p.skin) ? '' : '<button type="button" style="--c:' + p.skin + '" data-c="' + p.skin + '" aria-pressed="true" aria-label="Tono de tu foto"></button>');
    $('removePhoto').hidden = !p.photo; $('faceAdjust').hidden = !p.photo;
    if (p.photo) { $('pZoom').value = p.photo.zoom; $('pX').value = p.photo.x; $('pY').value = p.photo.y; }
    $('facePreview').innerHTML = MQ.renderAvatar(b, {}, { skin: p.skin, photo: p.photo }).svg;
    const est = MQ.estimateBody({ gender: p.gender, height: p.height, weight: p.weight });
    for (const [id, k] of [['mChest', 'chest'], ['mWaist', 'waist'], ['mHip', 'hip']]) { $(id).placeholder = est[k]; $(id).value = p.overrides[k] || ''; }
    $('measureSummary').textContent = 'pecho ' + b.chest + ' · cintura ' + b.waist + ' · cadera ' + b.hip + ' cm';
  }
  function seg(id, v) { document.querySelectorAll('#' + id + ' button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === v))); }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function commitProfile() { MQ.saveProfile(state.profile); renderProfile(); render(); }

  // ------------------------------------------------------------ prendas
  async function addGarment(src, meta = {}, silent) {
    const g = await MQ.processGarment(src, meta);
    if (g.quality === 'empty') throw new Error('No encontré una prenda en esa imagen.');
    state.garments.push(g);
    await MQ.putGarment(g);
    state.outfit[g.category] = g.id;
    state.active = g.category;
    if (!silent) {
      const tip = g.quality === 'busy' ? ' El fondo no es liso: si se ve raro, prueba con la foto de la prenda sola.' : g.quality === 'cropped' ? ' La prenda parece cortada en la foto.' : '';
      toast('Listo: ' + (g.category === 'top' ? 'parte de arriba' : 'parte de abajo') + (g.analysis.longSleeve ? ', manga larga' : '') + '.' + tip);
    }
    render();
    return g;
  }

  async function handleFiles(files, name) {
    const box = $('processing');
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      box.hidden = false;
      box.innerHTML = '<span class="spin"></span> Quitando el fondo y leyendo la prenda…';
      const url = URL.createObjectURL(file);
      try {
        const g = await addGarment(url, { name: name || cleanName(file.name) });
        box.innerHTML = '<img src="' + hrefOf(g) + '" alt="" /><div><b>' + esc(g.name) + '</b><span>' + (g.category === 'top' ? 'Parte de arriba' : 'Parte de abajo') + ' detectada. Ya está en tu avatar.</span></div>';
        $('garmentName').value = '';
      } catch (e) {
        box.innerHTML = '<span class="err">' + esc(e.message) + '</span>';
      } finally { URL.revokeObjectURL(url); }
    }
  }
  const cleanName = (n) => {
    const base = String(n || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
    return /^(image|imagen|captura|screenshot|img|\d|goods)/i.test(base) || !base ? '' : base.slice(0, 48);
  };

  async function loadDemos() {
    for (const d of DEMOS) {
      try { const g = await addGarment('demo/' + d.file, { name: d.name }, true); g.demo = true; await MQ.putGarment(g); } catch (e) { /* sin demo */ }
    }
    const top = state.garments.find((g) => g.category === 'top'), bot = state.garments.find((g) => g.category === 'bottom');
    state.outfit = { top: top && top.id, bottom: bot && bot.id };
    state.active = 'top';
    render();
  }

  // Prendas enviadas por la extensión de MeQueda
  window.addEventListener('message', async (ev) => {
    const d = ev.data;
    if (!d || d.type !== 'mequeda:garment' || ev.source !== window) return;
    const imgs = (d.images || []).filter(Boolean);
    toast('Recibí "' + (d.name || 'la prenda') + '" de ' + (d.store || 'la tienda') + '. Procesando…');
    const table = d.tableRows ? MQ.parseSizeTable(d.tableRows) : null;
    let lastErr;
    // Probamos las fotos y elegimos la que parece la prenda sola sobre fondo liso (sin modelo)
    const tried = [];
    for (const src of imgs.slice(0, 8)) {
      try {
        const g = await MQ.processGarment(src, { name: d.name, store: d.store, url: d.url, sizes: d.sizes, table });
        g.fitHint = d.description || '';
        g.pick = (g.quality === 'ok' ? 0 : g.quality === 'busy' ? 2 : 4) + g.skinRatio * 8;
        tried.push(g);
        if (g.quality === 'ok' && g.skinRatio < 0.05) break;
      } catch (e) { lastErr = e; }
    }
    tried.sort((a, b) => a.pick - b.pick);
    const best = tried[0];
    if (!best) return toast('No pude procesar las fotos: ' + (lastErr ? lastErr.message : 'sin imágenes'));
    state.garments.push(best);
    await MQ.putGarment(best);
    state.outfit[best.category] = best.id; state.active = best.category;
    render();
    toast('Listo: ' + best.name + (table ? ' (con la tabla de tallas de la tienda)' : ''));
  });

  // ------------------------------------------------------------ eventos
  function bind() {
    const p = state.profile;
    $('profileChip').addEventListener('click', () => $('profileSheet').showModal());
    $('profileForm').addEventListener('submit', () => { p.done = true; commitProfile(); });
    document.querySelectorAll('#genderSeg button').forEach((x) => x.addEventListener('click', () => { p.gender = x.dataset.v; commitProfile(); }));
    document.querySelectorAll('#prefSeg button').forEach((x) => x.addEventListener('click', () => { p.pref = x.dataset.v; state.sizes = {}; commitProfile(); }));
    $('height').addEventListener('input', (e) => { if (+e.target.value >= 130) { p.height = +e.target.value; commitProfile(); } });
    $('weight').addEventListener('input', (e) => { if (+e.target.value >= 35) { p.weight = +e.target.value; commitProfile(); } });
    for (const [id, k] of [['mChest', 'chest'], ['mWaist', 'waist'], ['mHip', 'hip']]) {
      $(id).addEventListener('change', (e) => { const v = +e.target.value; if (v > 20) p.overrides[k] = v; else delete p.overrides[k]; commitProfile(); });
    }
    $('skinSwatches').addEventListener('click', (e) => { const c = e.target.closest('[data-c]'); if (c) { p.skin = c.dataset.c; commitProfile(); } });
    $('photoInput').addEventListener('change', onPhoto);
    $('removePhoto').addEventListener('click', () => { p.photo = null; $('skinAuto').textContent = ''; commitProfile(); });
    for (const [id, k] of [['pZoom', 'zoom'], ['pX', 'x'], ['pY', 'y']]) $(id).addEventListener('input', (e) => { if (p.photo) { p.photo[k] = +e.target.value; commitProfile(); } });

    $('slots').addEventListener('click', (e) => { const x = e.target.closest('[data-slot]'); if (x && !x.disabled) { state.active = x.dataset.slot; render(); } });
    const pick = (e) => { const x = e.target.closest('[data-size]'); if (!x) return; const g = byId(state.outfit[state.active]); if (g) { state.sizes[g.id] = x.dataset.size; render(); } };
    $('sizeDock').addEventListener('click', pick);
    $('minis').addEventListener('click', pick);
    $('verdict').addEventListener('click', pick);
    $('prevBtn').addEventListener('click', () => cycle(-1));
    $('nextBtn').addEventListener('click', () => cycle(1));
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, dialog')) return;
      if (e.key === 'ArrowLeft') cycle(-1);
      if (e.key === 'ArrowRight') cycle(1);
    });
    let x0 = null;
    $('avatar').addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    $('avatar').addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 50) cycle(e.clientX < x0 ? 1 : -1); x0 = null; });

    $('rail').addEventListener('click', async (e) => {
      if (e.target.closest('#addCard')) return openAdd();
      const del = e.target.closest('[data-del]');
      if (del) {
        const id = del.dataset.del;
        state.garments = state.garments.filter((g) => g.id !== id);
        await MQ.deleteGarment(id);
        for (const s of ['top', 'bottom']) if (state.outfit[s] === id) { const n = state.garments.find((g) => g.category === s); state.outfit[s] = n ? n.id : null; }
        return render();
      }
      const c = e.target.closest('[data-id]');
      if (c) { const g = byId(c.dataset.id); state.outfit[g.category] = g.id; state.active = g.category; render(); }
    });
    $('rail').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.id) e.target.click(); });
    $('filters').addEventListener('click', (e) => { const x = e.target.closest('[data-f]'); if (x) { state.filter = x.dataset.f; renderRail(); } });

    // Agregar prenda: archivo, arrastrar o pegar
    $('addCancel').addEventListener('click', () => $('addSheet').close());
    $('garmentInput').addEventListener('change', (e) => { handleFiles([...e.target.files], $('garmentName').value.trim()); e.target.value = ''; });
    const drop = $('drop');
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('garmentInput').click(); } });
    for (const ev of ['dragover', 'dragenter']) document.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
    for (const ev of ['dragleave', 'drop']) document.addEventListener(ev, () => drop.classList.remove('over'));
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = [...(e.dataTransfer.files || [])];
      if (files.length) { if (!$('addSheet').open) openAdd(); handleFiles(files, $('garmentName').value.trim()); }
    });
    document.addEventListener('paste', (e) => {
      const files = [...(e.clipboardData.items || [])].filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile());
      if (files.length) { e.preventDefault(); if (!$('addSheet').open) openAdd(); handleFiles(files, $('garmentName').value.trim()); }
    });
  }
  function openAdd() { $('processing').hidden = true; $('addSheet').showModal(); }
  function cycle(delta) {
    const list = state.garments.filter((g) => g.category === state.active);
    if (!list.length) return;
    const i = list.findIndex((g) => g.id === state.outfit[state.active]);
    const n = list[(i + delta + list.length) % list.length];
    state.outfit[state.active] = n.id;
    render();
  }

  function onPhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 520 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      // Tono de piel: promedio de las mejillas (zona central-baja del rostro)
      try {
        const d = ctx.getImageData(Math.round(c.width * 0.36), Math.round(c.height * 0.52), Math.round(c.width * 0.28), Math.round(c.height * 0.12)).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 16) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
        const hex = '#' + [r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('');
        state.profile.skin = MQ.shade(hex, -0.04);
        $('skinAuto').textContent = '· tomado de tu foto';
      } catch (err) { /* sin muestreo */ }
      state.profile.photo = { src: c.toDataURL('image/jpeg', 0.86), zoom: 1, x: 0, y: 0 };
      URL.revokeObjectURL(url);
      commitProfile();
    };
    img.src = url;
    e.target.value = '';
  }

  // ------------------------------------------------------------ inicio
  async function init() {
    bind();
    renderProfile();
    state.garments = (await MQ.listGarments()) || [];
    if (!state.garments.length) await loadDemos();
    else {
      for (const s of ['top', 'bottom']) { const g = state.garments.slice().reverse().find((x) => x.category === s); state.outfit[s] = g ? g.id : null; }
      render();
    }
    if (!state.profile.done) $('profileSheet').showModal();
    window.postMessage({ type: 'mequeda:ready' }, '*');
  }
  init();
})();
