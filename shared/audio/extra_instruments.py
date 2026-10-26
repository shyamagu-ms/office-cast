"""Piano and pad voices for Office Cast."""
from functools import lru_cache

import numpy as np
from .dsp import SR, bp, env_exp, hz, lp, tt
from .instruments import _rng

@lru_cache(maxsize=None)
def piano(m, d=2.4, vel=0.8):
    """ピアノ：わずかに不協和な倍音（弦の硬さ）＋2 段の減衰＋ハンマーのノイズ。高い音ほど短く、弱いほど暗い"""
    f = hz(m)
    t = tt(d)
    n = len(t)
    Bi = 0.00035
    tau1 = 2.6 * (261.6 / f) ** 0.6
    x = np.zeros(n)
    for k in range(1, 14):
        fk = k * f * np.sqrt(1 + Bi * k * k)
        if fk > 9000:
            break
        a = (1 / k ** 1.25) * (vel ** (0.4 * (k - 1)))
        tk = tau1 / (1 + 0.35 * (k - 1))
        e = 0.55 * env_exp(n, tk * 0.12, 0.002) + 0.45 * env_exp(n, tk, 0.002)
        x += a * (np.sin(2 * np.pi * fk * t) + 0.6 * np.sin(2 * np.pi * fk * 1.0012 * t + 0.7)) * e
    nh = int(0.02 * SR)
    x[:nh] += bp(_rng(m + 500).standard_normal(nh), 400, 3000) * env_exp(nh, 0.004, 0.0005) * 0.15
    x = lp(x, 1800 + 3500 * vel)
    rel = min(n, int(0.25 * SR))
    x[-rel:] *= np.linspace(1, 0, rel) ** 2
    return x * 0.6

@lru_cache(maxsize=None)
def pad(notes, d, cut=1400.0):
    """パッド：各音を ±7 cent でずらした 3 本のノコギリ波（倍音は cut まで）、ゆっくり立ち上がり・ゆっくり消える"""
    t = tt(d)
    n = len(t)
    x = np.zeros(n)
    for m in notes:
        f0 = hz(m)
        for c, ph0 in ((-7, 0.0), (0, 1.3), (7, 2.6)):
            f = f0 * 2 ** (c / 1200)
            for k in range(1, 12):
                if k * f > cut * 2.2:
                    break
                x += np.sin(2 * np.pi * k * f * t + ph0 * k) / k
    x = lp(x, cut, 2)
    att, rel = min(0.6, d / 3), min(1.0, d / 2.5)
    env = np.minimum(1, t / att) * np.clip((d - t) / rel, 0, 1)
    env = env * env * (3 - 2 * env)
    trem = 1 + 0.06 * np.sin(2 * np.pi * 0.35 * t)       # ごくゆるい揺れ
    return x * env * trem / (len(notes) * 3) * 1.6
