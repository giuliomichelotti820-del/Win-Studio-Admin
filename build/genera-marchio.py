#!/usr/bin/env python3
"""Genera le risorse binarie del marchio, dal marchio ufficiale dello Studio.

Sorgente unica: le immagini del sito (`assets/img/` di Sito-Amm.Burch), che
sono il marchio vero — quello della carta intestata. Da li nascono:

    build/icon.ico                l'icona di Windows, a sette risoluzioni
    build/tray.png                l'icona dell'area di notifica
    build/installerSidebar.bmp    il fianco della prima pagina dell'installer
    build/installerHeader.bmp     la testata delle pagine successive

Niente di tutto questo e disegnato a mano: se il marchio dello Studio cambia si
rilancia questo script, non si rincorrono venti file.

    python3 build/genera-marchio.py [percorso del repository del sito]

Serve Pillow:  pip install pillow
"""

import os
import sys

from PIL import Image, ImageDraw, ImageFilter

QUI = os.path.dirname(os.path.abspath(__file__))
USCITA = QUI

# Il repository del sito, di fianco a questo per convenzione.
SITO = sys.argv[1] if len(sys.argv) > 1 else os.path.join(QUI, "..", "..", "Sito-Amm.Burch")
SORGENTE = os.path.join(SITO, "assets", "img", "logo-icon.png")   # il solo simbolo
COMPLETO = os.path.join(SITO, "assets", "img", "logo-full.png")   # il lockup intero

NAVY = (11, 35, 65)        # --c-navy dello Studio
ARANCIO = (232, 132, 61)   # --c-brand-orange
BIANCO = (255, 255, 255)

if not os.path.exists(SORGENTE):
    sys.exit(f"Marchio non trovato in {SORGENTE}.\n"
             f"Passa il percorso del repository del sito come primo argomento.")

marchio = Image.open(SORGENTE).convert("RGBA")
completo = Image.open(COMPLETO).convert("RGBA")


def tessera(lato, raggio_pct=0.22, inset_pct=0.13, bordo=True):
    """Il marchio dentro una tessera chiara, alla dimensione richiesta.

    Il cuore del marchio e una «A» blu notte: su una barra delle applicazioni
    scura sparirebbe. La tessera chiara e la stessa forma che l'app usa nella
    barra dei titoli e nella laterale, cosi il simbolo del programma e la sua
    icona di sistema coincidono.
    """
    ss = 8 if lato <= 64 else 4          # supercampionamento
    L = lato * ss
    r = int(L * raggio_pct)

    tela = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    maschera = Image.new("L", (L, L), 0)
    ImageDraw.Draw(maschera).rounded_rectangle([0, 0, L - 1, L - 1], radius=r, fill=255)

    # Sfumatura appena percepibile: la tessera non e una lastra piatta.
    grad = Image.new("L", (1, L))
    for y in range(L):
        grad.putpixel((0, y), 255 - int(14 * y / L))
    fondo = Image.composite(Image.new("RGBA", (L, L), BIANCO + (255,)),
                            Image.new("RGBA", (L, L), (238, 242, 246, 255)),
                            grad.resize((L, L)))
    tela.paste(fondo, (0, 0))

    if bordo:
        ImageDraw.Draw(tela).rounded_rectangle(
            [ss, ss, L - 1 - ss, L - 1 - ss], radius=r - ss,
            outline=NAVY + (38,), width=max(1, int(L * 0.012)))

    largo = int(L * (1 - 2 * inset_pct))
    alto = int(largo * marchio.height / marchio.width)
    tela.alpha_composite(marchio.resize((largo, alto), Image.LANCZOS),
                         ((L - largo) // 2, (L - alto) // 2))

    tela.putalpha(Image.composite(tela.getchannel("A"), Image.new("L", (L, L), 0), maschera))
    return tela.resize((lato, lato), Image.LANCZOS)


# --- Icona di Windows ------------------------------------------------------
# Sotto i 32 px la cornice mangia il simbolo: si stringe il raggio e si allarga
# il marchio, altrimenti sulla barra delle applicazioni resta una macchia bianca.
livelli = []
for lato in (16, 24, 32, 48, 64, 128, 256):
    if lato <= 24:
        livelli.append(tessera(lato, raggio_pct=0.14, inset_pct=0.06, bordo=False))
    elif lato <= 48:
        livelli.append(tessera(lato, raggio_pct=0.18, inset_pct=0.09, bordo=False))
    else:
        livelli.append(tessera(lato, raggio_pct=0.22, inset_pct=0.12))
livelli[-1].save(os.path.join(USCITA, "icon.ico"), format="ICO",
                 sizes=[(i.width, i.width) for i in livelli], append_images=livelli[:-1])

# --- Area di notifica ------------------------------------------------------
# Windows la riduce a 16 px sugli schermi normali e a 20/24 su quelli ad alta
# densita: si consegna la piu grande e si lascia scalare a lui.
tessera(64, raggio_pct=0.16, inset_pct=0.06, bordo=False).save(os.path.join(USCITA, "tray.png"))


# --- Installer -------------------------------------------------------------
def fondo_studio(w, h):
    """Il blu notte dello Studio con una diagonale appena piu chiara."""
    base = Image.new("RGB", (w, h), NAVY)
    velo = Image.new("RGB", (w, h), (24, 59, 99))
    m = Image.new("L", (w, h))
    px = m.load()
    for y in range(h):
        for x in range(w):
            t = (x / w) * 0.6 + (1 - y / h) * 0.4
            px[x, y] = int(max(0.0, min(1.0, t)) * 150)
    return Image.composite(velo, base, m.filter(ImageFilter.GaussianBlur(w / 12)))


# Fianco della prima pagina: 164x314, il lockup completo su fondo Studio.
w, h = 164, 314
lato_installer = fondo_studio(w, h)
lock = completo.resize((132, int(132 * completo.height / completo.width)), Image.LANCZOS)
piastra = Image.new("RGBA", (lock.width + 20, lock.height + 20), BIANCO + (255,))
piastra.alpha_composite(lock, (10, 10))
lato_installer.paste(piastra.convert("RGB"), ((w - piastra.width) // 2, 34))
ImageDraw.Draw(lato_installer).line([(28, h - 54), (w - 28, h - 54)], fill=ARANCIO, width=2)
lato_installer.save(os.path.join(USCITA, "installerSidebar.bmp"), format="BMP")

# Testata delle pagine successive: 150x57, la tessera del marchio a destra.
w, h = 150, 57
testa = fondo_studio(w, h)
t = tessera(41, raggio_pct=0.2, inset_pct=0.1)
testa.paste(t.convert("RGB"), (w - 41 - 9, (h - 41) // 2), t)
testa.save(os.path.join(USCITA, "installerHeader.bmp"), format="BMP")

for nome in ("icon.ico", "tray.png", "installerSidebar.bmp", "installerHeader.bmp"):
    percorso = os.path.join(USCITA, nome)
    print(f"  {nome:24} {os.path.getsize(percorso):>8} byte  {Image.open(percorso).size}")
