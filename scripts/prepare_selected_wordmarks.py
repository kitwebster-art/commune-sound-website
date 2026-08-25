#!/usr/bin/env python3
"""Prepare Kit's selected stacked wordmarks as lightweight web assets."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


SELECTION = (40, 24, 35)


def prepare(source: Path, destination: Path) -> None:
    image = Image.open(source).convert("RGB")
    if image.width > 1600:
        scale = 1600 / image.width
        image = image.resize((1600, round(image.height * scale)), Image.Resampling.LANCZOS)

    output = Image.new("RGBA", image.size)
    source_pixels = image.load()
    output_pixels = output.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue = source_pixels[x, y]
            alpha = max(red, green, blue)
            if alpha == 0:
                output_pixels[x, y] = (0, 0, 0, 0)
                continue
            output_pixels[x, y] = (
                min(255, round(red * 255 / alpha)),
                min(255, round(green * 255 / alpha)),
                min(255, round(blue * 255 / alpha)),
                alpha,
            )

    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination, "WEBP", lossless=True, method=6)
    print(f"{source.name} -> {destination.name} ({output.width}x{output.height})")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("destination_dir", type=Path)
    args = parser.parse_args()

    for number in SELECTION:
        prepare(
            args.source_dir / f"{number}-stacked-website-final.png",
            args.destination_dir / f"commune-wordmark-{number}-20260825.webp",
        )


if __name__ == "__main__":
    main()
