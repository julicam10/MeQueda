/* MeQueda · Lee la prenda de la página de producto: nombre, fotos, tallas y tabla de medidas. */
(() => {
  if (window.__mqExtract) return;
  const SIZE_RE = /^(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|\d{2}(\/\d{2})?)$/i;
  const MEASURE_RE = /(chest|pecho|busto|bust|waist|cintura|length|largo|hip|cadera|sleeve|manga|inseam|entrepierna|ancho|width|shoulder|hombro)/i;

  function ldProducts() {
    const out = [];
    const walk = (o) => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) return o.forEach(walk);
      const t = [].concat(o['@type'] || []);
      if (t.includes('Product') || t.includes('ProductGroup')) out.push(o);
      if (o['@graph']) walk(o['@graph']);
      if (o.hasVariant) walk(o.hasVariant);
    };
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => { try { walk(JSON.parse(s.textContent)); } catch (e) { /* JSON inválido */ } });
    return out;
  }
  const abs = (u) => { try { return new URL(u, location.href).href; } catch (e) { return null; } };
  function imgsFromLd(p) {
    const r = [];
    const add = (v) => { if (!v) return; if (typeof v === 'string') r.push(v); else if (Array.isArray(v)) v.forEach(add); else if (v.url || v.contentUrl) r.push(v.url || v.contentUrl); };
    add(p.image);
    return r;
  }
  function bestSrc(img) {
    const ss = img.getAttribute('srcset') || img.getAttribute('data-srcset');
    if (ss) {
      const c = ss.split(',').map((x) => x.trim().split(/\s+/)).map(([u, w]) => ({ u, w: parseFloat(w) || 0 })).sort((a, b) => b.w - a.w);
      if (c[0] && c[0].u) return c[0].u;
    }
    return img.currentSrc || img.src || img.getAttribute('data-src');
  }
  function pageImages() {
    return [...document.images].filter((i) => {
      const r = i.getBoundingClientRect();
      return (i.naturalWidth >= 350 || r.width >= 200) && (i.naturalHeight >= 350 || r.height >= 200) && !i.closest('header, footer, nav');
    }).map(bestSrc);
  }
  // Uniqlo: además de las fotos con modelo, existe la foto de la prenda sola
  function uniqloFlat(urls) {
    const extra = [];
    for (const u of urls) {
      const m = u && u.match(/imagesgoods\/(\d+)\/item\/\w*goods_(\w+?)_\1/);
      if (m) extra.push('https://image.uniqlo.com/UQ/ST3/WesternCommon/imagesgoods/' + m[1] + '/item/goods_' + m[2] + '_' + m[1] + '_3x4.jpg');
    }
    return extra;
  }
  function sizes() {
    const set = [];
    document.querySelectorAll('[data-size], [aria-label*="size" i], [aria-label*="talla" i], button, li, option, label').forEach((el) => {
      if (el.closest('footer, nav, header')) return;
      const t = (el.getAttribute('data-size') || el.textContent || '').trim().toUpperCase();
      if (t.length <= 6 && SIZE_RE.test(t) && !set.includes(t)) set.push(t);
    });
    return set.length >= 2 && set.length <= 14 ? set : [];
  }
  function bestTable(root) {
    let best = null, score = 0;
    root.querySelectorAll('table').forEach((t) => {
      const rows = [...t.rows].map((r) => [...r.cells].map((c) => c.textContent.replace(/\s+/g, ' ').trim()));
      const txt = rows.flat().join(' ');
      if (!MEASURE_RE.test(txt)) return;
      const nums = rows.flat().filter((c) => /\d/.test(c)).length;
      if (nums > score) { score = nums; best = rows; }
    });
    return best;
  }
  async function uniqloTable() {
    if (!/uniqlo\.com$/.test(location.hostname)) return null;
    const m = location.pathname.match(/^\/(\w+)\/(\w+)\/products\/(E?\d{6}-\d{3})(?:\/(\d{2}))?/);
    if (!m) return null;
    try {
      const d = await (await fetch('/' + m[1] + '/api/commerce/v5/' + m[2] + '/products/' + m[3] + '/price-groups/' + (m[4] || '00') + '/details')).json();
      const url = d.result && d.result.sizeChartUrl;
      if (!url) return null;
      const html = await (await fetch(url, { credentials: 'include' })).text();
      return bestTable(new DOMParser().parseFromString(html, 'text/html'));
    } catch (e) { return null; }
  }

  window.__mqIsProduct = () => ldProducts().length > 0 || /product/i.test(document.querySelector('meta[property="og:type"]')?.content || '');

  window.__mqExtract = async () => {
    const ld = ldProducts()[0] || {};
    const meta = (sel) => document.querySelector(sel)?.content;
    const name = (ld.name || meta('meta[property="og:title"]') || document.querySelector('h1')?.textContent || document.title || '')
      .replace(/\s+/g, ' ').trim().replace(/\s*[|]\s*[^|]+$/, '').slice(0, 80);
    let images = [...imgsFromLd(ld), meta('meta[property="og:image"]'), ...pageImages()].filter(Boolean).map(abs).filter(Boolean);
    images = [...new Set([...uniqloFlat(images), ...images])].filter((u) => !/\.svg(\?|$)|sprite|logo|icon|badge/i.test(u)).slice(0, 14);
    const tableRows = bestTable(document) || (await uniqloTable());
    const description = [ld.description, meta('meta[property="og:description"]'), meta('meta[name="description"]')].filter(Boolean).join(' ').slice(0, 600);
    return { name, url: location.href, store: location.hostname.replace(/^www\d?\./, ''), images, sizes: sizes(), tableRows, description };
  };
})();
