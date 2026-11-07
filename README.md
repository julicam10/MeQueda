# 👕 MeQueda

**¿Te queda? Pruébatelo antes de comprar.**

Mira cómo te quedaría cada prenda de una tienda online **en cada talla**, con un avatar hecho a partir de **tu altura, tu peso y una foto de tu cara**.

Nació de una necesidad concreta: comprar en **Uniqlo USA** para traer la ropa a Colombia con un casillero, sin poder medírtela y sin poder devolverla fácilmente.

## Qué hace

- **Avatar paramétrico**: con altura y peso estima pecho, cintura, cadera, hombros, brazo y entrepierna (puedes corregir las medidas si las conoces).
- **Tu cara en el avatar**: subes una foto frontal y la encuadras con zoom/posición. La foto **nunca sale de tu navegador**.
- **Carrusel de prendas**: pasas de una prenda a otra con las flechas, el teclado (← →) o deslizando en el celular.
- **Todas las tallas lado a lado**: ves el avatar con XS, S, M, L… o 28", 30", 32"… y cuál te recomienda.
- **Informe de ajuste por talla**: pecho, hombros, largo, mangas, cintura, cadera y largo de pierna (con aviso de "toca hacerle ruedo").
- **Outfit**: la camiseta se combina con el último pantalón que viste, y viceversa.
- **Precio en COP** con una tasa editable.
- **Cualquier tienda**: con **+ Agregar prenda** pegas la tabla de medidas de la prenda de Zara, H&M, Gap, etc. y la pruebas igual.

## Cómo probarlo

**En línea:** https://julicam10.github.io/MeQueda/

**En tu computador:** es una web estática sin dependencias ni servidor:

```bash
git clone https://github.com/julicam10/MeQueda.git
cd MeQueda
python3 -m http.server 8000   # o simplemente abre index.html en el navegador
```

Luego abre http://localhost:8000.

## Cómo funciona

| Archivo | Qué hace |
| --- | --- |
| `js/catalog.js` | Tiendas y catálogo. Cada prenda tiene medidas de la talla base y cuánto cambian por talla (*grading*), más la holgura de diseño. |
| `js/fit.js` | Estima tus medidas y califica cada talla (holgura vs. la holgura con la que fue diseñada, largo relativo a tu altura, etc.). |
| `js/render.js` | Dibuja en SVG el avatar y las prendas en centímetros reales: una talla más grande se ve más ancha y larga de verdad. |
| `js/app.js` | Interfaz, estado y guardado local (localStorage). |

## Limitaciones (es un prototipo)

- Las medidas del catálogo de Uniqlo son **aproximadas** y escritas a mano; verifica la guía de tallas de cada producto o agrega la prenda con su tabla real.
- La estimación de medidas por altura/peso es estadística: si tienes una cinta métrica, ingresa tus medidas reales.
- El avatar es una ilustración, no una foto realista.

## Ideas para la siguiente versión

1. **Extensión de navegador** que lea la tabla de tallas directamente de la página del producto (Uniqlo, Zara, Amazon…) y abra el probador.
2. **Prueba virtual con IA** (modelos de *virtual try-on*) para ver la prenda real sobre una foto de cuerpo completo.
3. **Medición con la cámara** del celular para estimar contornos.
4. Historial de lo que ya compraste y cómo te quedó, para afinar la recomendación.

No afiliado a Uniqlo ni a ninguna tienda.
