/*
 * MeQueda · Recorte automático de tu cara (con pelo) desde una selfie.
 * Usa MediaPipe Selfie Segmentation (Apache-2.0) que corre 100% en tu navegador:
 * la foto nunca sale de tu dispositivo y no tiene costo.
 */
(function () {
  const MQ = (window.MQ = window.MQ || {});
  const BASE = 'vendor/selfie_segmentation/';
  let segP = null;

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }
  function segmenter() {
    if (segP) return segP;
    segP = (async () => {
      if (!window.SelfieSegmentation) await loadScript(BASE + 'selfie_segmentation.js');
      const seg = new window.SelfieSegmentation({ locateFile: (f) => BASE + f });
      seg.setOptions({ modelSelection: 0, selfieMode: false });
      await seg.initialize();
      return seg;
    })();
    segP.catch(() => { segP = null; });
    return segP;
  }

  function maskOf(seg, canvas) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('tiempo agotado')), 20000);
      seg.onResults((r) => { clearTimeout(t); res(r.segmentationMask); });
      seg.send({ image: canvas }).catch(rej);
    });
  }

  /**
   * Devuelve { src (PNG con transparencia), w, h, head: {cx, top, chin, width} } en px del recorte,
   * o null si no encontró una persona.
   */
  MQ.cutFace = async function (img) {
    const max = 640, k = Math.min(1, max / Math.max(img.width, img.height));
    const W = Math.round(img.width * k), H = Math.round(img.height * k);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const seg = await segmenter();
    const mask = await maskOf(seg, c);

    // Máscara a alfa
    const m = document.createElement('canvas');
    m.width = W; m.height = H;
    const mctx = m.getContext('2d', { willReadFrequently: true });
    mctx.drawImage(mask, 0, 0, W, H);
    const md = mctx.getImageData(0, 0, W, H).data;
    const id = ctx.getImageData(0, 0, W, H);
    const alpha = new Uint8ClampedArray(W * H);
    for (let p = 0; p < W * H; p++) {
      // La máscara viene en el canal rojo (0..255); suavizamos el borde
      const v = md[p * 4];
      alpha[p] = v < 120 ? 0 : v > 215 ? 255 : Math.round(((v - 120) / 95) * 255);
    }

    // Seguimos la cabeza desde arriba: ancho del tramo central por fila hasta el cuello
    const runAt = (y, cx) => {
      let c = Math.round(cx);
      if (alpha[y * W + c] <= 128) {
        let f = -1;
        for (let d = 1; d < W * 0.1; d++) { if (alpha[y * W + c + d] > 128) { f = c + d; break; } if (alpha[y * W + c - d] > 128) { f = c - d; break; } }
        if (f < 0) return null; c = f;
      }
      let l = c, r = c;
      while (l > 0 && alpha[y * W + l - 1] > 128) l--;
      while (r < W - 1 && alpha[y * W + r + 1] > 128) r++;
      return { l, r, w: r - l + 1 };
    };
    let top = -1, cx = W / 2;
    // Tramo continuo más largo de cada fila (ignora manchas sueltas del borde)
    const longest = (y) => {
      let best = null, s = -1;
      for (let x = 0; x <= W; x++) {
        const on = x < W && alpha[y * W + x] > 128;
        if (on && s < 0) s = x;
        if (!on && s >= 0) { if (!best || x - s > best.w) best = { l: s, r: x - 1, w: x - s }; s = -1; }
      }
      return best;
    };
    const minW = W * 0.04;
    for (let y = 1; y < H - 10 && top < 0; y++) {
      const r0 = longest(y);
      if (!r0 || r0.w < minW || r0.l === 0 || r0.r === W - 1) continue;
      let ok = true;
      for (let k = 1; k <= 10 && ok; k++) {
        const rk = longest(y + k);
        ok = !!rk && rk.w >= minW && rk.l <= r0.r && rk.r >= r0.l;
      }
      if (ok) { top = y; cx = (r0.l + r0.r) / 2; }
    }
    if (top < 0) return null;
    let headW = 0, headY = top, neckY = -1, neckW = Infinity, inNeck = false;
    for (let y = top; y < H; y++) {
      const r = runAt(y, cx); if (!r) break;
      if (!inNeck) {
        if (r.w >= headW) { headW = r.w; headY = y; cx = (r.l + r.r) / 2; }
        else if (r.w < headW * 0.82) inNeck = true;
      }
      if (inNeck) {
        if (r.w < neckW) { neckW = r.w; neckY = y; }
        if (r.w > neckW * 1.6) break; // empiezan los hombros
      }
    }
    if (window.MQ_DEBUG) console.log('face', JSON.stringify({ top, headW, headY, neckY, neckW, cx }));
    if (neckY < 0 || headW < 20) return null;
    const hr = runAt(headY, cx);
    const cut = Math.min(H - 1, neckY + Math.round(headW * 0.14));
    const hc = (hr.l + hr.r) / 2;
    const x0 = Math.max(0, Math.round(hc - headW * 0.75)), x1 = Math.min(W, Math.round(hc + headW * 0.75));
    const y0 = Math.max(0, top - 4);
    const out = document.createElement('canvas');
    out.width = x1 - x0; out.height = cut - y0;
    const octx = out.getContext('2d');
    const od = octx.createImageData(out.width, out.height);
    for (let y = y0; y < cut; y++) {
      // Desvanecemos el cuello hacia abajo para que empalme con el del avatar
      const f0 = neckY - headW * 0.12;
      const fade = y > f0 ? Math.max(0, 1 - (y - f0) / (cut - f0)) : 1;
      for (let x = x0; x < x1; x++) {
        const s = (y * W + x) * 4, d = ((y - y0) * out.width + (x - x0)) * 4;
        od.data[d] = id.data[s]; od.data[d + 1] = id.data[s + 1]; od.data[d + 2] = id.data[s + 2];
        od.data[d + 3] = alpha[y * W + x] * fade;
      }
    }
    octx.putImageData(od, 0, 0);

    // Tono de piel: centro de la cara (entre ojos y boca)
    let skin = null;
    try {
      // Mejillas (evita boca, ojos y pelo)
      const sy = Math.round(top + (neckY - top) * 0.76), hc0 = (hr.l + hr.r) / 2, rad = Math.max(3, Math.round(headW * 0.05));
      let R = 0, G = 0, B = 0, n = 0;
      for (const sx of [Math.round(hc0 - headW * 0.2), Math.round(hc0 + headW * 0.2)]) {
        for (let y = sy - rad; y <= sy + rad; y++) for (let x = sx - rad; x <= sx + rad; x++) {
          const s = (y * W + x) * 4; if (alpha[y * W + x] < 200) continue;
          const r = id.data[s], g = id.data[s + 1], b = id.data[s + 2];
          if (r < g || r < b || r + g + b > 700) continue; // descarta brillos y sombras raras
          R += r; G += g; B += b; n++;
        }
      }
      if (n) {
        let r = R / n, g = G / n, b = B / n;
        const m = (r + g + b) / 3, sat = 1.25; // las fotos suelen apagar el tono
        r = m + (r - m) * sat; g = m + (g - m) * sat; b = m + (b - m) * sat;
        skin = '#' + [r * 1.04, g * 1.02, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { /* sin tono */ }

    return {
      src: out.toDataURL('image/png'), w: out.width, h: out.height, skin,
      head: { cx: (hr.l + hr.r) / 2 - x0, top: top - y0, chin: neckY - y0, width: headW },
    };
  };

  /**
   * Recorta a la persona completa (para poner la foto generada por la IA dentro del showroom).
   * Devuelve un PNG con transparencia recortado a la persona, o null.
   */
  MQ.cutPerson = async function (img) {
    const max = 1024, k = Math.min(1, max / Math.max(img.width, img.height));
    const W = Math.round(img.width * k), H = Math.round(img.height * k);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const seg = await segmenter();
    const mask = await maskOf(seg, c);
    const m = document.createElement('canvas');
    m.width = W; m.height = H;
    const mctx = m.getContext('2d', { willReadFrequently: true });
    mctx.drawImage(mask, 0, 0, W, H);
    const md = mctx.getImageData(0, 0, W, H).data;
    const id = ctx.getImageData(0, 0, W, H);
    let x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (let p = 0; p < W * H; p++) {
      const v = md[p * 4];
      const a = v < 110 ? 0 : v > 210 ? 255 : Math.round(((v - 110) / 100) * 255);
      id.data[p * 4 + 3] = a;
      if (a > 128) { const x = p % W, y = (p / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0 || (y1 - y0) < H * 0.3) return null;
    ctx.putImageData(id, 0, 0);
    const pad = 4;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
    const out = document.createElement('canvas');
    out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    return { src: out.toDataURL('image/png'), w: out.width, h: out.height, touchesBottom: y1 >= H - 6 };
  };

  /** Imagen → JPEG en dataURL (con fondo blanco si tiene transparencia), lado mayor ≤ max. */
  MQ.toJpeg = function (img, max = 1024, bg = '#ffffff') {
    const k = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const c = document.createElement('canvas');
    c.width = Math.round((img.naturalWidth || img.width) * k); c.height = Math.round((img.naturalHeight || img.height) * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.9);
  };

  /** Precarga el modelo en segundo plano. */
  MQ.warmFace = () => { segmenter().catch(() => {}); };
})();
