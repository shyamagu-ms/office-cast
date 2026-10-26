import json
from pathlib import Path

import numpy as np
from scipy.ndimage import uniform_filter1d

from .dsp import SR, lufs, put2, true_peak_db
from .extra_instruments import pad, piano
from .instruments import glock, marimba, pizz, shaker, woodblock
from .theme import CH, MEL, PROG

PRESETS = json.loads(Path(__file__).with_name("presets.json").read_text(encoding="utf-8"))
LAYER_TRANSITION = 0.6
ENDING_FADE = 1.2


def render(timeline, preset):
    if preset not in PRESETS:
        raise ValueError(f"Unknown music preset: {preset}")
    total = round(timeline["DURATION"] * SR)
    result = np.zeros((total, 2))
    recipe = PRESETS[preset]
    beat = 60 / recipe["bpm"]
    sections, layers = [], set()
    for scene in timeline["scenes"]:
        name = scene.get("music", preset)
        if name != "none" and name not in PRESETS:
            raise ValueError(f"Unknown music preset: {name}")
        start, end = round(scene["start"] * SR), round(scene["end"] * SR)
        if not 0 <= start < end <= total:
            raise ValueError(f"Invalid music section: {scene['id']}")
        if name != "none":
            layers.update(PRESETS[name]["layers"])
        sections.append({"scene": scene["id"], "preset": name, "bpm": recipe["bpm"]})
    supported = {"marimba", "bass", "woodblock", "glock", "shaker", "piano", "pad"}
    if layers - supported:
        raise ValueError(f"Unsupported music layers: {sorted(layers - supported)}")
    for layer in sorted(layers):
        track = np.zeros_like(result)
        for eighth in range(int(np.ceil(timeline["DURATION"] / (beat / 2)))):
            t = eighth * beat / 2
            bar, slot = divmod(eighth, 8)
            index = (bar + recipe["melodyOffset"]) % len(MEL)
            tones, root = CH[PROG[index]]
            note = MEL[index][slot]
            if layer == "marimba" and note is not None:
                put2(track, marimba(note), t, 0.12, 0.42 * (1 if slot == 0 else 0.78))
            elif layer == "bass" and slot % 2 == 0:
                put2(track, pizz([root, root + 7, root + 12, root + 7][slot // 2]), t, -0.05, 0.50)
            elif layer == "woodblock" and slot % 2 == 1:
                put2(track, woodblock(slot in (3, 7)), t, 0.35, 0.13)
            elif layer == "glock" and note is not None and slot in (0, 4):
                put2(track, glock(note + 12), t, 0.30, 0.10)
            elif layer == "shaker":
                put2(track, shaker(eighth), t, 0.55, 0.035)
            elif layer == "piano" and slot % 2 == 0:
                put2(track, piano(tones[(slot // 2) % len(tones)], vel=0.65), t, -0.15, 0.42)
            elif layer == "pad" and slot == 0:
                put2(track, pad(tuple(tones), min(4 * beat, timeline["DURATION"] - t)), t, 0.15, 0.15)
        presence = np.zeros(total)
        for scene, section in zip(timeline["scenes"], sections):
            name = section["preset"]
            if name != "none" and layer in PRESETS[name]["layers"]:
                presence[round(scene["start"] * SR):round(scene["end"] * SR)] = 1
        # Change the orchestration, never the score's clock or the shared instruments' tails.
        gain = np.clip(uniform_filter1d(presence, round(LAYER_TRANSITION * SR), mode="nearest"), 0, 1)
        gain = gain * gain * (3 - 2 * gain)
        result += track * gain[:, None]
    dry = result.copy()
    for delay, gain in ((0.043, 0.10), (0.079, 0.06)):
        offset = round(delay * SR)
        if offset < total:
            result[offset:] += dry[:-offset] * gain
    gate = np.ones(total)
    for scene, section in zip(timeline["scenes"], sections):
        if section["preset"] != "none":
            continue
        start, end = round(scene["start"] * SR), round(scene["end"] * SR)
        before, after = max(0, start - round(LAYER_TRANSITION * SR)), min(total, end + round(LAYER_TRANSITION * SR))
        gate[before:start] = np.minimum(gate[before:start], 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, start - before)))
        gate[start:end] = 0
        gate[end:after] = np.minimum(gate[end:after], 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, after - end)))
    opening, ending = min(round(0.12 * SR), total // 2), min(round(ENDING_FADE * SR), total // 2)
    gate[:opening] *= np.linspace(0, 1, opening)
    gate[-ending:] *= np.linspace(1, 0, ending)
    result *= gate[:, None]
    if np.max(np.abs(result)) > 0:
        result *= 10 ** ((-18 - lufs(result)) / 20)
        if true_peak_db(result) > -1:
            result *= 10 ** ((-1 - true_peak_db(result)) / 20)
    return result, sections
