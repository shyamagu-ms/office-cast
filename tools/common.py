import hashlib
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ID = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
LINE_ID = re.compile(r"[A-Za-z0-9_-]+")


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def number(value, label, minimum=None, maximum=None):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{label}: expected a finite number")
    if minimum is not None and value < minimum or maximum is not None and value > maximum:
        raise ValueError(f"{label}: outside supported range")
    return value


@dataclass
class Production:
    id: str

    def __post_init__(self):
        if not isinstance(self.id, str) or not ID.fullmatch(self.id):
            raise ValueError("Production ID must be lowercase kebab-case")
        self.root = ROOT / "productions" / self.id
        self.config = read_json(self.root / "project.json")
        self.studio = read_json(ROOT / "office-cast.json")
        if self.config["id"] != self.id:
            raise ValueError("project.json ID does not match its folder")
        if self.config["sharedVersion"] != self.studio["version"]:
            raise ValueError("Shared version mismatch; review the production before updating it")
        if not isinstance(self.config.get("title"), str) or not self.config["title"].strip():
            raise ValueError("project.json requires a title")
        presets = read_json(ROOT / "shared" / "audio" / "presets.json")
        if self.config["music"]["preset"] not in presets:
            raise ValueError("Unknown music preset")
        seed = self.config.get("soundEffectSeed", 2026)
        if isinstance(seed, bool) or not isinstance(seed, int) or seed < 0:
            raise ValueError("soundEffectSeed must be a nonnegative integer")
        self.story = self.root / "story"
        self.audio = self.root / "audio"
        self.build = self.root / "build"
        self.out = self.root / "out"
        self.fps = self.studio["video"]["fps"]

    def narration(self):
        value = read_json(self.story / "narration.json")
        if not isinstance(value.get("voice"), str) or not value["voice"].strip():
            raise ValueError("narration.json requires a voice")
        if not re.fullmatch(r"[+-]?\d+(?:\.\d+)?%", value.get("rate", "0%")):
            raise ValueError("Narration rate must be a percentage, such as -4%")
        number(float(value.get("rate", "0%")[:-1]), "Narration rate", -50, 100)
        number(value.get("gap", 0.5), "gap", 0, 60)
        if not isinstance(value.get("scenes"), list) or not value["scenes"]:
            raise ValueError("At least one scene is required")
        scene_ids, line_ids = set(), set()
        presets = read_json(ROOT / "shared" / "audio" / "presets.json")
        for scene in value["scenes"]:
            sid = scene["id"]
            if not isinstance(sid, str) or not LINE_ID.fullmatch(sid) or sid in scene_ids:
                raise ValueError(f"Invalid or duplicate scene ID: {sid}")
            scene_ids.add(sid)
            if not isinstance(scene.get("title"), str):
                raise ValueError(f"{sid}: a scene title is required")
            if scene.get("theme", "light") not in ("light", "dark"):
                raise ValueError(f"{sid}: unsupported theme")
            if scene.get("music", self.config["music"]["preset"]) not in {*presets, "none"}:
                raise ValueError(f"{sid}: unknown music preset")
            if not isinstance(scene.get("lines"), list):
                raise ValueError(f"{sid}: lines must be an array")
            if not scene["lines"]:
                number(scene.get("hold"), f"{sid}.hold", 0.1, 600)
            for key in ("lead", "tail"):
                number(scene.get(key, 1), f"{sid}.{key}", 0, 60)
            for line in scene["lines"]:
                lid = line["id"]
                if not isinstance(lid, str) or not LINE_ID.fullmatch(lid) or lid in line_ids:
                    raise ValueError(f"Invalid or duplicate line ID: {lid}")
                line_ids.add(lid)
                if not isinstance(line.get("text"), str) or not line["text"].strip():
                    raise ValueError(f"{lid}: narration text is required")
                if not isinstance(line.get("caption", line["text"]), str):
                    raise ValueError(f"{lid}: caption must be text")
                number(line.get("pre", value.get("gap", 0.5)), f"{lid}.pre", 0, 60)
                if "rate" in line:
                    if not re.fullmatch(r"[+-]?\d+(?:\.\d+)?%", line["rate"]):
                        raise ValueError(f"{lid}: invalid rate")
                    number(float(line["rate"][:-1]), f"{lid}.rate", -50, 100)
                if "ssml" in line and not isinstance(line["ssml"], str):
                    raise ValueError(f"{lid}: ssml must be text")
        return value


def build_timeline(narration, durations, fps=30):
    scenes, lines = [], []
    t = 0.0
    gap = narration.get("gap", 0.5)
    for scene in narration["scenes"]:
        start = round(t, 3)
        if not scene["lines"]:
            t = round(start + scene["hold"], 3)
        else:
            t = round(start + scene.get("lead", 1.0), 3)
            for index, line in enumerate(scene["lines"]):
                if index:
                    t = round(t + line.get("pre", gap), 3)
                meta = durations[line["id"]]
                if meta["text"] != line["text"]:
                    raise ValueError(f"{line['id']}: stale narration audio; run tts")
                duration = number(meta["dur"], f"{line['id']}.dur", 0.001)
                end = round(t + duration, 3)
                lines.append({
                    "id": line["id"], "scene": scene["id"], "start": t, "end": end, "dur": round(end - t, 3),
                    "text": line["text"], "caption": line.get("caption", line["text"]),
                    "captionStyle": line.get("captionStyle", "caption"),
                    "file": f"audio/voice/{line['id']}.wav",
                    "rate": line.get("rate", narration.get("rate", "0%")),
                })
                t = end
            t = round(t + scene.get("tail", 1.0), 3)
        scenes.append({
            "id": scene["id"], "title": scene["title"], "start": start, "end": t,
            "lines": [line["id"] for line in scene["lines"]], "theme": scene.get("theme", "light"),
            **({"music": scene["music"]} if "music" in scene else {}),
        })
    frames = math.ceil(t * fps - 1e-6)
    duration = round(frames / fps, 3)
    scenes[-1]["end"] = duration
    lookups = {"scene": {s["id"]: s for s in scenes}, "line": {l["id"]: l for l in lines}}
    markers = {}
    for name, rule in narration.get("markers", {}).items():
        if isinstance(rule, (int, float)) and not isinstance(rule, bool):
            marker = number(rule, f"marker {name}", 0, duration)
        else:
            if not isinstance(rule, dict):
                raise ValueError(f"marker {name}: expected a number or relative timing object")
            bases = [base for base in ("scene", "line", "duration") if base in rule]
            if len(bases) != 1:
                raise ValueError(f"marker {name}: choose one timing base")
            base = bases[0]
            if base == "duration":
                marker = duration
            else:
                edge = rule.get("edge", "start")
                if edge not in ("start", "end"):
                    raise ValueError(f"marker {name}: edge must be start/end")
                marker = lookups[base][rule[base]][edge]
            marker += number(rule.get("offset", 0), f"marker {name}.offset")
            number(marker, f"marker {name}", 0, duration)
        markers[name] = round(marker, 3)
    return {
        "fps": fps, "frames": frames, "DURATION": duration,
        "voice": narration["voice"], "rate": narration.get("rate", "0%"),
        "scenes": scenes, "lines": lines, "markers": markers,
    }
