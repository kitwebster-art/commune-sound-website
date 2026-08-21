#!/usr/bin/env python3
"""Remove opaque black counter fills from every rotating Commune Sound wordmark."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "gpt-wordmark-studies"

# Coordinates are authored against the final transparent PNG masters. Each mask
# covers only the enclosed counters in the two O characters and the final D.
CONFIG = {
    "02-gradient-monoliths": {
        "mode": "hole",
        "ellipses": (
            (337, 190, 474, 354),
            (544, 507, 680, 680),
            (1360, 507, 1472, 683),
        ),
    },
    "04-perspective-extrusion": {
        "mode": "dark",
        "ellipses": (
            (292, 158, 500, 368),
            (488, 512, 702, 741),
            (1294, 505, 1486, 748),
        ),
    },
    "05-isometric-lattice": {
        "mode": "dark",
        "polygons": (
            ((352, 177), (455, 177), (503, 276), (419, 371), (326, 278)),
            ((543, 500), (638, 465), (720, 581), (629, 696), (526, 594)),
            ((1288, 487), (1414, 488), (1463, 590), (1387, 696), (1287, 651)),
        ),
    },
    "06-folded-ribbons": {
        "mode": "dark",
        "polygons": (
            ((426, 264), (461, 312), (426, 360), (391, 312)),
            ((646, 551), (681, 599), (646, 647), (611, 599)),
            ((1271, 559), (1347, 559), (1347, 650), (1271, 650)),
        ),
    },
    "07-technical-instruments": {
        "mode": "dark",
        "ellipses": (
            (298, 156, 525, 375),
            (527, 489, 753, 720),
            (1324, 488, 1514, 718),
        ),
    },
    "09-kinetic-fragments": {
        "mode": "copy",
    },
}

DARK_FLOOR = 16
DARK_CEILING = 46


def build_mask(size: tuple[int, int], spec: dict) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for ellipse in spec.get("ellipses", ()):
        draw.ellipse(ellipse, fill=255)
    for polygon in spec.get("polygons", ()):
        draw.polygon(polygon, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(radius=1.0))


def refine(source: Path, destination: Path, spec: dict) -> dict[str, int]:
    image = Image.open(source).convert("RGBA")
    mask = build_mask(image.size, spec)
    rgba = image.load()
    mask_pixels = mask.load()
    removed = 0
    partial = 0

    for y in range(image.height):
        for x in range(image.width):
            mask_alpha = mask_pixels[x, y]
            if spec["mode"] == "copy" or mask_alpha == 0:
                continue
            red, green, blue, alpha = rgba[x, y]
            if alpha == 0:
                continue

            if spec["mode"] == "hole":
                keep = 255 - mask_alpha
            else:
                brightness = max(red, green, blue)
                if brightness >= DARK_CEILING:
                    continue
                dark_strength = round(
                    255 * (DARK_CEILING - brightness) / (DARK_CEILING - DARK_FLOOR)
                )
                dark_strength = max(0, min(255, dark_strength))
                keep = 255 - round(mask_alpha * dark_strength / 255)

            new_alpha = round(alpha * keep / 255)
            if new_alpha == alpha:
                continue
            rgba[x, y] = (red, green, blue, new_alpha)
            if new_alpha == 0:
                removed += 1
            else:
                partial += 1

    image.save(destination, optimize=True)
    image.save(
        destination.with_suffix(".webp"),
        format="WEBP",
        lossless=True,
        method=6,
        exact=True,
    )
    return {"removed": removed, "partial": partial}


def main() -> None:
    for stem, spec in CONFIG.items():
        source = ASSET_DIR / f"{stem}-alpha-v1.png"
        destination = ASSET_DIR / f"{stem}-alpha-v2.png"
        stats = refine(source, destination, spec)
        print(
            f"{destination.name}: removed={stats['removed']} "
            f"partial={stats['partial']}"
        )


if __name__ == "__main__":
    main()
