/*
 * MeQueda · Avatar paramétrico en SVG y montaje de la foto real de la prenda.
 * Unidades del SVG = centímetros. x = 0 es el centro del cuerpo, y = 0 la coronilla.
 */
(function () {
  const MQ = (window.MQ = window.MQ || {});
  let uid = 0;
  const f = (n) => +(+n).toFixed(2);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const mir = (p) => ({ x: -p.x, y: p.y });
  const deg = (r) => (r * 180) / Math.PI;

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, k = Math.abs(amt);
    r = Math.round(lerp(r, t, k)); g = Math.round(lerp(g, t, k)); b = Math.round(lerp(b, t, k));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  MQ.shade = shade;

  // Curva suave cerrada (Catmull-Rom)
  function smooth(pts, k = 1) {
    const n = pts.length;
    let d = 'M' + f(pts[0].x) + ' ' + f(pts[0].y);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * k, y: p1.y + ((p2.y - p0.y) / 6) * k };
      const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * k, y: p2.y - ((p3.y - p1.y) / 6) * k };
      d += ' C' + [c1.x, c1.y, c2.x, c2.y, p2.x, p2.y].map(f).join(' ');
    }
    return d + 'Z';
  }
  const poly = (pts) => 'M' + pts.map((p) => f(p.x) + ' ' + f(p.y)).join('L') + 'Z';
  function interp(nodes, y) {
    if (y <= nodes[0][0]) return nodes[0][1];
    for (let i = 1; i < nodes.length; i++) if (y <= nodes[i][0]) {
      const [y0, v0] = nodes[i - 1], [y1, v1] = nodes[i];
      return lerp(v0, v1, (y - y0) / (y1 - y0 || 1));
    }
    return nodes[nodes.length - 1][1];
  }

  // ------------------------------------------------------------ geometría
  function geometry(body, armDeg = 11) {
    const h = body.height, w = body.gender === 'women';
    const bf = clamp(body.bmi - 22, -6, 18);
    const G = {
      h, w,
      headTop: 0, chin: 0.128 * h, hps: 0.162 * h, shoulderY: 0.182 * h, armpitY: 0.238 * h,
      chestY: 0.272 * h, waistY: w ? 0.375 * h : 0.39 * h, hipY: 0.49 * h,
      crotchY: Math.max(h - body.inseam, 0.5 * h), floorY: h, ankleY: 0.955 * h,
      cw: body.chest / 5.7, ww: body.waist / 5.9, hw: body.hip / 5.6, sh: body.shoulder / 2,
      neck: 0.03 * h * (1 + bf * 0.012),
      headRx: 0.047 * h, headRy: 0.064 * h, headCy: 0.064 * h,
      ua: 0.024 * h * (1 + bf * 0.03), wa: 0.0118 * h * (1 + bf * 0.012), handLen: 0.105 * h,
      armLen: body.armLen, armAngle: (armDeg * Math.PI) / 180,
    };
    G.kneeY = G.crotchY + (G.ankleY - G.crotchY) * 0.48;
    G.calfY = G.kneeY + (G.ankleY - G.kneeY) * 0.3;
    G.A = { x: G.sh - G.ua * 0.75, y: G.shoulderY + G.ua * 0.6 };
    G.d = { x: Math.sin(G.armAngle), y: Math.cos(G.armAngle) };
    G.n = { x: G.d.y, y: -G.d.x };
    G.W = add(G.A, mul(G.d, G.armLen));
    G.armAt = (t) => add(G.A, mul(G.d, t));
    G.armHalf = (t) => {
      const u = clamp(t / G.armLen, 0, 1);
      const elbow = u < 0.5 ? lerp(G.ua, G.ua * 0.8, u / 0.5) : lerp(G.ua * 0.86, G.wa, (u - 0.5) / 0.5);
      return elbow;
    };
    const hw = G.hw;
    G.torso = [[G.shoulderY, G.sh], [G.armpitY, G.cw * 1.03], [G.chestY, G.cw], [G.waistY, G.ww], [G.hipY, hw], [G.crotchY, hw * 0.97]];
    G.torsoHalf = (y) => interp(G.torso, y);
    const kneeH = Math.max(hw * 0.27, 0.027 * h);
    G.legC = [[G.hipY, hw * 0.5], [G.crotchY, hw * 0.5], [G.kneeY, hw * 0.45], [G.calfY, hw * 0.44], [G.ankleY, hw * 0.42]];
    G.legH = [[G.hipY, hw * 0.5], [G.crotchY, hw * 0.48], [G.kneeY, kneeH], [G.calfY, kneeH * 1.08], [G.ankleY, 0.017 * h]];
    G.leg = (y) => ({ c: interp(G.legC, y), half: interp(G.legH, y) });
    return G;
  }
  MQ.geometry = geometry;

  // ------------------------------------------------------------ cuerpo
  function drawArm(G, id) {
    const L = G.armLen, el = L * 0.5;
    const o = (t, k = 1) => add(G.armAt(t), mul(G.n, G.armHalf(t) * k));
    const i = (t, k = 1) => add(G.armAt(t), mul(G.n, -G.armHalf(t) * k));
    const pts = [add(G.A, mul(G.d, -G.ua * 0.9)), o(0), o(L * 0.25, 1.02), o(el), o(L * 0.72), o(L), i(L), i(L * 0.72), i(el, 0.95), i(L * 0.25), i(0)];
    const hc = add(G.W, mul(G.d, G.handLen * 0.42));
    const ang = deg(Math.atan2(G.d.y, G.d.x)) - 90;
    const hand = 'M' + f(-G.wa * 1.05) + ' 0 C' + f(-G.wa * 1.5) + ' ' + f(G.handLen * 0.35) + ' ' + f(-G.wa * 1.2) + ' ' + f(G.handLen * 0.9) + ' 0 ' + f(G.handLen * 0.95) +
      ' C' + f(G.wa * 1.2) + ' ' + f(G.handLen * 0.9) + ' ' + f(G.wa * 1.6) + ' ' + f(G.handLen * 0.35) + ' ' + f(G.wa * 1.05) + ' 0Z';
    return '<path d="' + smooth(pts, 0.9) + '" fill="url(#' + id + 'skinH)"/>' +
      '<path d="' + hand + '" transform="translate(' + f(G.W.x) + ' ' + f(G.W.y - 0.5) + ') rotate(' + f(ang) + ')" fill="url(#' + id + 'skinH)"/>' +
      '<path d="' + smooth(pts, 0.9) + '" fill="none" stroke="url(#' + id + 'rim)" stroke-width="0.25"/>' + (hc ? '' : '');
  }

  function drawBody(G, id) {
    const r = [
      { x: G.neck * 0.95, y: G.hps - 1.5 },
      { x: G.sh * 0.7, y: G.shoulderY - 0.6 },
      { x: G.sh * 0.97, y: G.shoulderY + 1.4 },
      { x: G.cw * 1.03, y: G.armpitY },
      { x: G.cw * (G.w ? 1.02 : 1), y: G.chestY },
      { x: G.ww, y: G.waistY },
      { x: G.hw, y: G.hipY },
      { x: G.hw * 0.96, y: G.crotchY },
    ];
    const torso = r.concat([{ x: 0, y: G.crotchY + 0.8 }], r.slice().reverse().map(mir));
    const L = (y) => G.leg(y);
    const leg = [
      { x: G.hw * 0.99, y: G.hipY + 3 },
      { x: L(G.crotchY + 8).c + L(G.crotchY + 8).half, y: G.crotchY + 8 },
      { x: L(G.kneeY).c + L(G.kneeY).half * 0.95, y: G.kneeY },
      { x: L(G.calfY).c + L(G.calfY).half, y: G.calfY },
      { x: L(G.ankleY).c + L(G.ankleY).half, y: G.ankleY },
      { x: L(G.ankleY).c - L(G.ankleY).half, y: G.ankleY },
      { x: L(G.calfY).c - L(G.calfY).half * 0.92, y: G.calfY },
      { x: L(G.kneeY).c - L(G.kneeY).half, y: G.kneeY },
      { x: 0.6, y: G.crotchY - 0.5 },
    ];
    const legD = smooth(leg, 0.9);
    const a = G.leg(G.ankleY);
    const shoe = 'M' + f(a.c - a.half - 1) + ' ' + f(G.ankleY - 0.5) + ' Q' + f(a.c) + ' ' + f(G.ankleY - 2) + ' ' + f(a.c + a.half + 1) + ' ' + f(G.ankleY - 0.5) +
      ' C' + f(a.c + a.half + 4.5) + ' ' + f(G.floorY - 4) + ' ' + f(a.c + a.half + 5) + ' ' + f(G.floorY - 0.8) + ' ' + f(a.c + a.half + 3.5) + ' ' + f(G.floorY) +
      ' L' + f(a.c - a.half - 1.6) + ' ' + f(G.floorY) + ' Q' + f(a.c - a.half - 2.4) + ' ' + f(G.floorY - 3) + ' ' + f(a.c - a.half - 1) + ' ' + f(G.ankleY - 0.5) + 'Z';
    const shoes = '<path d="' + shoe + '" fill="url(#' + id + 'shoe)" stroke="#c9ccd3" stroke-width="0.2"/>' +
      '<path d="M' + f(a.c - a.half - 1.8) + ' ' + f(G.floorY - 1) + ' L' + f(a.c + a.half + 4.6) + ' ' + f(G.floorY - 1) + '" stroke="#d4d7dd" stroke-width="0.6"/>';
    // Detalles anatómicos sutiles
    const det = '<path d="M' + f(-G.neck * 1.6) + ' ' + f(G.hps + 1.2) + ' Q' + f(-G.sh * 0.45) + ' ' + f(G.hps + 2.4) + ' ' + f(-G.sh * 0.8) + ' ' + f(G.shoulderY + 0.4) +
      ' M' + f(G.neck * 1.6) + ' ' + f(G.hps + 1.2) + ' Q' + f(G.sh * 0.45) + ' ' + f(G.hps + 2.4) + ' ' + f(G.sh * 0.8) + ' ' + f(G.shoulderY + 0.4) + '" fill="none" stroke="url(#' + id + 'rim)" stroke-width="0.35" opacity="0.55"/>' +
      '<ellipse cx="0" cy="' + f(G.waistY + 2.5) + '" rx="0.45" ry="0.7" fill="#000" opacity="0.18"/>' +
      [1, -1].map((s) => '<path d="M' + f(s * (L(G.kneeY).c - 2)) + ' ' + f(G.kneeY + 1) + ' q' + f(s * 2) + ' 1.2 ' + f(s * 4) + ' 0" fill="none" stroke="#000" stroke-width="0.25" opacity="0.15"/>').join('');
    return {
      neck: '<path d="M' + f(-G.neck) + ' ' + f(G.chin - 4) + ' L' + f(G.neck) + ' ' + f(G.chin - 4) + ' L' + f(G.neck * 1.05) + ' ' + f(G.hps + 1) + ' L' + f(-G.neck * 1.05) + ' ' + f(G.hps + 1) + 'Z" fill="url(#' + id + 'skinH)"/>' +
        '<path d="M' + f(-G.neck) + ' ' + f(G.chin - 0.5) + ' Q0 ' + f(G.chin + 2.2) + ' ' + f(G.neck) + ' ' + f(G.chin - 0.5) + ' L' + f(G.neck) + ' ' + f(G.chin - 2) + ' L' + f(-G.neck) + ' ' + f(G.chin - 2) + 'Z" fill="#000" opacity="0.12"/>',
      main: '<path d="' + smooth(torso, 0.85) + '" fill="url(#' + id + 'skinH)"/>' +
        '<path d="' + legD + '" fill="url(#' + id + 'skinH)"/><g transform="scale(-1 1)"><path d="' + legD + '" fill="url(#' + id + 'skinH)"/></g>' + det,
      shoes: shoes + '<g transform="scale(-1 1)">' + shoes + '</g>',
      arms: drawArm(G, id) + '<g transform="scale(-1 1)">' + drawArm(G, id) + '</g>',
    };
  }

  // Ropa interior base cuando falta una prenda
  function baseLayer(G, slot, id) {
    const c = '#3a3f4b';
    if (slot === 'bottom') {
      const y0 = G.hipY - 5, l = G.leg(G.crotchY + 9);
      const p = [{ x: -G.torsoHalf(y0) - 0.2, y: y0 }, { x: G.torsoHalf(y0) + 0.2, y: y0 }, { x: G.hw + 0.3, y: G.hipY + 2 },
        { x: l.c + l.half + 0.3, y: G.crotchY + 9 }, { x: l.c - l.half, y: G.crotchY + 9.5 }, { x: 0, y: G.crotchY + 1.5 },
        { x: -(l.c - l.half), y: G.crotchY + 9.5 }, { x: -(l.c + l.half + 0.3), y: G.crotchY + 9 }, { x: -G.hw - 0.3, y: G.hipY + 2 }];
      return '<path d="' + poly(p) + '" fill="' + c + '"/><path d="' + poly(p) + '" fill="url(#' + id + 'fold)"/>' +
        '<path d="M' + f(-G.torsoHalf(y0)) + ' ' + f(y0 + 1.6) + ' L' + f(G.torsoHalf(y0)) + ' ' + f(y0 + 1.6) + '" stroke="#5b6170" stroke-width="1.2"/>';
    }
    if (slot === 'top' && G.w) {
      const y0 = G.armpitY - 1, y1 = G.chestY + 6;
      const p = [{ x: -G.cw - 0.3, y: y0 }, { x: -G.cw * 0.6, y: G.hps + 2 }, { x: -G.cw * 0.35, y: G.hps + 3 }, { x: 0, y: y0 + 2 },
        { x: G.cw * 0.35, y: G.hps + 3 }, { x: G.cw * 0.6, y: G.hps + 2 }, { x: G.cw + 0.3, y: y0 }, { x: G.cw + 0.2, y: y1 }, { x: -G.cw - 0.2, y: y1 }];
      return '<path d="' + poly(p) + '" fill="' + c + '"/><path d="' + poly(p) + '" fill="url(#' + id + 'fold)"/>';
    }
    return '';
  }

  function drawHead(G, photo, id, skin) {
    const rx = G.headRx, ry = G.headRy, cy = G.headCy;
    const head = 'M0 ' + f(cy - ry) + ' C' + f(rx * 1.05) + ' ' + f(cy - ry) + ' ' + f(rx * 1.08) + ' ' + f(cy - ry * 0.1) + ' ' + f(rx * 0.95) + ' ' + f(cy + ry * 0.35) +
      ' C' + f(rx * 0.8) + ' ' + f(cy + ry * 0.8) + ' ' + f(rx * 0.35) + ' ' + f(cy + ry) + ' 0 ' + f(cy + ry) +
      ' C' + f(-rx * 0.35) + ' ' + f(cy + ry) + ' ' + f(-rx * 0.8) + ' ' + f(cy + ry * 0.8) + ' ' + f(-rx * 0.95) + ' ' + f(cy + ry * 0.35) +
      ' C' + f(-rx * 1.08) + ' ' + f(cy - ry * 0.1) + ' ' + f(-rx * 1.05) + ' ' + f(cy - ry) + ' 0 ' + f(cy - ry) + 'Z';
    const ears = [1, -1].map((s) => '<ellipse cx="' + f(s * rx * 0.98) + '" cy="' + f(cy + ry * 0.08) + '" rx="1.5" ry="2.7" fill="url(#' + id + 'skinH)"/>').join('');
    if (photo && photo.src) {
      const prx = rx * 1.2, pry = ry * 1.18, pcy = cy - ry * 0.05;
      const z = photo.zoom || 1, w = prx * 2 * z * 1.2, hh = pry * 2 * z * 1.2;
      const x = -w / 2 + (photo.x || 0) * w * 0.5, y = pcy - hh / 2 + (photo.y || 0) * hh * 0.5;
      return ears + '<path d="' + head + '" fill="url(#' + id + 'skinH)"/>' +
        '<mask id="' + id + 'fm" maskContentUnits="userSpaceOnUse"><ellipse cx="0" cy="' + f(pcy) + '" rx="' + f(prx) + '" ry="' + f(pry) + '" fill="url(#' + id + 'feather)"/></mask>' +
        '<image href="' + photo.src + '" x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(hh) + '" preserveAspectRatio="xMidYMid slice" mask="url(#' + id + 'fm)"/>';
    }
    const hair = G.w ? '#3b2a22' : '#2b211c';
    const hairD = G.w
      ? 'M' + f(-rx * 1.12) + ' ' + f(cy + ry * 0.9) + ' C' + f(-rx * 1.4) + ' ' + f(cy - ry * 0.4) + ' ' + f(-rx * 0.9) + ' ' + f(cy - ry * 1.18) + ' 0 ' + f(cy - ry * 1.12) +
        ' C' + f(rx * 0.9) + ' ' + f(cy - ry * 1.18) + ' ' + f(rx * 1.4) + ' ' + f(cy - ry * 0.4) + ' ' + f(rx * 1.12) + ' ' + f(cy + ry * 0.9) +
        ' L' + f(rx * 0.8) + ' ' + f(cy + ry * 0.3) + ' C' + f(rx * 0.85) + ' ' + f(cy - ry * 0.5) + ' ' + f(rx * 0.2) + ' ' + f(cy - ry * 0.62) + ' ' + f(-rx * 0.4) + ' ' + f(cy - ry * 0.45) +
        ' C' + f(-rx * 0.8) + ' ' + f(cy - ry * 0.3) + ' ' + f(-rx * 0.85) + ' ' + f(cy + ry * 0.1) + ' ' + f(-rx * 0.8) + ' ' + f(cy + ry * 0.3) + 'Z'
      : 'M' + f(-rx * 1.02) + ' ' + f(cy - ry * 0.05) + ' C' + f(-rx * 1.15) + ' ' + f(cy - ry * 1.05) + ' ' + f(-rx * 0.3) + ' ' + f(cy - ry * 1.22) + ' ' + f(rx * 0.25) + ' ' + f(cy - ry * 1.12) +
        ' C' + f(rx * 1.05) + ' ' + f(cy - ry * 1.05) + ' ' + f(rx * 1.12) + ' ' + f(cy - ry * 0.5) + ' ' + f(rx * 1.02) + ' ' + f(cy - ry * 0.05) +
        ' C' + f(rx * 0.85) + ' ' + f(cy - ry * 0.5) + ' ' + f(rx * 0.4) + ' ' + f(cy - ry * 0.68) + ' 0 ' + f(cy - ry * 0.62) + ' C' + f(-rx * 0.5) + ' ' + f(cy - ry * 0.68) + ' ' + f(-rx * 0.9) + ' ' + f(cy - ry * 0.5) + ' ' + f(-rx * 1.02) + ' ' + f(cy - ry * 0.05) + 'Z';
    const ink = shade(skin, -0.6);
    const face = [1, -1].map((s) => '<ellipse cx="' + f(s * rx * 0.36) + '" cy="' + f(cy + ry * 0.05) + '" rx="0.85" ry="0.95" fill="#2a2626"/>' +
      '<path d="M' + f(s * rx * 0.2) + ' ' + f(cy - ry * 0.16) + ' q' + f(s * rx * 0.18) + ' -0.9 ' + f(s * rx * 0.36) + ' 0" fill="none" stroke="' + ink + '" stroke-width="0.45" stroke-linecap="round"/>').join('') +
      '<path d="M0 ' + f(cy + ry * 0.12) + ' q-0.8 2.6 0.2 3.1" fill="none" stroke="' + shade(skin, -0.3) + '" stroke-width="0.35" stroke-linecap="round"/>' +
      '<path d="M' + f(-rx * 0.26) + ' ' + f(cy + ry * 0.5) + ' Q0 ' + f(cy + ry * 0.62) + ' ' + f(rx * 0.26) + ' ' + f(cy + ry * 0.5) + '" fill="none" stroke="' + shade(skin, -0.45) + '" stroke-width="0.5" stroke-linecap="round"/>';
    return ears + '<path d="' + head + '" fill="url(#' + id + 'skinH)"/>' + face + '<path d="' + hairD + '" fill="' + hair + '"/>';
  }

  // ------------------------------------------------------------ prendas reales
  /** Escalas de la parte de arriba y ángulo de brazos que sigue las mangas de la foto. */
  function topFrame(G, body, g, size) {
    const a = g.analysis, S = MQ.garmentSpecs(g, body.gender).specs[size];
    const sx = S.chest / 2 / a.bodyFlat, sy = S.length / a.lengthPx;
    let armDeg = 11;
    const sl = [a.sleeveR, a.sleeveL].filter(Boolean);
    if (sl.length) {
      const angs = sl.map((v) => (Math.atan2(Math.abs(v.dir.x) * sx, v.dir.y * sy) * 180) / Math.PI);
      armDeg = clamp(angs.reduce((x, y) => x + y, 0) / angs.length, 8, 62);
    }
    return { a, S, sx, sy, armDeg };
  }

  function placeTop(G, F, id, href) {
    const { a, sx, sy } = F;
    const ty = G.hps - 1.6 - a.collarY * sy, tx = -a.cx * sx;
    return {
      defs: '',
      body: '<g transform="matrix(' + [sx, 0, 0, sy, tx, ty].map(f).join(' ') + ')" filter="url(#' + id + 'soft)"><image href="' + href + '" width="' + a.w + '" height="' + a.h + '"/></g>',
    };
  }

  function placeBottom(G, body, g, size, id, href) {
    const a = g.analysis, S = MQ.garmentSpecs(g, body.gender).specs[size];
    const sx = S.waist / 2 / a.waistFlat;
    const sy = S.inseam / a.inseamPx;
    const ty = G.crotchY + 2 - a.crotchY * sy, tx = -a.cx * sx;
    const hemY = a.y1 * sy + ty;
    const over = hemY - (G.floorY - 0.6);
    return {
      defs: '<clipPath id="' + id + 'floor"><rect x="-200" y="-10" width="400" height="' + f(G.floorY - 0.6 + 10) + '"/></clipPath>',
      body: '<g clip-path="url(#' + id + 'floor)"><image href="' + href + '" width="' + a.w + '" height="' + a.h + '" transform="matrix(' + [sx, 0, 0, sy, tx, ty].map(f).join(' ') + ')" filter="url(#' + id + 'soft)"/></g>',
      over,
    };
  }

  /**
   * outfit: { top: {garment, size, href}, bottom: {garment, size, href} }
   * opts: { skin, photo, compact }
   */
  MQ.renderAvatar = function (body, outfit, opts = {}) {
    const id = 'mq' + ++uid;
    const F = outfit.top ? topFrame(null, body, outfit.top.garment, outfit.top.size) : null;
    const G = geometry(body, F ? F.armDeg : 11);
    const skin = opts.skin || '#d9a47c';
    const B = drawBody(G, id);
    const top = F ? placeTop(G, F, id + 't', outfit.top.href) : null;
    const bot = outfit.bottom ? placeBottom(G, body, outfit.bottom.garment, outfit.bottom.size, id + 'b', outfit.bottom.href) : null;
    const defs = '<defs>' +
      '<linearGradient id="' + id + 'skinH" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="' + shade(skin, -0.2) + '"/><stop offset="0.35" stop-color="' + shade(skin, 0.06) + '"/><stop offset="0.65" stop-color="' + skin + '"/><stop offset="1" stop-color="' + shade(skin, -0.24) + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'rim" x1="0" x2="1"><stop offset="0" stop-color="' + shade(skin, -0.35) + '"/><stop offset="1" stop-color="' + shade(skin, -0.35) + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'fold" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0.25"/><stop offset="0.4" stop-color="#fff" stop-opacity="0.08"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></linearGradient>' +
      '<linearGradient id="' + id + 'shoe" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e5ea"/></linearGradient>' +
      '<radialGradient id="' + id + 'feather"><stop offset="0.78" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id + 'floorG"><stop offset="0" stop-color="#000" stop-opacity="0.28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
      '<filter id="' + id + 'tsoft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0.4" stdDeviation="0.5" flood-opacity="0.25"/></filter>' +
      '<filter id="' + id + 'bsoft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0.4" stdDeviation="0.5" flood-opacity="0.25"/></filter>' +
      (top ? top.defs : '') + (bot ? bot.defs : '') + '</defs>';
    const longHair = !opts.photo && G.w
      ? '<path d="M' + f(-G.headRx * 1.15) + ' ' + f(G.headCy) + ' C' + f(-G.headRx * 1.3) + ' ' + f(G.hps + 6) + ' ' + f(-G.headRx * 1.1) + ' ' + f(G.shoulderY + 6) + ' ' + f(-G.headRx * 0.6) + ' ' + f(G.shoulderY + 7) +
        ' L' + f(G.headRx * 0.6) + ' ' + f(G.shoulderY + 7) + ' C' + f(G.headRx * 1.1) + ' ' + f(G.shoulderY + 6) + ' ' + f(G.headRx * 1.3) + ' ' + f(G.hps + 6) + ' ' + f(G.headRx * 1.15) + ' ' + f(G.headCy) + 'Z" fill="#3b2a22"/>'
      : '';
    // Ancho del cuadro: lo justo para que quepan los brazos según la pose
    const reach = Math.abs(G.W.x) + G.handLen * Math.sin(G.armAngle) + G.wa * 2 + 3;
    const w = Math.max(G.h * 0.5, reach * 2);
    const vb = [-w / 2, -3, w, G.h + 5];
    const content =
      '<ellipse cx="0" cy="' + f(G.floorY) + '" rx="' + f(G.hw * 2.2) + '" ry="2.4" fill="url(#' + id + 'floorG)"/>' +
      longHair + B.neck + B.main + B.shoes +
      (bot ? bot.body : baseLayer(G, 'bottom', id)) +
      B.arms +
      (top ? top.body : baseLayer(G, 'top', id)) +
      drawHead(G, opts.photo, id, skin);
    return {
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.map(f).join(' ') + '" class="avatar-svg" role="img" aria-label="Tu avatar con la prenda">' + defs + content + '</svg>',
      overLength: bot ? bot.over : 0,
    };
  };
})();
