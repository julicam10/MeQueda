/*
 * Catálogo de demostración inspirado en prendas básicas de Uniqlo USA.
 *
 * Las medidas son de la PRENDA (no del cuerpo), en centímetros, y son
 * aproximaciones para la demo. Para precisión real, copia la tabla de tallas
 * del producto con "Agregar prenda".
 *
 * Cada producto define:
 *  - base: medidas de la prenda en una talla de referencia
 *  - grade: cuánto cambia cada medida por cada "paso" de talla
 *    (en tallas de letra 1 paso = 1 talla; en tallas de pulgada 1 paso = 1")
 *  - ease: holgura de diseño en cm (prenda - cuerpo) para que quede "como fue diseñada"
 *  - refHeight: altura (cm) de la persona de referencia para la talla base
 *
 * Para añadir otra tienda, agrega un objeto a STORES y productos con su `store`.
 */
(function () {
  const PV = (window.PV = window.PV || {});

  const LETTERS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  const inchSizes = (from, to, step = 1) => {
    const out = [];
    for (let i = from; i <= to; i += step) out.push(String(i));
    return out;
  };

  PV.STORES = {
    'uniqlo-us': {
      id: 'uniqlo-us',
      name: 'Uniqlo USA',
      currency: 'USD',
      searchUrl: (q) => 'https://www.uniqlo.com/us/en/search?q=' + encodeURIComponent(q),
    },
  };

  const C = {
    white: { name: 'Blanco', hex: '#f4f4f2' },
    black: { name: 'Negro', hex: '#222326' },
    navy: { name: 'Azul marino', hex: '#253553' },
    gray: { name: 'Gris', hex: '#9a9ca0' },
    olive: { name: 'Oliva', hex: '#5f6544' },
    beige: { name: 'Beige', hex: '#d8c7a8' },
    blue: { name: 'Azul', hex: '#7ea3cf' },
    red: { name: 'Rojo', hex: '#b23a3a' },
    brown: { name: 'Café', hex: '#7a5638' },
    pink: { name: 'Rosa', hex: '#e7b9c0' },
    denim: { name: 'Denim', hex: '#3d5a80' },
    lightDenim: { name: 'Denim claro', hex: '#7b98b8' },
    cream: { name: 'Crema', hex: '#efe6d2' },
    green: { name: 'Verde', hex: '#3d6b55' },
  };

  PV.CATALOG = [
    // ---------------- HOMBRE ----------------
    {
      id: 'm-supima-crew',
      store: 'uniqlo-us', gender: 'men', category: 'top', kind: 'tee',
      name: 'Supima Cotton Crew Neck T-Shirt',
      fitLabel: 'Regular', price: 14.9,
      colors: [C.white, C.black, C.navy, C.gray, C.olive],
      sizes: LETTERS, refHeight: 175,
      base: { size: 'M', chest: 104, length: 70, shoulder: 45, sleeve: 20 },
      grade: { chest: 6, length: 2, shoulder: 1.6, sleeve: 0.7 },
      ease: { chest: 7 },
    },
    {
      id: 'm-airism-oversized',
      store: 'uniqlo-us', gender: 'men', category: 'top', kind: 'tee',
      name: 'AIRism Cotton Oversized Crew Neck T-Shirt',
      fitLabel: 'Oversized', price: 19.9,
      colors: [C.black, C.white, C.beige, C.olive],
      sizes: LETTERS, refHeight: 175,
      base: { size: 'M', chest: 118, length: 72, shoulder: 54, sleeve: 24 },
      grade: { chest: 6, length: 2, shoulder: 2, sleeve: 1 },
      ease: { chest: 21 },
    },
    {
      id: 'm-oxford-shirt',
      store: 'uniqlo-us', gender: 'men', category: 'top', kind: 'shirt',
      name: 'Oxford Shirt Regular Fit Long Sleeve',
      fitLabel: 'Regular', price: 39.9,
      colors: [C.blue, C.white, C.pink],
      sizes: LETTERS, refHeight: 175,
      base: { size: 'M', chest: 110, length: 76, shoulder: 46, sleeve: 61 },
      grade: { chest: 6, length: 2, shoulder: 1.5, sleeve: 1.5 },
      ease: { chest: 12 },
    },
    {
      id: 'm-merino-crew',
      store: 'uniqlo-us', gender: 'men', category: 'top', kind: 'sweater',
      name: 'Extra Fine Merino Crew Neck Sweater',
      fitLabel: 'Slim', price: 39.9,
      colors: [C.navy, C.gray, C.green, C.brown],
      sizes: LETTERS, refHeight: 175,
      base: { size: 'M', chest: 102, length: 66, shoulder: 44, sleeve: 61 },
      grade: { chest: 5, length: 2, shoulder: 1.5, sleeve: 1.5 },
      ease: { chest: 4 },
    },
    {
      id: 'm-sweat-hoodie',
      store: 'uniqlo-us', gender: 'men', category: 'top', kind: 'hoodie',
      name: 'Sweat Pullover Hoodie',
      fitLabel: 'Relaxed', price: 39.9,
      colors: [C.gray, C.black, C.cream, C.olive],
      sizes: LETTERS, refHeight: 175,
      base: { size: 'M', chest: 116, length: 68, shoulder: 50, sleeve: 60 },
      grade: { chest: 6, length: 2, shoulder: 2, sleeve: 1.5 },
      ease: { chest: 18 },
    },
    {
      id: 'm-uld-jacket',
      store: 'uniqlo-us', gender: 'men', category: 'top', kind: 'jacket',
      name: 'Ultra Light Down Jacket',
      fitLabel: 'Regular', price: 69.9,
      colors: [C.black, C.navy, C.olive, C.beige],
      sizes: LETTERS, refHeight: 175,
      base: { size: 'M', chest: 108, length: 68, shoulder: 45, sleeve: 62 },
      grade: { chest: 6, length: 2, shoulder: 1.5, sleeve: 1.5 },
      ease: { chest: 10 },
    },
    {
      id: 'm-selvedge-jeans',
      store: 'uniqlo-us', gender: 'men', category: 'bottom', kind: 'jeans',
      name: 'Selvedge Regular Fit Jeans',
      fitLabel: 'Regular', price: 49.9,
      colors: [C.denim, C.lightDenim, C.black],
      sizes: inchSizes(28, 40), sizeUnit: 'in', refHeight: 175,
      base: { size: '32', waist: 83, hip: 101, inseam: 79, rise: 27, opening: 19 },
      grade: { waist: 2.54, hip: 2.4, inseam: 0, rise: 0.3, opening: 0.3 },
      ease: { waist: 1, hip: 6 },
    },
    {
      id: 'm-smart-ankle',
      store: 'uniqlo-us', gender: 'men', category: 'bottom', kind: 'pants',
      name: 'Smart Ankle Pants',
      fitLabel: 'Slim (al tobillo)', price: 49.9,
      colors: [C.black, C.navy, C.beige, C.gray],
      sizes: inchSizes(28, 40), sizeUnit: 'in', refHeight: 175,
      base: { size: '32', waist: 82, hip: 100, inseam: 70, rise: 26, opening: 16 },
      grade: { waist: 2.54, hip: 2.4, inseam: 0, rise: 0.3, opening: 0.3 },
      ease: { waist: 1, hip: 5 },
      elastic: 3,
    },
    {
      id: 'm-easy-shorts',
      store: 'uniqlo-us', gender: 'men', category: 'bottom', kind: 'shorts',
      name: 'Geared Shorts',
      fitLabel: 'Relaxed', price: 29.9,
      colors: [C.olive, C.beige, C.navy, C.black],
      sizes: LETTERS, refHeight: 175,
      base: { size: 'M', waist: 82, hip: 106, inseam: 18, rise: 28, opening: 30 },
      grade: { waist: 6, hip: 6, inseam: 0.5, rise: 0.5, opening: 1 },
      ease: { waist: 0, hip: 12 },
      elastic: 8,
    },

    // ---------------- MUJER ----------------
    {
      id: 'w-supima-crew',
      store: 'uniqlo-us', gender: 'women', category: 'top', kind: 'tee',
      name: 'Supima Cotton Crew Neck T-Shirt (Mujer)',
      fitLabel: 'Regular', price: 14.9,
      colors: [C.white, C.black, C.pink, C.navy],
      sizes: LETTERS, refHeight: 163,
      base: { size: 'M', chest: 92, length: 60, shoulder: 38, sleeve: 15 },
      grade: { chest: 4.5, length: 1.5, shoulder: 1, sleeve: 0.5 },
      ease: { chest: 5 },
    },
    {
      id: 'w-airism-oversized',
      store: 'uniqlo-us', gender: 'women', category: 'top', kind: 'tee',
      name: 'AIRism Cotton Oversized T-Shirt (Mujer)',
      fitLabel: 'Oversized', price: 19.9,
      colors: [C.beige, C.black, C.white, C.olive],
      sizes: LETTERS, refHeight: 163,
      base: { size: 'M', chest: 112, length: 62, shoulder: 52, sleeve: 22 },
      grade: { chest: 4.5, length: 1.5, shoulder: 1.5, sleeve: 0.5 },
      ease: { chest: 25 },
    },
    {
      id: 'w-rayon-blouse',
      store: 'uniqlo-us', gender: 'women', category: 'top', kind: 'shirt',
      name: 'Rayon Long Sleeve Blouse',
      fitLabel: 'Relaxed', price: 29.9,
      colors: [C.cream, C.black, C.blue],
      sizes: LETTERS, refHeight: 163,
      base: { size: 'M', chest: 100, length: 64, shoulder: 39, sleeve: 57 },
      grade: { chest: 4.5, length: 1.5, shoulder: 1, sleeve: 1 },
      ease: { chest: 13 },
    },
    {
      id: 'w-souffle-crew',
      store: 'uniqlo-us', gender: 'women', category: 'top', kind: 'sweater',
      name: 'Souffle Yarn Crew Neck Sweater',
      fitLabel: 'Relaxed', price: 39.9,
      colors: [C.cream, C.brown, C.gray, C.red],
      sizes: LETTERS, refHeight: 163,
      base: { size: 'M', chest: 104, length: 58, shoulder: 50, sleeve: 50 },
      grade: { chest: 4.5, length: 1.5, shoulder: 1.5, sleeve: 0.8 },
      ease: { chest: 17 },
    },
    {
      id: 'w-uld-jacket',
      store: 'uniqlo-us', gender: 'women', category: 'top', kind: 'jacket',
      name: 'Ultra Light Down Jacket (Mujer)',
      fitLabel: 'Regular', price: 69.9,
      colors: [C.black, C.beige, C.navy, C.pink],
      sizes: LETTERS, refHeight: 163,
      base: { size: 'M', chest: 98, length: 58, shoulder: 39, sleeve: 59 },
      grade: { chest: 4.5, length: 1.5, shoulder: 1, sleeve: 1 },
      ease: { chest: 11 },
    },
    {
      id: 'w-wide-straight-jeans',
      store: 'uniqlo-us', gender: 'women', category: 'bottom', kind: 'jeans',
      name: 'Wide Straight Jeans',
      fitLabel: 'Wide', price: 49.9,
      colors: [C.lightDenim, C.denim, C.black],
      sizes: inchSizes(22, 34), sizeUnit: 'in', refHeight: 163,
      base: { size: '27', waist: 70, hip: 100, inseam: 74, rise: 28, opening: 25 },
      grade: { waist: 2.54, hip: 2.4, inseam: 0, rise: 0.3, opening: 0.4 },
      ease: { waist: 1, hip: 7 },
    },
    {
      id: 'w-smart-ankle',
      store: 'uniqlo-us', gender: 'women', category: 'bottom', kind: 'pants',
      name: 'Smart Ankle Pants (Mujer)',
      fitLabel: 'Slim (al tobillo)', price: 39.9,
      colors: [C.black, C.navy, C.beige],
      sizes: LETTERS, refHeight: 163,
      base: { size: 'M', waist: 70, hip: 98, inseam: 66, rise: 25, opening: 14 },
      grade: { waist: 5, hip: 5, inseam: 0, rise: 0.5, opening: 0.5 },
      ease: { waist: 1, hip: 4 },
      elastic: 3,
    },
  ];

  /** Holgura objetivo por tipo de ajuste (para prendas agregadas por el usuario). */
  PV.FIT_PRESETS = {
    top: { slim: 4, regular: 8, relaxed: 14, oversized: 22 },
    bottom: { slim: 3, regular: 6, relaxed: 10, wide: 16 },
  };

  PV.KIND_LABELS = {
    tee: 'Camiseta', shirt: 'Camisa / blusa', sweater: 'Suéter', hoodie: 'Hoodie',
    jacket: 'Chaqueta', pants: 'Pantalón', jeans: 'Jean', shorts: 'Short',
  };
  PV.TOP_KINDS = ['tee', 'shirt', 'sweater', 'hoodie', 'jacket'];
  PV.BOTTOM_KINDS = ['pants', 'jeans', 'shorts'];

  /** Medidas de la prenda para una talla dada. */
  PV.measurementsFor = function (product, size) {
    if (product.table) return product.table[size] || null;
    const { base, grade } = product;
    let steps;
    if (product.sizeUnit === 'in') steps = parseFloat(size) - parseFloat(base.size);
    else steps = product.sizes.indexOf(size) - product.sizes.indexOf(base.size);
    const out = {};
    for (const k of Object.keys(base)) {
      if (k === 'size') continue;
      out[k] = +(base[k] + (grade[k] || 0) * steps).toFixed(1);
    }
    return out;
  };
})();
