/*
 * MeQueda · Procesamiento de la foto real de la prenda.
 *
 * 1. cutout(): quita el fondo (fotos de producto sobre fondo liso) → PNG con transparencia.
 * 2. analyze(): detecta si es parte de arriba o de abajo y sus puntos clave
 *    (cuello, hombros, axilas, mangas, ruedo / pretina, tiro, botas) en píxeles.
 * Todo corre en el navegador, sin servidores.
 */
(function () {
  const MQ = (window.MQ = window.MQ || {});
  const MAX_SIDE = 900;

  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('No se pudo leer la imagen'));
      img.src = src;
    });
  }
  MQ.loadImage = loadImage;

  function toCanvas(img, max = MAX_SIDE) {
    const k = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const c = document.createElement('canvas');
    c.width = Math.round((img.naturalWidth || img.width) * k);
    c.height = Math.round((img.naturalHeight || img.height) * k);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  /** Quita el fondo con un relleno desde los bordes usando el color del fondo. */
  MQ.cutout = function (img) {
    const c = toCanvas(img);
    const { width: w, height: h } = c;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;

    // Color del fondo = mediana de los píxeles del borde
    const border = [];
    const pushPx = (x, y) => { const i = (y * w + x) * 4; border.push([px[i], px[i + 1], px[i + 2], px[i + 3]]); };
    for (let x = 0; x < w; x += 2) { pushPx(x, 0); pushPx(x, h - 1); }
    for (let y = 0; y < h; y += 2) { pushPx(0, y); pushPx(w - 1, y); }
    const transparentBorder = border.filter((b) => b[3] < 20).length > border.length * 0.6;
    const med = (k) => border.map((b) => b[k]).sort((a, b) => a - b)[border.length >> 1];
    const bg = [med(0), med(1), med(2)];
    // Distancia al fondo; las sombras (más oscuras pero del mismo tono) cuentan menos
    const dist = (i) => {
      const dr = px[i] - bg[0], dg = px[i + 1] - bg[1], db = px[i + 2] - bg[2];
      const dl = (dr + dg + db) / 3;
      const cr = dr - dl, cg = dg - dl, cb = db - dl;
      const lum = dl < 0 ? dl * 0.42 : dl;
      return Math.sqrt(cr * cr + cg * cg + cb * cb + lum * lum * 3) * 0.95;
    };
    let sd = 0;
    for (const b of border) { const dr = b[0] - bg[0], dg = b[1] - bg[1], db = b[2] - bg[2]; sd += dr * dr + dg * dg + db * db; }
    sd = Math.sqrt(sd / border.length / 3);
    const tol = Math.max(7, Math.min(42, 5 + sd * 3));

    // 0 = sin visitar/prenda, 1 = fondo
    const bgMask = new Uint8Array(w * h);
    if (transparentBorder) {
      for (let p = 0; p < w * h; p++) if (px[p * 4 + 3] < 40) bgMask[p] = 1;
    } else {
      const stack = new Int32Array(w * h);
      let sp = 0;
      const localTol = 3.5 + sd * 1.2;
      const ldiff = (a, b) => Math.abs(px[a] - px[b]) + Math.abs(px[a + 1] - px[b + 1]) + Math.abs(px[a + 2] - px[b + 2]);
      const seed = (p) => { if (!bgMask[p] && dist(p * 4) < tol * 1.6) { bgMask[p] = 1; stack[sp++] = p; } };
      for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
      // Relleno por continuidad: avanza por el fondo y sus sombras suaves,
      // pero se detiene en el borde nítido de la prenda.
      while (sp) {
        const p = stack[--sp];
        const x = p % w, y = (p / w) | 0;
        const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
        for (const q of nb) {
          if (q < 0 || bgMask[q]) continue;
          const dq = dist(q * 4);
          if (dq < tol || (dq < tol * 3.2 && ldiff(p * 4, q * 4) < localTol * 3)) { bgMask[q] = 1; stack[sp++] = q; }
        }
      }
    }

    // Componente principal (la prenda): nos quedamos con la región más grande
    const label = new Int32Array(w * h).fill(-1);
    let best = -1, bestSize = 0;
    const sizes = [];
    const q = new Int32Array(w * h);
    for (let p = 0; p < w * h; p++) {
      if (bgMask[p] || label[p] >= 0) continue;
      const id = sizes.length;
      let qh = 0, qt = 0, n = 0;
      q[qt++] = p; label[p] = id;
      while (qh < qt) {
        const r = q[qh++]; n++;
        const x = r % w, y = (r / w) | 0;
        if (x > 0 && !bgMask[r - 1] && label[r - 1] < 0) { label[r - 1] = id; q[qt++] = r - 1; }
        if (x < w - 1 && !bgMask[r + 1] && label[r + 1] < 0) { label[r + 1] = id; q[qt++] = r + 1; }
        if (y > 0 && !bgMask[r - w] && label[r - w] < 0) { label[r - w] = id; q[qt++] = r - w; }
        if (y < h - 1 && !bgMask[r + w] && label[r + w] < 0) { label[r + w] = id; q[qt++] = r + w; }
      }
      sizes.push(n);
      if (n > bestSize) { bestSize = n; best = id; }
    }
    const mask = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) {
      // otras piezas grandes (p. ej. la otra pierna separada) también cuentan
      if (label[p] >= 0 && (label[p] === best || sizes[label[p]] > bestSize * 0.25)) mask[p] = 1;
    }

    // Alfa con borde suave
    let touch = 0, area = 0, skin = 0;
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (!mask[p]) { px[i + 3] = 0; continue; }
      area++;
      const R = px[i], Gc = px[i + 1], Bc = px[i + 2];
      if (R > 95 && Gc > 40 && Bc > 20 && R > Gc + 12 && R > Bc + 18 && R - Bc < 120 && Math.max(R, Gc, Bc) - Math.min(R, Gc, Bc) > 18) skin++;
      const x = p % w, y = (p / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touch++;
      const edge = (x > 0 && !mask[p - 1]) || (x < w - 1 && !mask[p + 1]) || (y > 0 && !mask[p - w]) || (y < h - 1 && !mask[p + w]);
      if (edge && !transparentBorder) px[i + 3] = Math.round(255 * Math.min(1, 0.35 + dist(i) / (tol * 3)));
    }
    ctx.putImageData(data, 0, 0);
    const ratio = area / (w * h);
    const quality = ratio < 0.04 ? 'empty' : touch > (w + h) * 0.25 ? 'cropped' : sd > 14 && !transparentBorder ? 'busy' : 'ok';
    return { canvas: c, mask, w, h, quality, bg, skinRatio: area ? skin / area : 0 };
  };

  /** Puntos clave de la prenda en píxeles. */
  MQ.analyze = function (cut) {
    const { mask, w, h } = cut;
    const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) return null;
    const H = y1 - y0;
    // Centro de simetría: mediana del punto medio entre extremos de cada fila
    const mids = [];
    for (let y = y0; y <= y1; y += 2) {
      let l = -1, r = -1;
      for (let x = 0; x < w; x++) if (mask[y * w + x]) { l = x; break; }
      for (let x = w - 1; x >= 0; x--) if (mask[y * w + x]) { r = x; break; }
      if (l >= 0) mids.push((l + r) / 2);
    }
    mids.sort((a, b) => a - b);
    const cx = Math.round(mids[mids.length >> 1]);

    // Tramo que contiene el centro en la fila y
    function centralRun(y) {
      let c = cx;
      if (!at(c, y)) {
        let found = -1;
        for (let d = 1; d < w * 0.06; d++) { if (at(cx + d, y)) { found = cx + d; break; } if (at(cx - d, y)) { found = cx - d; break; } }
        if (found < 0) return null;
        c = found;
      }
      let l = c, r = c;
      while (at(l - 1, y)) l--;
      while (at(r + 1, y)) r++;
      return { l, r, w: r - l + 1 };
    }
    function topAt(x) { for (let y = 0; y < h; y++) if (at(Math.round(x), y)) return y; return y0; }

    // ¿Pantalón? Hueco entre las piernas en la parte baja del centro
    let gap = 0;
    for (let y = y0 + Math.round(H * 0.5); y <= y1; y++) if (!at(cx, y) && !at(cx - 1, y) && !at(cx + 1, y)) gap++;
    const isBottom = gap > H * 0.22;

    if (isBottom) {
      let crotchY = y1;
      for (let y = y0 + Math.round(H * 0.12); y <= y1; y++) {
        let g = 0;
        for (let x = cx - 6; x <= cx + 6; x++) if (!at(x, y)) g++;
        if (g >= 2) { crotchY = y; break; }
      }
      const wr = centralRun(y0 + Math.round(H * 0.03)) || { l: x0, r: x1, w: x1 - x0 };
      const hipY = Math.round(crotchY - (crotchY - y0) * 0.15);
      const hr = centralRun(hipY) || wr;
      const legs = (y) => {
        const runs = []; let s = -1;
        for (let x = 0; x <= w; x++) {
          const v = x < w && at(x, y);
          if (v && s < 0) s = x;
          if (!v && s >= 0) { if (x - s > 3) runs.push({ l: s, r: x - 1, w: x - s }); s = -1; }
        }
        return runs;
      };
      const hemRow = y1 - Math.max(2, Math.round(H * 0.015));
      const lr = legs(hemRow);
      const opening = lr.length ? lr.reduce((a, r) => a + r.w, 0) / lr.length : (x1 - x0) / 2;
      return {
        type: 'bottom', w, h, cx, x0, x1, y0, y1, H,
        waistY: y0, waistFlat: wr.w, waistL: wr.l, waistR: wr.r,
        hipY, hipFlat: hr.w, crotchY, risePx: crotchY - y0, inseamPx: y1 - crotchY,
        openingPx: opening,
      };
    }

    // Parte de arriba
    const widths = [];
    for (let y = y0 + Math.round(H * 0.62); y <= y0 + Math.round(H * 0.9); y++) { const r = centralRun(y); if (r) widths.push(r.w); }
    widths.sort((a, b) => a - b);
    const B = widths.length ? widths[widths.length >> 1] : x1 - x0;
    const half = B / 2;
    // Axila: donde aparece el hueco bajo la manga, justo por fuera del costado
    let armpitY = -1;
    const yStart = y0 + Math.round(H * 0.08), yEnd = y0 + Math.round(H * 0.7);
    for (const side of [1, -1]) {
      const col = Math.round(cx + side * half * 1.07);
      let seen = false, run = 0;
      for (let y = yStart; y <= yEnd; y++) {
        if (at(col, y)) { seen = true; run = 0; }
        else if (seen && ++run >= 3) { armpitY = Math.max(armpitY, y - 3); break; }
      }
    }
    if (armpitY < 0) {
      for (let y = yStart; y <= yEnd; y++) { const r = centralRun(y); if (r && r.w > B * 1.12) armpitY = y; }
    }
    const sleeveless = armpitY < 0;
    if (sleeveless) armpitY = y0 + Math.round(H * 0.28);
    const shX = half * 0.9;
    const shoulderR = { x: cx + shX, y: topAt(cx + shX) };
    const shoulderL = { x: cx - shX, y: topAt(cx - shX) };
    let collarY = topAt(cx);
    // Capucha: el centro sobresale muy por encima de los hombros → el cuello está más abajo
    const shY = (shoulderR.y + shoulderL.y) / 2;
    const hood = shY - collarY > H * 0.1;
    if (hood) collarY = Math.round(shY - H * 0.02);
    // Mangas: píxeles fuera de la columna del cuerpo; el extremo = centroide de los más lejanos
    function sleeve(side) {
      const piv = side > 0 ? shoulderR : shoulderL;
      const pts = [];
      for (let y = y0; y <= y1; y += 2) {
        // bajo la axila, lo que está pegado al cuerpo es cuerpo (ruedo acampanado), no manga
        let lim = half * 1.04;
        if (y > armpitY + 2) { const r = centralRun(y); if (r) lim = Math.max(lim, side > 0 ? r.r - cx + 1 : cx - r.l + 1); }
        for (let x = 0; x < w; x += 2) {
          if (mask[y * w + x] && (x - cx) * side > lim) pts.push([x, y]);
        }
      }
      if (pts.length < 40) return null;
      // Dirección de la manga: del centro de la sisa al centro de masa de la manga
      let mx = 0, my = 0;
      for (const p of pts) { mx += p[0]; my += p[1]; }
      mx /= pts.length; my /= pts.length;
      let ux = mx - piv.x, uy = my - piv.y;
      const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      let maxT = 0;
      for (const p of pts) { const t = (p[0] - piv.x) * ux + (p[1] - piv.y) * uy; if (t > maxT) maxT = t; }
      const end = { x: piv.x + ux * maxT, y: piv.y + uy * maxT };
      return { pivot: piv, end, dir: { x: ux, y: uy }, lengthPx: maxT };
    }
    const sR = sleeveless ? null : sleeve(1), sL = sleeveless ? null : sleeve(-1);
    const sleevePx = sR && sL ? (sR.lengthPx + sL.lengthPx) / 2 : sR ? sR.lengthPx : sL ? sL.lengthPx : 0;
    return {
      type: 'top', w, h, cx, x0, x1, y0, y1, H,
      collarY, hood, hemY: y1, lengthPx: y1 - collarY, bodyFlat: B, armpitY,
      shoulderL, shoulderR, shoulderPx: shX * 2, sleeveR: sR, sleeveL: sL, sleevePx,
      longSleeve: sleevePx > (y1 - collarY) * 0.55,
    };
  };

  /**
   * Convierte una imagen (URL o dataURL) en una prenda lista para el probador.
   * meta: { name, store, url, sizes, table, gender }
   */
  MQ.processGarment = async function (src, meta = {}) {
    const img = await loadImage(src);
    const cut = MQ.cutout(img);
    const a = MQ.analyze(cut);
    if (!a) throw new Error('No encontré una prenda en la imagen.');
    return {
      id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: meta.name || (a.type === 'top' ? 'Prenda de arriba' : 'Pantalón'),
      store: meta.store || '',
      url: meta.url || '',
      png: cut.canvas.toDataURL('image/png'),
      quality: cut.quality,
      skinRatio: cut.skinRatio,
      analysis: a,
      category: a.type,
      sizes: meta.sizes && meta.sizes.length ? meta.sizes : null,
      table: meta.table || null,
      gender: meta.gender || null,
      addedAt: Date.now(),
    };
  };
})();
