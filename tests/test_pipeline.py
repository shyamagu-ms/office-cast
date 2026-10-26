import sys
import unittest
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "tools"), str(ROOT)]
from common import Production, build_timeline, number, read_json, write_json
from pipeline import contact_sheet, duck_curve
from shared.audio import music, sfx
from shared.audio.dsp import SR, true_peak_db
from shared.audio.limiter import limiter
from speech import ssml, trim


class TimelineTests(unittest.TestCase):
    def setUp(self):
        self.narration = {
            "voice": "ja-JP-NaokiNeural", "gap": 0.5,
            "scenes": [
                {"id": "s0", "title": "Intro", "lead": 1, "tail": 1, "lines": [
                    {"id": "a", "text": "Hello"}, {"id": "b", "text": "World", "pre": 0.8},
                ]},
                {"id": "s1", "title": "Silent scene", "hold": 2.5, "lines": []},
            ],
            "markers": {"show": {"scene": "s1", "offset": 0.2}, "end": {"duration": True, "offset": -0.5}},
        }
        self.durations = {"a": {"text": "Hello", "dur": 1.234}, "b": {"text": "World", "dur": 2.345}}

    def test_silent_scene_and_frame_alignment(self):
        timeline = build_timeline(self.narration, self.durations)
        self.assertEqual(timeline["scenes"][1]["start"], timeline["scenes"][0]["end"])
        self.assertAlmostEqual(timeline["scenes"][1]["end"] - timeline["scenes"][1]["start"], 2.5, delta=1 / 30)
        self.assertEqual(round(timeline["DURATION"] * 30), timeline["frames"])
        self.assertEqual(timeline["scenes"][-1]["end"], timeline["DURATION"])
        self.assertEqual(timeline["lines"][1]["start"], 3.034)
        for line in timeline["lines"]:
            self.assertEqual(round(line["end"] - line["start"], 3), line["dur"])
        self.assertAlmostEqual(timeline["markers"]["show"], timeline["scenes"][1]["start"] + 0.2)

    def test_stale_audio_is_rejected(self):
        self.durations["a"]["text"] = "Old text"
        with self.assertRaisesRegex(ValueError, "stale"):
            build_timeline(self.narration, self.durations)

    def test_out_of_range_marker_is_rejected(self):
        self.narration["markers"]["invalid"] = {"line": "a", "offset": -50}
        with self.assertRaises(ValueError):
            build_timeline(self.narration, self.durations)

    def test_invalid_numeric_values(self):
        for value in (True, float("nan"), float("inf"), "3"):
            with self.assertRaises(ValueError):
                number(value, "test")

    def test_path_traversal_is_rejected(self):
        for name in ("../example-production", "..\\example-production", "Bad ID", ""):
            with self.assertRaises(ValueError):
                Production(name)

    def test_template_production_schema(self):
        with tempfile.TemporaryDirectory(prefix="office-cast-test-") as directory:
            root = Path(directory)
            shutil.copytree(ROOT / "templates" / "production", root / "productions" / "template")
            shutil.copyfile(ROOT / "office-cast.json", root / "office-cast.json")
            presets = root / "shared" / "audio" / "presets.json"
            write_json(presets, read_json(ROOT / "shared" / "audio" / "presets.json"))
            with patch("common.ROOT", root):
                production = Production("template")
                self.assertEqual(len(production.narration()["scenes"]), 1)


class ContactSheetTests(unittest.TestCase):
    def test_arbitrary_scene_ids_follow_timeline_order_and_ignore_old_stills(self):
        with tempfile.TemporaryDirectory(prefix="office-cast-sheet-test-") as directory:
            out = Path(directory)
            (out / "stills").mkdir()
            for name, color in [("z-intro", "red"), ("pair", "blue"), ("share", "green"), ("s-old", "black")]:
                Image.new("RGB", (100, 100), color).save(out / "stills" / f"{name}.jpg")
            contact_sheet(SimpleNamespace(out=out), {"scenes": [
                {"id": "z-intro"}, {"id": "pair"}, {"id": "share"},
            ]})
            with Image.open(out / "contact-sheet.jpg") as sheet:
                self.assertEqual(sheet.size, (1280, 768))
                self.assertGreater(sheet.getpixel((100, 100))[0], 240)
                self.assertGreater(sheet.getpixel((740, 100))[2], 240)
                self.assertGreater(sheet.getpixel((100, 484))[1], 100)
                self.assertGreater(min(sheet.getpixel((740, 484))), 200)

    def test_missing_scene_still_is_an_explicit_error(self):
        with tempfile.TemporaryDirectory(prefix="office-cast-sheet-test-") as directory:
            with self.assertRaises(FileNotFoundError):
                contact_sheet(SimpleNamespace(out=Path(directory)), {"scenes": [{"id": "missing"}]})


class SpeechTests(unittest.TestCase):
    def test_ssml_escapes_plain_text(self):
        markup = ssml({"id": "a", "text": "A & B"}, "ja-JP-NaokiNeural", "-4%")
        self.assertIn("A &amp; B", markup)

    def test_reading_overrides_preserve_words(self):
        markup = ssml({"id": "a", "text": "人", "ssml": '<sub alias="ひと">人</sub>'}, "ja-JP-NaokiNeural", "-4%")
        self.assertIn('alias="ひと"', markup)
        with self.assertRaises(ValueError):
            ssml({"id": "a", "text": "人", "ssml": "別の文"}, "ja-JP-NaokiNeural", "-4%")

    def test_trim_and_silence_errors(self):
        with self.assertRaises(ValueError):
            trim(np.zeros(SR))
        audio = np.r_[np.zeros(SR), np.ones(100) * 0.5, np.zeros(SR)]
        self.assertEqual(len(trim(audio)), 100 + 2 * round(0.04 * SR))


