from __future__ import annotations

from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "assets"
SCREENS = OUT / "screens"
OUT.mkdir(parents=True, exist_ok=True)

INDIGO = "#4658D9"
INDIGO_DARK = "#27346F"
INK = "#17203B"
PAPER = "#F4F5FA"
WHITE = "#FFFFFF"
MUTED = "#69738D"
LINE = "#D8DCE8"
SIGNAL = "#F08B65"
MINT = "#78D5BE"

FONT_CANDIDATES = [
    Path("C:/Windows/Fonts/bahnschrift.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/Library/Fonts/Arial Unicode.ttf"),
]
FONT_PATH = next((path for path in FONT_CANDIDATES if path.is_file()), FONT_CANDIDATES[0])


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size=size)


def tracking(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, size: int, fill: str, spacing: int = 2) -> None:
    x, y = xy
    face = font(size)
    for char in text:
        draw.text((x, y), char, font=face, fill=fill)
        x += int(draw.textlength(char, font=face)) + spacing


def noise(size: tuple[int, int], opacity: int = 5) -> Image.Image:
    rng = Random(1313)
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    pixels = layer.load()
    for y in range(size[1]):
        for x in range(size[0]):
            value = rng.randrange(opacity + 1)
            pixels[x, y] = (255, 255, 255, value)
    return layer.filter(ImageFilter.GaussianBlur(0.3))


def icon(size: int) -> Image.Image:
    source = Image.open(ROOT / "assets" / "icon.png").convert("RGBA")
    return ImageOps.contain(source, (size, size), Image.Resampling.LANCZOS)


def shadow_card(canvas: Image.Image, box: tuple[int, int, int, int], radius: int = 28) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x1, y1, x2, y2 = box
    draw.rounded_rectangle((x1 + 4, y1 + 12, x2 + 4, y2 + 12), radius=radius, fill=(23, 32, 59, 38))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(16)))


def render_banner() -> None:
    size = (1600, 440)
    canvas = Image.new("RGBA", size, PAPER)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 14, size[1]), fill=INDIGO)
    draw.rectangle((14, 0, 18, size[1]), fill=SIGNAL)
    tracking(draw, (82, 42), "LOCAL-FIRST / ANDROID", 18, MUTED)
    draw.text((76, 94), "ПОРА", font=font(90), fill=INK)
    tracking(draw, (82, 216), "РАСПИСАНИЕ / НАПОМИНАНИЯ / ИСТОРИЯ", 20, INDIGO, 1)
    draw.text((80, 270), "Локальный сценарий. Точный сигнал. Понятная история.", font=font(22), fill=MUTED)

    y = 366
    draw.line((84, y, 760, y), fill=LINE, width=3)
    for x, color in [(100, INDIGO), (420, SIGNAL), (742, MINT)]:
        draw.ellipse((x - 10, y - 10, x + 10, y + 10), fill=color)

    draw.line((1038, 64, 1038, 378), fill=LINE, width=2)
    app_icon = icon(270)
    canvas.alpha_composite(app_icon, (1172, 62))
    tracking(draw, (1086, 364), "PLAN / REMIND / RECORD", 15, MUTED, 2)
    canvas = Image.alpha_composite(canvas, noise(size)).convert("RGB")
    canvas.save(OUT / "pora-banner.png", optimize=True, quality=94)


def render_social() -> None:
    size = (1280, 640)
    canvas = Image.new("RGBA", size, INDIGO_DARK)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 14, size[1]), fill=INDIGO)
    draw.rectangle((14, 0, 18, size[1]), fill=SIGNAL)
    tracking(draw, (76, 58), "ANDROID / SIGNED RELEASE", 17, "#BFC8EA")
    draw.text((70, 126), "Пора", font=font(92), fill=WHITE)
    draw.text((76, 250), "Напоминания, которые", font=font(29), fill="#DDE3FA")
    draw.text((76, 292), "остаются рядом.", font=font(29), fill="#DDE3FA")
    tracking(draw, (76, 524), "LOCAL / EXACT / OPTIONAL SYNC", 16, "#BFC8EA", 2)

    app_icon = icon(248)
    canvas.alpha_composite(app_icon, (508, 186))

    screenshot = Image.open(SCREENS / "today-clean-install.png").convert("RGB")
    screenshot = ImageOps.contain(screenshot, (250, 510), Image.Resampling.LANCZOS)
    x, y = 928, 66
    shadow_card(canvas, (x - 14, y - 14, x + screenshot.width + 14, y + screenshot.height + 14), 34)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((x - 10, y - 10, x + screenshot.width + 10, y + screenshot.height + 10), radius=28, fill=WHITE)
    canvas.paste(screenshot, (x, y))
    canvas = Image.alpha_composite(canvas, noise(size)).convert("RGB")
    canvas.save(OUT / "pora-social-preview.png", optimize=True, quality=94)


def render_product() -> None:
    size = (1440, 920)
    canvas = Image.new("RGBA", size, PAPER)
    draw = ImageDraw.Draw(canvas)
    tracking(draw, (70, 42), "REAL RELEASE SCREENS / ANDROID 16", 16, MUTED, 2)
    draw.text((66, 82), "Один спокойный ежедневный цикл", font=font(45), fill=INK)

    items = [
        ("01 / СЕГОДНЯ", "today-clean-install.png"),
        ("02 / КУРС", "course-form.png"),
        ("03 / ВРЕМЯ", "time-picker.png"),
    ]
    xs = [150, 570, 990]
    for x, (label, filename) in zip(xs, items):
        tracking(draw, (x, 166), label, 16, MUTED, 2)
        screenshot = Image.open(SCREENS / filename).convert("RGB")
        screenshot = ImageOps.contain(screenshot, (300, 660), Image.Resampling.LANCZOS)
        y = 214
        shadow_card(canvas, (x - 16, y - 16, x + screenshot.width + 16, y + screenshot.height + 16), 34)
        draw = ImageDraw.Draw(canvas)
        draw.rounded_rectangle((x - 10, y - 10, x + screenshot.width + 10, y + screenshot.height + 10), radius=28, fill=WHITE, outline=LINE, width=1)
        canvas.paste(screenshot, (x, y))

    draw.line((70, 874, 1370, 874), fill=LINE, width=2)
    tracking(draw, (70, 888), "PLAN / REMIND / RECORD", 15, INK, 2)
    tracking(draw, (1110, 888), "ACTUAL UI", 15, MUTED, 2)
    canvas.convert("RGB").save(OUT / "pora-product.png", optimize=True, quality=94)


if __name__ == "__main__":
    render_banner()
    render_social()
    render_product()
    print("Rendered Pora GitHub assets")
