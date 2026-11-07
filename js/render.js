/*
 * Renderizado SVG del avatar paramétrico y de las prendas.
 * Unidades del SVG = centímetros reales. Eje x centrado en el cuerpo, y desde la coronilla.
 * Se dibuja el lado derecho y se refleja con scale(-1,1) para brazos, mangas y piernas.
 */
(function () {
  const PV = (window.PV = window.PV || {});
  let uid = 0;
  const f = (n) => +n.toFixed(2);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const mirror = (p) => ({ x: -p.x, y: p.y });

  function shade(hex, amt) {
    const n = parseInt(hex.replace('#', ''), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, k = Math.abs(amt);
    r = Math.round(lerp(r, t, k)); g = Math.round(lerp(g, t, k)); b = Math.round(lerp(b, t, k));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  const isLight = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 150;
  };

  function poly(pts) {
    return 'M' + pts.map((p) => f(p.x) + ' ' + f(p.y)).join(' L') + ' Z';
  }
  // Catmull-Rom cerrado → curvas Bézier (siluetas orgánicas)
  function smooth(pts, k = 0.5) {
    const n = pts.length;
    let d = 'M' + f(pts[0].x) + ' ' + f(pts[0].y);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * k * 2, y: p1.y + ((p2.y - p0.y) / 6) * k * 2 };
      const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * k * 2, y: p2.y - ((p3.y - p1.y) / 6) * k * 2 };
      d += ' C' + [c1.x, c1.y, c2.x, c2.y, p2.x, p2.y].map(f).join(' ');
    }
    return d + ' Z';
  }
  function interp(nodes, y) {
    if (y <= nodes[0][0]) return nodes[0][1];
    for (let i = 1; i < nodes.length; i++) {
      if (y <= nodes[i][0]) {
        const [y0, v0] = nodes[i - 1], [y1, v1] = nodes[i];
        return lerp(v0, v1, (y - y0) / (y1 - y0 || 1));
      }
    }
    return nodes[nodes.length - 1][1];
  }

  /** Puntos clave del cuerpo a partir de las medidas. */
  function geometry(body) {
    const h = body.height;
    const bf = clamp(body.bmi - 22, -6, 18);
    const G = {
      h,
      chin: 0.13 * h,
      hps: 0.163 * h,
      shoulderY: 0.183 * h,
      armpitY: 0.24 * h,
      chestY: 0.275 * h,
      waistY: 0.385 * h,
      hipY: 0.49 * h,
      crotchY: h - body.inseam,
      floorY: h,
      ankleY: h - 0.045 * h,
      cw: body.chest / 5.8,
      ww: body.waist / 5.8,
      hw: body.hip / 5.8,
      sh: body.shoulder / 2,
      neckHalf: 0.03 * h * (1 + bf * 0.012),
      headRx: 0.046 * h,
      headRy: 0.066 * h,
      headCy: 0.067 * h,
      uaHalf: 0.024 * h * (1 + bf * 0.03),
      waHalf: 0.0115 * h * (1 + bf * 0.012),
      handLen: 0.1 * h,
      armLen: body.armLen,
    };
    G.crotchY = Math.max(G.crotchY, G.hipY + 3);
    G.kneeY = G.crotchY + (G.ankleY - G.crotchY) * 0.47;
    G.calfY = G.kneeY + (G.ankleY - G.kneeY) * 0.3;
    G.A = { x: G.sh - G.uaHalf * 0.8, y: G.shoulderY + G.uaHalf * 0.55 };
    G.W = { x: G.A.x + 0.042 * h, y: G.A.y + body.armLen };
    const len = Math.hypot(G.W.x - G.A.x, G.W.y - G.A.y);
    G.d = { x: (G.W.x - G.A.x) / len, y: (G.W.y - G.A.y) / len };
    G.n = { x: G.d.y, y: -G.d.x }; // normal hacia afuera (lado derecho)
    G.armAt = (t) => add(G.A, mul(G.d, t));
    G.armHalf = (t) => lerp(G.uaHalf, G.waHalf, clamp(t / body.armLen, 0, 1)) * (t < body.armLen * 0.45 ? 1 : 1);
    const hw = G.hw;
    G.torsoNodes = [
      [G.shoulderY, G.sh], [G.armpitY, G.cw * 1.02], [G.chestY, G.cw], [G.waistY, G.ww],
      [G.hipY, hw], [G.crotchY, hw * 0.97],
    ];
    G.torsoHalfAt = (y) => interp(G.torsoNodes, y);
    const kneeHalf = Math.max(hw * 0.27, 0.027 * h);
    G.legNodesC = [[G.hipY, hw * 0.5], [G.crotchY, hw * 0.49], [G.kneeY, hw * 0.43], [G.calfY, hw * 0.41], [G.ankleY, hw * 0.38]];
    G.legNodesH = [[G.hipY, hw * 0.5], [G.crotchY, hw * 0.48], [G.kneeY, kneeHalf], [G.calfY, kneeHalf * 1.03], [G.ankleY, 0.016 * h]];
    G.legAt = (y) => ({ c: interp(G.legNodesC, y), half: interp(G.legNodesH, y) });
    return G;
  }

  // ---------------------------------------------------------------- cuerpo
  function drawArm(G, skin, skinDark) {
    const L = G.armLen, el = L * 0.48;
    const pts = [
      add(G.A, mul(G.d, -G.uaHalf * 0.85)),
      add(G.A, mul(G.n, G.uaHalf)),
      add(G.armAt(el), mul(G.n, G.armHalf(el) * 0.92)),
      add(G.W, mul(G.n, G.waHalf)),
      add(G.W, mul(G.n, -G.waHalf)),
      add(G.armAt(el), mul(G.n, -G.armHalf(el) * 0.9)),
      add(G.A, mul(G.n, -G.uaHalf)),
    ];
    const hc = add(G.W, mul(G.d, G.handLen * 0.45));
    const ang = (Math.atan2(G.d.y, G.d.x) * 180) / Math.PI - 90;
    return (
      '<path d="' + smooth(pts, 0.45) + '" fill="' + skin + '" stroke="' + skinDark + '" stroke-width="0.25"/>' +
      '<ellipse cx="' + f(hc.x) + '" cy="' + f(hc.y) + '" rx="' + f(G.waHalf * 1.3) + '" ry="' + f(G.handLen * 0.5) +
      '" transform="rotate(' + f(ang) + ' ' + f(hc.x) + ' ' + f(hc.y) + ')" fill="' + skin + '" stroke="' + skinDark + '" stroke-width="0.25"/>'
    );
  }

  function drawBody(G, skin) {
    const dark = shade(skin, -0.22);
    const right = [
      { x: G.neckHalf, y: G.hps - 1 },
      { x: G.sh * 0.72, y: G.shoulderY - 0.4 },
      { x: G.sh, y: G.shoulderY + 1.8 },
      { x: G.cw * 1.02, y: G.armpitY },
      { x: G.cw, y: G.chestY },
      { x: G.ww, y: G.waistY },
      { x: G.hw, y: G.hipY },
      { x: G.hw * 0.96, y: G.crotchY },
    ];
    const torso = right.concat([{ x: 0, y: G.crotchY + 0.6 }], right.slice().reverse().map(mirror));
    const l = (y) => G.legAt(y);
    const legR = [
      { x: G.hw * 0.99, y: G.hipY + 2 },
      { x: l(G.kneeY).c + l(G.kneeY).half, y: G.kneeY },
      { x: l(G.calfY).c + l(G.calfY).half, y: G.calfY },
      { x: l(G.ankleY).c + l(G.ankleY).half, y: G.ankleY },
      { x: l(G.ankleY).c - l(G.ankleY).half, y: G.ankleY },
      { x: l(G.calfY).c - l(G.calfY).half * 0.95, y: G.calfY },
      { x: l(G.kneeY).c - l(G.kneeY).half, y: G.kneeY },
      { x: 0.5, y: G.crotchY - 0.5 },
    ];
    const leg = '<path d="' + smooth(legR, 0.45) + '" fill="' + skin + '" stroke="' + dark + '" stroke-width="0.25"/>';
    const neck = '<rect x="' + f(-G.neckHalf) + '" y="' + f(G.chin - 3) + '" width="' + f(G.neckHalf * 2) + '" height="' + f(G.hps - G.chin + 4) + '" rx="1.5" fill="' + skin + '"/>';
    const shoeTop = G.ankleY + 0.3, a = G.legAt(G.ankleY);
    const shoeR = '<path d="M' + f(a.c - a.half - 0.6) + ' ' + f(shoeTop) + ' L' + f(a.c + a.half + 0.4) + ' ' + f(shoeTop) +
      ' Q' + f(a.c + a.half + 3.2) + ' ' + f(G.floorY - 2.5) + ' ' + f(a.c + a.half + 3) + ' ' + f(G.floorY) +
      ' L' + f(a.c - a.half - 1) + ' ' + f(G.floorY) + ' Z" fill="#2b2b2e"/>';
    return {
      back: neck,
      main: '<path d="' + smooth(torso, 0.42) + '" fill="' + skin + '" stroke="' + dark + '" stroke-width="0.25"/>' +
        leg + '<g transform="scale(-1,1)">' + leg + '</g>',
      shoes: shoeR + '<g transform="scale(-1,1)">' + shoeR + '</g>',
      arms: drawArm(G, skin, dark) + '<g transform="scale(-1,1)">' + drawArm(G, skin, dark) + '</g>',
    };
  }

  function drawHead(G, skin, photo, id) {
    const dark = shade(skin, -0.22);
    const cx = 0, cy = G.headCy, rx = G.headRx, ry = G.headRy;
    let s = '<ellipse cx="' + f(-rx * 0.98) + '" cy="' + f(cy + 1) + '" rx="1.6" ry="2.8" fill="' + skin + '" stroke="' + dark + '" stroke-width="0.2"/>' +
      '<ellipse cx="' + f(rx * 0.98) + '" cy="' + f(cy + 1) + '" rx="1.6" ry="2.8" fill="' + skin + '" stroke="' + dark + '" stroke-width="0.2"/>' +
      '<ellipse cx="' + cx + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="' + skin + '" stroke="' + dark + '" stroke-width="0.25"/>';
    if (photo && photo.src) {
      const prx = rx * 1.14, pry = ry * 1.12, pcy = cy - ry * 0.04;
      const z = photo.zoom || 1;
      const w = prx * 2 * z * 1.15, hh = pry * 2 * z * 1.15;
      const x = -w / 2 + (photo.x || 0) * w * 0.5, y = pcy - hh / 2 + (photo.y || 0) * hh * 0.5;
      s += '<clipPath id="' + id + 'face"><ellipse cx="0" cy="' + f(pcy) + '" rx="' + f(prx) + '" ry="' + f(pry) + '"/></clipPath>' +
        '<image href="' + photo.src + '" x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(hh) +
        '" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + id + 'face)"/>' +
        '<ellipse cx="0" cy="' + f(pcy) + '" rx="' + f(prx) + '" ry="' + f(pry) + '" fill="none" stroke="' + dark + '" stroke-width="0.3" opacity="0.5"/>';
    } else {
      const hair = '#2e2420';
      s += '<path d="M' + f(-rx * 1.02) + ' ' + f(cy - ry * 0.05) + ' Q' + f(-rx * 1.1) + ' ' + f(cy - ry * 1.15) + ' 0 ' + f(cy - ry * 1.04) +
        ' Q' + f(rx * 1.1) + ' ' + f(cy - ry * 1.15) + ' ' + f(rx * 1.02) + ' ' + f(cy - ry * 0.05) +
        ' Q' + f(rx * 0.8) + ' ' + f(cy - ry * 0.62) + ' 0 ' + f(cy - ry * 0.6) + ' Q' + f(-rx * 0.8) + ' ' + f(cy - ry * 0.62) + ' ' + f(-rx * 1.02) + ' ' + f(cy - ry * 0.05) + ' Z" fill="' + hair + '"/>' +
        '<ellipse cx="' + f(-rx * 0.38) + '" cy="' + f(cy + ry * 0.02) + '" rx="0.9" ry="1.1" fill="#2a2a2a"/>' +
        '<ellipse cx="' + f(rx * 0.38) + '" cy="' + f(cy + ry * 0.02) + '" rx="0.9" ry="1.1" fill="#2a2a2a"/>' +
        '<path d="M' + f(-rx * 0.3) + ' ' + f(cy + ry * 0.45) + ' Q0 ' + f(cy + ry * 0.62) + ' ' + f(rx * 0.3) + ' ' + f(cy + ry * 0.45) + '" fill="none" stroke="' + shade(skin, -0.45) + '" stroke-width="0.5" stroke-linecap="round"/>';
    }
    return s;
  }

  // -------------------------------------------------------------- prendas
  function topGeometry(G, body, m) {
    const e = m.chest - body.chest;
    const gChest = e >= 0 ? G.cw + 0.35 + e / 4.2 : G.cw + 0.2;
    const hemY = G.hps + m.length;
    const gHem = Math.max(gChest * 0.98, G.torsoHalfAt(hemY) + 0.45);
    const gWaist = Math.max(lerp(gChest, gHem, 0.55), G.torsoHalfAt(G.waistY) + 0.4);
    const drop = m.shoulder / 2 - G.sh;
    const neckOuter = G.neckHalf + 1.1;
    let seam;
    if (drop > 0.5) seam = add(add(G.A, mul(G.n, G.armHalf(drop) + 0.35)), mul(G.d, drop * 0.9));
    else seam = add(add(G.A, mul(G.n, G.uaHalf + 0.5 + Math.min(drop, 0) * 0.3)), mul(G.d, -G.uaHalf * 0.75));
    const underarm = { x: gChest + 0.2, y: G.armpitY + 1 + Math.max(0, e) / 10 + Math.max(0, drop) * 0.45 };
    const tEnd = clamp(m.sleeve + drop, 4, G.armLen + G.handLen * 0.75);
    return { e, gChest, hemY, gHem, gWaist, drop, neckOuter, seam, underarm, tEnd };
  }

  function sleevePath(G, T, kind, m) {
    const long = m.sleeve > 35;
    const loose = Math.max(T.e, 0);
    let endExtra = long ? 0.8 + loose / 16 : 1.7 + loose / 9;
    if (long && (kind === 'sweater' || kind === 'hoodie')) endExtra = 0.5;
    if (kind === 'jacket') endExtra = 1.2 + loose / 14;
    const startExtra = (long ? 1 : 1.7) + loose / 10 + Math.max(0, T.drop) * 0.15;
    const t0 = Math.max(T.drop, 0) * 0.9;
    const N = long ? 4 : 2;
    const outer = [], inner = [];
    for (let i = 0; i <= N; i++) {
      const t = lerp(t0, T.tEnd, i / N);
      const hh = G.armHalf(Math.min(t, G.armLen)) + lerp(startExtra, endExtra, i / N);
      const p = G.armAt(t);
      outer.push(add(p, mul(G.n, hh)));
      inner.unshift(add(p, mul(G.n, -hh)));
    }
    // Copa de la manga: cubre el hombro hasta la costura
    const cap = add(G.armAt(Math.min(t0, 0) - G.uaHalf * 1.2), mul(G.n, -G.uaHalf * 0.3));
    const pts = T.drop > 0.5
      ? [cap, add(G.armAt(-G.uaHalf * 0.2), mul(G.n, G.uaHalf + 0.6))].concat(outer, inner)
      : [T.seam].concat(outer, inner, [cap]);
    const E = G.armAt(T.tEnd);
    const he = G.armHalf(Math.min(T.tEnd, G.armLen)) + endExtra;
    return { d: poly(pts), E, he, outerEnd: outer[outer.length - 1], innerEnd: inner[0] };
  }

  function drawTop(G, body, product, m, color, id) {
    const c = color.hex, line = shade(c, isLight(c) ? -0.28 : 0.22), T = topGeometry(G, body, m);
    const kind = product.kind;
    const right = [
      { x: T.neckOuter, y: G.hps - 0.3 },
      { x: G.sh * 0.75, y: G.shoulderY - 0.1 },
    ];
    if (T.drop > 0.5) right.push({ x: G.sh + 0.3, y: G.shoulderY + 1.4 });
    right.push(T.seam, T.underarm, { x: T.gChest, y: G.chestY + 1.5 }, { x: T.gWaist, y: G.waistY });
    if (kind === 'shirt') right.push({ x: T.gHem, y: T.hemY - 3 }, { x: T.gHem * 0.55, y: T.hemY - 0.8 });
    else right.push({ x: T.gHem, y: T.hemY });
    const neckDepth = kind === 'shirt' ? 3.2 : kind === 'jacket' ? 1.5 : G.h * 0.022;
    const torsoPts = right.concat(right.slice().reverse().map(mirror));
    // neckline: from left neck to right neck via dip
    const neckD = 'M' + f(-T.neckOuter) + ' ' + f(G.hps - 0.3) + ' Q0 ' + f(G.hps + neckDepth * 2) + ' ' + f(T.neckOuter) + ' ' + f(G.hps - 0.3);
    const torsoD = poly(torsoPts.slice(0, right.length)).replace(' Z', '') + ' L' +
      right.slice().reverse().map(mirror).map((p) => f(p.x) + ' ' + f(p.y)).join(' L') +
      ' Q0 ' + f(G.hps + neckDepth * 2) + ' ' + f(T.neckOuter) + ' ' + f(G.hps - 0.3) + ' Z';
    const S = sleevePath(G, T, kind, m);
    const st = ' stroke="' + line + '" stroke-width="0.28" stroke-linejoin="round"';
    let torso = '<path d="' + torsoD + '" fill="' + c + '"' + st + '/>' +
      '<path d="' + torsoD + '" fill="url(#' + id + 'shade)"/>';
    let sleeve = '<path d="' + S.d + '" fill="' + c + '"' + st + '/><path d="' + S.d + '" fill="url(#' + id + 'shade)"/>';
    let details = '';
    const L = (x1, y1, x2, y2, w = 0.22, col = line, extra = '') =>
      '<line x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) + '" stroke="' + col + '" stroke-width="' + w + '"' + extra + '/>';
    const halfAt = (y) => interp([[G.armpitY, T.gChest], [G.chestY, T.gChest], [G.waistY, T.gWaist], [T.hemY, T.gHem]], y);

    // ribs / cuffs
    if (kind === 'sweater' || kind === 'hoodie') {
      const bandTop = T.hemY - 4.5;
      details += '<path d="M' + f(-halfAt(bandTop)) + ' ' + f(bandTop) + ' L' + f(halfAt(bandTop)) + ' ' + f(bandTop) + '" stroke="' + line + '" stroke-width="0.3"/>';
      for (let x = -halfAt(bandTop) + 1; x < halfAt(bandTop); x += 1.4) details += L(x, bandTop + 0.4, x, T.hemY - 0.3, 0.12);
      if (m.sleeve > 35) {
        const p1 = add(S.E, mul(G.d, -5)), a = add(p1, mul(G.n, S.he)), b = add(p1, mul(G.n, -S.he));
        sleeve += L(a.x, a.y, b.x, b.y, 0.3);
      }
    }
    if (kind === 'tee' || kind === 'sweater' || kind === 'hoodie') {
      details += '<path d="' + neckD + '" fill="none" stroke="' + line + '" stroke-width="1"/>';
    }
    if (kind === 'shirt') {
      details += L(0, G.hps + neckDepth * 1.5, 0, T.hemY - 0.8, 0.25);
      for (let y = G.hps + 6, i = 0; y < T.hemY - 4 && i < 8; y += (T.hemY - G.hps) / 7, i++)
        details += '<circle cx="0.9" cy="' + f(y) + '" r="0.45" fill="' + shade(c, -0.15) + '" stroke="' + line + '" stroke-width="0.1"/>';
      const collar = (s) => '<path d="M' + f(s * 0.2) + ' ' + f(G.hps + neckDepth * 1.6) + ' L' + f(s * (T.neckOuter + 1.2)) + ' ' + f(G.hps - 1.5) +
        ' L' + f(s * (T.neckOuter + 2.2)) + ' ' + f(G.hps + 2.8) + ' Z" fill="' + shade(c, isLight(c) ? -0.04 : 0.05) + '"' + st + '/>';
      details += collar(1) + collar(-1);
      if (m.sleeve > 35) {
        const p1 = add(S.E, mul(G.d, -6)), a = add(p1, mul(G.n, S.he)), b = add(p1, mul(G.n, -S.he));
        sleeve += L(a.x, a.y, b.x, b.y, 0.25);
      }
    }
    if (kind === 'hoodie') {
      const no = T.neckOuter;
      details = '<path d="M' + f(-no - 3.2) + ' ' + f(G.hps + 2.5) + ' Q' + f(-no - 4) + ' ' + f(G.hps - 6) + ' ' + f(-G.headRx * 0.5) + ' ' + f(G.chin - 2) +
        ' L' + f(G.headRx * 0.5) + ' ' + f(G.chin - 2) + ' Q' + f(no + 4) + ' ' + f(G.hps - 6) + ' ' + f(no + 3.2) + ' ' + f(G.hps + 2.5) +
        ' Q0 ' + f(G.hps + 9) + ' ' + f(-no - 3.2) + ' ' + f(G.hps + 2.5) + ' Z" fill="' + shade(c, -0.08) + '"' + st + '/>' + details +
        L(-1.4, G.hps + 4.5, -1.8, G.hps + 15, 0.35, shade(c, isLight(c) ? -0.4 : 0.45)) +
        L(1.4, G.hps + 4.5, 1.8, G.hps + 15, 0.35, shade(c, isLight(c) ? -0.4 : 0.45));
      const py1 = T.hemY - 20, py2 = T.hemY - 5.5, pw1 = Math.min(halfAt(py1) * 0.55, 11), pw2 = Math.min(halfAt(py2) * 0.72, 15);
      details += '<path d="M' + f(-pw1) + ' ' + f(py1) + ' L' + f(pw1) + ' ' + f(py1) + ' L' + f(pw2) + ' ' + f(py2) + ' L' + f(-pw2) + ' ' + f(py2) + ' Z" fill="none" stroke="' + line + '" stroke-width="0.3"/>';
    }
    if (kind === 'jacket') {
      for (let y = G.chestY - 4; y < T.hemY - 2; y += 6.5) {
        const hx = halfAt(y) - 0.3;
        details += '<path d="M' + f(-hx) + ' ' + f(y) + ' Q0 ' + f(y + 1.2) + ' ' + f(hx) + ' ' + f(y) + '" fill="none" stroke="' + line + '" stroke-width="0.22"/>';
      }
      for (let t = T.drop + 7; t < T.tEnd - 2; t += 6.5) {
        const p = G.armAt(t), hh = G.armHalf(Math.min(t, G.armLen)) + 1.1 + Math.max(T.e, 0) / 14;
        const a = add(p, mul(G.n, hh)), b = add(p, mul(G.n, -hh));
        sleeve += L(a.x, a.y, b.x, b.y, 0.22);
      }
      details += L(0, G.hps + 1, 0, T.hemY, 0.45, shade(c, -0.35));
      details += '<path d="M' + f(-T.neckOuter - 0.6) + ' ' + f(G.hps - 3) + ' L' + f(T.neckOuter + 0.6) + ' ' + f(G.hps - 3) + ' L' + f(T.neckOuter + 0.9) + ' ' + f(G.hps + 1.6) +
        ' Q0 ' + f(G.hps + 2.8) + ' ' + f(-T.neckOuter - 0.9) + ' ' + f(G.hps + 1.6) + ' Z" fill="' + shade(c, -0.06) + '"' + st + '/>';
    }

    // Indicadores de tensión (prenda apretada) o tela sobrante
    const target = product.ease?.chest ?? 8;
    if (T.e < -1) {
      for (let i = 0; i < 3; i++) {
        const y = G.chestY - 1 + i * 3.2, hx = T.gChest - 1.5;
        details += '<path d="M' + f(-hx) + ' ' + f(y) + ' Q0 ' + f(y + 2) + ' ' + f(hx) + ' ' + f(y) + '" fill="none" stroke="#c0392b" stroke-width="0.35" stroke-dasharray="1.2 0.8" opacity="0.85"/>';
      }
    } else if (T.e - target > 9) {
      for (const s of [1, -1]) {
        details += '<path d="M' + f(s * (T.gChest - 2.5)) + ' ' + f(G.armpitY + 4) + ' Q' + f(s * (T.gChest - 4)) + ' ' + f(G.waistY) + ' ' + f(s * (T.gHem - 2)) + ' ' + f(T.hemY - 1) + '" fill="none" stroke="' + line + '" stroke-width="0.22" opacity="0.7"/>';
      }
    }
    return {
      torso: torso + details,
      sleeves: sleeve + '<g transform="scale(-1,1)">' + sleeve + '</g>',
      bbox: { y0: G.hps - 6, y1: T.hemY + 3, x: Math.max(T.gChest, S.outerEnd.x) + 3 },
    };
  }

  function drawBottom(G, body, product, m, color, id) {
    const c = color.hex, line = shade(c, isLight(c) ? -0.28 : 0.22);
    const kind = product.kind;
    let wbY = Math.max(G.crotchY - m.rise, G.waistY - 3);
    const bodyWb = G.torsoHalfAt(wbY);
    const wE = m.waist - body.waist;
    const gWb = wE >= 0 ? bodyWb + 0.3 + wE / 6 : bodyWb + 0.15;
    const hE = m.hip - body.hip;
    const gHip = Math.max(G.torsoHalfAt(G.hipY) + 0.35 + Math.max(0, hE) / 4.5, gWb);
    const maxHem = G.floorY - 1.2;
    const rawHem = G.crotchY + m.inseam;
    const tooLong = rawHem - maxHem;
    const hemY = Math.min(rawHem, maxHem);
    const legEase = Math.max(0, hE) / 9 + 0.4;
    const la = G.legAt(hemY);
    let hemHalf = Math.max(la.half + 0.45, (m.opening || 0) / 2.6);
    if (tooLong > 0) hemHalf += Math.min(tooLong, 10) * 0.12;
    const tY = G.crotchY + 3, lt = G.legAt(tY);
    const thighHalf = lt.half + legEase + 0.5;
    const right = [{ x: gWb, y: wbY }, { x: gHip, y: G.hipY }, { x: Math.min(lt.c + thighHalf, gHip + 0.5), y: tY }];
    const inner = [];
    if (hemY > G.kneeY + 2) {
      const lk = G.legAt(G.kneeY);
      const kneeHalf = Math.max(lk.half + legEase * 0.6 + 0.35, lerp(thighHalf, hemHalf, 0.55));
      right.push({ x: lk.c + kneeHalf, y: G.kneeY });
      inner.push({ x: Math.max(lk.c - kneeHalf, 0.5), y: G.kneeY });
    }
    right.push({ x: la.c + hemHalf, y: hemY }, { x: Math.max(la.c - hemHalf, 0.5), y: hemY });
    const crotchInner = { x: Math.max(lt.c - thighHalf, 0.35), y: tY };
    const half = right.concat(inner.reverse(), [crotchInner, { x: 0, y: G.crotchY + 1.2 }]);
    const full = half.concat(half.slice(0, -1).reverse().map(mirror));
    const d = poly(full);
    const st = ' stroke="' + line + '" stroke-width="0.28" stroke-linejoin="round"';
    let s = '<path d="' + d + '" fill="' + c + '"' + st + '/><path d="' + d + '" fill="url(#' + id + 'shadeV)"/>';
    // pretina
    const bandH = 3.6, bh = G.torsoHalfAt(wbY + bandH);
    const bandW = wE >= 0 ? bh + 0.3 + wE / 6 : bh + 0.15;
    s += '<path d="M' + f(-gWb) + ' ' + f(wbY) + ' L' + f(gWb) + ' ' + f(wbY) + ' L' + f(bandW) + ' ' + f(wbY + bandH) + ' L' + f(-bandW) + ' ' + f(wbY + bandH) + ' Z" fill="' + shade(c, -0.05) + '"' + st + '/>';
    const stitch = kind === 'jeans' ? '#d9a441' : line;
    if (kind === 'jeans' || kind === 'pants') {
      for (const x of [-gWb * 0.7, -gWb * 0.15, gWb * 0.15, gWb * 0.7])
        s += '<rect x="' + f(x - 0.5) + '" y="' + f(wbY - 0.3) + '" width="1" height="' + f(bandH + 0.8) + '" fill="' + shade(c, -0.12) + '"/>';
      s += '<path d="M0.4 ' + f(wbY + bandH) + ' L0.4 ' + f(G.crotchY - 3) + ' Q0.4 ' + f(G.crotchY) + ' -1.6 ' + f(G.crotchY - 1) + '" fill="none" stroke="' + stitch + '" stroke-width="0.25" stroke-dasharray="0.7 0.5"/>';
      for (const sgn of [1, -1]) {
        const x0 = sgn * gWb * 0.45, x1 = sgn * (G.torsoHalfAt(wbY + 11) + 0.2);
        s += '<path d="M' + f(x0) + ' ' + f(wbY + bandH) + ' Q' + f(x0 + sgn * 1.5) + ' ' + f(wbY + 10) + ' ' + f(x1) + ' ' + f(wbY + 11) + '" fill="none" stroke="' + stitch + '" stroke-width="0.25"' + (kind === 'jeans' ? ' stroke-dasharray="0.7 0.5"' : '') + '/>';
      }
      if (kind === 'pants') {
        const lk = G.legAt(G.kneeY);
        for (const sgn of [1, -1]) s += '<line x1="' + f(sgn * lt.c) + '" y1="' + f(G.hipY + 2) + '" x2="' + f(sgn * la.c) + '" y2="' + f(hemY - 0.5) + '" stroke="' + line + '" stroke-width="0.18" opacity="0.6"/>';
        void lk;
      }
    }
    if (kind === 'shorts') {
      for (let x = -gWb + 1; x < gWb; x += 1.6) s += '<line x1="' + f(x) + '" y1="' + f(wbY + 0.4) + '" x2="' + f(x) + '" y2="' + f(wbY + bandH - 0.3) + '" stroke="' + line + '" stroke-width="0.12"/>';
      s += '<path d="M-1 ' + f(wbY + bandH) + ' q-0.5 5 -1.4 7 M1 ' + f(wbY + bandH) + ' q0.5 5 1.4 7" fill="none" stroke="' + shade(c, isLight(c) ? -0.4 : 0.45) + '" stroke-width="0.35"/>';
    }
    if (tooLong > 0.5) {
      for (const sgn of [1, -1]) for (let i = 1; i <= Math.min(3, Math.ceil(tooLong / 3)); i++) {
        const y = hemY - i * 2.4;
        const a = G.legAt(y);
        s += '<path d="M' + f(sgn * (la.c - hemHalf + 0.3)) + ' ' + f(y) + ' q' + f(sgn * hemHalf * 0.6) + ' 1.4 ' + f(sgn * (hemHalf * 2 - 0.6)) + ' 0" fill="none" stroke="' + line + '" stroke-width="0.25"/>';
        void a;
      }
    }
    if (wE < -(product.elastic || 0) - 1 || hE < -1) {
      for (let i = 0; i < 3; i++) {
        const y = G.hipY - 3 + i * 3, hx = G.torsoHalfAt(y) - 1;
        s += '<path d="M' + f(-hx) + ' ' + f(y) + ' Q0 ' + f(y + 1.6) + ' ' + f(hx) + ' ' + f(y) + '" fill="none" stroke="#c0392b" stroke-width="0.35" stroke-dasharray="1.2 0.8" opacity="0.85"/>';
      }
    }
    return { svg: s, bbox: { y0: wbY - 3, y1: hemY + 3, x: Math.max(gHip, la.c + hemHalf) + 3 } };
  }

  /**
   * Renderiza el avatar con un outfit.
   * outfit = { top: {product, size, color}, bottom: {product, size, color} }
   * opts = { skin, photo, garmentOnly, crop: 'top'|'bottom', showGrid }
   */
  PV.renderAvatar = function (body, outfit, opts = {}) {
    const id = 'pv' + ++uid;
    const G = geometry(body);
    const skin = opts.skin || '#e0b48f';
    const B = drawBody(G, skin);
    let top = null, bottom = null;
    if (outfit.bottom) {
      const ob = outfit.bottom, m = PV.measurementsFor(ob.product, ob.size);
      if (m) bottom = drawBottom(G, body, ob.product, m, ob.color, id);
    }
    if (outfit.top) {
      const ot = outfit.top, m = PV.measurementsFor(ot.product, ot.size);
      if (m) top = drawTop(G, body, ot.product, m, ot.color, id);
    }
    const defs = '<defs>' +
      '<linearGradient id="' + id + 'shade" x1="0" x2="1" y1="0" y2="0">' +
      '<stop offset="0" stop-color="#000" stop-opacity="0.16"/><stop offset="0.3" stop-color="#fff" stop-opacity="0.07"/>' +
      '<stop offset="0.7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></linearGradient>' +
      '<linearGradient id="' + id + 'shadeV" x1="0" x2="1" y1="0" y2="0">' +
      '<stop offset="0" stop-color="#000" stop-opacity="0.15"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.06"/>' +
      '<stop offset="0.55" stop-color="#000" stop-opacity="0.04"/><stop offset="1" stop-color="#000" stop-opacity="0.16"/></linearGradient>' +
      '</defs>';
    let vb, content;
    if (opts.garmentOnly) {
      const bb = (opts.crop === 'bottom' ? bottom : top)?.bbox;
      const g = opts.crop === 'bottom' ? (bottom ? bottom.svg : '') : top ? top.torso + top.sleeves : '';
      const half = bb ? bb.x : G.h * 0.3, y0 = bb ? bb.y0 : 0, y1 = bb ? bb.y1 : G.h;
      const size = Math.max(half * 2, y1 - y0);
      vb = [-size / 2, (y0 + y1) / 2 - size / 2, size, size];
      content = g;
    } else {
      const w = G.h * 0.62;
      vb = [-w / 2, -3, w, G.h + 5];
      content =
        '<ellipse cx="0" cy="' + f(G.floorY) + '" rx="' + f(G.hw * 1.5) + '" ry="1.6" fill="#000" opacity="0.12"/>' +
        B.back + B.main + B.shoes + (bottom ? bottom.svg : '') + (top ? top.torso : '') + B.arms + (top ? top.sleeves : '') +
        drawHead(G, skin, opts.photo, id);
      if (opts.showGrid) {
        let g = '';
        for (let y = 0; y <= G.h; y += 10) g += '<line x1="' + f(-w / 2) + '" y1="' + y + '" x2="' + f(-w / 2 + 2.5) + '" y2="' + y + '" stroke="#999" stroke-width="0.2"/>' +
          (y % 50 === 0 ? '<text x="' + f(-w / 2 + 3) + '" y="' + f(y + 1) + '" font-size="2.6" fill="#999">' + (G.h - y) + '</text>' : '');
        content = g + content;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.map(f).join(' ') + '" class="avatar-svg" role="img" aria-label="Avatar con la prenda">' + defs + content + '</svg>';
  };
})();
