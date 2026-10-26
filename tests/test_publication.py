import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PublicationTests(unittest.TestCase):
    def test_logo_generation_records_exclude_prompts(self):
        records = list((ROOT / "shared" / "brand" / "sources").glob("*.json"))
        self.assertTrue(records)
        for path in records:
            record = json.loads(path.read_text(encoding="utf-8"))
            self.assertNotIn("prompt", record, path.name)
            for key in ("generator", "generatedOn", "sourceImage", "localProcessing"):
                self.assertIn(key, record, path.name)


if __name__ == "__main__":
    unittest.main()
