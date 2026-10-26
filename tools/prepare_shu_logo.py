from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "shared" / "brand" / "sources" / "shu-works-designer-20261009-142928.png"
PADDING = 24
BACKGROUND_LEVEL = 244
INK_LEVEL = 22


def prepare_logo(source, color):
    pixels = np.asarray(source.convert("RGB"), dtype=np.float64)
    luminance = pixels @ np.array([0.2126, 0.7152, 0.0722])
    # This generated source has monochrome ink on an almost-white matte.
    coverage = np.clip((BACKGROUND_LEVEL - luminance) / (BACKGROUND_LEVEL - INK_LEVEL), 0, 1)
    alpha = Image.fromarray(np.rint(coverage * 255).astype(np.uint8))
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("The generated source contains no visible logo")
    crop = (
        max(0, bounds[0] - PADDING), max(0, bounds[1] - PADDING),
        min(source.width, bounds[2] + PADDING), min(source.height, bounds[3] + PADDING),
    )
    result = Image.new("RGBA", source.size, (*color, 255))
    result.putalpha(alpha)
    return result.crop(crop), crop


def main():
    with Image.open(SOURCE) as source:
        for name, color in [
            ("shu-works-logo.png", (244, 242, 238)),
            ("shu-works-logo-ink.png", (17, 17, 21)),
        ]:
            image, crop = prepare_logo(source, color)
            destination = ROOT / "shared" / "brand" / name
            image.save(destination)
            print(f"{name}: {image.width}x{image.height}, source crop={crop}")


if __name__ == "__main__":
    main()
