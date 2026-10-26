"""Shared DSP primitives preserved from the original Office Cast productions."""
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter, resample_poly, sosfilt

SR = 48000

def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)

def tt(d):
    return np.arange(int(round(d * SR))) / SR

def env_exp(n, tau, att=0.002):
    t = np.arange(n) / SR
    a = np.minimum(1, t / att) if att > 0 else 1
    return a * np.exp(-t / tau)

def bp(x, lo, hi, o=2):
    hi = min(hi, SR / 2 - 200)
    return sosfilt(butter(o, [lo, hi], "band", fs=SR, output="sos"), x)

def lp(x, f, o=2):
    return sosfilt(butter(o, min(f, SR / 2 - 200), "low", fs=SR, output="sos"), x)

def hp(x, f, o=2):
    return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)

def fade_tail(x, n=480):
    n = min(n, len(x))
    if n > 0:
        x[-n:] *= np.linspace(1, 0, n)
    return x

def fade_head(x, n=48):
    n = min(n, len(x))
    if n > 0:
        x[:n] *= np.linspace(0, 1, n)
    return x

def pad_to(x, n):
    return np.r_[x, np.zeros(max(0, n - len(x)))][:n]

def put1(buf, x, t, g=1.0):
    """mono バッファに加算"""
    i = int(round(t * SR))
    if i < 0:
        x, i = x[-i:], 0
    n = min(len(x), len(buf) - i)
    if n > 0:
        buf[i:i + n] += x[:n] * g

def put2(buf, x, t, pan=0.0, g=1.0):
    """stereo バッファ (N,2) に定パワーパンで加算"""
    i = int(round(t * SR))
    if g == 0 or i >= len(buf):
        return
    if i < 0:
        x, i = x[-i:], 0
    n = min(len(x), len(buf) - i)
    if n <= 0:
        return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + n, 0] += x[:n] * g * l * 1.4142
    buf[i:i + n, 1] += x[:n] * g * r * 1.4142

def wsave(p, x):
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(p), SR, (np.clip(x, -1, 1) * 32767).round().astype(np.int16))

def wload(p):
    sr, x = wavfile.read(str(p))
    if x.dtype == np.int16:
        x = x.astype(np.float64) / 32768.0
    elif x.dtype == np.int32:
        x = x.astype(np.float64) / 2147483648.0
    else:
        x = x.astype(np.float64)
    return sr, x

def lufs(x):
    """ITU-R BS.1770-4 積分ラウドネス（48 kHz 用係数）。x: (N,) or (N,C)"""
    if x.ndim == 1:
        x = x[:, None]
    b0 = np.array([1.53512485958697, -2.69169618940638, 1.19839281085285])
    a0 = np.array([1.0, -1.69065929318241, 0.73248077421585])
    b1 = np.array([1.0, -2.0, 1.0])
    a1 = np.array([1.0, -1.99004745483398, 0.99007225036621])
    y = lfilter(b1, a1, lfilter(b0, a0, x, axis=0), axis=0)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    if len(y) < blk:
        return -120.0
    cs = np.r_[0, np.cumsum(np.sum(y ** 2, 1))]
    starts = np.arange(0, len(y) - blk + 1, hop)
    ms = (cs[starts + blk] - cs[starts]) / blk
    l = -0.691 + 10 * np.log10(ms + 1e-15)
    g = ms[l > -70]
    if len(g) == 0:
        return -120.0
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g = ms[(l > -70) & (l > rel)]
    return float(-0.691 + 10 * np.log10(g.mean()))

def true_peak_db(x):
    if x.ndim == 1:
        x = x[:, None]
    up = resample_poly(x, 4, 1, axis=0)
    return float(20 * np.log10(np.abs(up).max() + 1e-12))

def db(v):
    return 20 * np.log10(np.abs(v) + 1e-12)
