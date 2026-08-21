#!/usr/bin/env python3
"""Encode the transparent rotating wordmarks as lossless WebP assets."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "gpt-wordmark-studies"


def main() -> None:
    for source in sorted(ASSET_DIR.glob("*-alpha-v1.png")):
        destination = source.with_suffix(".webp")
        image = Image.open(source).convert("RGBA")
        image.save(
            destination,
            format="WEBP",
            lossless=True,
            method=6,
            exact=True,
        )
        before = source.stat().st_size
        after = destination.stat().st_size
        saving = 100 * (before - after) / before
        print(
            f"{destination.name}: {before} -> {after} bytes "
            f"({saving:.1f}% smaller)"
        )


if __name__ == "__main__":
    main()
