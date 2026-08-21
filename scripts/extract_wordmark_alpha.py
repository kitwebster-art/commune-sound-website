#!/usr/bin/env python3
"""Extract connected near-black wordmark backgrounds into real PNG alpha."""

from collections import deque
from pathlib import Path
from statistics import median

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "gpt-wordmark-studies"
SOURCES = (
    "02-gradient-monoliths.png",
    "04-perspective-extrusion.png",
    "05-isometric-lattice.png",
    "06-folded-ribbons.png",
    "07-technical-instruments.png",
    "09-kinetic-fragments.png",
    "10-liquid-chrome.png",
)
FLOOD_LIMIT = 24
TRANSPARENT_FLOOR = 10


def border_background_level(image: Image.Image) -> int:
    pixels = image.load()
    width, height = image.size
    border = []
    for x in range(width):
        border.extend((max(pixels[x, 0]), max(pixels[x, height - 1])))
    for y in range(height):
        border.extend((max(pixels[0, y]), max(pixels[width - 1, y])))
    return int(median(border))


def extract(source: Path, destination: Path) -> dict[str, int]:
    source_image = Image.open(source).convert("RGB")
    width, height = source_image.size
    rgb = source_image.load()
    background = border_background_level(source_image)
    connected = bytearray(width * height)
    queue: deque[int] = deque()

    def eligible(x: int, y: int) -> bool:
        return max(rgb[x, y]) <= FLOOD_LIMIT

    def seed(x: int, y: int) -> None:
        index = y * width + x
        if not connected[index] and eligible(x, y):
            connected[index] = 1
            queue.append(index)

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)

    while queue:
        index = queue.popleft()
        x = index % width
        y = index // width
        if x > 0:
            seed(x - 1, y)
        if x + 1 < width:
            seed(x + 1, y)
        if y > 0:
            seed(x, y - 1)
        if y + 1 < height:
            seed(x, y + 1)

    rgba = Image.new("RGBA", (width, height))
    output = rgba.load()
    transparent = 0
    partial = 0
    scale = FLOOD_LIMIT - TRANSPARENT_FLOOR

    for y in range(height):
        for x in range(width):
            red, green, blue = rgb[x, y]
            if not connected[y * width + x]:
                output[x, y] = (red, green, blue, 255)
                continue

            signal = max(red, green, blue) - background
            alpha = max(
                0,
                min(255, round((signal - TRANSPARENT_FLOOR) * 255 / scale)),
            )
            if alpha == 0:
                transparent += 1
                output[x, y] = (0, 0, 0, 0)
            elif alpha < 255:
                partial += 1
                output[x, y] = (
                    min(255, round(red * 255 / alpha)),
                    min(255, round(green * 255 / alpha)),
                    min(255, round(blue * 255 / alpha)),
                    alpha,
                )
            else:
                output[x, y] = (red, green, blue, 255)

    rgba.save(destination, optimize=True)
    return {"transparent": transparent, "partial": partial, "total": width * height}


def main() -> None:
    for filename in SOURCES:
        source = ASSET_DIR / filename
        destination = source.with_name(f"{source.stem}-alpha-v1.png")
        stats = extract(source, destination)
        print(
            f"{destination.name}: transparent={stats['transparent']} "
            f"partial={stats['partial']} total={stats['total']}"
        )


if __name__ == "__main__":
    main()
