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
  // Siluetas (en cm) de brazo, torso y pierna
  function armPath(G) {
    const L = G.armLen, el = L * 0.5;
    const o = (t, k = 1) => add(G.armAt(t), mul(G.n, G.armHalf(t) * k));
    const i = (t, k = 1) => add(G.armAt(t), mul(G.n, -G.armHalf(t) * k));
    return smooth([add(G.A, mul(G.d, -G.ua * 0.55)), add(o(0), mul(G.d, -G.ua * 0.15)), o(L * 0.22, 1.04), o(el, 0.92), o(L * 0.62, 1.0), o(L * 0.85, 0.88), o(L),
      i(L), i(L * 0.85, 0.86), i(L * 0.62, 0.95), i(el, 0.9), i(L * 0.25), i(0, 0.9)], 0.9);
  }
  function handPath(G) {
    const hl = G.handLen, w = G.wa;
    const ang = deg(Math.atan2(G.d.y, G.d.x)) - 90;
    const d = 'M' + f(-w * 1.02) + ' 0 C' + f(-w * 1.45) + ' ' + f(hl * 0.3) + ' ' + f(-w * 1.25) + ' ' + f(hl * 0.78) + ' ' + f(-w * 0.55) + ' ' + f(hl * 0.98) +
      ' C' + f(-w * 0.1) + ' ' + f(hl * 1.04) + ' ' + f(w * 0.7) + ' ' + f(hl * 0.98) + ' ' + f(w * 1.05) + ' ' + f(hl * 0.72) +
      ' C' + f(w * 1.4) + ' ' + f(hl * 0.42) + ' ' + f(w * 1.55) + ' ' + f(hl * 0.2) + ' ' + f(w * 1.02) + ' 0Z';
    return { d, transform: 'translate(' + f(G.W.x) + ' ' + f(G.W.y - 0.6) + ') rotate(' + f(ang) + ')' };
  }
  function torsoPath(G) {
    const w = G.w;
    const r = [
      { x: G.neck * 0.95, y: G.hps - 1.5 },
      { x: G.sh * 0.68, y: G.shoulderY - 0.7 },
      { x: G.sh * 0.96, y: G.shoulderY + 1.5 },
      { x: G.cw * 1.04, y: G.armpitY },
      { x: G.cw * (w ? 1.03 : 1.01), y: G.chestY },
      { x: lerp(G.cw, G.ww, 0.55), y: lerp(G.chestY, G.waistY, 0.55) },
      { x: G.ww, y: G.waistY },
      { x: lerp(G.ww, G.hw, 0.7), y: lerp(G.waistY, G.hipY, 0.55) },
      { x: G.hw, y: G.hipY },
      { x: G.hw * 0.96, y: G.crotchY },
    ];
    return smooth(r.concat([{ x: 0, y: G.crotchY + 0.8 }], r.slice().reverse().map(mir)), 0.85);
  }
  function legPath(G) {
    const L = (y) => G.leg(y);
    const y1 = G.crotchY + 9, ym = (G.kneeY + G.crotchY) / 2;
    return smooth([
      { x: G.hw * 0.99, y: G.hipY + 3 },
      { x: L(y1).c + L(y1).half * 1.02, y: y1 },
      { x: L(ym).c + L(ym).half * 0.95, y: ym },
      { x: L(G.kneeY).c + L(G.kneeY).half * 0.92, y: G.kneeY },
      { x: L(G.calfY).c + L(G.calfY).half * 1.04, y: G.calfY },
      { x: L(G.ankleY).c + L(G.ankleY).half, y: G.ankleY },
      { x: L(G.ankleY).c - L(G.ankleY).half, y: G.ankleY },
      { x: L(G.calfY).c - L(G.calfY).half * 0.9, y: G.calfY },
      { x: L(G.kneeY).c - L(G.kneeY).half * 0.95, y: G.kneeY },
      { x: L(ym).c - L(ym).half * 0.92, y: ym },
      { x: 0.6, y: G.crotchY - 0.5 },
    ], 0.9);
  }

  /**
   * Volumen realista sin IA: color base + sombra interior difuminada en los bordes
   * + luces suaves desde arriba (como un tragaluz) + detalles anatómicos sutiles.
   */
  function shaded(id, d, skin, extra = '', transform = '') {
    const k = id + Math.random().toString(36).slice(2, 7);
    const tr = transform ? ' transform="' + transform + '"' : '';
    return '<g' + tr + '><clipPath id="' + k + '"><path d="' + d + '"/></clipPath>' +
      '<path d="' + d + '" fill="' + skin + '"/>' +
      '<g clip-path="url(#' + k + ')">' +
      '<path d="' + d + '" fill="url(#' + id + 'top)"/>' +
      '<path d="' + d + '" fill="none" stroke="' + shade(skin, -0.42) + '" stroke-width="5" opacity="0.5" filter="url(#' + id + 'blur2)"/>' +
      extra + '</g>' +
      '<path d="' + d + '" fill="none" stroke="' + shade(skin, -0.3) + '" stroke-width="0.18" opacity="0.6"/></g>';
  }

  function drawArm(G, id, skin) {
    const d = armPath(G), h = handPath(G);
    const L = G.armLen;
    const hi = '<path d="M' + f(G.armAt(L * 0.08).x + G.n.x * G.ua * 0.25) + ' ' + f(G.armAt(L * 0.08).y) + ' L' + f(G.armAt(L * 0.9).x + G.n.x * G.wa * 0.2) + ' ' + f(G.armAt(L * 0.9).y) + '" stroke="' + shade(skin, 0.28) + '" stroke-width="2.2" stroke-linecap="round" opacity="0.5" filter="url(#' + id + 'blur2)"/>' +
      '<ellipse cx="' + f(G.armAt(L * 0.5).x) + '" cy="' + f(G.armAt(L * 0.5).y) + '" rx="' + f(G.ua * 0.6) + '" ry="1.4" fill="' + shade(skin, -0.4) + '" opacity="0.25" filter="url(#' + id + 'blur1)"/>';
    return shaded(id, d, skin, hi) + shaded(id, h.d, skin, '', h.transform);
  }

  function drawBody(G, id, skin) {
    const tD = torsoPath(G), lD = legPath(G), dk = shade(skin, -0.45), lt = shade(skin, 0.3);
    const blur2 = 'filter="url(#' + id + 'blur2)"', blur1 = 'filter="url(#' + id + 'blur1)"';
    // Anatomía sutil del torso (difuminada)
    let an = '<path d="M' + f(-G.neck * 1.3) + ' ' + f(G.hps + 1.4) + ' Q' + f(-G.sh * 0.45) + ' ' + f(G.hps + 2.8) + ' ' + f(-G.sh * 0.85) + ' ' + f(G.shoulderY + 0.6) +
      ' M' + f(G.neck * 1.3) + ' ' + f(G.hps + 1.4) + ' Q' + f(G.sh * 0.45) + ' ' + f(G.hps + 2.8) + ' ' + f(G.sh * 0.85) + ' ' + f(G.shoulderY + 0.6) + '" fill="none" stroke="' + dk + '" stroke-width="0.8" opacity="0.35" ' + blur1 + '/>' +
      '<ellipse cx="0" cy="' + f(G.chestY - 1) + '" rx="' + f(G.cw * 0.55) + '" ry="' + f(G.cw * 0.35) + '" fill="' + lt + '" opacity="0.35" ' + blur2 + '/>' +
      '<path d="M0 ' + f(G.chestY + 3) + ' L0 ' + f(G.waistY + 1) + '" stroke="' + dk + '" stroke-width="1.1" opacity="0.18" ' + blur1 + '/>' +
      '<ellipse cx="0" cy="' + f(G.waistY + 2.5) + '" rx="0.5" ry="0.75" fill="' + dk + '" opacity="0.45"/>';
    if (G.w) {
      for (const sgn of [1, -1]) an += '<path d="M' + f(sgn * G.cw * 0.15) + ' ' + f(G.chestY + 2.5) + ' Q' + f(sgn * G.cw * 0.5) + ' ' + f(G.chestY + 5) + ' ' + f(sgn * G.cw * 0.9) + ' ' + f(G.chestY + 1) + '" fill="none" stroke="' + dk + '" stroke-width="1" opacity="0.3" ' + blur1 + '/>';
    } else {
      for (const sgn of [1, -1]) an += '<path d="M' + f(sgn * G.cw * 0.08) + ' ' + f(G.chestY + 2.8) + ' Q' + f(sgn * G.cw * 0.5) + ' ' + f(G.chestY + 4.2) + ' ' + f(sgn * G.cw * 0.88) + ' ' + f(G.chestY) + '" fill="none" stroke="' + dk + '" stroke-width="0.9" opacity="0.26" ' + blur1 + '/>';
    }
    const k = G.leg(G.kneeY);
    const legHi = '<path d="M' + f(G.leg(G.crotchY + 6).c) + ' ' + f(G.crotchY + 6) + ' L' + f(k.c + 0.5) + ' ' + f(G.kneeY - 3) + ' M' + f(k.c + 0.4) + ' ' + f(G.kneeY + 5) + ' L' + f(G.leg(G.ankleY).c + 0.3) + ' ' + f(G.ankleY - 4) + '" stroke="' + lt + '" stroke-width="2.6" stroke-linecap="round" opacity="0.45" ' + blur2 + '/>' +
      '<ellipse cx="' + f(k.c) + '" cy="' + f(G.kneeY + 0.5) + '" rx="' + f(k.half * 0.55) + '" ry="' + f(k.half * 0.45) + '" fill="none" stroke="' + dk + '" stroke-width="0.6" opacity="0.3" ' + blur1 + '/>';
    const leg = shaded(id, lD, skin, legHi);
    const a = G.leg(G.ankleY);
    const shoe = 'M' + f(a.c - a.half - 1) + ' ' + f(G.ankleY - 0.6) + ' Q' + f(a.c) + ' ' + f(G.ankleY - 2.2) + ' ' + f(a.c + a.half + 1) + ' ' + f(G.ankleY - 0.6) +
      ' C' + f(a.c + a.half + 4.5) + ' ' + f(G.floorY - 4) + ' ' + f(a.c + a.half + 5.2) + ' ' + f(G.floorY - 0.9) + ' ' + f(a.c + a.half + 3.6) + ' ' + f(G.floorY) +
      ' L' + f(a.c - a.half - 1.7) + ' ' + f(G.floorY) + ' Q' + f(a.c - a.half - 2.5) + ' ' + f(G.floorY - 3) + ' ' + f(a.c - a.half - 1) + ' ' + f(G.ankleY - 0.6) + 'Z';
    const shoes = '<path d="' + shoe + '" fill="url(#' + id + 'shoe)" stroke="#cfc6ba" stroke-width="0.2"/>' +
      '<path d="M' + f(a.c - a.half - 1.9) + ' ' + f(G.floorY - 1.1) + ' L' + f(a.c + a.half + 4.7) + ' ' + f(G.floorY - 1.1) + '" stroke="#ded6cb" stroke-width="0.7"/>';
    const neckD = 'M' + f(-G.neck) + ' ' + f(G.chin - 5) + ' L' + f(G.neck) + ' ' + f(G.chin - 5) + ' C' + f(G.neck * 1.02) + ' ' + f(G.hps - 2) + ' ' + f(G.neck * 1.2) + ' ' + f(G.hps) + ' ' + f(G.neck * 1.5) + ' ' + f(G.hps + 1.5) +
      ' L' + f(-G.neck * 1.5) + ' ' + f(G.hps + 1.5) + ' C' + f(-G.neck * 1.2) + ' ' + f(G.hps) + ' ' + f(-G.neck * 1.02) + ' ' + f(G.hps - 2) + ' ' + f(-G.neck) + ' ' + f(G.chin - 5) + 'Z';
    const neckSh = '<path d="M' + f(-G.neck * 1.1) + ' ' + f(G.chin - 1.5) + ' Q0 ' + f(G.chin + 2.5) + ' ' + f(G.neck * 1.1) + ' ' + f(G.chin - 1.5) + '" fill="none" stroke="' + dk + '" stroke-width="2.4" opacity="0.35" ' + blur2 + '/>';
    return {
      neck: shaded(id, neckD, skin, neckSh),
      main: shaded(id, tD, skin, an) + leg + '<g transform="scale(-1 1)">' + leg + '</g>',
      shoes: shoes + '<g transform="scale(-1 1)">' + shoes + '</g>',
      arms: drawArm(G, id, skin) + '<g transform="scale(-1 1)">' + drawArm(G, id, skin) + '</g>',
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
      const y0 = G.armpitY - 2.5, y1 = G.chestY + 5.5;
      const p = [{ x: -G.cw * 1.02, y: y0 + 1 }, { x: -G.cw * 0.55, y: y0 - 1.5 }, { x: 0, y: y0 + 1.2 }, { x: G.cw * 0.55, y: y0 - 1.5 }, { x: G.cw * 1.02, y: y0 + 1 }, { x: G.cw * 1.01, y: y1 }, { x: -G.cw * 1.01, y: y1 }];
      return '<path d="' + smooth(p, 0.6) + '" fill="' + c + '"/><path d="' + smooth(p, 0.6) + '" fill="url(#' + id + 'fold)"/>';
    }
    return '';
  }

  function drawHead(G, photo, id, skin) {
    const rx = G.headRx, ry = G.headRy, cy = G.headCy;
    const head = 'M0 ' + f(cy - ry) + ' C' + f(rx * 1.05) + ' ' + f(cy - ry) + ' ' + f(rx * 1.08) + ' ' + f(cy - ry * 0.1) + ' ' + f(rx * 0.95) + ' ' + f(cy + ry * 0.35) +
      ' C' + f(rx * 0.8) + ' ' + f(cy + ry * 0.8) + ' ' + f(rx * 0.35) + ' ' + f(cy + ry) + ' 0 ' + f(cy + ry) +
      ' C' + f(-rx * 0.35) + ' ' + f(cy + ry) + ' ' + f(-rx * 0.8) + ' ' + f(cy + ry * 0.8) + ' ' + f(-rx * 0.95) + ' ' + f(cy + ry * 0.35) +
      ' C' + f(-rx * 1.08) + ' ' + f(cy - ry * 0.1) + ' ' + f(-rx * 1.05) + ' ' + f(cy - ry) + ' 0 ' + f(cy - ry) + 'Z';
    if (photo && photo.src && photo.head) {
      // Tu cara recortada (con pelo): coronilla arriba, cuello en la barbilla del avatar
      const hd = photo.head, z = photo.zoom || 1;
      const s0 = (G.chin + 2.4) / Math.max(10, hd.chin - hd.top) * z;
      const w = photo.w * s0, h = photo.h * s0;
      const x = -hd.cx * s0 + (photo.x || 0) * 6, y = -1.6 - hd.top * s0 + (photo.y || 0) * 6;
      return '<image href="' + photo.src + '" x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" filter="url(#' + id + 'face)"/>';
    }
    if (photo && photo.src) {
      const prx = rx * 1.2, pry = ry * 1.18, pcy = cy - ry * 0.05;
      const z = photo.zoom || 1, w = prx * 2 * z * 1.2, hh = pry * 2 * z * 1.2;
      const x = -w / 2 + (photo.x || 0) * w * 0.5, y = pcy - hh / 2 + (photo.y || 0) * hh * 0.5;
      return '<path d="' + head + '" fill="' + skin + '"/>' +
        '<mask id="' + id + 'fm" maskContentUnits="userSpaceOnUse"><ellipse cx="0" cy="' + f(pcy) + '" rx="' + f(prx) + '" ry="' + f(pry) + '" fill="url(#' + id + 'feather)"/></mask>' +
        '<image href="' + photo.src + '" x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(hh) + '" preserveAspectRatio="xMidYMid slice" mask="url(#' + id + 'fm)"/>';
    }
    // Sin foto: cabeza de maniquí, lisa y elegante
    const ears = [1, -1].map((s) => '<ellipse cx="' + f(s * rx * 0.97) + '" cy="' + f(cy + ry * 0.06) + '" rx="1.4" ry="2.6" fill="' + shade(skin, -0.05) + '"/>').join('');
    const feat = '<path d="M' + f(-rx * 0.55) + ' ' + f(cy - ry * 0.02) + ' Q' + f(-rx * 0.35) + ' ' + f(cy - ry * 0.1) + ' ' + f(-rx * 0.15) + ' ' + f(cy - ry * 0.02) +
      ' M' + f(rx * 0.15) + ' ' + f(cy - ry * 0.02) + ' Q' + f(rx * 0.35) + ' ' + f(cy - ry * 0.1) + ' ' + f(rx * 0.55) + ' ' + f(cy - ry * 0.02) + '" fill="none" stroke="' + shade(skin, -0.4) + '" stroke-width="0.9" opacity="0.4" filter="url(#' + id + 'blur1)"/>' +
      '<path d="M0 ' + f(cy - ry * 0.05) + ' L-0.6 ' + f(cy + ry * 0.32) + ' L0.5 ' + f(cy + ry * 0.36) + '" fill="none" stroke="' + shade(skin, -0.35) + '" stroke-width="0.9" opacity="0.35" filter="url(#' + id + 'blur1)"/>' +
      '<path d="M' + f(-rx * 0.25) + ' ' + f(cy + ry * 0.55) + ' Q0 ' + f(cy + ry * 0.6) + ' ' + f(rx * 0.25) + ' ' + f(cy + ry * 0.55) + '" fill="none" stroke="' + shade(skin, -0.4) + '" stroke-width="0.7" opacity="0.4" filter="url(#' + id + 'blur1)"/>';
    return ears + shaded(id, head, skin, feat);
  }

  // ------------------------------------------------------------ prendas reales
  /** Escalas de la parte de arriba. Los brazos cuelgan naturales y las mangas giran hacia ellos. */
  function topFrame(G, body, g, size) {
    const a = g.analysis, S = MQ.garmentSpecs(g, body.gender).specs[size];
    const sx = S.chest / 2 / a.bodyFlat, sy = S.length / a.lengthPx;
    return { a, S, sx, sy, armDeg: 8 };
  }

  function placeTop(G, F, id, href) {
    const { a, sx, sy } = F;
    const ty = G.hps - 1.6 - a.collarY * sy, tx = -a.cx * sx;
    const T = (p) => ({ x: p.x * sx + tx, y: p.y * sy + ty });
    const M = 'matrix(' + [sx, 0, 0, sy, tx, ty].map(f).join(' ') + ')';
    const piece = (clip) => '<g transform="' + M + '"><image href="' + href + '" width="' + a.w + '" height="' + a.h + '"' + (clip ? ' clip-path="url(#' + clip + ')"' : '') + '/></g>';
    const half = a.bodyFlat / 2, ov = half * 0.05;
    const sleeves = [a.sleeveR, a.sleeveL].filter(Boolean);
    if (!sleeves.length) return { defs: '', body: '<g filter="url(#' + id + 'soft)">' + piece('') + '</g>', sleeves: '' };

    // Cuerpo de la prenda: desde los hombros hasta el ruedo, sin las mangas
    const body = [{ x: a.shoulderL.x, y: 0 }, { x: a.shoulderR.x, y: 0 }, { x: a.cx + half + ov, y: a.armpitY }, { x: a.cx + half + ov, y: a.h }, { x: a.cx - half - ov, y: a.h }, { x: a.cx - half - ov, y: a.armpitY }];
    let defs = '<clipPath id="' + id + 'cb"><path d="' + poly(body) + '"/></clipPath>';
    let out = '';
    for (const side of [1, -1]) {
      const sl = side > 0 ? a.sleeveR : a.sleeveL;
      if (!sl) continue;
      const sp = side > 0 ? a.shoulderR : a.shoulderL;
      // Cuña a lo largo de la manga (en píxeles de la foto)
      const L = Math.max(a.w, a.h) * 2, dir = sl.dir;
      let nOut = { x: dir.y, y: -dir.x };
      if (nOut.x * side < 0) nOut = { x: -nOut.x, y: -nOut.y };
      const pit = { x: a.cx + side * (half - ov), y: a.armpitY };
      const s0 = { x: sp.x - side * ov * 2, y: Math.max(0, sp.y - 4) };
      const wedge = [s0, add(s0, mul(nOut, L)), add(add(s0, mul(nOut, L)), mul(dir, L)), add(pit, mul(dir, L)), pit];
      defs += '<clipPath id="' + id + 'cs' + (side > 0 ? 'r' : 'l') + '"><path d="' + poly(wedge) + '"/></clipPath>';
      // Giro: la dirección de la manga (en cm) pasa a ser la del brazo que cuelga
      const P = T(sl.pivot), E = T(sl.end);
      const armD = side > 0 ? G.d : { x: -G.d.x, y: G.d.y };
      let dA = Math.atan2(armD.y, armD.x) - Math.atan2(E.y - P.y, E.x - P.x);
      while (dA > Math.PI) dA -= 2 * Math.PI;
      while (dA < -Math.PI) dA += 2 * Math.PI;
      // y un pequeño desplazamiento para que la manga quede centrada sobre el brazo
      const c = Math.cos(dA), s = Math.sin(dA);
      const E2 = { x: P.x + (E.x - P.x) * c - (E.y - P.y) * s, y: P.y + (E.x - P.x) * s + (E.y - P.y) * c };
      const A = side > 0 ? G.A : mir(G.A);
      const v = sub(E2, A), off = sub(v, mul(armD, dot(v, armD)));
      const t = mul(off, -0.6);
      out += '<g transform="translate(' + f(t.x) + ' ' + f(t.y) + ') rotate(' + f(deg(dA)) + ' ' + f(P.x) + ' ' + f(P.y) + ')">' + piece(id + 'cs' + (side > 0 ? 'r' : 'l')) + '</g>';
      if (window.MQ_DEBUG) console.log('sleeve', side, 'imgDeg', deg(Math.atan2(E.y - P.y, E.x - P.x)).toFixed(1), 'armDeg', deg(Math.atan2(armD.y, armD.x)).toFixed(1), 'rot', deg(dA).toFixed(1));
    }
    return { defs, body: '<g filter="url(#' + id + 'soft)">' + piece(id + 'cb') + '</g>', sleeves: '<g filter="url(#' + id + 'soft)">' + out + '</g>' };
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
    const B = drawBody(G, id, skin);
    const bkey = [body.gender, body.height, body.chest, body.waist, body.hip, body.inseam, body.shoulder].join('|');
    let top = null, bot = null;
    if (F && outfit.top.img && MQ.drapeTop) {
      // La prenda "puesta": se ciñe al cuerpo y las mangas siguen los brazos
      const D = MQ.drapeTop(G, F, outfit.top.img, outfit.top.garment.id + '|' + outfit.top.size + '|' + bkey);
      const im = (u, x, y, w, h) => '<image href="' + u + '" x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" preserveAspectRatio="none"/>';
      top = {
        defs: '',
        sleeves: '<g filter="url(#' + id + 'tsoft)">' + D.sleeves.map((sl) => '<g transform="translate(' + f(sl.ox) + ' ' + f(sl.oy) + ') rotate(' + f(sl.rot) + ')">' + im(sl.url, -sl.w / 2, 0, sl.w, sl.h) + '</g>').join('') + '</g>',
        body: '<g filter="url(#' + id + 'tsoft)">' + im(D.body.url, D.body.x, D.body.y, D.body.w, D.body.h) + '</g>',
      };
    } else if (F) top = placeTop(G, F, id + 't', outfit.top.href);
    if (outfit.bottom && outfit.bottom.img && MQ.drapeBottom) {
      const g = outfit.bottom.garment, a = g.analysis, S = MQ.garmentSpecs(g, body.gender).specs[outfit.bottom.size];
      const sx = S.waist / 2 / a.waistFlat, sy = S.inseam / a.inseamPx, ty = G.crotchY + 2 - a.crotchY * sy;
      const D = MQ.drapeBottom(G, { a, sx, sy, ty }, outfit.bottom.img, g.id + '|' + outfit.bottom.size + '|' + bkey);
      bot = {
        defs: '',
        body: '<g filter="url(#' + id + 'bsoft)"><image href="' + D.url + '" x="' + f(D.x) + '" y="' + f(D.y) + '" width="' + f(D.w) + '" height="' + f(D.h) + '" preserveAspectRatio="none"/></g>',
        over: a.y1 * sy + ty - (G.floorY - 0.6),
      };
    } else if (outfit.bottom) bot = placeBottom(G, body, outfit.bottom.garment, outfit.bottom.size, id + 'b', outfit.bottom.href);
    const defs = '<defs>' +
      '<linearGradient id="' + id + 'skinH" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="' + shade(skin, -0.2) + '"/><stop offset="0.35" stop-color="' + shade(skin, 0.06) + '"/><stop offset="0.65" stop-color="' + skin + '"/><stop offset="1" stop-color="' + shade(skin, -0.24) + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'rim" x1="0" x2="1"><stop offset="0" stop-color="' + shade(skin, -0.35) + '"/><stop offset="1" stop-color="' + shade(skin, -0.35) + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'fold" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0.25"/><stop offset="0.4" stop-color="#fff" stop-opacity="0.08"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></linearGradient>' +
      '<filter id="' + id + 'blur1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="0.6"/></filter>' +
      '<filter id="' + id + 'blur2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6"/></filter>' +
      '<filter id="' + id + 'face" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="0.5" stdDeviation="0.35" flood-color="#3a2a1a" flood-opacity="0.22"/></filter>' +
      '<linearGradient id="' + id + 'top" x1="0" x2="0" y1="0" gradientUnits="userSpaceOnUse" y2="' + f(G.h) + '"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.12"/></linearGradient>' +
      '<linearGradient id="' + id + 'shoe" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e5ea"/></linearGradient>' +
      '<radialGradient id="' + id + 'feather"><stop offset="0.78" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id + 'floorG"><stop offset="0" stop-color="#000" stop-opacity="0.28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
      '<filter id="' + id + 'tsoft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0.4" stdDeviation="0.5" flood-opacity="0.25"/></filter>' +
      '<filter id="' + id + 'bsoft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0.4" stdDeviation="0.5" flood-opacity="0.25"/></filter>' +
      (top ? top.defs : '') + (bot ? bot.defs : '') + '</defs>';
    const longHair = false && G.w
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
      (top ? top.sleeves + top.body : baseLayer(G, 'top', id)) +
      drawHead(G, opts.photo, id, skin);
    return {
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.map(f).join(' ') + '" class="avatar-svg" role="img" aria-label="Tu avatar con la prenda">' + defs + content + '</svg>',
      overLength: bot ? bot.over : 0,
    };
  };
})();
