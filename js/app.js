/* Interfaz de MeQueda: estado, perfil, carrusel y prendas personalizadas. */
(function () {
  const PV = window.PV;
  const $ = (id) => document.getElementById(id);
  const KEY = 'mequeda:v1';

  const SKINS = ['#f3d4bf', '#e9bf9b', '#d9a47c', '#bd845b', '#9a643f', '#6e4429'];

  const DEFAULT = {
    profile: { gender: 'men', height: 175, weight: 72, pref: 'normal', skin: SKINS[2], overrides: {}, photo: null },
    store: 'uniqlo-us',
    filter: 'all',
    index: 0,
    sel: {}, // productId -> { size, color }
    outfit: {}, // { top: productId, bottom: productId }
    custom: [],
    rate: 4000,
  };

  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return { ...DEFAULT, ...s, profile: { ...DEFAULT.profile, ...(s.profile || {}) } };
      }
    } catch (e) { /* almacenamiento no disponible */ }
    return JSON.parse(JSON.stringify(DEFAULT));
  }
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* cuota llena o bloqueado */ }
    }, 250);
  }

  // ------------------------------------------------------------ datos
  const allProducts = () => PV.CATALOG.concat(state.custom);
  const byId = (id) => allProducts().find((p) => p.id === id);
  function visibleProducts() {
    const g = state.profile.gender;
    return allProducts().filter((p) =>
      (p.store === state.store || p.store === 'custom') &&
      (p.gender === g || p.gender === 'unisex') &&
      (state.filter === 'all' || p.category === state.filter));
  }
  function body() {
    const p = state.profile;
    return PV.estimateBody({ gender: p.gender, height: p.height, weight: p.weight, overrides: p.overrides });
  }
  function selFor(product, b) {
    let s = state.sel[product.id];
    const ranked = PV.rankSizes(product, b, state.profile.pref);
    if (!s || !product.sizes.includes(s.size)) {
      s = { size: ranked.best, color: 0, auto: true };
    } else if (s.auto) {
      s = { ...s, size: ranked.best };
    }
    return { ...s, ranked };
  }
  function companion(product, b) {
    // La otra prenda del outfit (si veo una camiseta, con qué pantalón la combino)
    const slot = product.category === 'top' ? 'bottom' : 'top';
    let other = state.outfit[slot] && byId(state.outfit[slot]);
    const g = state.profile.gender;
    if (!other || (other.gender !== g && other.gender !== 'unisex')) {
      other = allProducts().find((p) => p.category === slot && p.gender === g && p.store === state.store);
    }
    if (!other) return null;
    const s = selFor(other, b);
    return { product: other, size: s.size, color: other.colors[s.color] || other.colors[0] };
  }

  // ------------------------------------------------------------ perfil UI
  function initProfile() {
    const p = state.profile;
    $('height').value = p.height;
    $('weight').value = p.weight;
    $('rate').value = state.rate;
    segment('genderSeg', p.gender, (v) => { p.gender = v; state.index = 0; state.outfit = {}; refreshAll(); });
    segment('prefSeg', p.pref, (v) => {
      p.pref = v;
      for (const k in state.sel) state.sel[k].auto = true;
      refreshAll();
    });
    $('height').addEventListener('input', (e) => { p.height = +e.target.value || p.height; refreshAll(); });
    $('weight').addEventListener('input', (e) => { p.weight = +e.target.value || p.weight; refreshAll(); });
    $('rate').addEventListener('input', (e) => { state.rate = +e.target.value || state.rate; renderStage(); save(); });

    const sw = $('skinSwatches');
    sw.innerHTML = SKINS.map((c) => '<button type="button" class="swatch" style="--c:' + c + '" data-c="' + c + '" aria-label="Tono ' + c + '"></button>').join('');
    sw.addEventListener('click', (e) => {
      const c = e.target.closest('[data-c]');
      if (!c) return;
      p.skin = c.dataset.c;
      refreshAll();
    });

    const ov = [['mChest', 'chest'], ['mWaist', 'waist'], ['mHip', 'hip'], ['mInseam', 'inseam']];
    for (const [id, k] of ov) {
      $(id).addEventListener('change', (e) => {
        const v = +e.target.value;
        if (v > 20) p.overrides[k] = v; else delete p.overrides[k];
        refreshAll();
      });
    }
    $('resetMeasures').addEventListener('click', () => { p.overrides = {}; refreshAll(); });

    $('photoInput').addEventListener('change', onPhoto);
    $('removePhoto').addEventListener('click', () => { p.photo = null; refreshAll(); });
    for (const [id, k] of [['pZoom', 'zoom'], ['pX', 'x'], ['pY', 'y']]) {
      $(id).addEventListener('input', (e) => { if (p.photo) { p.photo[k] = +e.target.value; renderPhoto(); renderStage(); save(); } });
    }
    $('toggleProfile').addEventListener('click', () => {
      $('profilePanel').classList.toggle('collapsed');
    });
  }

  function segment(id, value, onChange) {
    const el = $(id);
    const set = (v) => el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === v)));
    set(value);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      set(b.dataset.v);
      onChange(b.dataset.v);
    });
  }

  function onPhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // Reducimos a 480 px para que quepa en el almacenamiento local
      const max = 480, k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      state.profile.photo = { src: cv.toDataURL('image/jpeg', 0.85), zoom: 1, x: 0, y: 0 };
      URL.revokeObjectURL(url);
      refreshAll();
    };
    img.src = url;
    e.target.value = '';
  }

  function renderPhoto() {
    const ph = state.profile.photo;
    $('removePhoto').hidden = !ph;
    $('photoAdjust').hidden = !ph;
    const prev = $('photoPreview');
    prev.style.backgroundImage = ph ? 'url(' + ph.src + ')' : '';
    prev.classList.toggle('empty', !ph);
    if (ph) { $('pZoom').value = ph.zoom; $('pX').value = ph.x; $('pY').value = ph.y; }
  }

  function renderProfile() {
    const b = body(), p = state.profile;
    document.querySelectorAll('#skinSwatches .swatch').forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.c === p.skin)));
    const ft = Math.floor(b.height / 30.48), inch = Math.round((b.height / 2.54) % 12);
    $('usUnits').textContent = '≈ ' + ft + "'" + inch + '" · ' + Math.round(b.weight * 2.2046) + ' lb · IMC ' + b.bmi;
    const est = PV.estimateBody({ gender: p.gender, height: p.height, weight: p.weight });
    for (const [id, k] of [['mChest', 'chest'], ['mWaist', 'waist'], ['mHip', 'hip'], ['mInseam', 'inseam']]) {
      const el = $(id);
      el.placeholder = est[k];
      el.value = p.overrides[k] || '';
    }
    $('measuresBox').querySelector('summary').firstChild.textContent =
      'Medidas: pecho ' + b.chest + ' · cintura ' + b.waist + ' · cadera ' + b.hip + ' cm ';
    renderPhoto();
  }

  // ------------------------------------------------------------ probador UI
  const STATUS_TXT = { good: 'Bien', warn: 'Regular', bad: 'No' };
  const money = (n, cur = 'USD') => n.toLocaleString(cur === 'COP' ? 'es-CO' : 'en-US', { style: 'currency', currency: cur, maximumFractionDigits: cur === 'COP' ? 0 : 2 });

  function current() {
    const list = visibleProducts();
    if (!list.length) return { list, product: null };
    state.index = ((state.index % list.length) + list.length) % list.length;
    return { list, product: list[state.index] };
  }

  function renderStage() {
    const { list, product } = current();
    const b = body();
    if (!product) {
      $('avatarWrap').innerHTML = '<p class="empty-msg">No hay prendas en esta sección.</p>';
      return;
    }
    const s = selFor(product, b);
    const color = product.colors[s.color] || product.colors[0];
    const comp = companion(product, b);
    const me = { product, size: s.size, color };
    const outfit = product.category === 'top' ? { top: me, bottom: comp } : { bottom: me, top: comp };
    const opts = { skin: state.profile.skin, photo: state.profile.photo, showGrid: true };
    $('avatarWrap').innerHTML = PV.renderAvatar(b, outfit, opts);
    $('counter').textContent = (state.index + 1) + ' / ' + list.length;

    const store = PV.STORES[product.store];
    $('pKind').textContent = (PV.KIND_LABELS[product.kind] || '') + ' · ' + (product.fitLabel || '') + (product.store === 'custom' ? ' · ' + (product.storeName || 'Otra tienda') : '');
    $('pName').textContent = product.name;
    $('pPrice').innerHTML = product.price
      ? money(product.price) + ' <span class="cop">≈ ' + money(product.price * state.rate, 'COP') + '</span>'
      : '';
    const link = product.url || (store && store.searchUrl(product.name));
    $('pLink').hidden = !link;
    if (link) $('pLink').href = link;
    $('pColorName').textContent = color.name;
    $('pColors').innerHTML = product.colors.map((c, i) =>
      '<button type="button" class="swatch" style="--c:' + c.hex + '" data-i="' + i + '" aria-pressed="' + (i === s.color) + '" aria-label="' + c.name + '" title="' + c.name + '"></button>').join('');

    const res = s.ranked.results;
    $('pSizes').innerHTML = res.map((r) =>
      '<button type="button" class="size ' + r.status + (r.size === s.size ? ' active' : '') + '" data-size="' + r.size + '" title="' + STATUS_TXT[r.status] + '">' +
      r.size + (product.sizeUnit === 'in' ? '"' : '') + (r.size === s.ranked.best ? '<span class="star">★</span>' : '') + '</button>').join('');

    const cur = res.find((r) => r.size === s.size);
    const best = s.ranked.best;
    $('reco').innerHTML = '<span class="badge">★ Recomendada: ' + best + (product.sizeUnit === 'in' ? '"' : '') + '</span>' +
      (s.size !== best ? ' <span class="muted">Estás viendo la ' + s.size + '</span>' : '') +
      (product.sizeUnit === 'in' ? ' <span class="muted">(cintura en pulgadas)</span>' : '');
    $('fitList').innerHTML = cur.items.map((it) =>
      '<li class="' + it.status + '"><span class="dot"></span><div><b>' + it.label + ':</b> ' + it.text + '<small>' + it.detail + '</small></div></li>').join('');
    $('combo').innerHTML = comp
      ? 'Combinado con <a href="#" data-goto="' + comp.product.id + '">' + comp.product.name + '</a> talla ' + comp.size + '.'
      : '';

    // Tira con todas las tallas
    $('sizeStrip').innerHTML = res.map((r) => {
      const o = product.category === 'top' ? { top: { ...me, size: r.size }, bottom: comp } : { bottom: { ...me, size: r.size }, top: comp };
      return '<button type="button" class="mini ' + r.status + (r.size === s.size ? ' active' : '') + '" data-size="' + r.size + '">' +
        PV.renderAvatar(b, o, { skin: state.profile.skin, photo: state.profile.photo }) +
        '<span>' + r.size + (r.size === best ? ' ★' : '') + '</span></button>';
    }).join('');

    renderCarousel(list, product, b);
    save();
  }

  function renderCarousel(list, product, b) {
    const el = $('carousel');
    el.innerHTML = list.map((p, i) => {
      const s = selFor(p, b);
      const c = p.colors[s.color] || p.colors[0];
      const o = p.category === 'top' ? { top: { product: p, size: s.size, color: c } } : { bottom: { product: p, size: s.size, color: c } };
      return '<button type="button" role="option" class="card' + (p === product ? ' active' : '') + '" data-i="' + i + '" aria-selected="' + (p === product) + '">' +
        '<div class="thumb">' + PV.renderAvatar(b, o, { garmentOnly: true, crop: p.category }) + '</div>' +
        '<span class="card-name">' + p.name + '</span>' +
        '<span class="card-meta">' + (p.price ? money(p.price) + ' · ' : '') + 'Talla ' + s.ranked.best + '</span></button>';
    }).join('');
    const active = el.querySelector('.card.active');
    if (active) {
      const left = active.offsetLeft - el.clientWidth / 2 + active.clientWidth / 2;
      el.scrollTo({ left, behavior: 'smooth' });
    }
    $('catalogNote').textContent = list.length + ' prendas · ' + (PV.STORES[state.store]?.name || '');
  }

  function setSize(size) {
    const { product } = current();
    if (!product) return;
    const prev = state.sel[product.id] || { color: 0 };
    state.sel[product.id] = { ...prev, size, auto: false };
    state.outfit[product.category] = product.id;
    renderStage();
  }

  function go(delta) {
    state.index += delta;
    const { product } = current();
    if (product) state.outfit[product.category] = product.id;
    renderStage();
  }

  function initStage() {
    $('prevBtn').addEventListener('click', () => go(-1));
    $('nextBtn').addEventListener('click', () => go(1));
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select, dialog')) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    });
    // Swipe en el avatar
    let x0 = null;
    const wrap = $('avatarWrap');
    wrap.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    wrap.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    });

    $('pSizes').addEventListener('click', (e) => { const b = e.target.closest('[data-size]'); if (b) setSize(b.dataset.size); });
    $('sizeStrip').addEventListener('click', (e) => { const b = e.target.closest('[data-size]'); if (b) setSize(b.dataset.size); });
    $('pColors').addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      const { product } = current();
      if (!b || !product) return;
      const prev = state.sel[product.id] || { auto: true };
      state.sel[product.id] = { ...prev, size: prev.size || PV.rankSizes(product, body(), state.profile.pref).best, color: +b.dataset.i };
      state.outfit[product.category] = product.id;
      renderStage();
    });
    $('carousel').addEventListener('click', (e) => {
      const c = e.target.closest('[data-i]');
      if (!c) return;
      state.index = +c.dataset.i;
      const { product } = current();
      if (product) state.outfit[product.category] = product.id;
      renderStage();
    });
    $('combo').addEventListener('click', (e) => {
      const a = e.target.closest('[data-goto]');
      if (!a) return;
      e.preventDefault();
      const target = byId(a.dataset.goto);
      state.filter = 'all';
      markTabs();
      state.index = visibleProducts().indexOf(target);
      renderStage();
    });
    $('filterTabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      state.filter = b.dataset.v;
      state.index = 0;
      markTabs();
      renderStage();
    });
    markTabs();

    const ss = $('storeSelect');
    ss.innerHTML = Object.values(PV.STORES).map((s) => '<option value="' + s.id + '">' + s.name + '</option>').join('');
    ss.value = state.store;
    ss.addEventListener('change', () => { state.store = ss.value; state.index = 0; renderStage(); });
  }
  function markTabs() {
    document.querySelectorAll('#filterTabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.v === state.filter)));
  }

  // ------------------------------------------------------------ prendas personalizadas
  const COLS = { top: ['talla', 'pecho', 'largo', 'hombro', 'manga'], bottom: ['talla', 'cintura', 'cadera', 'entrepierna', 'tiro', 'bota'] };
  const KEYMAP = { pecho: 'chest', largo: 'length', hombro: 'shoulder', manga: 'sleeve', cintura: 'waist', cadera: 'hip', entrepierna: 'inseam', tiro: 'rise', bota: 'opening' };
  const EXAMPLES = {
    top: 'S, 96, 66, 42, 20\nM, 102, 68, 44, 21\nL, 108, 70, 46, 22\nXL, 114, 72, 48, 23',
    bottom: '30, 78, 98, 78, 26, 18\n32, 83, 103, 78, 27, 19\n34, 88, 108, 78, 28, 20',
  };
  function initAdd() {
    const dlg = $('addDialog'), kind = $('addKind'), fit = $('addFit');
    kind.innerHTML = Object.entries(PV.KIND_LABELS).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('');
    const cat = () => (PV.TOP_KINDS.includes(kind.value) ? 'top' : 'bottom');
    const syncKind = () => {
      const c = cat();
      fit.innerHTML = Object.keys(PV.FIT_PRESETS[c]).map((k) => '<option value="' + k + '"' + (k === 'regular' ? ' selected' : '') + '>' +
        ({ slim: 'Ceñido / slim', regular: 'Regular', relaxed: 'Holgado', oversized: 'Oversize', wide: 'Ancho' }[k]) + '</option>').join('');
      $('tableCols').textContent = COLS[c].join(', ') + (c === 'bottom' ? ' (tiro y bota opcionales)' : '');
      $('addTable').placeholder = EXAMPLES[c];
    };
    kind.addEventListener('change', syncKind);
    syncKind();
    $('addProductBtn').addEventListener('click', () => { $('addError').hidden = true; dlg.showModal(); });
    $('addCancel').addEventListener('click', () => dlg.close());
    $('addForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const p = buildCustom(fd, cat());
        state.custom.push(p);
        state.filter = 'all'; markTabs();
        state.index = visibleProducts().indexOf(p);
        state.outfit[p.category] = p.id;
        dlg.close();
        e.target.reset(); syncKind();
        renderStage();
      } catch (err) {
        $('addError').textContent = err.message;
        $('addError').hidden = false;
      }
    });
  }
  function buildCustom(fd, category) {
    const cols = COLS[category];
    let lines = String(fd.get('table') || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
    let factor = 1;
    if (lines[0] && /^(in|inch|pulg)/i.test(lines[0])) { factor = 2.54; lines = lines.slice(1); }
    lines = lines.filter((l) => !/^[a-záéíóú\s]+[,;\t]/i.test(l) || /^(xxs|xs|s|m|l|xl|xxl|\dxl)\b/i.test(l));
    const table = {}, sizes = [];
    for (const l of lines) {
      const parts = l.split(/[,;\t]+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length < (category === 'top' ? 4 : 4)) throw new Error('La línea "' + l + '" tiene pocas columnas. Esperado: ' + cols.join(', '));
      const size = parts[0].toUpperCase();
      const row = {};
      cols.slice(1).forEach((c, i) => {
        const v = parseFloat(String(parts[i + 1] || '').replace(',', '.'));
        if (!isNaN(v)) row[KEYMAP[c]] = +(v * factor).toFixed(1);
      });
      if (category === 'top') {
        if (!row.chest || !row.length) throw new Error('Falta pecho o largo en la talla ' + size);
        row.shoulder = row.shoulder || row.chest * 0.42;
        row.sleeve = row.sleeve || 20;
      } else {
        if (!row.waist || !row.hip || !row.inseam) throw new Error('Falta cintura, cadera o entrepierna en la talla ' + size);
        row.rise = row.rise || 26;
        row.opening = row.opening || row.hip * 0.19;
      }
      table[size] = row;
      sizes.push(size);
    }
    if (!sizes.length) throw new Error('Agrega al menos una talla a la tabla.');
    const fit = fd.get('fit');
    const ease = category === 'top'
      ? { chest: PV.FIT_PRESETS.top[fit] ?? 8 }
      : { waist: 1, hip: PV.FIT_PRESETS.bottom[fit] ?? 6 };
    const hex = fd.get('color') || '#3d5a80';
    return {
      id: 'custom-' + Date.now(),
      store: 'custom', storeName: fd.get('store') || 'Otra tienda',
      gender: state.profile.gender, category, kind: fd.get('kind'),
      name: fd.get('name'), url: fd.get('url') || '', price: +fd.get('price') || 0,
      fitLabel: { slim: 'Slim', regular: 'Regular', relaxed: 'Relaxed', oversized: 'Oversized', wide: 'Wide' }[fit],
      colors: [{ name: 'Color elegido', hex }],
      sizes, table, ease, elastic: +fd.get('elastic') || 0,
    };
  }

  function refreshAll() {
    renderProfile();
    renderStage();
    save();
  }

  initProfile();
  initStage();
  initAdd();
  refreshAll();
})();
