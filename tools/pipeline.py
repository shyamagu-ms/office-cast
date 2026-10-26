import argparse
import importlib.metadata
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from scipy.ndimage import minimum_filter1d, uniform_filter1d

from common import ROOT, Production, build_timeline, digest, number, read_json, write_json

sys.path.insert(0, str(ROOT))
from shared.audio import music, sfx
from shared.audio.dsp import SR, hp, lufs, true_peak_db, wload, wsave
from shared.audio.limiter import limiter
from speech import cache_key, ssml, synthesize_production


def ffmpeg():
    import os
    configured = os.environ.get("FFMPEG")
    executable = configured or imageio_ffmpeg.get_ffmpeg_exe()
    if not Path(executable).is_file() and not shutil.which(executable):
        raise FileNotFoundError(f"FFmpeg executable not found: {executable}")
    return executable


def run(command, **kwargs):
    return subprocess.run(command, check=True, **kwargs)


def timeline(production):
    narration = production.narration()
    metadata = read_json(production.audio / "voice" / "durations.json")
    for scene in narration["scenes"]:
        for line in scene["lines"]:
            markup = ssml(line, narration["voice"], line.get("rate", narration.get("rate", "0%")))
            if metadata[line["id"]]["key"] != cache_key(markup):
                raise ValueError(f"{line['id']}: voice/rate/SSML changed; run tts")
    value = build_timeline(narration, metadata, production.fps)
    value["inputHashes"] = timeline_inputs(production)
    production.build.mkdir(parents=True, exist_ok=True)
    write_json(production.build / "timeline.json", value)
    (production.build / "timeline.js").write_text(
        "window.TIMELINE = " + json.dumps(value, ensure_ascii=False) + ";\n", encoding="utf-8"
    )
    public = {**production.config, "brand": production.studio["brand"], "sfxNames": sorted(sfx.BANK)}
    (production.build / "project.js").write_text(
        "window.PRODUCTION = " + json.dumps(public, ensure_ascii=False) + ";\n", encoding="utf-8"
    )
    voice = np.zeros(round(value["DURATION"] * SR))
    for line in value["lines"]:
        path = production.root / line["file"]
        if digest(path) != metadata[line["id"]]["sha256"]:
            raise ValueError(f"{line['id']}: cached voice has been modified; run tts")
        rate, samples = wload(path)
        if rate != SR or samples.ndim != 1:
            raise ValueError(f"{line['id']}: voice must be 48-kHz mono")
        start = round(line["start"] * SR)
        if start + len(samples) > len(voice):
            raise ValueError(f"{line['id']}: voice exceeds the timeline")
        voice[start:start + len(samples)] += samples
    wsave(production.audio / "narration_full.wav", voice)
    print(f"[timeline] {value['DURATION']:.3f}s / {value['frames']} frames")
    return value


def timeline_inputs(production):
    return {
        "narration": digest(production.story / "narration.json"),
        "project": digest(production.root / "project.json"),
        "studio": digest(ROOT / "office-cast.json"),
    }


def load_timeline(production):
    value = read_json(production.build / "timeline.json")
    if value.get("inputHashes") != timeline_inputs(production):
        raise ValueError("Production inputs changed; rebuild the timeline before using generated audio/video")
    return value


def make_audio(production):
    value = load_timeline(production)
    background, sections = music.render(value, production.config["music"]["preset"])
    wsave(production.audio / "bgm.wav", background)
    write_json(production.audio / "bgm_info.json", {
        "clock": "production", "bpm": music.PRESETS[production.config["music"]["preset"]]["bpm"],
        "layerTransitionSeconds": music.LAYER_TRANSITION, "endingFadeSeconds": music.ENDING_FADE,
        "sections": sections, "samples": len(background),
    })
    bank = {name: sfx.render(name, production.config.get("soundEffectSeed", 2026)) for name in sorted(sfx.BANK)}
    for name, samples in bank.items():
        wsave(production.audio / "sfx" / f"{name}.wav", samples)
    cues = read_json(production.build / "sfx_cues.json")
    if not isinstance(cues, list):
        raise ValueError("sfx_cues.json must be an array")
    track = np.zeros_like(background)
    for cue in cues:
        if cue["name"] not in bank:
            raise ValueError(f"Unknown SFX: {cue['name']}")
        time = number(cue["t"], "SFX time", 0, value["DURATION"] - 1 / SR)
        gain = number(cue.get("gain", 1), "SFX gain", 0, 4)
        samples = bank[cue["name"]]
        offset = round(time * SR)
        count = min(len(samples), len(track) - offset)
        track[offset:offset + count] += samples[:count, None] * gain / math.sqrt(2)
    if np.max(np.abs(track)) >= 1:
        raise ValueError("SFX overlap clips the stem; reduce cue gains")
    wsave(production.audio / "sfx_track.wav", track)
    write_json(production.audio / "sfx_track_info.json", {"cues": cues, "samples": len(track)})
    print(f"[audio] Generated BGM, {len(bank)} one-shot SFX and {len(cues)} cues")


