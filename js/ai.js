/*
 * MeQueda · Prueba virtual con IA (Gemini, Google AI Studio).
 *
 * Envía a Gemini tu foto de cuerpo completo + la foto real de la(s) prenda(s) + cómo te queda
 * la talla elegida, y recibe una foto tuya con la ropa puesta. La clave es tuya y se guarda solo
 * en tu navegador; la app llama a Google directamente, sin servidores intermedios.
 */
(function () {
  const MQ = (window.MQ = window.MQ || {});
  const KEY = 'mequeda:gemini-key';
  const MODEL_KEY = 'mequeda:gemini-model';
  const API = 'https://generativelanguage.googleapis.com/v1beta';
  // Preferencia si hay varios modelos de imagen disponibles en tu cuenta
  const PREFERRED = [/pro-image/i, /flash-image/i, /image/i];
  const FALLBACK_MODEL = 'gemini-2.5-flash-image';

  const ls = {
    get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { /* bloqueado */ } },
  };
  MQ.ai = {
    getKey: () => ls.get(KEY),
    setKey: (k) => { ls.set(KEY, (k || '').trim()); ls.set(MODEL_KEY, ''); },
    enabled: () => !!ls.get(KEY),
    model: () => ls.get(MODEL_KEY) || FALLBACK_MODEL,
  };

  function niceError(status, body) {
    const msg = (body && body.error && body.error.message) || '';
    if (status === 400 && /api key/i.test(msg)) return 'La clave de Google no es válida. Revísala en Ajustes.';
    if (status === 401 || status === 403) return 'Google rechazó la clave (' + status + '). Revisa que esté activa en AI Studio.';
    if (status === 429) return 'Llegaste al límite de Google por ahora. Espera un momento o revisa tu cuota en AI Studio.';
    if (status >= 500) return 'Google no respondió bien (' + status + '). Intenta de nuevo en un momento.';
    return 'Google respondió con un error (' + status + ')' + (msg ? ': ' + msg.slice(0, 160) : '');
  }

  /** Busca el mejor modelo de imágenes disponible para la clave y verifica que funcione. */
  MQ.ai.check = async function () {
    const key = MQ.ai.getKey();
    if (!key) throw new Error('Pega tu clave de Google AI Studio.');
    const r = await fetch(API + '/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
    const body = await r.json().catch(() => null);
    if (!r.ok) throw new Error(niceError(r.status, body));
    const names = (body.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /image/i.test(m.name) && !/imagen/i.test(m.name))
      .map((m) => m.name.replace(/^models\//, ''));
    let pick = null;
    for (const re of PREFERRED) { pick = names.find((n) => re.test(n) && !/preview/i.test(n)) || names.find((n) => re.test(n)); if (pick) break; }
    ls.set(MODEL_KEY, pick || FALLBACK_MODEL);
    return { model: MQ.ai.model(), available: names };
  };

  const b64 = (dataUrl) => {
    const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
    return m ? { mime_type: m[1], data: m[2] } : null;
  };

  async function generate(parts, aspect = '3:4') {
    const key = MQ.ai.getKey();
    if (!key) throw new Error('Configura tu clave de Google AI Studio en "Pruébatelo tú".');
    const call = async (withConfig) => {
      const generationConfig = { responseModalities: ['TEXT', 'IMAGE'] };
      if (withConfig) generationConfig.imageConfig = { aspectRatio: aspect };
      const r = await fetch(API + '/models/' + encodeURIComponent(MQ.ai.model()) + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
      });
      const body = await r.json().catch(() => null);
      return { r, body };
    };
    let { r, body } = await call(true);
    // Algunos modelos no aceptan imageConfig: se reintenta sin él
    if (!r.ok && r.status === 400 && /imageConfig|aspect/i.test(JSON.stringify(body || {}))) ({ r, body } = await call(false));
    if (!r.ok) throw new Error(niceError(r.status, body));
    const cand = body && body.candidates && body.candidates[0];
    const outParts = (cand && cand.content && cand.content.parts) || [];
    for (const p of outParts) {
      const d = p.inlineData || p.inline_data;
      if (d && d.data) return 'data:' + (d.mimeType || d.mime_type || 'image/png') + ';base64,' + d.data;
    }
    const why = (cand && cand.finishReason) || (body && body.promptFeedback && body.promptFeedback.blockReason) || '';
    const txt = outParts.map((p) => p.text).filter(Boolean).join(' ').slice(0, 160);
    throw new Error('Gemini no devolvió una imagen' + (why ? ' (' + why + ')' : '') + (txt ? ': ' + txt : '.'));
  }

  const BACKDROP = 'plain seamless warm beige studio wall background (color #e3d6c4) with a light beige floor, soft diffused overhead daylight';

  /** Modelo genérico (cuando aún no subes tu foto). */
  MQ.ai.makeModel = function ({ gender, height, weight }) {
    const who = gender === 'women' ? 'woman' : 'man';
    const build = weight / Math.pow(height / 100, 2) > 27 ? 'sturdy build' : weight / Math.pow(height / 100, 2) < 20 ? 'slim build' : 'average athletic build';
    return generate([{ text:
      'Photorealistic full-body fashion catalog photo of a friendly Latin American ' + who + ', about ' + height + ' cm tall, ' + build +
      ', standing straight and front-facing, arms relaxed at the sides, neutral natural expression, wearing a plain fitted white crew-neck t-shirt, light beige straight chinos and white sneakers. ' +
      BACKDROP + '. Entire body visible from head to shoes, centered, camera at chest height, no text, no logos.' }]);
  };

  /**
   * Te viste con las prendas.
   * person: dataURL JPEG de la persona. items: [{ slot:'top'|'bottom', image: dataURL, name, size, fit }]
   */
  MQ.ai.tryOn = function ({ person, items }) {
    const parts = [];
    let txt = 'Virtual try-on. IMAGE 1 is the person. ';
    items.forEach((it, i) => {
      txt += 'IMAGE ' + (i + 2) + ' is a product photo of a ' + (it.slot === 'top' ? 'TOP garment (upper body)' : 'BOTTOM garment (pants/shorts)') + ' called "' + it.name + '". ';
    });
    txt += 'Generate a photorealistic full-body photo of the SAME person from IMAGE 1 — identical face, hairstyle, skin tone, body shape and proportions — standing front-facing with arms relaxed at the sides, wearing ' +
      items.map((it, i) => 'the garment from IMAGE ' + (i + 2)).join(' and ') +
      '. Reproduce each garment exactly: same color, fabric texture, print, logos, stitching and details. ';
    for (const it of items) txt += 'Fit of the ' + (it.slot === 'top' ? 'top' : 'bottom') + ' (size ' + it.size + ' on this person): ' + it.fit + '. ';
    txt += 'Keep any other clothing from IMAGE 1 only if it is not replaced; use plain white sneakers if feet are visible. Natural fabric folds and drape that follow the body. ' +
      BACKDROP + '. Entire body visible from head to shoes, centered, no text, no watermark.';
    parts.push({ text: txt });
    const p = b64(person); if (p) parts.push({ inline_data: p });
    for (const it of items) { const g = b64(it.image); if (g) parts.push({ inline_data: g }); }
    return generate(parts);
  };

  /** Traduce el veredicto de talla a una instrucción de caída para la IA. */
  MQ.ai.fitText = function (evalResult) {
    if (!evalResult) return 'regular fit';
    const out = [];
    for (const it of evalResult.items) {
      const t = it.text.toLowerCase();
      if (it.label === 'Pecho') out.push(/apretada/.test(t) ? 'tight across the chest, fabric stretched' : /ceñida/.test(t) ? 'snug, close to the body' : /muy grande/.test(t) ? 'very oversized and baggy, lots of extra fabric' : /holgada/.test(t) ? 'loose and relaxed' : 'fits as designed, natural ease');
      if (it.label === 'Largo' && /corta/.test(t)) out.push('hem slightly short, showing the waist');
      if (it.label === 'Largo' && /larga/.test(t)) out.push('hem long, below the hips');
      if (it.label === 'Largo' && /ruedo/.test(t)) out.push('legs too long, fabric stacking over the shoes');
      if (it.label === 'Largo' && /corto/.test(t) && !/corta/.test(t)) out.push('legs a bit short, ankles visible');
      if (it.label === 'Mangas' && /cortas/.test(t)) out.push('sleeves slightly short, wrists visible');
      if (it.label === 'Mangas' && /mano/.test(t)) out.push('sleeves long, covering part of the hands');
      if (it.label === 'Cintura' && /no cierra|apretada|ajustada/.test(t)) out.push('tight at the waist');
      if (it.label === 'Cintura' && /holgada|grande/.test(t)) out.push('loose at the waist, needs a belt');
      if (it.label === 'Cadera' && /ceñida|apretada/.test(t)) out.push('tight on hips and thighs');
      if (it.label === 'Cadera' && /holgada/.test(t)) out.push('relaxed on hips');
    }
    return out.join(', ') || 'regular fit';
  };
})();
