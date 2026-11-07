/* MeQueda · Entrega a la web de MeQueda la prenda que la extensión leyó en la tienda. */
(() => {
  let sent = false;
  const deliver = () => {
    if (sent) return;
    chrome.runtime.sendMessage({ type: 'mq:getPending' }, (p) => {
      if (!p || sent) return;
      sent = true;
      window.postMessage(Object.assign({ type: 'mequeda:garment' }, p), location.origin);
    });
  };
  window.addEventListener('message', (e) => { if (e.source === window && e.data && e.data.type === 'mequeda:ready') deliver(); });
})();