def duck_curve(lines, count, depth, bridge=0.9):
    spans = []
    for line in lines:
        a, b = line["start"], line["end"]
        if spans and a - spans[-1][1] < bridge:
            spans[-1][1] = b
        else:
            spans.append([a, b])
    times = np.arange(count) / SR
    amount = np.zeros(count)
    for a, b in spans:
        up = np.clip((times - (a - 0.15)) / 0.15, 0, 1)
        down = np.clip(1 - (times - (b + 0.10)) / 0.40, 0, 1)
        raised_cosine = 0.5 - 0.5 * np.cos(np.pi * np.minimum(up, down))
        amount = np.maximum(amount, raised_cosine)
    return 10 ** (depth * amount / 20)


def read_stem(path, count, stereo):
    rate, samples = wload(path)
    if rate != SR or len(samples) != count or not np.isfinite(samples).all():
        raise ValueError(f"{path.name}: invalid rate, duration or samples; regenerate audio")
    if stereo and (samples.ndim != 2 or samples.shape[1] != 2):
        raise ValueError(f"{path.name}: expected stereo")
    if not stereo and samples.ndim != 1:
        raise ValueError(f"{path.name}: expected mono")
    return samples


def mix(production):
    value = load_timeline(production)
    count = round(value["DURATION"] * SR)
    raw_voice = read_stem(production.audio / "narration_full.wav", count, False)
    voice = np.repeat(hp(raw_voice, 70)[:, None], 2, axis=1) / math.sqrt(2)
    background = read_stem(production.audio / "bgm.wav", count, True)
    effects = read_stem(production.audio / "sfx_track.wav", count, True)
    voice_level = lufs(voice) if value["lines"] else -16
    if np.max(np.abs(background)) > 0:
        background *= 10 ** ((voice_level - 10 - lufs(background)) / 20)
    background *= duck_curve(value["lines"], count, -8)[:, None]
    effects *= 10 ** (-9 / 20)
    effects *= duck_curve(value["lines"], count, -3, bridge=0)[:, None]
    ratios, deficit = {}, 0
    for line in value["lines"]:
        a, b = round(line["start"] * SR), round(line["end"] * SR)
        v = np.sqrt(np.mean(voice[a:b] ** 2))
        bg = np.sqrt(np.mean(background[a:b] ** 2))
        ratio = 20 * np.log10(v / (bg + 1e-12))
        deficit = max(deficit, 16 - ratio)
        ratios[line["id"]] = ratio
    background *= 10 ** (-deficit / 20)
    ratios = {lid: round(float(ratio + deficit), 3) for lid, ratio in ratios.items()}
    window = round(0.4 * SR)
    envelope = np.sqrt(np.maximum(uniform_filter1d(np.mean(effects ** 2, axis=1), window), 0))
    reference = np.full(count, max(np.sqrt(np.mean(voice ** 2)) * 10 ** (3 / 20), 0.001))
    for line in value["lines"]:
        a, b = round(line["start"] * SR), round(line["end"] * SR)
        local = np.sqrt(np.mean(voice[a:b] ** 2)) * 10 ** (-6 / 20)
        reference[a:b] = min(reference[a:b].min(), local)
    guard = np.minimum(1, reference / np.maximum(envelope, 1e-9))
    guard = uniform_filter1d(minimum_filter1d(guard, window), window // 2)
    effects *= guard[:, None]
    combined = voice + background + effects
    if np.max(np.abs(combined)) < 1e-8:
        raise ValueError("The final audio mix is silent")
    target = production.studio["audio"]["targetLufs"]
    gain = target - lufs(combined)
    for _ in range(8):
        mastered, reduction = limiter(combined * 10 ** (gain / 20), -2)
        error = target - lufs(mastered)
        if abs(error) < 0.02:
            break
        gain += error
    if abs(target - lufs(mastered)) > 0.15 or true_peak_db(mastered) > -1.9:
        raise ValueError("Mastering did not meet loudness/true-peak targets")
    wsave(production.audio / "mix.wav", mastered)
    info = {
        "lufs": round(lufs(mastered), 3), "truePeakDbtp": round(true_peak_db(mastered), 3),
        "voiceMusicRatioDb": ratios, "masterGainDb": round(gain, 3),
        "limiterReductionDb": round(reduction, 3), "samples": count,
        "bgmRelativeDb": -10, "duckDb": -8, "sfxRelativeDb": -9, "sfxDuckDb": -3,
    }
    write_json(production.audio / "mix_info.json", info)
    print(f"[mix] {info['lufs']} LUFS / {info['truePeakDbtp']} dBTP")
    return info


def mux(production):
    load_timeline(production)
    production.out.mkdir(parents=True, exist_ok=True)
    destination = production.out / f"{production.id}.mp4"
    run([
        ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(production.build / "video_noaudio.mp4"), "-i", str(production.audio / "mix.wav"),
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-ar", str(SR), "-ac", "2", "-metadata", f"title={production.config['title']}",
        "-metadata", f"artist={production.studio['brand']}", "-movflags", "+faststart", str(destination),
    ])
    print(f"[output] {destination}")
    return destination


def contact_sheet(production, timeline):
    from PIL import Image, ImageDraw
    stills = [production.out / "stills" / f"{scene['id']}.jpg" for scene in timeline["scenes"]]
    sheet = Image.new("RGB", (1280, 384 * math.ceil(len(stills) / 2)), "#ece8e1")
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(stills):
        x, y = index % 2 * 640, index // 2 * 384
        with Image.open(path) as image:
            sheet.paste(image.resize((640, 360)), (x, y))
        draw.text((x + 12, y + 365), path.stem, fill="#1f1d1b")
    sheet.save(production.out / "contact-sheet.jpg", quality=94)


def qc(production):
    value = load_timeline(production)
    destination = production.out / f"{production.id}.mp4"
    decoded = run([
        ffmpeg(), "-hide_banner", "-nostats", "-i", str(destination), "-map", "0:v:0",
        "-an", "-progress", "pipe:1", "-f", "null", "-",
    ], capture_output=True, text=True, encoding="utf-8")
    frames = [int(n) for n in re.findall(r"^frame=(\d+)", decoded.stdout, re.M)]
    audio = run([
        ffmpeg(), "-v", "error", "-i", str(destination), "-map", "0:a:0", "-f", "f32le",
        "-c:a", "pcm_f32le", "-ar", str(SR), "-ac", "2", "pipe:1",
    ], capture_output=True).stdout
    samples = np.frombuffer(audio, dtype="<f4").reshape(-1, 2).astype(np.float64)
    audio_lufs, peak = lufs(samples), true_peak_db(samples)
    header = decoded.stderr
    target = production.studio["audio"]
    render = read_json(production.build / "render_checks.json")
    info = read_json(production.audio / "mix_info.json")
    checks = {
        "frameCount": bool(frames) and frames[-1] == value["frames"],
        "resolution": "1920x1080" in header,
        "fps": bool(re.search(r"30 fps", header)),
        "h264": "Video: h264" in header,
        "yuv420p": "yuv420p" in header,
        "bt709": "bt709" in header,
        "aac48kStereo": bool(re.search(r"Audio: aac.*48000 Hz, stereo", header)),
        "audioLength": abs(len(samples) - round(value["DURATION"] * SR)) <= 1024,
        "loudness": abs(audio_lufs - target["targetLufs"]) <= 0.3,
        "truePeak": peak <= target["maxTruePeak"],
        "finiteNonClippingAudio": bool(np.isfinite(samples).all() and np.max(np.abs(samples)) < 1),
        "voiceMusicClarity": all(r >= 16 for r in info["voiceMusicRatioDb"].values()),
        "captionSafeArea": all(c["fits"] for c in render["captions"]),
        "captionCoverage": len(render["captions"]) == len(value["lines"]),
        "deterministicSeek": render["deterministicSeek"],
        "noBrowserErrors": render["browserErrors"] == [],
    }
    report = {
        "file": destination.name, "DURATION": value["DURATION"], "framesExpected": value["frames"],
        "framesDecoded": frames[-1] if frames else None, "audioSamples": len(samples),
        "lufs": round(audio_lufs, 3), "truePeakDbtp": round(peak, 3),
        "checks": checks, "passed": all(checks.values()),
    }
    write_json(production.out / "qc_final.json", report)
    run([
        ffmpeg(), "-y", "-v", "error", "-i", str(destination),
        "-vf", f"select=eq(n\\,{value['frames'] - 1})", "-frames:v", "1", "-update", "1",
        str(production.out / "ending.png"),
    ])
    contact_sheet(production, value)
    print(f"[qc] {sum(checks.values())}/{len(checks)} checks passed")
    if not report["passed"]:
        raise RuntimeError("QC failed: " + ", ".join(name for name, passed in checks.items() if not passed))
    return report


def manifest(production):
    files = [
        ROOT / "office-cast.json", ROOT / "package.json", ROOT / "package-lock.json", ROOT / "requirements.txt",
        ROOT / "AGENTS.md", ROOT / "README.md",
    ]
    for folder in (ROOT / "shared", ROOT / "tools", ROOT / "docs", production.root / "src", production.story):
        files.extend(p for p in folder.rglob("*") if p.is_file() and "__pycache__" not in p.parts)
    files.append(production.root / "project.json")
    shared = {str(p.relative_to(ROOT)): digest(p) for p in sorted(set(files))}
    generated = {}
    for folder in (production.audio, production.build, production.out):
        for path in sorted(folder.rglob("*")):
            if path.is_file() and path.name != "manifest.json":
                generated[str(path.relative_to(production.root))] = digest(path)
    write_json(production.out / "manifest.json", {
        "brand": production.studio["brand"], "sharedVersion": production.studio["version"],
        "production": production.config, "python": sys.version.split()[0],
        "pythonDependencies": {p: importlib.metadata.version(p) for p in ["numpy", "scipy", "Pillow", "imageio-ffmpeg"]},
        "node": run([shutil.which("node"), "--version"], capture_output=True, text=True).stdout.strip(),
        "nodeDependencies": {
            name: read_json(ROOT / "node_modules" / name / "package.json")["version"]
            for name in ["gsap", "playwright-core"]
        },
        "browser": read_json(production.build / "render_checks.json")["browserVersion"],
        "ffmpeg": run([ffmpeg(), "-version"], capture_output=True, text=True).stdout.splitlines()[0],
        "sourceHashes": shared, "generatedHashes": generated,
    })


def render(production, *options):
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js is missing")
    run([node, str(ROOT / "tools" / "render.mjs"), "--production", production.id, *options], cwd=ROOT)


def main():
    parser = argparse.ArgumentParser(description="Office Cast production pipeline")
    parser.add_argument("command", choices=["tts", "timeline", "audio", "mix", "mux", "qc", "build"])
    parser.add_argument("--production", required=True)
    parser.add_argument("--offline", action="store_true", help="Require current cached voices; never contact Azure")
    parser.add_argument("--force-voice", action="store_true")
    args = parser.parse_args()
    if args.offline and args.force_voice:
        parser.error("--offline and --force-voice cannot be combined")
    production = Production(args.production)
    if args.command in ("tts", "build"):
        synthesize_production(production, args.force_voice, args.offline)
    if args.command in ("timeline", "build"):
        timeline(production)
    if args.command == "build":
        render(production, "--cues")
    if args.command in ("audio", "build"):
        make_audio(production)
    if args.command in ("mix", "build"):
        mix(production)
    if args.command == "build":
        render(production, "--video")
    if args.command in ("mux", "build"):
        mux(production)
    if args.command in ("qc", "build"):
        qc(production)
        manifest(production)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
