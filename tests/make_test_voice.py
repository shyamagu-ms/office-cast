"""Create synthetic cache data for pipeline tests, never production narration."""
import sys
import wave
from pathlib import Path

import numpy as np

sys.path[:0] = [str(Path(__file__).resolve().parents[1] / "tools")]
from common import Production, digest, write_json
from speech import SR, cache_key, ssml


def main():
    production = Production(sys.argv[1])
    narration = production.narration()
    out = production.audio / "voice"
    out.mkdir(parents=True, exist_ok=True)
    metadata = {}
    t = np.arange(SR) / SR
    samples = (0.12 * np.sin(2 * np.pi * 440 * t) * np.sin(np.pi * t) ** 2 * 32767).round().astype("<i2")
    for scene in narration["scenes"]:
        for line in scene["lines"]:
            rate = line.get("rate", narration.get("rate", "0%"))
            path = out / f"{line['id']}.wav"
            with wave.open(str(path), "wb") as writer:
                writer.setparams((1, 2, SR, 0, "NONE", "not compressed"))
                writer.writeframes(samples.tobytes())
            metadata[line["id"]] = {
                "text": line["text"], "voice": narration["voice"], "rate": rate,
                "key": cache_key(ssml(line, narration["voice"], rate)),
                "dur": 1.0, "sha256": digest(path),
            }
    write_json(out / "durations.json", metadata)


if __name__ == "__main__":
    main()
