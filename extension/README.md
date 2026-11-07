# Extensión de Chrome · MeQueda

Agrega un botón **“👕 Probar en MeQueda”** en la página de producto de las tiendas. Con un clic:

1. Lee el nombre, las fotos, las tallas y la tabla de medidas de la prenda (si la tienda la tiene en la página).
2. Descarga las fotos (la web sola no puede hacerlo por seguridad del navegador).
3. Abre MeQueda, que elige la foto de la prenda sola, le quita el fondo y te la pone en el avatar.

## Instalarla (modo desarrollador)

1. Descarga este repositorio: botón verde **Code → Download ZIP** y descomprímelo.
2. En Chrome abre `chrome://extensions`.
3. Activa **Modo de desarrollador** (arriba a la derecha).
4. Toca **Cargar descomprimida** y elige la carpeta `extension` de este repositorio.
5. Fija el ícono de MeQueda en la barra (ícono de rompecabezas → 📌).

## Usarla

- En tiendas conocidas (Uniqlo, Zara, H&M, Mattelsa, Pull&Bear, Bershka, Gap, Shein, ASOS…) aparece el botón flotante abajo a la derecha.
- En **cualquier otra tienda**, toca el ícono de MeQueda en la barra de Chrome estando en la página del producto.
- Si la tienda muestra la guía de tallas en una ventana, ábrela antes de tocar el botón para que la extensión la lea.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `extract.js` | Lee la página: datos estructurados del producto (JSON-LD), fotos de la galería, tallas y tablas de medidas. |
| `button.js` | Muestra el botón flotante en páginas de producto. |
| `background.js` | Descarga las fotos y abre MeQueda con la prenda. |
| `bridge.js` | Entrega la prenda a la web de MeQueda. |

Para probar contra una copia local de la web, en la consola del service worker:
`chrome.storage.local.set({ appUrl: 'http://localhost:8000/' })`
