/*
 * MeQueda · Medidas del cuerpo, medidas de la prenda por talla y recomendación.
 *
 * Las medidas de la prenda salen solas:
 *  - Si la tienda publica tabla de tallas (la extensión la lee), se usan esas medidas.
 *  - Si no, se escalan desde la foto: la foto de producto conserva las proporciones
 *    reales de la prenda (talla de muestra ≈ M), así que con un ancla de tamaño típico
 *    se obtienen largo, ancho y mangas, y se gradúan las demás tallas.
 */
(function () {
  const MQ = (window.MQ = window.MQ || {});
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const r1 = (n) => Math.round(n * 10) / 10;

  // ------------------------------------------------------------ cuerpo
  MQ.estimateBody = function ({ gender, height, weight, overrides = {} }) {
    const h = clamp(+height || 170, 130, 215);
    const w = clamp(+weight || 65, 35, 200);
    const bmi = w / Math.pow(h / 100, 2);
    let b;
    if (gender === 'women') {
      const x = clamp(bmi, 15, 45) - 21.5;
      b = { chest: 0.535 * h + 1.9 * x, waist: 0.42 * h + 2.4 * x, hip: 0.58 * h + 2.0 * x, shoulder: 0.235 * h + 0.35 * x, armLen: 0.325 * h, inseam: 0.46 * h };
    } else {
      const x = clamp(bmi, 15, 45) - 22;
      b = { chest: 0.53 * h + 1.9 * x, waist: 0.45 * h + 2.6 * x, hip: 0.54 * h + 1.7 * x, shoulder: 0.255 * h + 0.45 * x, armLen: 0.33 * h, inseam: 0.455 * h };
    }
    for (const k of ['chest', 'waist', 'hip', 'inseam']) if (+overrides[k] > 20) b[k] = +overrides[k];
    for (const k in b) b[k] = r1(b[k]);
    return { gender: gender === 'women' ? 'women' : 'men', height: h, weight: w, bmi: r1(bmi), ...b };
  };

  // ------------------------------------------------------------ tallas
  const LETTERS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
  const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const norm = (s) => String(s).trim().toUpperCase().replace(/^2XL$/, 'XXL').replace(/^XXXL$/, '3XL').replace(/^2XS$/, 'XXS');

  /** Paso de talla respecto a la talla "base" (≈ M) y tipo de sistema. */
  function sizeSteps(sizes) {
    const ns = sizes.map(norm);
    if (ns.every((s) => LETTERS.includes(s))) {
      const m = LETTERS.indexOf('M');
      return { system: 'letter', steps: ns.map((s) => LETTERS.indexOf(s) - m), labels: ns };
    }
    const nums = ns.map((s) => parseFloat(s));
    if (nums.every((n) => !isNaN(n))) {
      const mid = nums[Math.floor((nums.length - 1) / 2)];
      // Pulgadas de cintura (US 24-44) o tallas EU (32-56, de 2 en 2)
      const inches = nums.every((n) => n >= 22 && n <= 46) && nums.some((n, i) => i && n - nums[i - 1] === 1);
      if (inches) return { system: 'inch', steps: nums.map((n) => (n - 32)), labels: ns, inchBase: 32 };
      const eu = nums.every((n) => n >= 30 && n <= 60);
      if (eu) return { system: 'eu', steps: nums.map((n) => (n - (nums[0] < 40 ? 38 : 48)) / 2), labels: ns };
      return { system: 'other', steps: nums.map((n, i) => i - nums.indexOf(mid)), labels: ns };
    }
    const mid = Math.floor((ns.length - 1) / 2);
    return { system: 'other', steps: ns.map((_, i) => i - mid), labels: ns };
  }

  // Tamaños típicos de la talla M para anclar la escala de la foto
  const ANCHOR = {
    top: { men: { length: 70, flat: 53 }, women: { length: 61, flat: 47 } },
    bottom: { men: { waist: 82 }, women: { waist: 70 } },
  };
  const GRADE = {
    top: { men: { chest: 6, length: 2, sleeve: 0.8, shoulder: 1.6 }, women: { chest: 5, length: 1.5, sleeve: 0.6, shoulder: 1.2 } },
    bottom: { men: { waist: 5, hip: 5, inseam: 0.3, rise: 0.5 }, women: { waist: 5, hip: 5, inseam: 0.3, rise: 0.5 } },
  };
  // Cuerpo de referencia para la talla M (para saber la holgura con que fue diseñada)
  const REF_BODY = { men: { chest: 98, waist: 82, hip: 97, height: 175 }, women: { chest: 87, waist: 70, hip: 95, height: 163 } };

  /** Pistas de ajuste a partir del nombre/descripción de la prenda. */
  function fitHint(g) {
    const t = ((g.name || '') + ' ' + (g.fitHint || '')).toLowerCase();
    const r = { flat: 0, length: 0, waist: 0 };
    if (/oversize|over size|boxy|holgad|amplia|wide|relaxed|baggy/.test(t)) { r.flat += 5; r.length += 2; }
    if (/slim|ajustad|skinny|fitted|ceñid|muscle/.test(t)) { r.flat -= 3; }
    if (/crop|corta\b|cropped/.test(t)) r.length -= 9;
    if (/long|larga|tunic|túnica/.test(t)) r.length += 6;
    if (/coat|abrigo|parka|gabardina|trench/.test(t)) { r.length += 22; r.flat += 4; }
    if (/jacket|chaqueta|chamarra|blazer|down|puffer|plumas/.test(t)) { r.flat += 3; }
    return r;
  }

  /** Medidas de la prenda (cm) para cada talla. */
  MQ.garmentSpecs = function (g, gender) {
    const a = g.analysis;
    const gen = g.gender || gender || 'men';
    const sizes = g.sizes && g.sizes.length ? g.sizes : DEFAULT_SIZES;
    const st = sizeSteps(sizes);
    const out = {};
    let base;
    if (a.type === 'top') {
      const an = ANCHOR.top[gen], adj = fitHint(g);
      const flatA = an.flat + adj.flat, lenA = an.length + adj.length;
      // La foto da la forma; el ancla da el tamaño (las fotos de producto suelen doblar los costados)
      const flat = 0.75 * flatA + 0.25 * (lenA * a.bodyFlat / a.lengthPx);
      const length = 0.85 * lenA + 0.15 * (flatA * a.lengthPx / a.bodyFlat);
      const kx = flat / a.bodyFlat, ky = length / a.lengthPx;
      base = { chest: 2 * flat, length, sleeve: a.sleevePx * (kx + ky) / 2, shoulder: a.shoulderPx * kx };
    } else {
      const s0 = (ANCHOR.bottom[gen].waist + fitHint(g).waist) / 2 / a.waistFlat;
      base = { waist: 2 * a.waistFlat * s0, hip: 2 * a.hipFlat * s0, inseam: a.inseamPx * s0, rise: a.risePx * s0, opening: a.openingPx * s0 };
    }
    const gr = GRADE[a.type][gen];
    sizes.forEach((label, i) => {
      const k = st.steps[i];
      const m = {};
      for (const key in base) {
        let step = gr[key] || 0;
        if (st.system === 'inch' && (key === 'waist' || key === 'hip')) step = 2.54;
        if (st.system === 'eu' && (key === 'waist' || key === 'hip')) step = 4;
        m[key] = r1(base[key] + step * k);
      }
      // Medidas reales de la tienda (si las hay) tienen prioridad
      const t = g.table && (g.table[label] || g.table[norm(label)]);
      if (t) for (const key in t) if (t[key] > 0) m[key] = t[key];
      out[label] = m;
    });
    return { sizes, specs: out, base: out[sizes[st.steps.indexOf(0)]] || base, system: st.system, fromTable: !!(g.table && Object.keys(g.table).length) };
  };

  // ------------------------------------------------------------ ajuste
  const PREF_SHIFT = { fitted: -4, normal: 0, loose: 6 };
  const status = (d, gLo, gHi, wLo, wHi) => (d >= gLo && d <= gHi ? 'good' : d >= wLo && d <= wHi ? 'warn' : 'bad');
  const cm = (n) => (n > 0 ? '+' : '') + Math.round(n) + ' cm';

  MQ.evaluate = function (g, size, body, pref = 'normal') {
    const S = MQ.garmentSpecs(g, body.gender);
    const m = S.specs[size];
    if (!m) return null;
    const ref = REF_BODY[g.gender || body.gender];
    const items = [];
    let score = 0;
    if (g.category === 'top') {
      const designed = S.base.chest - ref.chest + (PREF_SHIFT[pref] || 0);
      const ease = m.chest - body.chest;
      const d = ease - designed;
      let st = status(d, -3, 4, -8, 10), txt;
      if (ease < -1) { st = 'bad'; txt = 'Apretada en el pecho'; }
      else txt = d < -3 ? 'Más ceñida de lo diseñado' : d <= 4 ? 'Te queda como fue diseñada' : d <= 10 ? 'Más holgada de lo diseñado' : 'Muy grande, te sobra tela';
      items.push({ label: 'Pecho', status: st, text: txt, detail: 'Holgura ' + cm(ease) });
      score += (d < 0 ? -d * 1.6 : d) + (ease < 0 ? -ease * 3 : 0);

      const idealLen = S.base.length * (body.height / ref.height);
      const dl = m.length - idealLen;
      items.push({ label: 'Largo', status: status(dl, -3, 3.5, -7, 8), text: dl < -3 ? (dl < -7 ? 'Corta: se te verá la cintura' : 'Un poco corta') : dl > 3.5 ? (dl > 8 ? 'Larga' : 'Un poco larga') : 'Largo ideal', detail: Math.round(m.length) + ' cm de largo' });
      score += Math.abs(dl) * 0.5;

      if (g.analysis.longSleeve && m.sleeve) {
        const eff = m.sleeve + (m.shoulder - body.shoulder) / 2;
        const ds = eff - (body.armLen + 1);
        items.push({ label: 'Mangas', status: status(ds, -2.5, 3.5, -6, 7), text: ds < -2.5 ? 'Te quedan cortas' : ds > 3.5 ? 'Te tapan parte de la mano' : 'Llegan a la muñeca', detail: (ds > 0 ? '+' : '') + Math.round(ds) + ' cm vs. tu brazo' });
        score += Math.abs(ds) * 0.4;
      }
    } else {
      const wE = m.waist - body.waist;
      let st, txt;
      if (wE < -4) { st = 'bad'; txt = 'No cierra en la cintura'; }
      else if (wE < -1.5) { st = 'warn'; txt = 'Ajustada en la cintura'; }
      else if (wE <= 4) { st = 'good'; txt = 'Cintura a tu medida'; }
      else if (wE <= 8) { st = 'warn'; txt = 'Holgada: necesitarás correa'; }
      else { st = 'bad'; txt = 'Muy grande en la cintura'; }
      items.push({ label: 'Cintura', status: st, text: txt, detail: 'Holgura ' + cm(wE) });
      score += wE < 0 ? -wE * 2.2 : wE * 1.1;

      const hE = m.hip - body.hip;
      const designed = S.base.hip - ref.hip + (PREF_SHIFT[pref] || 0) * 0.6;
      const dh = hE - designed;
      items.push({ label: 'Cadera', status: hE < -1 ? 'bad' : status(dh, -3, 5, -7, 10), text: hE < -1 ? 'Apretada en la cadera' : dh < -3 ? 'Ceñida en cadera y muslo' : dh > 5 ? 'Holgada en cadera' : 'Cadera como fue diseñada', detail: 'Holgura ' + cm(hE) });
      score += Math.abs(dh) * (dh < 0 ? 1.2 : 0.6) + (hE < 0 ? -hE * 3 : 0);

      const short = m.inseam < 40;
      const di = m.inseam - (short ? m.inseam : body.inseam - 2);
      if (!short) {
        items.push({ label: 'Largo', status: status(di, -2.5, 3, -6, 12), text: di > 3 ? 'Te sobran ≈' + Math.round(di) + ' cm: toca hacerle ruedo' : di < -2.5 ? 'Te queda corto' : 'Largo ideal', detail: 'Entrepierna ' + Math.round(m.inseam) + ' cm' });
        score += di > 0 ? di * 0.25 : -di * 0.7;
      }
    }
    const rank = { good: 0, warn: 1, bad: 2 };
    const worst = items.reduce((a, it) => Math.max(a, rank[it.status]), 0);
    return { size, m, items, score, status: ['good', 'warn', 'bad'][worst] };
  };

  MQ.rankSizes = function (g, body, pref) {
    const S = MQ.garmentSpecs(g, body.gender);
    const results = S.sizes.map((s) => MQ.evaluate(g, s, body, pref)).filter(Boolean);
    let best = results[0];
    for (const r of results) if (r.score < best.score) best = r;
    return { results, best: best && best.size, fromTable: S.fromTable };
  };

  // ------------------------------------------------------------ tablas de la tienda
  const KEYS = [
    ['chest', /(chest|pecho|busto|bust|contorno de pecho|body width|ancho( de)? (pecho|cuerpo)|width)/i],
    ['length', /(length|largo|longitud)(?!.*(sleeve|manga|inseam|pierna))/i],
    ['sleeve', /(sleeve|manga)/i],
    ['shoulder', /(shoulder|hombro)/i],
    ['waist', /(waist|cintura)/i],
    ['hip', /(hip|cadera)/i],
    ['inseam', /(inseam|entrepierna|inside leg|largo de pierna|tiro largo)/i],
    ['rise', /(\brise\b|tiro)/i],
  ];
  /**
   * Interpreta una tabla de tallas: matriz de celdas (texto). Devuelve {talla: {medida: cm}}.
   * Acepta tallas como filas o columnas, en cm o pulgadas, anchos "planos" o contornos.
   */
  MQ.parseSizeTable = function (rows) {
    if (!rows || rows.length < 2) return null;
    const isSize = (s) => /^(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|\d{2}(\/\d{2})?)$/i.test(String(s).trim());
    const inch = rows.flat().some((c) => /(\binch|\bin\b|")/i.test(c));
    const num = (s) => { const m = String(s).replace(',', '.').match(/(\d+(\.\d+)?)(\s*[-–]\s*(\d+(\.\d+)?))?/); if (!m) return NaN; const v = m[4] ? (parseFloat(m[1]) + parseFloat(m[4])) / 2 : parseFloat(m[1]); return inch ? v * 2.54 : v; };
    const keyOf = (s) => { for (const [k, re] of KEYS) if (re.test(s)) return k; return null; };
    let table = {};
    const header = rows[0];
    if (header.slice(1).filter(isSize).length >= 2) {
      // tallas en columnas
      for (const r of rows.slice(1)) {
        const k = keyOf(r[0]); if (!k) continue;
        header.forEach((sz, j) => { if (j && isSize(sz)) { const v = num(r[j]); if (!isNaN(v)) (table[norm(sz)] = table[norm(sz)] || {})[k] = v; } });
      }
    } else {
      const keys = header.map(keyOf);
      for (const r of rows.slice(1)) {
        if (!isSize(r[0])) continue;
        const row = {};
        keys.forEach((k, j) => { if (k && j) { const v = num(r[j]); if (!isNaN(v)) row[k] = v; } });
        if (Object.keys(row).length) table[norm(r[0])] = row;
      }
    }
    // Anchos planos → contorno
    for (const s in table) {
      const t = table[s];
      if (t.chest && t.chest < 75) t.chest = r1(t.chest * 2);
      if (t.waist && t.waist < 55) t.waist = r1(t.waist * 2);
      if (t.hip && t.hip < 65) t.hip = r1(t.hip * 2);
    }
    return Object.keys(table).length ? table : null;
  };
})();
