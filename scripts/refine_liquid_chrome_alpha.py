#!/usr/bin/env python3
"""Remove the enclosed black counters from the Liquid Chrome wordmark."""

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "gpt-wordmark-studies"
SOURCE = ASSET_DIR / "10-liquid-chrome-alpha-v1.png"
PNG_DESTINATION = ASSET_DIR / "10-liquid-chrome-alpha-v2.png"
WEBP_DESTINATION = ASSET_DIR / "10-liquid-chrome-alpha-v2.webp"
DARK_LIMIT = 32
SEEDS = (
    (380, 275),  # top O
    (610, 575),  # lower O
    (1390, 580),  # D
    (1650, 215),  # upper E counter
    (1635, 250),  # lower half of upper E counter
)


def connected_dark_region(image: Image.Image, seed: tuple[int, int]) -> set[int]:
    width, height = image.size
    pixels = image.load()
    queue = deque([seed])
    visited: set[int] = set()
    region: set[int] = set()

    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if index in visited:
            continue
        visited.add(index)
        red, green, blue, alpha = pixels[x, y]
        if alpha == 0 or max(red, green, blue) > DARK_LIMIT:
            continue
        region.add(index)
        if x > 0:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    return region


def main() -> None:
    image = Image.open(SOURCE).convert("RGBA")
    width, height = image.size
    cutout = Image.new("L", image.size, 0)
    cutout_pixels = cutout.load()
    removed: set[int] = set()

    for seed in SEEDS:
        removed.update(connected_dark_region(image, seed))

    for index in removed:
        cutout_pixels[index % width, index // width] = 255

    cutout = cutout.filter(ImageFilter.GaussianBlur(radius=1.15))
    alpha = image.getchannel("A")
    alpha_pixels = alpha.load()
    cutout_pixels = cutout.load()
    for y in range(height):
        for x in range(width):
            alpha_pixels[x, y] = min(alpha_pixels[x, y], 255 - cutout_pixels[x, y])
    image.putalpha(alpha)
    image.save(PNG_DESTINATION, optimize=True)
    image.save(
        WEBP_DESTINATION,
        format="WEBP",
        lossless=True,
        method=6,
        exact=True,
    )
    print(f"removed counter pixels: {len(removed)}")
    print(PNG_DESTINATION.name)
    print(WEBP_DESTINATION.name)


if __name__ == "__main__":
    main()
