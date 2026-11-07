/*
 * Estimación de medidas corporales y evaluación de ajuste por talla.
 * Todas las medidas en cm. Las fórmulas son aproximaciones antropométricas
 * a partir de altura e IMC; el usuario puede sobrescribir pecho/cintura/cadera.
 */
(function () {
  const PV = (window.PV = window.PV || {});
  const round = (n, d = 1) => +n.toFixed(d);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  PV.estimateBody = function ({ gender, height, weight, overrides = {} }) {
    const h = clamp(+height || 170, 130, 215);
    const w = clamp(+weight || 65, 35, 200);
    const bmi = w / Math.pow(h / 100, 2);
    let b;
    if (gender === 'women') {
      const x = clamp(bmi, 15, 45) - 21.5;
      b = {
        chest: 0.535 * h + 1.9 * x,
        waist: 0.42 * h + 2.4 * x,
        hip: 0.58 * h + 2.0 * x,
        shoulder: 0.235 * h + 0.35 * x,
        armLen: 0.325 * h,
        inseam: 0.46 * h,
      };
    } else {
      const x = clamp(bmi, 15, 45) - 22;
      b = {
        chest: 0.53 * h + 1.9 * x,
        waist: 0.45 * h + 2.6 * x,
        hip: 0.54 * h + 1.7 * x,
        shoulder: 0.255 * h + 0.45 * x,
        armLen: 0.33 * h,
        inseam: 0.455 * h,
      };
    }
    for (const k of ['chest', 'waist', 'hip', 'inseam']) {
      if (overrides[k] && +overrides[k] > 20) b[k] = +overrides[k];
    }
    for (const k of Object.keys(b)) b[k] = round(b[k]);
    return { gender: gender === 'women' ? 'women' : 'men', height: h, weight: w, bmi: round(bmi), ...b };
  };

  const REF_WEIGHT = { men: 70, women: 57 };
  function refBody(product, gender) {
    const g = product.gender === 'women' || product.gender === 'men' ? product.gender : gender;
    const h = product.refHeight || (g === 'women' ? 163 : 175);
    return PV.estimateBody({ gender: g, height: h, weight: REF_WEIGHT[g] * Math.pow(h / (g === 'women' ? 163 : 175), 2) });
  }

  // Preferencia de ajuste: desplaza la holgura objetivo.
  const PREF_SHIFT = { fitted: -4, normal: 0, loose: 6 };

  function statusFrom(d, goodLo, goodHi, warnLo, warnHi) {
    if (d >= goodLo && d <= goodHi) return 'good';
    if (d >= warnLo && d <= warnHi) return 'warn';
    return 'bad';
  }
  const cm = (n) => (n > 0 ? '+' : '') + round(n, 0) + ' cm';

  /** Devuelve {score, status, items[], m} — menor score = mejor talla. */
  PV.evaluateFit = function (product, size, body, pref = 'normal') {
    const m = PV.measurementsFor(product, size);
    if (!m) return null;
    const ref = refBody(product, body.gender);
    const refM = product.table
      ? m // en tablas del usuario no hay talla base; se usan proporciones del cuerpo
      : PV.measurementsFor(product, product.base.size);
    const shift = PREF_SHIFT[pref] || 0;
    const items = [];
    let score = 0;

    if (product.category === 'top') {
      // Pecho
      const ease = m.chest - body.chest;
      const target = (product.ease?.chest ?? 8) + shift;
      const d = ease - target;
      let st = statusFrom(d, -3, 4, -8, 10);
      let txt;
      if (ease < -1) { st = 'bad'; txt = 'Apretada: le faltan ' + round(-ease, 0) + ' cm de contorno'; }
      else if (d < -3) txt = 'Más ceñida de lo que fue diseñada';
      else if (d <= 4) txt = 'Como fue diseñada';
      else if (d <= 10) txt = 'Más holgada de lo diseñado';
      else txt = 'Muy holgada, te va a sobrar tela';
      items.push({ key: 'chest', label: 'Pecho', status: st, text: txt, detail: 'Prenda ' + m.chest + ' cm · tú ' + body.chest + ' cm (holgura ' + cm(ease) + ')' });
      score += (d < 0 ? -d * 1.6 : d) + (ease < 0 ? -ease * 3 : 0);

      // Hombros
      if (m.shoulder) {
        const ideal = product.table ? body.shoulder + (product.ease?.chest ?? 8) / 3 : refM.shoulder + (body.shoulder - ref.shoulder);
        const ds = m.shoulder - ideal;
        const sst = statusFrom(ds, -2, 2.5, -4, 5);
        items.push({ key: 'shoulder', label: 'Hombros', status: sst,
          text: ds < -2 ? 'Costura de hombro arriba del hombro (tira)' : ds > 2.5 ? 'Hombro caído' : 'Costura en tu hombro',
          detail: 'Prenda ' + m.shoulder + ' cm · tú ≈ ' + body.shoulder + ' cm' });
        score += Math.abs(ds) * (ds < 0 ? 0.9 : 0.4);
      }

      // Largo
      const idealLen = product.table ? 0.4 * body.height : refM.length * (body.height / ref.height);
      const dl = m.length - idealLen;
      items.push({ key: 'length', label: 'Largo', status: statusFrom(dl, -3, 3.5, -7, 8),
        text: dl < -3 ? (dl < -7 ? 'Corta: se te verá la cintura' : 'Un poco corta') : dl > 3.5 ? (dl > 8 ? 'Larga' : 'Un poco larga') : 'Largo ideal',
        detail: 'Prenda ' + m.length + ' cm · ideal para ti ≈ ' + round(idealLen, 0) + ' cm' });
      score += Math.abs(dl) * 0.5;

      // Mangas
      if (m.sleeve) {
        const isLong = m.sleeve > 35;
        // Largo efectivo de manga = manga + lo que el hombro de la prenda sobresale del tuyo
        const effective = m.sleeve + (m.shoulder ? (m.shoulder - body.shoulder) / 2 : 0);
        const idealEff = product.table
          ? (isLong ? body.armLen + 2 : effective)
          : (refM.sleeve + ((refM.shoulder || ref.shoulder) - ref.shoulder) / 2) * (body.armLen / ref.armLen);
        const dsl = effective - idealEff;
        items.push({ key: 'sleeve', label: 'Mangas', status: statusFrom(dsl, isLong ? -2.5 : -3, isLong ? 3 : 4, -6, 7),
          text: dsl < (isLong ? -2.5 : -3) ? 'Mangas cortas para ti' : dsl > (isLong ? 3 : 4) ? (isLong ? 'Mangas largas: te tapan parte de la mano' : 'Mangas más largas') : 'Largo de manga ideal',
          detail: 'Manga ' + m.sleeve + ' cm' });
        score += Math.abs(dsl) * 0.4;
      }
    } else {
      // Cintura
      const wE = m.waist - body.waist;
      const target = (product.ease?.waist ?? 1) + shift * 0.25;
      const elastic = product.elastic || 0;
      const d = wE - target;
      let st, txt;
      if (wE < -elastic - 1) { st = 'bad'; txt = 'No cierra / muy apretada en la cintura'; }
      else if (d < -2) { st = elastic ? 'good' : 'warn'; txt = elastic ? 'El elástico se ajusta a tu cintura' : 'Ajustada en la cintura'; }
      else if (d <= 3.5) { st = 'good'; txt = 'Cintura a tu medida'; }
      else if (d <= 7) { st = 'warn'; txt = 'Holgada en la cintura (correa)'; }
      else { st = 'bad'; txt = 'Muy grande en la cintura'; }
      items.push({ key: 'waist', label: 'Cintura', status: st, text: txt, detail: 'Prenda ' + m.waist + ' cm · tú ' + body.waist + ' cm' });
      score += (wE < -elastic ? (-elastic - wE) * 4 : 0) + Math.abs(d) * (d < 0 ? (elastic ? 0.4 : 1.4) : 1.1);

      // Cadera
      const hE = m.hip - body.hip;
      const ht = (product.ease?.hip ?? 6) + shift * 0.6;
      const dh = hE - ht;
      items.push({ key: 'hip', label: 'Cadera', status: hE < -1 ? 'bad' : statusFrom(dh, -2.5, 5, -6, 10),
        text: hE < -1 ? 'Apretada en la cadera' : dh < -2.5 ? 'Ceñida en cadera y muslo' : dh > 5 ? 'Holgada en cadera' : 'Cadera como fue diseñada',
        detail: 'Prenda ' + m.hip + ' cm · tú ' + body.hip + ' cm' });
      score += Math.abs(dh) * (dh < 0 ? 1.2 : 0.6) + (hE < 0 ? -hE * 3 : 0);

      // Largo de pierna
      const idealIn = product.table
        ? (product.kind === 'shorts' ? m.inseam : body.inseam - 2)
        : refM.inseam * (body.inseam / ref.inseam);
      const di = m.inseam - idealIn;
      const isShort = product.kind === 'shorts';
      items.push({ key: 'inseam', label: 'Largo', status: statusFrom(di, -2.5, 3, -6, isShort ? 6 : 12),
        text: di > 3 ? (isShort ? 'Más largo (cerca de la rodilla)' : 'Te sobran ≈' + round(di, 0) + ' cm: toca hacerle ruedo') : di < -2.5 ? (isShort ? 'Más corto' : 'Te queda corto (' + round(-di, 0) + ' cm)') : 'Largo ideal',
        detail: 'Entrepierna ' + m.inseam + ' cm · ideal ≈ ' + round(idealIn, 0) + ' cm' });
      score += di > 0 ? di * 0.25 : -di * 0.7;
    }

    const rank = { good: 0, warn: 1, bad: 2 };
    const worst = items.reduce((a, it) => Math.max(a, rank[it.status]), 0);
    return { size, m, items, score: round(score, 2), status: ['good', 'warn', 'bad'][worst] };
  };

  PV.rankSizes = function (product, body, pref) {
    const res = product.sizes.map((s) => PV.evaluateFit(product, s, body, pref)).filter(Boolean);
    let best = res[0];
    for (const r of res) if (r.score < best.score) best = r;
    return { results: res, best: best ? best.size : null };
  };
})();
