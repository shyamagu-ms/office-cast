import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.request
import wave
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape, quoteattr

import numpy as np

from common import ROOT, digest, read_json, write_json

SR = 48000


def ssml(line, voice, rate):
    body = line.get("ssml", escape(line["text"]))
    locale = "-".join(voice.split("-")[:2])
    result = (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        'xmlns:mstts="http://www.w3.org/2001/mstts" '
        f'xml:lang={quoteattr(locale)}><voice name={quoteattr(voice)}>'
        f'<prosody rate={quoteattr(rate)}>{body}</prosody></voice></speak>'
    )
    parsed = ET.fromstring(result)
    if "".join(parsed.itertext()) != line["text"]:
        raise ValueError(f"{line['id']}: SSML must preserve the narration text; use phoneme/sub tags for readings")
    return result


def trim(samples):
    active = np.flatnonzero(np.abs(samples) > 10 ** (-48 / 20))
    if not len(active):
        raise ValueError("Speech synthesis produced silent audio")
    pad = round(0.04 * SR)
    return samples[max(0, active[0] - pad):min(len(samples), active[-1] + pad + 1)]


def cache_key(markup):
    return hashlib.sha256(("trim-48db-pad40ms-v1|" + markup).encode()).hexdigest()


class AzureSpeech:
    def __init__(self):
        local = ROOT / "settings.local.json"
        settings = read_json(local).get("speech", {}) if local.exists() else {}
        self.region = os.environ.get("SPEECH_REGION") or settings.get("region")
        self.resource = os.environ.get("SPEECH_RESOURCE_ID") or settings.get("resourceId")
        if not self.region or not re.fullmatch(r"[a-z0-9]+", self.region):
            raise ValueError("Set SPEECH_REGION or configure settings.local.json")
        if not self.resource or not re.fullmatch(
            r"/subscriptions/[a-fA-F0-9-]+/resourceGroups/[^/#]+/providers/Microsoft\.CognitiveServices/accounts/[^/#]+",
            self.resource,
        ):
            raise ValueError("Set a valid SPEECH_RESOURCE_ID or configure settings.local.json")
        self.token = None

    def authenticate(self):
        az = shutil.which("az")
        if not az:
            raise RuntimeError("Azure CLI is missing; install it and run az login")
        proc = subprocess.run(
            [az, "account", "get-access-token", "--subscription", self.resource.split("/")[2],
             "--resource", "https://cognitiveservices.azure.com", "--output", "json", "--only-show-errors"],
            capture_output=True, text=True, encoding="utf-8", timeout=120,
        )
        if proc.returncode:
            raise RuntimeError("Azure CLI authentication failed; run az login.\n" + proc.stderr.strip())
        self.token = json.loads(proc.stdout)["accessToken"]

    def synthesize(self, markup):
        if self.token is None:
            self.authenticate()
        for attempt in range(4):
            request = urllib.request.Request(
                f"https://{self.region}.tts.speech.microsoft.com/cognitiveservices/v1",
                data=markup.encode("utf-8"),
                headers={
                    "Authorization": f"Bearer aad#{self.resource}#{self.token}",
                    "Content-Type": "application/ssml+xml",
                    "X-Microsoft-OutputFormat": "riff-48khz-16bit-mono-pcm",
                    "User-Agent": "office-cast/1.0",
                },
            )
            try:
                with urllib.request.urlopen(request, timeout=180) as response:
                    data = response.read()
                break
            except urllib.error.HTTPError as error:
                if error.code == 401 and attempt == 0:
                    self.authenticate()
                elif error.code in (429, 500, 502, 503, 504) and attempt < 3:
                    time.sleep(2 ** (attempt + 1))
                else:
                    detail = error.read(400).decode("utf-8", errors="replace")
                    raise RuntimeError(
                        f"Azure Speech HTTP {error.code}: {detail}. "
                        "For 403, check Cognitive Services Speech User/Contributor access."
                    ) from error
        else:
            raise RuntimeError("Azure Speech retry limit reached")
        with wave.open(io.BytesIO(data), "rb") as reader:
            if (reader.getframerate(), reader.getnchannels(), reader.getsampwidth()) != (SR, 1, 2):
                raise ValueError("Azure Speech returned an unexpected WAV format")
            samples = np.frombuffer(reader.readframes(reader.getnframes()), np.int16).astype(np.float64) / 32768
        if not len(samples) or not np.isfinite(samples).all():
            raise ValueError("Invalid synthesized audio")
        return trim(samples)


def synthesize_production(production, force=False, offline=False):
    narration = production.narration()
    out = production.audio / "voice"
    out.mkdir(parents=True, exist_ok=True)
    metadata_path = out / "durations.json"
    metadata = read_json(metadata_path) if metadata_path.exists() else {}
    retained = {}
    client = None
    for scene in narration["scenes"]:
        for line in scene["lines"]:
            rate = line.get("rate", narration.get("rate", "0%"))
            markup = ssml(line, narration["voice"], rate)
            key = cache_key(markup)
            path = out / f"{line['id']}.wav"
            prior = metadata.get(line["id"])
            cached = (
                not force and path.is_file() and isinstance(prior, dict)
                and prior.get("key") == key and prior.get("sha256") == digest(path)
            )
            if not cached:
                if offline:
                    raise RuntimeError(f"{line['id']}: current cached voice is missing; offline build cannot synthesize")
                if client is None:
                    client = AzureSpeech()
                samples = client.synthesize(markup)
                with wave.open(str(path), "wb") as writer:
                    writer.setnchannels(1)
                    writer.setsampwidth(2)
                    writer.setframerate(SR)
                    writer.writeframes((np.clip(samples, -1, 1) * 32767).round().astype(np.int16).tobytes())
                prior = {
                    "text": line["text"], "voice": narration["voice"], "rate": rate, "key": key,
                    "dur": round(len(samples) / SR, 6), "sha256": digest(path),
                }
                metadata[line["id"]] = prior
                write_json(metadata_path, metadata)
            retained[line["id"]] = prior
            print(f"[voice] {line['id']}: {prior['dur']:.3f}s ({'cached' if cached else 'Azure Speech'})", flush=True)
    write_json(metadata_path, retained)
    return narration, retained
