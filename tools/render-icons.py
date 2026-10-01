"""Draws every Пора icon: assets/icon.png, the Android adaptive layers, the notification glyph, splash, favicon.

The mark is the Cyrillic "П" of the name built from medicine: a bar and two capsule legs. The left leg ends in a
mint half, the right one in an amber half, and a small clock sits in the gap, so the letter reads "pill, on time".
Run: python tools/render-icons.py
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SS = 2  # supersampling

FIELD_TOP = (22, 96, 78)
FIELD_BOTTOM = (7, 30, 25)
PAPER = (240, 252, 247)
MINT = (126, 227, 198)
AMBER = (242, 196, 109)
INK = (9, 38, 31)


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def gradient(size: int) -> Image.Image:
    base = Image.new("RGB", (size, size))
    px = base.load()
    for y in range(size):
        for x in range(size):
            t = min(1.0, max(0.0, (x * 0.35 + y * 0.9) / (size * 1.25)))
            px[x, y] = mix(FIELD_TOP, FIELD_BOTTOM, t**0.9)
    return base


def rrect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_mark(size: int, *, scale: float, palette: str = "colour", glow: bool = True) -> Image.Image:
    """The mark alone, centred, on a transparent square. `scale` is the mark's height as a share of the canvas."""
    big = size * SS
    layer = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # Design grid: a 1000-unit square, mark spans x 250..750, y 250..750 (500 units).
    unit = big * scale / 500.0
    cx = cy = big / 2

    def gx(v):  # design x -> pixels
        return cx + (v - 500) * unit

    def gy(v):
        return cy + (v - 500) * unit

    if palette == "mono":
        bar = leg_left_top = leg_left_bottom = leg_right_top = leg_right_bottom = (255, 255, 255, 255)
        clock = (255, 255, 255, 255)
    else:
        bar = leg_left_top = leg_right_top = PAPER + (255,)
        leg_left_bottom = MINT + (255,)
        leg_right_bottom = AMBER + (255,)
        clock = MINT + (255,)

    leg_w = 150
    top = 250
    bottom = 750
    split = 560
    left_x0, left_x1 = 250, 250 + leg_w
    right_x0, right_x1 = 750 - leg_w, 750

    # Bar and legs: full capsules first, then the lower halves recoloured through a mask.
    rrect(d, (gx(250), gy(top), gx(750), gy(top + 150)), 75 * unit, bar)
    rrect(d, (gx(left_x0), gy(top + 20), gx(left_x1), gy(bottom)), (leg_w / 2) * unit, leg_left_top)
    rrect(d, (gx(right_x0), gy(top + 20), gx(right_x1), gy(bottom)), (leg_w / 2) * unit, leg_right_top)

    if palette != "mono":
        lower = Image.new("L", (big, big), 0)
        ld = ImageDraw.Draw(lower)
        ld.rectangle((0, gy(split), big, big), fill=255)
        for (x0, x1, colour) in ((left_x0, left_x1, leg_left_bottom), (right_x0, right_x1, leg_right_bottom)):
            tint = Image.new("RGBA", (big, big), (0, 0, 0, 0))
            td = ImageDraw.Draw(tint)
            rrect(td, (gx(x0), gy(top + 20), gx(x1), gy(bottom)), (leg_w / 2) * unit, colour)
            # keep only the lower half of this leg
            tint.putalpha(ImageChops.multiply(tint.getchannel("A"), lower))
            layer = Image.alpha_composite(layer, tint)
        d = ImageDraw.Draw(layer)
        # A hairline where the pill halves meet.
        for (x0, x1) in ((left_x0, left_x1), (right_x0, right_x1)):
            d.rectangle((gx(x0), gy(split) - 2 * SS, gx(x1), gy(split) + 2 * SS), fill=INK + (70,))

    # The clock in the gap between the legs.
    ccx, ccy, cr = 500, 575, 66
    ring = 15
    if palette == "mono":
        d.ellipse((gx(ccx - cr), gy(ccy - cr), gx(ccx + cr), gy(ccy + cr)), outline=clock, width=int(ring * unit))
    else:
        d.ellipse((gx(ccx - cr), gy(ccy - cr), gx(ccx + cr), gy(ccy + cr)), outline=clock, width=int(ring * unit))
    hand = int(13 * unit)
    d.line((gx(ccx), gy(ccy), gx(ccx), gy(ccy - 36)), fill=clock, width=hand)
    d.line((gx(ccx), gy(ccy), gx(ccx + 28), gy(ccy + 16)), fill=clock, width=hand)
    d.ellipse((gx(ccx) - hand * 0.8, gy(ccy) - hand * 0.8, gx(ccx) + hand * 0.8, gy(ccy) + hand * 0.8), fill=clock)

    if glow and palette != "mono":
        halo = layer.filter(ImageFilter.GaussianBlur(big * 0.03))
        halo.putalpha(halo.getchannel("A").point(lambda a: int(a * 0.35)))
        layer = Image.alpha_composite(halo, layer)

    return layer.resize((size, size), Image.Resampling.LANCZOS)


