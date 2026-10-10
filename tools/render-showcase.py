"""Renders the README feature image from real emulator screenshots in docs/assets/screens.

    python tools/render-showcase.py

Outputs docs/assets/pora-features.png (three feature panels).
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "assets"
SCREENS = OUT / "screens"

FONT_CANDIDATES = [
    Path("C:/Windows/Fonts/bahnschrift.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
]
FONT_PATH = next((p for p in FONT_CANDIDATES if p.is_file()), FONT_CANDIDATES[0])

FIELD_TOP = (16, 78, 63)
FIELD_BOTTOM = (6, 24, 20)
PAPER = (245, 242, 234)
MINT = (126, 227, 198)
AMBER = (242, 196, 109)
WHITE = (255, 255, 255)


def font(size: int, weight: float | None = None) -> ImageFont.FreeTypeFont:
    face = ImageFont.truetype(str(FONT_PATH), size=size)
    if weight is not None:
        try:
            face.set_variation_by_axes([weight])
        except Exception:  # not a variable font
            pass
    return face


def gradient(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = min(1.0, max(0.0, (x * 0.3 + y * 0.9) / (w * 0.3 + h * 0.9)))
            px[x, y] = tuple(int(FIELD_TOP[i] + (FIELD_BOTTOM[i] - FIELD_TOP[i]) * t) for i in range(3))
    return img


def glow(canvas: Image.Image, centre: tuple[int, int], radius: int, colour: tuple[int, int, int], alpha: int) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = centre
    d.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=colour + (alpha,))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(radius * 0.45)))


def phone(screen_name: str, width: int, shadow: int = 40) -> Image.Image:
    """A screenshot inside a dark device frame with a soft shadow, as an RGBA tile."""
    shot = Image.open(SCREENS / screen_name).convert("RGB")
    bezel = max(8, width // 38)
    inner_w = width - 2 * bezel
    shot = ImageOps.contain(shot, (inner_w, 10_000), Image.Resampling.LANCZOS)
    height = shot.height + 2 * bezel
    pad = shadow * 2
    tile = Image.new("RGBA", (width + 2 * pad, height + 2 * pad), (0, 0, 0, 0))

    sh = Image.new("RGBA", tile.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        (pad, pad + shadow // 2, pad + width, pad + height + shadow // 2), radius=width // 8, fill=(0, 0, 0, 150)
    )
    tile.alpha_composite(sh.filter(ImageFilter.GaussianBlur(shadow)))

    d = ImageDraw.Draw(tile)
    d.rounded_rectangle((pad, pad, pad + width, pad + height), radius=width // 8, fill=(14, 18, 17, 255))
    d.rounded_rectangle((pad + 2, pad + 2, pad + width - 2, pad + height - 2), radius=width // 8 - 2, outline=(70, 86, 80, 255), width=2)

    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, shot.width, shot.height), radius=width // 8 - bezel, fill=255)
    tile.paste(shot, (pad + bezel, pad + bezel), mask)
    return tile


def app_icon(size: int) -> Image.Image:
    src = Image.open(ROOT / "assets" / "icon.png").convert("RGBA")
    src = ImageOps.contain(src, (size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", src.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, src.width, src.height), radius=src.width // 4, fill=255)
    out = Image.new("RGBA", src.size, (0, 0, 0, 0))
    out.paste(src, (0, 0), mask)
    return out


def render_features() -> None:
    size = (2400, 1100)
    canvas = Image.new("RGBA", size, PAPER + (255,))
    d = ImageDraw.Draw(canvas)
    d.text((100, 70), "Спокойный день с лекарствами", font=font(70, 650), fill=(21, 32, 28))

    panels = [
        ("history.png", "ИСТОРИЯ", "Что произошло на самом деле", "Отметки не удаляются при отмене,\nих можно выгрузить в CSV для врача."),
        ("course-selected.png", "СПРАВОЧНИК ЕСКЛП", "Название — в два касания", "Дозировка, форма и единица остатка\nподставляются из справочника."),
        ("cabinet-dark.png", "ТЁМНАЯ ТЕМА", "Удобно и вечером", "Аптечка с остатками, временем приёмов\nи предупреждением «мало»."),
    ]
    col_w = 740
    panel_w, panel_h = 700, 830
    for index, (name, tag, title, text) in enumerate(panels):
        x0 = 100 + index * col_w
        panel = Image.new("RGBA", (panel_w, panel_h), WHITE + (255,))
        pd = ImageDraw.Draw(panel)
        pd.text((50, 40), tag, font=font(24, 700), fill=(15, 107, 88))
        pd.text((50, 82), title, font=font(42, 650), fill=(21, 32, 28))
        pd.multiline_text((50, 148), text, font=font(26, 400), fill=(92, 106, 100), spacing=10)
        tile = phone(name, 340, shadow=24)
        panel.alpha_composite(tile, ((panel_w - tile.width) // 2, 260 - 48))
        mask = Image.new("L", panel.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, panel_w, panel_h), radius=44, fill=255)
        canvas.paste(panel, (x0, 210), mask)
        d.rounded_rectangle((x0, 210, x0 + panel_w, 210 + panel_h), radius=44, outline=(226, 221, 207), width=2)
    canvas.convert("RGB").save(OUT / "pora-features.png", optimize=True)
    print("wrote pora-features.png")


if __name__ == "__main__":
    render_features()
