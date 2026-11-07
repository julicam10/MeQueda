/* MeQueda · Botón flotante "Probar en MeQueda" en páginas de producto de tiendas conocidas. */
(() => {
  if (window.__mqButton || !window.__mqIsProduct || !window.__mqIsProduct()) return;
  window.__mqButton = true;
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = '👕 Probar en MeQueda';
  b.setAttribute('aria-label', 'Probar esta prenda en MeQueda');
  Object.assign(b.style, {
    position: 'fixed', right: '20px', bottom: '20px', zIndex: 2147483647, padding: '12px 18px', borderRadius: '999px',
    border: '0', background: '#111214', color: '#c8f169', font: '600 15px/1 system-ui, sans-serif', cursor: 'pointer',
    boxShadow: '0 10px 30px rgba(0,0,0,.3)',
  });
  b.addEventListener('click', () => {
    b.textContent = 'Leyendo la prenda…';
    chrome.runtime.sendMessage({ type: 'mq:tryTab' }, () => { b.textContent = '👕 Probar en MeQueda'; });
  });
  document.documentElement.appendChild(b);
})();