def field_with_highlight(size: int) -> Image.Image:
    base = gradient(size).convert("RGBA")
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-size * 0.2, -size * 0.7, size * 1.2, size * 0.35), fill=(160, 255, 225, 30))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.06))
    return Image.alpha_composite(base, glow)


def save(image: Image.Image, name: str, *, flatten: bool = False) -> None:
    path = ASSETS / name
    if flatten:
        image = image.convert("RGB")
    image.save(path, optimize=True)
    print("wrote", path.relative_to(ROOT), image.size)


def main() -> None:
    ASSETS.mkdir(exist_ok=True)

    # App icon: full-bleed square (the launcher applies its own mask).
    icon = Image.alpha_composite(field_with_highlight(1024), draw_mark(1024, scale=0.52))
    save(icon, "icon.png", flatten=True)

    # Android adaptive icon: the system masks the 108 dp canvas to a circle/squircle, keeping the central 66 dp.
    save(field_with_highlight(1024).convert("RGB"), "android-icon-background.png")
    save(draw_mark(1024, scale=0.46), "android-icon-foreground.png")
    mono = draw_mark(1024, scale=0.46, palette="mono", glow=False)
    save(mono, "android-icon-monochrome.png")

    # Notification glyph: white on transparent, heavier so it survives 24 dp.
    glyph = draw_mark(96 * 4, scale=0.86, palette="mono", glow=False).resize((96, 96), Image.Resampling.LANCZOS)
    save(glyph, "notification-icon.png")

    # Splash: the colour mark on transparent (the splash background colour comes from the app config).
    save(draw_mark(1024, scale=0.5), "splash-icon.png")

    save(Image.alpha_composite(field_with_highlight(256), draw_mark(256, scale=0.56)).resize((64, 64), Image.Resampling.LANCZOS), "favicon.png")

    # A contact sheet for review.
    sheet = Image.new("RGBA", (1100, 420), (28, 30, 34, 255))
    sheet.alpha_composite(icon.resize((360, 360), Image.Resampling.LANCZOS).convert("RGBA"), (30, 30))
    x = 420
    for size in (128, 96, 64, 48):
        small = icon.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")
        sheet.alpha_composite(small, (x, 30))
        x += size + 20
    # Circle-masked adaptive preview.
    adaptive = Image.alpha_composite(field_with_highlight(1024), draw_mark(1024, scale=0.46))
    mask = Image.new("L", (1024, 1024), 0)
    ImageDraw.Draw(mask).ellipse((60, 60, 964, 964), fill=255)
    adaptive.putalpha(mask)
    sheet.alpha_composite(adaptive.resize((200, 200), Image.Resampling.LANCZOS), (420, 200))
    notif = Image.new("RGBA", (96, 96), (60, 64, 70, 255))
    notif.alpha_composite(glyph)
    sheet.alpha_composite(notif.resize((192, 192), Image.Resampling.NEAREST), (650, 200))
    sheet.alpha_composite(glyph.resize((48, 48), Image.Resampling.LANCZOS), (880, 200))
    out = ROOT / "_incoming" / "icon-sheet.png"
    sheet.save(out)
    print("sheet", out)


if __name__ == "__main__":
    main()
