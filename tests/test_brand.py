import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from prepare_shu_logo import SOURCE, prepare_logo


class BrandTests(unittest.TestCase):
    def test_white_matte_preserves_smooth_edges_and_counters(self):
        source = Image.new("RGB", (100, 100), (250, 250, 250))
        source.paste((11, 11, 11), (30, 30, 70, 70))
        source.paste((250, 250, 250), (40, 40, 60, 60))
        source.putpixel((30, 35), (122, 122, 122))
        result, crop = prepare_logo(source, (244, 242, 238))
        alpha = np.asarray(result.getchannel("A"))
        x, y = crop[:2]
        self.assertEqual(alpha[50 - y, 50 - x], 0)
        self.assertEqual(alpha[35 - y, 35 - x], 255)
        self.assertGreater(alpha[35 - y, 30 - x], 0)
        self.assertLess(alpha[35 - y, 30 - x], 255)
        self.assertEqual(alpha[0, 0], 0)

    def test_empty_source_fails_explicitly(self):
        with self.assertRaisesRegex(ValueError, "no visible logo"):
            prepare_logo(Image.new("RGB", (100, 100), "white"), (0, 0, 0))

    def test_saved_assets_match_the_generated_source_and_recipe(self):
        with Image.open(SOURCE) as source:
            self.assertEqual(source.size, (1536, 1024))
            for name, color in [
                ("shu-works-logo.png", (244, 242, 238)),
                ("shu-works-logo-ink.png", (17, 17, 21)),
            ]:
                expected, _ = prepare_logo(source, color)
                with Image.open(ROOT / "shared" / "brand" / name) as saved:
                    self.assertEqual(saved.mode, "RGBA")
                    self.assertGreaterEqual(saved.width, 1120)
                    np.testing.assert_array_equal(np.asarray(saved), np.asarray(expected))
                    alpha = np.asarray(saved.getchannel("A"))
                    self.assertEqual(alpha.min(), 0)
                    self.assertEqual(alpha.max(), 255)
                    self.assertTrue(((alpha > 0) & (alpha < 255)).any())
                    for edge in [alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]]:
                        self.assertFalse(edge.any())


if __name__ == "__main__":
    unittest.main()
