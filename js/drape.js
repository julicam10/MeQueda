/*
 * MeQueda · "Vestir" la foto real de la prenda sobre el cuerpo del avatar.
 *
 * La foto de producto es la prenda plana. Puesta, la tela rodea el cuerpo: de frente se ve
 * ≈ 0,69 de su ancho plano (contorno / 2,9, igual que el cuerpo), nunca más angosta que el
 * cuerpo (si es apretada, se estira y se pega) y, si sobra tela, cae sin pegarse.
 * Se re-muestrea fila por fila (cuerpo y piernas) y a lo largo del eje de cada manga (brazos).
 * Resultado: lienzos PNG en cm que el avatar coloca en su lugar. Sin IA, en el navegador.
 */
(function () {
  const MQ = (window.MQ = window.MQ || {});
  const PPC = 6; // píxeles por cm de los lienzos de salida
  const WRAP = 0.69; // ancho plano → ancho visto de frente
  const SLEEVE_WRAP = 0.72;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const cache = new Map();

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.ceil(w)); c.height = Math.max(2, Math.ceil(h));
    return c;
  }
  function alphaRows(c) {
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const W = c.width;
    return {
      ext(y) { // extremos del alfa en la fila y
        y = Math.round(y);
        if (y < 0 || y >= c.height) return null;
        let l = -1, r = -1;
        for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 60) { if (l < 0) l = x; r = x; }
        return l < 0 ? null : { l, r };
      },
      runs(y) { // tramos continuos en la fila y
        y = Math.round(y);
        const out = []; let s = -1;
        if (y < 0 || y >= c.height) return out;
        for (let x = 0; x <= W; x++) {
          const on = x < W && d[(y * W + x) * 4 + 3] > 60;
          if (on && s < 0) s = x;
          if (!on && s >= 0) { if (x - s > 2) out.push({ l: s, r: x - 1 }); s = -1; }
        }
        return out;
      },
    };
  }
  const smoothArr = (arr, k = 3) => arr.map((v, i) => {
    if (v == null) return v;
    let s = 0, n = 0;
    for (let j = i - k; j <= i + k; j++) if (arr[j] != null) { s += arr[j]; n++; }
    return s / n;
  });
  // Sombreado que "envuelve": bordes más oscuros, centro con luz
  function wrapShade(ctx, x0, x1, y0, y1, strength = 0.32) {
    if (x1 - x0 < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(0,0,0,' + strength + ')');
    g.addColorStop(0.18, 'rgba(0,0,0,' + strength * 0.25 + ')');
    g.addColorStop(0.42, 'rgba(255,255,255,0.06)');
    g.addColorStop(0.6, 'rgba(0,0,0,0)');
    g.addColorStop(0.85, 'rgba(0,0,0,' + strength * 0.3 + ')');
    g.addColorStop(1, 'rgba(0,0,0,' + strength + ')');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }

  /** Mitad del ancho del cuerpo (cm) a la altura y, incluyendo la rampa cuello → hombros. */
  function bodyHalf(G, y) {
    const shW = G.A.x + G.ua * 1.12; // el hombro de la prenda cubre la articulación del brazo
    if (y < G.hps) return G.neck * 1.05;
    if (y < G.shoulderY + 2) return lerp(G.neck * 1.05, shW, Math.pow((y - G.hps) / (G.shoulderY + 2 - G.hps), 0.7));
    if (y < G.armpitY + 2) return Math.max(G.torsoHalf(y), lerp(shW, G.cw * 1.04, (y - G.shoulderY - 2) / (G.armpitY - G.shoulderY)));
    return G.torsoHalf(y);
  }

  /**
   * Parte de arriba. F = {a, sx, sy} (escalas foto→cm de la talla), img = imagen de la prenda.
   * Devuelve { body: {url, x, y, w, h}, sleeves: [{url, w, h, ox, oy, rot}] } en cm del avatar.
   */
  MQ.drapeTop = function (G, F, img, key) {
    if (key && cache.has(key)) return cache.get(key);
    const { a, sx, sy } = F;
    const ty = G.hps - 1.6 - a.collarY * sy;
    const half = a.bodyFlat / 2, ov = half * 0.05;

    // 1) Pieza del cuerpo (sin mangas), en píxeles de la foto
    const src = canvas(a.w, a.h);
    const sctx = src.getContext('2d');
    const hasSleeves = !!(a.sleeveR || a.sleeveL);
    if (hasSleeves) {
      sctx.beginPath();
      [{ x: a.shoulderL.x, y: 0 }, { x: a.shoulderR.x, y: 0 }, { x: a.cx + half + ov, y: a.armpitY }, { x: a.cx + half + ov, y: a.h }, { x: a.cx - half - ov, y: a.h }, { x: a.cx - half - ov, y: a.armpitY }]
        .forEach((p, i) => (i ? sctx.lineTo(p.x, p.y) : sctx.moveTo(p.x, p.y)));
      sctx.closePath();
      sctx.clip();
    }
    sctx.drawImage(img, 0, 0, a.w, a.h);
    const A = alphaRows(src);

    // 2) Ancho puesto por fila
    const yTop = Math.max(-4, ty + 0 * sy), yBot = ty + a.h * sy;
    const rows = Math.ceil((yBot - yTop) * PPC);
    const ext = [], halfW = [];
    let maxHalf = 0;
    for (let i = 0; i < rows; i++) {
      const yc = yTop + i / PPC;
      const ys = (yc - ty) / sy;
      const e = A.ext(ys);
      ext.push(e);
      if (!e) { halfW.push(null); continue; }
      const flatHalf = ((e.r - e.l + 1) / 2) * sx;
      const bh = bodyHalf(G, yc);
      const w = Math.max(bh + 0.35, flatHalf * WRAP);
      halfW.push(w);
    }
    // La tela que sobra cae: bajo el pecho no se ciñe más que la mitad de lo que se angosta el cuerpo
    const sm = smoothArr(halfW, 7);
    let chestW = 0;
    for (let i = 0; i < rows; i++) {
      const yc = yTop + i / PPC;
      if (sm[i] == null) continue;
      if (yc <= G.chestY + 2) chestW = Math.max(chestW, sm[i]);
      else if (ext[i]) {
        const flatHalf = ((ext[i].r - ext[i].l + 1) / 2) * sx;
        const hang = Math.min(chestW, flatHalf * 0.8);
        sm[i] = Math.max(sm[i], lerp(sm[i], hang, 0.55));
      }
      maxHalf = Math.max(maxHalf, sm[i]);
    }
    const out = canvas((maxHalf * 2 + 2) * PPC, rows);
    const octx = out.getContext('2d');
    const cxo = out.width / 2;
    octx.imageSmoothingQuality = 'high';
    for (let i = 0; i < rows; i++) {
      const e = ext[i], w = sm[i];
      if (!e || w == null) continue;
      const ys = ((yTop + i / PPC) - ty) / sy;
      octx.drawImage(src, e.l, Math.floor(ys), e.r - e.l + 1, Math.max(1, sy > 0 ? 1 / (sy * PPC) + 1 : 1), cxo - w * PPC, i, w * 2 * PPC, 1.6);
    }
    wrapShade(octx, cxo - maxHalf * PPC, cxo + maxHalf * PPC, 0, rows, 0.3);
    const result = { body: { url: out.toDataURL('image/png'), x: -out.width / 2 / PPC, y: yTop, w: out.width / PPC, h: out.height / PPC }, sleeves: [] };

    // 3) Mangas: se enderezan a lo largo de su eje y se vuelven un tubo sobre el brazo
    const sAvg = (sx + sy) / 2;
    for (const side of [1, -1]) {
      const sl = side > 0 ? a.sleeveR : a.sleeveL;
      if (!sl) continue;
      const u = sl.dir, p = sl.pivot;
      const L = Math.ceil(sl.lengthPx * 1.15 + 20), Wd = Math.ceil(Math.max(a.w, a.h));
      const sc = canvas(Wd * 2, L);
      const c2 = sc.getContext('2d');
      c2.translate(Wd, 0);
      c2.rotate(Math.PI / 2 - Math.atan2(u.y, u.x));
      c2.translate(-p.x, -p.y);
      // cuña de la manga
      let nOut = { x: u.y, y: -u.x };
      if (nOut.x * side < 0) nOut = { x: -nOut.x, y: -nOut.y };
      const pit = { x: a.cx + side * (half - ov), y: a.armpitY };
      const s0 = { x: p.x - side * ov * 2, y: Math.max(0, p.y - 4) };
      const big = Wd * 3;
      c2.beginPath();
      [s0, { x: s0.x + nOut.x * big, y: s0.y + nOut.y * big }, { x: s0.x + nOut.x * big + u.x * big, y: s0.y + nOut.y * big + u.y * big }, { x: pit.x + u.x * big, y: pit.y + u.y * big }, pit]
        .forEach((q, i) => (i ? c2.lineTo(q.x, q.y) : c2.moveTo(q.x, q.y)));
      c2.closePath();
      c2.clip();
      c2.drawImage(img, 0, 0, a.w, a.h);
      const SA = alphaRows(sc);
      // dónde empieza la manga sobre el brazo
      const P = { x: p.x * sx - a.cx * sx, y: p.y * sy + ty };
      const armA = side > 0 ? G.A : { x: -G.A.x, y: G.A.y };
      const armD = side > 0 ? G.d : { x: -G.d.x, y: G.d.y };
      const t0 = Math.max(0, (P.x - armA.x) * armD.x + (P.y - armA.y) * armD.y);
      const CAP = 6; // cm: la copa de la manga se redondea para fundirse con el hombro
      const rowsS = Math.ceil(L * sAvg * PPC);
      const sext = [], sw = [];
      let maxS = 0;
      for (let i = 0; i < rowsS; i++) {
        const tpx = i / (sAvg * PPC);
        const e = SA.ext(tpx);
        sext.push(e);
        if (!e) { sw.push(null); continue; }
        const tArm = clamp(t0 + i / PPC, 0, G.armLen);
        let w = Math.max(G.armHalf(tArm) + 0.45, ((e.r - e.l + 1) / 2) * sAvg * SLEEVE_WRAP);
        const tc = i / PPC;
        if (tc < CAP) w *= 0.55 + 0.45 * Math.sqrt(1 - Math.pow(1 - tc / CAP, 2));
        sw.push(w);
      }
      const ssm = smoothArr(sw, 6);
      ssm.forEach((v) => { if (v != null) maxS = Math.max(maxS, v); });
      if (!maxS) continue;
      const so = canvas((maxS * 2 + 1) * PPC, rowsS);
      const sctx2 = so.getContext('2d');
      const cx2 = so.width / 2;
      for (let i = 0; i < rowsS; i++) {
        const e = sext[i], w = ssm[i];
        if (!e || w == null) continue;
        sctx2.drawImage(sc, e.l, Math.floor(i / (sAvg * PPC)), e.r - e.l + 1, 1.5, cx2 - w * PPC, i, w * 2 * PPC, 1.6);
      }
      wrapShade(sctx2, cx2 - maxS * PPC, cx2 + maxS * PPC, 0, rowsS, 0.34);
      const O = { x: armA.x + armD.x * t0, y: armA.y + armD.y * t0 };
      result.sleeves.push({ url: so.toDataURL('image/png'), w: so.width / PPC, h: so.height / PPC, ox: O.x, oy: O.y, rot: (Math.atan2(armD.y, armD.x) * 180) / Math.PI - 90 });
    }
    if (key) { cache.set(key, result); if (cache.size > 80) cache.delete(cache.keys().next().value); }
    return result;
  };

  /** Parte de abajo: cada pierna del pantalón sigue la pierna del avatar. */
  MQ.drapeBottom = function (G, B, img, key) {
    if (key && cache.has(key)) return cache.get(key);
    const { a, sx, sy, ty } = B;
    const src = canvas(a.w, a.h);
    src.getContext('2d').drawImage(img, 0, 0, a.w, a.h);
    const A = alphaRows(src);
    const yTop = ty + a.y0 * sy, yBot = Math.min(G.floorY - 0.6, ty + a.y1 * sy);
    const rows = Math.ceil((yBot - yTop) * PPC);
    const segs = [];
    let maxX = 0;
    for (let i = 0; i < rows; i++) {
      const yc = yTop + i / PPC, ys = (yc - ty) / sy;
      let runs = A.runs(ys);
      if (!runs.length) { segs.push(null); continue; }
      const crotchCm = ty + a.crotchY * sy;
      if (yc < crotchCm || runs.length === 1 && yc < crotchCm + 3) {
        const l = runs[0].l, r = runs[runs.length - 1].r;
        const w = Math.max(G.torsoHalf(Math.min(yc, G.crotchY)) + 0.3, ((r - l + 1) / 2) * sx * WRAP);
        segs.push([{ l, r, c: 0, w }]);
        maxX = Math.max(maxX, w);
      } else {
        if (runs.length === 1) { const r0 = runs[0]; runs = [{ l: r0.l, r: Math.round(a.cx) }, { l: Math.round(a.cx), r: r0.r }]; }
        const left = runs[0], right = runs[runs.length - 1];
        const lg = G.leg(Math.min(yc, G.ankleY));
        const out = [];
        for (const [run, sgn] of [[left, -1], [right, 1]]) {
          const w = Math.max(lg.half + 0.35, ((run.r - run.l + 1) / 2) * sx * 0.74);
          out.push({ l: run.l, r: run.r, c: sgn * lg.c, w });
          maxX = Math.max(maxX, lg.c + w);
        }
        segs.push(out);
      }
    }
    const out = canvas((maxX * 2 + 2) * PPC, rows);
    const ctx = out.getContext('2d');
    const cx = out.width / 2;
    for (let i = 0; i < rows; i++) {
      const s = segs[i]; if (!s) continue;
      const ys = ((yTop + i / PPC) - ty) / sy;
      for (const g of s) ctx.drawImage(src, g.l, Math.floor(ys), g.r - g.l + 1, 1.5, cx + (g.c - g.w) * PPC, i, g.w * 2 * PPC, 1.6);
    }
    // Sombreado: cadera completa arriba, cada pierna abajo
    const crotchRow = Math.max(0, Math.round((ty + a.crotchY * sy - yTop) * PPC));
    wrapShade(ctx, cx - maxX * PPC, cx + maxX * PPC, 0, crotchRow, 0.26);
    const lgc = G.leg(G.kneeY);
    const lw = (lgc.half + 3) * PPC;
    wrapShade(ctx, cx - lgc.c * PPC - lw, cx - lgc.c * PPC + lw, crotchRow, rows, 0.3);
    wrapShade(ctx, cx + lgc.c * PPC - lw, cx + lgc.c * PPC + lw, crotchRow, rows, 0.3);
    const res = { url: out.toDataURL('image/png'), x: -out.width / 2 / PPC, y: yTop, w: out.width / PPC, h: out.height / PPC };
    if (key) { cache.set(key, res); if (cache.size > 80) cache.delete(cache.keys().next().value); }
    return res;
  };
})();
