/* MeQueda · Service worker: lee la prenda, descarga sus fotos y abre el probador. */
const DEFAULT_APP = 'https://julicam10.github.io/MeQueda/';

async function appUrl() {
  const { appUrl } = await chrome.storage.local.get('appUrl');
  return appUrl || DEFAULT_APP;
}

async function toDataURL(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return 'data:' + blob.type + ';base64,' + btoa(s);
}

async function tryOn(tab) {
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['extract.js'] });
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.__mqExtract() });
  const data = res && res.result;
  if (!data) return;
  // Las fotos se descargan aquí (la extensión puede; la web sola no, por seguridad del navegador)
  const images = [];
  for (const u of data.images.slice(0, 8)) {
    try {
      const r = await fetch(u, { credentials: 'omit' });
      const blob = await r.blob();
      if (r.ok && blob.type.startsWith('image/') && blob.size > 8000) images.push(await toDataURL(blob));
    } catch (e) { /* foto no disponible */ }
  }
  await chrome.storage.local.set({ pending: Object.assign({}, data, { images }) });
  const url = await appUrl();
  const [open] = await chrome.tabs.query({ url: url + '*' });
  if (open) {
    await chrome.tabs.reload(open.id);
    await chrome.tabs.update(open.id, { active: true });
  } else {
    await chrome.tabs.create({ url });
  }
}

chrome.action.onClicked.addListener((tab) => { tryOn(tab); });

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'mq:tryTab' && sender.tab) { tryOn(sender.tab).then(() => reply(true), () => reply(false)); return true; }
  if (msg.type === 'mq:getPending') {
    chrome.storage.local.get('pending').then(({ pending }) => { reply(pending || null); chrome.storage.local.remove('pending'); });
    return true;
  }
  return false;
});