class AudioTests(unittest.TestCase):
    def test_sfx_is_order_independent(self):
        first = sfx.render("paper", 2026)
        sfx.render("whoosh", 2026)
        second = sfx.render("paper", 2026)
        np.testing.assert_array_equal(first, second)
        with self.assertRaises(ValueError):
            sfx.render("missing")

    def test_all_sfx_are_finite(self):
        for name in sfx.BANK:
            with self.subTest(name=name):
                samples = sfx.render(name)
                self.assertTrue(np.isfinite(samples).all())
                self.assertLessEqual(np.abs(samples).max(), 10 ** (-6 / 20) + 1e-8)

    def test_music_none_and_presets(self):
        timeline = {
            "DURATION": 3,
            "scenes": [
                {"id": "first", "start": 0, "end": 1.5},
                {"id": "silent", "start": 1.5, "end": 3, "music": "none"},
            ],
        }
        for preset in music.PRESETS:
            with self.subTest(preset=preset):
                samples, _ = music.render(timeline, preset)
                self.assertEqual(samples.shape, (3 * SR, 2))
                self.assertTrue(np.isfinite(samples).all())
                np.testing.assert_array_equal(samples[round(1.5 * SR):], 0)

    def test_scene_splits_do_not_change_music(self):
        whole = {"DURATION": 7, "scenes": [{"id": "whole", "start": 0, "end": 7}]}
        split = {
            "DURATION": 7,
            "scenes": [
                {"id": "a", "start": 0, "end": 1.137},
                {"id": "b", "start": 1.137, "end": 4.178},
                {"id": "c", "start": 4.178, "end": 7},
            ],
        }
        for preset in music.PRESETS:
            with self.subTest(preset=preset):
                expected, _ = music.render(whole, preset)
                actual, sections = music.render(split, preset)
                np.testing.assert_array_equal(actual, expected)
                self.assertTrue(all(s["bpm"] == music.PRESETS[preset]["bpm"] for s in sections))
                for boundary in (1.137, 4.178):
                    index = round(boundary * SR)
                    self.assertGreater(np.sqrt(np.mean(actual[index:index + round(0.03 * SR)] ** 2)), 0.001)

    def test_scene_presets_change_layers_not_tempo_or_harmony(self):
        whole = {"DURATION": 7, "scenes": [{"id": "whole", "start": 0, "end": 7}]}
        split = {
            "DURATION": 7,
            "scenes": [
                {"id": "a", "start": 0, "end": 1.137},
                {"id": "b", "start": 1.137, "end": 4.178, "music": "alternate"},
                {"id": "c", "start": 4.178, "end": 7},
            ],
        }
        with patch.dict(music.PRESETS, {
            "base": {"bpm": 120, "melodyOffset": 0, "layers": ["marimba"]},
            "alternate": {"bpm": 80, "melodyOffset": 8, "layers": ["marimba"]},
        }):
            expected, _ = music.render(whole, "base")
            actual, sections = music.render(split, "base")
            np.testing.assert_array_equal(actual, expected)
            self.assertTrue(all(s["bpm"] == 120 for s in sections))

    def test_music_resumes_on_original_clock_after_mute(self):
        timeline = {
            "DURATION": 7,
            "scenes": [
                {"id": "a", "start": 0, "end": 1.137},
                {"id": "mute", "start": 1.137, "end": 2.137, "music": "none"},
                {"id": "b", "start": 2.137, "end": 7},
            ],
        }
        whole = {"DURATION": 7, "scenes": [{"id": "whole", "start": 0, "end": 7}]}
        actual, _ = music.render(timeline, "office-main")
        expected, _ = music.render(whole, "office-main")
        np.testing.assert_array_equal(actual[round(1.137 * SR):round(2.137 * SR)], 0)
        a, b = round(3 * SR), round(5 * SR)
        scale = np.sum(actual[a:b] * expected[a:b]) / np.sum(expected[a:b] ** 2)
        np.testing.assert_allclose(actual[a:b], expected[a:b] * scale, atol=1e-12)

    def test_layer_changes_crossfade_without_interrupting_common_notes(self):
        timeline = {
            "DURATION": 5,
            "scenes": [
                {"id": "a", "start": 0, "end": 2.137, "music": "office-light"},
                {"id": "b", "start": 2.137, "end": 5},
            ],
        }
        boundary = round(2.137 * SR)
        actual, sections = music.render(timeline, "office-main")
        self.assertTrue(all(s["bpm"] == 120 for s in sections))
        for start in (boundary - round(0.03 * SR), boundary):
            self.assertGreater(np.sqrt(np.mean(actual[start:start + round(0.03 * SR)] ** 2)), 0.001)
        jump = np.max(np.abs(actual[boundary] - actual[boundary - 1]))
        self.assertLess(jump, 0.01)
        np.testing.assert_array_equal(actual[-1], 0)

    def test_ducking_during_narration(self):
        curve = duck_curve([{"start": 1, "end": 2}], 3 * SR, -8)
        self.assertAlmostEqual(curve[round(1.5 * SR)], 10 ** (-8 / 20))
        self.assertEqual(curve[0], 1)

    def test_limiter(self):
        time = np.arange(SR) / SR
        samples = np.repeat((2 * np.sin(2 * np.pi * 997 * time))[:, None], 2, axis=1)
        limited, _ = limiter(samples, -2)
        self.assertLessEqual(true_peak_db(limited), -1.9)


if __name__ == "__main__":
    unittest.main()
