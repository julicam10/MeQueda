# 👕 MeQueda

**¿Te queda? Pruébatelo antes de comprar.**

Mira cómo te queda la ropa de cualquier tienda online —con su diseño real— en un avatar con tu altura, tu peso y tu cara, talla por talla.

👉 **Pruébalo:** https://julicam10.github.io/MeQueda/

## Cómo funciona

1. **Tu avatar**: altura, peso y una foto de tu cara. Estimamos tus medidas (o pones las tuyas) y tomamos el tono de piel de la foto.
2. **La prenda real**: tomamos la foto del producto (la de la prenda sola, sin modelo), **le quitamos el fondo** y detectamos su forma: si es de arriba o de abajo, cuello, hombros, axilas, mangas, ruedo, pretina, tiro y botas.
3. **La talla**: escalamos la foto a las medidas de cada talla y la montamos sobre tu avatar. Los brazos del avatar siguen la dirección de las mangas, así la prenda se ve tal cual es.
4. **El veredicto**: pecho, largo, mangas, cintura, cadera y largo de pierna comparados con tu cuerpo, y la talla recomendada.

Las medidas de la prenda salen solas:
- con la **extensión**, de la tabla de tallas de la tienda;
- sin ella, **estimadas desde la foto** (proporciones de la prenda + tamaños típicos de una talla M + pistas del nombre como *oversize*, *slim*, *crop*).

## Agregar prendas

- **Pegar** (Ctrl+V): en la tienda, clic derecho sobre la foto → *Copiar imagen* → pégala en MeQueda.
- **Arrastrar** o **subir** la foto.
- **Extensión de Chrome** (un clic desde la tienda): ver [`extension/`](extension/).

Funciona mejor con la foto de la prenda sola sobre fondo liso, que casi todas las tiendas tienen en la galería.

## Privacidad

Todo corre en tu navegador. Tu foto, tus medidas y tus prendas se guardan solo en tu dispositivo (localStorage / IndexedDB). No hay servidor.

## Estructura

| Archivo | Qué hace |
| --- | --- |
| `js/garment.js` | Quita el fondo de la foto y detecta los puntos clave de la prenda. |
| `js/sizing.js` | Medidas del cuerpo, medidas de la prenda por talla, lectura de tablas de tallas y recomendación. |
| `js/avatar.js` | Avatar paramétrico en SVG (unidades en cm) y montaje de la foto real de la prenda. |
| `js/app.js`, `js/store.js` | Interfaz y guardado local. |
| `extension/` | Extensión de Chrome que lleva la prenda de la tienda a MeQueda. |
| `demo/` | Prendas de ejemplo dibujadas por `tools/gen_demo.py` (sin derechos de terceros). |
| `tools/mock-product.html` | Página de producto de prueba para desarrollar la extensión. |

Para correrlo local: `python3 -m http.server 8000` y abre http://localhost:8000.

## Limitaciones actuales

- Con fotos de modelo o fondos con textura el recorte sale peor; la app prefiere la foto de la prenda sola.
- Prendas blancas sobre fondo blanco pueden recortarse mal.
- Vestidos, faldas y prendas abiertas (chaquetas abiertas) aún no se detectan bien.
- El avatar es una ilustración paramétrica, no una foto realista.

No afiliado a ninguna tienda.
