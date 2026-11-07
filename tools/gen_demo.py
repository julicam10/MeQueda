"""Genera prendas de ejemplo (dibujadas, sin derechos de terceros) en fotos tipo producto
sobre fondo liso, para que el probador abra con algo que mostrar.

Uso: python3 tools/gen_demo.py  → escribe demo/*.jpg
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageChops

W, H = 900, 1200
BG = (236, 237, 239)
OUT = os.path.join(os.path.dirname(__file__), "..", "demo")
random.seed(7)


def canvas():
    return Image.new("RGB", (W, H), BG)


def noise_layer(color, amount=10, scale=2):
    small = Image.new("RGB", (W // scale, H // scale))
    px = small.load()
    for y in range(small.height):
        for x in range(small.width):
            n = random.randint(-amount, amount)
            px[x, y] = tuple(max(0, min(255, c + n)) for c in color)
    return small.resize((W, H), Image.BILINEAR)


def stripes(c1, c2, period=46, ratio=0.5):
    im = Image.new("RGB", (W, H), c1)
    d = ImageDraw.Draw(im)
    for y in range(0, H, period):
        d.rectangle([0, y + int(period * ratio), W, y + period], fill=c2)
    return im


def shade(mask, strength=40):
    """Sombras suaves de pliegues: degradado lateral + arrugas."""
    g = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(g)
    for x in range(W):
        v = int(strength * (abs(x - W / 2) / (W / 2)) ** 2)
        d.line([(x, 0), (x, H)], fill=v)
    for _ in range(9):
        x = random.randint(250, 650)
        y = random.randint(300, 1050)
        d.line([(x, y), (x + random.randint(-90, 90), y + random.randint(60, 160))], fill=strength, width=random.randint(6, 14))
    g = g.filter(ImageFilter.GaussianBlur(14))
    return ImageChops.multiply(g, mask)


def compose(fill, mask, name, extra=None):
    base = canvas()
    # sombra de la prenda sobre el fondo
    sh = mask.filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * 0.25))
    base.paste((180, 182, 186), (8, 10), sh)
    base.paste(fill, (0, 0), mask)
    dark = Image.new("RGB", (W, H), (0, 0, 0))
    base.paste(dark, (0, 0), shade(mask))
    # borde de la prenda (como el contorno sombreado de una foto real)
    edge = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(5))).point(lambda v: int(v * 0.35))
    base.paste(dark, (0, 0), edge)
    if extra:
        extra(base)
    base.save(os.path.join(OUT, name), quality=90)


def poly_mask(*polys, ellipses=()):
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    for p in polys:
        d.polygon(p, fill=255)
    for e in ellipses:
        d.ellipse(e, fill=0)
    return m.filter(ImageFilter.GaussianBlur(1.2))


def off(pts, dy):
    return [(x, y + dy) for x, y in pts]


def tee(name, fill, graphic=None, dy=230):
    # Proporciones de una camiseta talla M (≈7.2 px/cm): ancho 53 cm, largo 70 cm
    body = [(300, 200), (380, 178), (450, 195), (520, 178), (600, 200), (640, 345), (640, 700), (260, 700), (260, 345)]
    sl_r = [(600, 200), (765, 318), (712, 392), (640, 345)]
    sl_l = [(300, 200), (135, 318), (188, 392), (260, 345)]
    m = poly_mask(off(body, dy), off(sl_r, dy), off(sl_l, dy), ellipses=[(398, 160 + dy, 502, 232 + dy)])

    def extra(im):
        d = ImageDraw.Draw(im)
        d.arc((392, 152 + dy, 508, 240 + dy), 10, 170, fill=(90, 90, 92), width=9)
        if graphic:
            graphic(im, dy)

    compose(fill, m, name, extra)


def longsleeve(name, fill, hood=False, dy=190):
    body = [(305, 200), (385, 178), (450, 195), (515, 178), (595, 200), (633, 360), (633, 640), (267, 640), (267, 360)]
    sl_r = [(595, 200), (690, 300), (800, 610), (735, 632), (650, 420), (633, 360)]
    sl_l = [(305, 200), (210, 300), (100, 610), (165, 632), (250, 420), (267, 360)]
    cuffs = [[(800, 610), (818, 650), (752, 672), (735, 632)], [(100, 610), (82, 650), (148, 672), (165, 632)]]
    hem = [(267, 640), (633, 640), (633, 680), (267, 680)]
    polys = [off(p, dy) for p in [body, sl_r, sl_l, hem] + cuffs]
    ell = [] if hood else [(402, 165 + dy, 498, 232 + dy)]
    if hood:
        polys.append(off([(360, 210), (365, 95), (450, 68), (535, 95), (540, 210), (450, 290)], dy))
    m = poly_mask(*polys, ellipses=ell)

    def extra(im):
        d = ImageDraw.Draw(im)
        dk = tuple(max(0, c - 35) for c in fill)
        d.line([(269, 640 + dy), (631, 640 + dy)], fill=dk, width=3)
        if hood:
            d.polygon(off([(398, 150), (450, 122), (502, 150), (480, 225), (420, 225)], dy), fill=tuple(max(0, c - 45) for c in fill))
            d.line(off([(430, 225), (426, 350)], dy), fill=(245, 245, 245), width=6)
            d.line(off([(470, 225), (474, 350)], dy), fill=(245, 245, 245), width=6)
            d.rounded_rectangle((335, 470 + dy, 565, 610 + dy), 20, outline=dk, width=4)

    compose(fill, m, name, extra)


def jeans(name, color, dy=80):
    # cintura 41 cm plano ≈ 300 px · tiro 27 cm · entrepierna 80 cm
    p = [(300, 120), (600, 120), (640, 300), (634, 985), (470, 985), (452, 330), (448, 330), (430, 985), (266, 985), (260, 300)]
    m = poly_mask(off(p, dy))
    fill = noise_layer(color, 14)

    def extra(im):
        d = ImageDraw.Draw(im)
        st = (214, 160, 70)
        d.rectangle((300, 120 + dy, 600, 160 + dy), outline=tuple(max(0, c - 25) for c in color), width=4)
        for x in (330, 410, 490, 570):
            d.rectangle((x, 112 + dy, x + 14, 170 + dy), fill=tuple(max(0, c - 18) for c in color))
        d.line([(450, 160 + dy), (450, 300 + dy)], fill=st, width=3)
        d.arc((395, 230 + dy, 465, 320 + dy), 0, 90, fill=st, width=3)
        d.arc((300, 150 + dy, 410, 260 + dy), 0, 90, fill=st, width=3)
        d.arc((490, 150 + dy, 600, 260 + dy), 90, 180, fill=st, width=3)
        d.ellipse((440, 128 + dy, 460, 148 + dy), fill=(190, 190, 195))

    compose(fill, m, name, extra)


def shorts(name, color, dy=0):
    p = [(300, 330), (600, 330), (645, 470), (660, 690), (478, 700), (452, 540), (448, 540), (422, 700), (240, 690), (255, 470)]
    m = poly_mask(off(p, dy))

    def extra(im):
        d = ImageDraw.Draw(im)
        dk = tuple(max(0, c - 30) for c in color)
        d.rectangle((300, 330, 600, 375), fill=dk)
        for x in range(305, 600, 12):
            d.line([(x, 335), (x, 370)], fill=tuple(max(0, c - 45) for c in color), width=2)
        d.line([(440, 375), (432, 450)], fill=(240, 240, 240), width=5)
        d.line([(460, 375), (468, 450)], fill=(240, 240, 240), width=5)

    compose(color, m, name, extra)


def logo(color):
    def g(im, dy):
        d = ImageDraw.Draw(im)
        y = 290 + dy
        d.rounded_rectangle((365, y, 535, y + 100), 24, outline=color, width=9)
        d.ellipse((415, y + 18, 485, y + 82), outline=color, width=8)
    return g


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    tee("camiseta-rayas.jpg", stripes((250, 247, 238), (32, 48, 86), 44, 0.55))
    tee("camiseta-terracota.jpg", (191, 98, 66), graphic=logo((245, 235, 220)))
    longsleeve("sueter-camel.jpg", (196, 158, 112))
    longsleeve("hoodie-verde.jpg", (96, 122, 98), hood=True)
    jeans("jean-indigo.jpg", (52, 74, 120))
    shorts("short-beige.jpg", (206, 190, 158))
    print("ok")
