/* MeQueda · Showroom: estado, carrusel de prendas, tallas, perfil con tu cara y prendas desde la extensión. */
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
  const JACKET = /(chaqueta|jacket|abrigo|coat|parka|blazer|chamarra|cardigan|cárdigan|puffer|down|plumas|sobrecamisa|overshirt|bomber|gabardina|trench|chaleco|vest)/i;

  const state = {
    profile: Object.assign({ gender: 'men', height: 175, weight: 72, pref: 'normal', skin: SKINS[2], overrides: {}, photo: null, done: false }, MQ.loadProfile() || {}),
    garments: [],
    outfit: { top: null, bottom: null },
    current: null,
    sizes: {},
    filter: 'all',
  };
  const hrefs = {};
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const body = () => MQ.estimateBody(state.profile);
  const byId = (id) => state.garments.find((g) => g.id === id);
  const kindOf = (g) => (g.category === 'bottom' ? 'bottom' : JACKET.test(g.name + ' ' + (g.fitHint || '')) ? 'jacket' : 'top');
  const visible = () => state.garments.filter((g) => state.filter === 'all' || kindOf(g) === state.filter);

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
    toast.t = setTimeout(() => t.classList.remove('show'), 3400);
  }
  function outfitFor(b, override) {
    const o = {};
    for (const slot of ['top', 'bottom']) {
      const g = byId(state.outfit[slot]);
      if (!g) continue;
      o[slot] = { garment: g, size: override && override.id === g.id ? override.size : sizeFor(g, b).size, href: hrefOf(g) };
    }
    return o;
  }
  function select(g) {
    if (!g) return;
    state.current = g.id;
    state.outfit[g.category] = g.id;
  }

  // ------------------------------------------------------------ render
  const VERDICT = { good: 'Te queda bien', warn: 'Te queda, con detalles', bad: 'No es tu talla' };

  function render() {
    const b = body(), p = state.profile;
    const opts = { skin: p.skin, photo: p.photo };
    const r = MQ.renderAvatar(b, outfitFor(b), opts);
    $('avatar').innerHTML = r.svg;
    document.querySelectorAll('#tabs button').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.f === state.filter)));

    const list = visible();
    let g = byId(state.current);
    if (!g || !list.includes(g)) { g = list.find((x) => state.outfit.top === x.id || state.outfit.bottom === x.id) || list[0]; if (g) select(g); }
    renderCards(list, g, b);
    if (!g) {
      $('dockName').textContent = 'Agrega una prenda';
      $('dockSub').textContent = 'Pega o arrastra la foto de una prenda';
      $('dockThumb').style.backgroundImage = '';
      $('sizes').innerHTML = ''; $('verdictChip').innerHTML = ''; $('dockAction').hidden = true;
      return;
    }
    const sel = sizeFor(g, b);
    const cur = sel.ranked.results.find((x) => x.size === sel.size);
    $('brandSub').textContent = 'PROBADOR · ' + String(g.store || (g.demo ? 'EJEMPLOS' : 'TU ARMARIO')).toUpperCase().slice(0, 22);
    $('dockThumb').style.backgroundImage = 'url(' + hrefOf(g) + ')';
    $('dockName').textContent = g.name;
    $('dockSub').textContent = [g.store || (g.demo ? 'Prenda de ejemplo' : 'Tu prenda'), (kindOf(g) === 'jacket' ? 'Chaqueta' : g.category === 'top' ? 'Superior' : 'Inferior'), 'tu talla: ' + sel.ranked.best].join(' · ');
    $('sizes').innerHTML = sel.ranked.results.map((x) =>
      '<button type="button" class="sz ' + x.status + '" data-size="' + esc(x.size) + '" aria-pressed="' + (x.size === sel.size) + '" title="' + VERDICT[x.status] + '">' +
      esc(x.size) + (x.size === sel.ranked.best ? '<i aria-label="recomendada">★</i>' : '') + '</button>').join('');
    const act = $('dockAction');
    act.hidden = false;
    if (g.url) { act.textContent = 'Ver en la tienda'; act.href = g.url; act.target = '_blank'; }
    else { act.textContent = 'Cómo me queda'; act.href = '#'; act.removeAttribute('target'); }

    const notes = cur.items.slice();
    if (r.overLength > 1 && g.category === 'bottom') notes.push({ label: 'Bota', status: 'warn', text: 'Se arruga sobre el zapato', detail: '≈' + Math.round(r.overLength) + ' cm de más' });
    const firstIssue = notes.find((n) => n.status !== 'good');
    $('verdictChip').className = 'verdict glass ' + cur.status;
    $('verdictChip').innerHTML = '<i></i>Talla ' + esc(sel.size) + ' · ' + VERDICT[cur.status] + (firstIssue ? ' <span>· ' + esc(firstIssue.text) + '</span>' : '');
    $('fitSub').textContent = g.name + ' · talla ' + sel.size + ' · recomendada: ' + sel.ranked.best;
    $('fitList').innerHTML = notes.map((it) => '<li class="' + it.status + '"><i></i><div><b>' + it.label + '</b><span>' + it.text + '</span></div><small>' + it.detail + '</small></li>').join('');
    $('source').textContent = sel.ranked.fromTable ? 'Medidas tomadas de la tabla de tallas de la tienda.' : 'Medidas estimadas desde la foto. Con la extensión se usan las de la tienda.';
    if ($('sizesSheet').open) renderMinis();
  }

  function cardHtml(g, b, depth) {
    const s = sizeFor(g, b).ranked.best;
    return '<button type="button" class="card glass d' + depth + '" data-id="' + g.id + '" aria-label="Probar ' + esc(g.name) + '">' +
      '<img src="' + hrefOf(g) + '" alt="" loading="lazy" /><b>' + esc(g.name) + '</b><small>' + (g.demo ? 'Ejemplo · ' : '') + 'Talla ' + esc(s) + ' para ti</small></button>';
  }
  function renderCards(list, g, b) {
    const i = g ? list.indexOf(g) : -1;
    const left = [], right = [];
    // Carrusel circular: las demás prendas se reparten a ambos lados del avatar
    const others = i < 0 ? [] : list.slice(i + 1).concat(list.slice(0, i));
    const nR = Math.min(3, Math.ceil(others.length / 2)), nL = Math.min(3, others.length - nR);
    others.slice(0, nR).forEach((x, k) => right.push(cardHtml(x, b, k + 1)));
    others.slice(others.length - nL).reverse().forEach((x, k) => left.push(cardHtml(x, b, k + 1)));
    const add = '<button type="button" class="card glass empty d' + Math.min(3, right.length + 1) + '" data-add="1"><span class="plus">+</span><b>Agregar prenda</b><small>Pega o arrastra una foto</small></button>';
    if (right.length < 3) right.push(add);
    $('leftCards').innerHTML = left.reverse().join('');
    $('rightCards').innerHTML = right.join('');
    $('prevBtn').disabled = $('nextBtn').disabled = list.length < 2;
  }

  function renderMinis() {
    const b = body(), g = byId(state.current);
    if (!g) return;
    const sel = sizeFor(g, b);
    $('minis').innerHTML = sel.ranked.results.map((x) =>
      '<button type="button" class="mini ' + x.status + '" data-size="' + esc(x.size) + '" aria-pressed="' + (x.size === sel.size) + '">' +
      MQ.renderAvatar(b, outfitFor(b, { id: g.id, size: x.size }), { skin: state.profile.skin, photo: state.profile.photo }).svg +
      '<span>' + esc(x.size) + (x.size === sel.ranked.best ? ' ★' : '') + '</span></button>').join('');
  }

  function renderProfile() {
    const p = state.profile, b = body();
    $('height').value = p.height; $('weight').value = p.weight;
    seg('genderSeg', p.gender); seg('prefSeg', p.pref);
    $('skinSwatches').innerHTML = SKINS.map((c) => '<button type="button" style="--c:' + c + '" data-c="' + c + '" aria-pressed="' + (c === p.skin) + '" aria-label="Tono de piel"></button>').join('') +
      (SKINS.includes(p.skin) ? '' : '<button type="button" style="--c:' + p.skin + '" data-c="' + p.skin + '" aria-pressed="true" aria-label="Tono de tu foto"></button>');
    $('removePhoto').hidden = !p.photo; $('faceAdjust').hidden = !p.photo;
    $('photoLabel').textContent = p.photo ? 'Cambiar selfie' : 'Subir selfie';
    if (p.photo) { $('pZoom').value = p.photo.zoom; $('pX').value = p.photo.x; $('pY').value = p.photo.y; }
    $('facePreview').innerHTML = MQ.renderAvatar(b, {}, { skin: p.skin, photo: p.photo }).svg;
    const est = MQ.estimateBody({ gender: p.gender, height: p.height, weight: p.weight });
    for (const [id, k] of [['mChest', 'chest'], ['mWaist', 'waist'], ['mHip', 'hip']]) { $(id).placeholder = est[k]; $(id).value = p.overrides[k] || ''; }
    $('measureSummary').textContent = 'pecho ' + b.chest + ' · cintura ' + b.waist + ' · cadera ' + b.hip + ' cm';
  }
  function seg(id, v) { document.querySelectorAll('#' + id + ' button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === v))); }
  function commitProfile() { MQ.saveProfile(state.profile); renderProfile(); render(); }

  // ------------------------------------------------------------ prendas
  async function addGarment(src, meta = {}, silent) {
    const g = await MQ.processGarment(src, meta);
    if (g.quality === 'empty') throw new Error('No encontré una prenda en esa imagen.');
    if (meta.demo) g.demo = true;
    state.garments.push(g);
    await MQ.putGarment(g);
    if (!silent) {
      select(g);
      const tip = g.quality === 'busy' ? ' El fondo no es liso: si se ve raro, usa la foto de la prenda sola.' : g.quality === 'cropped' ? ' La prenda parece cortada en la foto.' : '';
      toast('Listo: ' + (g.category === 'top' ? 'prenda superior' : 'prenda inferior') + (g.analysis.longSleeve ? ', manga larga' : '') + '.' + tip);
      render();
    }
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
        box.innerHTML = '<img src="' + hrefOf(g) + '" alt="" /><div><b>' + esc(g.name) + '</b><span>' + (g.category === 'top' ? 'Prenda superior' : 'Prenda inferior') + ' detectada. Ya la tienes puesta.</span></div>';
        $('garmentName').value = '';
      } catch (e) {
        box.innerHTML = '<span class="err">' + esc(e.message) + '</span>';
      } finally { URL.revokeObjectURL(url); }
    }
  }
  const cleanName = (n) => {
    const base = String(n || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
    return /^(image|imagen|captura|screenshot|img|\d|goods|usgoods)/i.test(base) || !base ? '' : base.slice(0, 48);
  };
  async function loadDemos() {
    for (const d of DEMOS) { try { await addGarment('demo/' + d.file, { name: d.name, demo: true }, true); } catch (e) { /* sin demo */ } }
    const top = state.garments.find((g) => g.category === 'top'), bot = state.garments.find((g) => g.category === 'bottom');
    state.outfit = { top: top && top.id, bottom: bot && bot.id };
    state.current = top && top.id;
  }

  // Prendas que envía la extensión de MeQueda
  window.addEventListener('message', async (ev) => {
    const d = ev.data;
    if (!d || d.type !== 'mequeda:garment' || ev.source !== window) return;
    const imgs = (d.images || []).filter(Boolean);
    toast('Recibí "' + (d.name || 'la prenda') + '" de ' + (d.store || 'la tienda') + '. Procesando…');
    const table = d.tableRows ? MQ.parseSizeTable(d.tableRows) : null;
    let lastErr;
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
    state.filter = 'all';
    select(best);
    render();
    toast('Listo: ' + best.name + (table ? ' (con la tabla de tallas de la tienda)' : ''));
  });

  // ------------------------------------------------------------ tu cara
  async function onPhoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const st = $('faceStatus');
    st.innerHTML = '<span class="spin" style="display:inline-block;vertical-align:-4px"></span> Recortando tu cara…';
    try {
      const img = await MQ.loadImage(url);
      let face = null;
      try { face = await MQ.cutFace(img); } catch (err) { face = null; }
      if (face) {
        state.profile.photo = Object.assign({ zoom: 1, x: 0, y: 0 }, face);
        if (face.skin) { state.profile.skin = face.skin; $('skinAuto').textContent = '· tomado de tu foto'; }
        st.textContent = 'Listo. Ajusta tamaño y posición si hace falta.';
      } else {
        // Plan B: recorte ovalado clásico
        const c = document.createElement('canvas');
        const k = Math.min(1, 520 / Math.max(img.width, img.height));
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        state.profile.photo = { src: c.toDataURL('image/jpeg', 0.86), zoom: 1, x: 0, y: 0 };
        st.textContent = 'No pude recortar la cara sola; usa los controles para centrarla en el óvalo.';
      }
      commitProfile();
    } catch (err) {
      st.textContent = 'No pude leer esa foto. Prueba con otra.';
    } finally { URL.revokeObjectURL(url); }
  }

  // ------------------------------------------------------------ eventos
  function bind() {
    const p = state.profile;
    const openProfile = () => { renderProfile(); $('profileSheet').showModal(); };
    const openAdd = () => { $('processing').hidden = true; $('addSheet').showModal(); };
    const openFit = () => { if (byId(state.current)) $('fitSheet').showModal(); };
    const openSizes = () => { if (byId(state.current)) { renderMinis(); $('sizesSheet').showModal(); } };
    $('tryYou').addEventListener('click', openProfile);
    $('toolAvatar').addEventListener('click', openProfile);
    $('addTop').addEventListener('click', openAdd);
    $('toolAdd').addEventListener('click', openAdd);
    $('toolFit').addEventListener('click', openFit);
    $('verdictChip').addEventListener('click', openFit);
    $('toolSizes').addEventListener('click', openSizes);
    $('dockAction').addEventListener('click', (e) => { if (!byId(state.current) || !byId(state.current).url) { e.preventDefault(); openFit(); } });
    document.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', () => x.closest('dialog').close()));
    document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

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
    $('photoInput').addEventListener('click', () => MQ.warmFace && MQ.warmFace());
    $('removePhoto').addEventListener('click', () => { p.photo = null; $('skinAuto').textContent = ''; $('faceStatus').textContent = ''; commitProfile(); });
    for (const [id, k] of [['pZoom', 'zoom'], ['pX', 'x'], ['pY', 'y']]) $(id).addEventListener('input', (e) => { if (p.photo) { p.photo[k] = +e.target.value; commitProfile(); } });

    $('tabs').addEventListener('click', (e) => { const x = e.target.closest('[data-f]'); if (x) { state.filter = x.dataset.f; state.current = null; render(); } });
    const pick = (e) => {
      const x = e.target.closest('[data-size]'); if (!x) return;
      const g = byId(state.current); if (!g) return;
      state.sizes[g.id] = x.dataset.size;
      render();
    };
    $('sizes').addEventListener('click', pick);
    $('minis').addEventListener('click', pick);
    const onCard = (e) => {
      const c = e.target.closest('.card'); if (!c) return;
      if (c.dataset.add) return openAdd();
      select(byId(c.dataset.id)); render();
    };
    $('leftCards').addEventListener('click', onCard);
    $('rightCards').addEventListener('click', onCard);
    $('prevBtn').addEventListener('click', () => step(-1));
    $('nextBtn').addEventListener('click', () => step(1));
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, dialog')) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'Delete' && state.current) remove(state.current);
    });
    let x0 = null;
    $('avatar').addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    $('avatar').addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 50) step(e.clientX < x0 ? 1 : -1); x0 = null; });

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
  function step(delta) {
    const list = visible();
    const i = list.findIndex((g) => g.id === state.current);
    if (list.length < 2) return;
    select(list[(i + delta + list.length) % list.length]); render();
  }
  async function remove(id) {
    state.garments = state.garments.filter((g) => g.id !== id);
    await MQ.deleteGarment(id);
    for (const s of ['top', 'bottom']) if (state.outfit[s] === id) { const n = state.garments.find((g) => g.category === s); state.outfit[s] = n ? n.id : null; }
    state.current = null;
    render();
    toast('Prenda quitada de tu armario.');
  }

  // ------------------------------------------------------------ inicio
  async function init() {
    bind();
    renderProfile();
    state.garments = (await MQ.listGarments()) || [];
    if (!state.garments.length) await loadDemos();
    else {
      for (const s of ['top', 'bottom']) { const g = state.garments.slice().reverse().find((x) => x.category === s); state.outfit[s] = g ? g.id : null; }
      state.current = state.outfit.top || state.outfit.bottom;
    }
    render();
    if (!state.profile.done) { renderProfile(); $('profileSheet').showModal(); }
    window.postMessage({ type: 'mequeda:ready' }, '*');
  }
  init();
})();
