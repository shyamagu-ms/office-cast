"""Synthesized SFX bank with an explicitly resettable seed."""
import numpy as np
import hashlib
from .dsp import SR, bp, env_exp, fade_head, fade_tail, hp, hz, lp, put1, tt

PEAK = 10 ** (-6 / 20)
rng = np.random.default_rng(2026)

def noise(n):
    return rng.standard_normal(n)

def click(ms=6, lo=1500, hi=8000, tau=None):
    n = max(8, int(ms / 1000 * SR))
    return bp(noise(n), lo, hi) * env_exp(n, tau or ms / 4000, 0.0003)

def sine_sweep(f0, f1, d, tau=None, att=0.002, curve="exp"):
    t = tt(d)
    if curve == "exp":
        f = f0 * (f1 / f0) ** (t / d)
    else:
        f = f0 + (f1 - f0) * t / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(len(t), tau or d / 3, att)

def ring(freqs, d, taus, amps, att=0.0004):
    t = tt(d)
    n = len(t)
    return fade_tail(sum(a * np.sin(2 * np.pi * f * t) * env_exp(n, tau, att) for f, tau, a in zip(freqs, taus, amps)), n // 3)

def bell_tone(f, d, taus=(0.9, 0.5, 0.3, 0.12, 0.05)):
    t = tt(d)
    n = len(t)
    parts = [(1.0, 1.0), (2.0, 0.45), (2.76, 0.32), (5.40, 0.18), (8.93, 0.08)]
    return sum(a * np.sin(2 * np.pi * f * r * t) * env_exp(n, tau, 0.0008) for (r, a), tau in zip(parts, taus))

def noise_sweep(f0, f1, d, q=0.6, shape=1.5, skew=1.0):
    n = int(d * SR)
    x = noise(n + 4000)
    out = np.zeros(n)
    blk = 480
    for i in range(0, n, blk):
        f = f0 * (f1 / f0) ** (i / n)
        y = bp(x[i:i + blk + 4000], f * (1 - q / 2), f * (1 + q / 2))
        out[i:i + blk] = y[4000:4000 + min(blk, n - i)] if len(y) > 4000 else 0
    return out * np.sin(np.pi * (np.arange(n) / n) ** skew) ** shape

def s_paper():
    d = 0.3
    t = tt(d)
    x = noise_sweep(1800, 5200, d, 0.9, 1.2)
    x *= 0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 17 * t + 0.4))     # ぱらぱらした揺れ
    put1(x, click(5, 2000, 7000) * 0.4, 0.17)
    return x

def s_pon():
    d = 0.25
    t = tt(d)
    f = hz(79) * (1 + 0.06 * np.exp(-t / 0.01))                  # G5、頭で少しピッチが落ちる
    ph = 2 * np.pi * np.cumsum(f) / SR
    n = len(t)
    x = np.sin(ph) * env_exp(n, 0.07, 0.001) + 0.25 * np.sin(4 * ph) * env_exp(n, 0.012, 0.0005)
    x[: int(0.004 * SR)] += click(4, 1000, 5000)[: int(0.004 * SR)] * 0.3
    return x

def s_whoosh():
    return noise_sweep(450, 3600, 0.4, 0.7, 1.2, 0.55) + noise_sweep(900, 7000, 0.4, 0.5, 2.0, 0.55) * 0.4

def s_type(d=1.0, seed=5):
    r = np.random.default_rng(seed)
    x = np.zeros(int(d * SR))
    t = 0.004
    k = 0
    while t < d - 0.05:
        g = 0.55 + 0.45 * r.random()
        put1(x, click(5, 2200, 8500) * g, t)
        put1(x, sine_sweep(1400 + 300 * r.random(), 700, 0.02, 0.005, 0.0005) * 0.15 * g, t + 0.002)
        put1(x, click(7, 500, 2500) * 0.35 * g, t + 0.004)                # キーの底打ち
        k += 1
        t += 0.065 + 0.055 * r.random() + (0.12 if k % 6 == 0 else 0)  # ときどき間
    return x

def s_kira():
    d = 0.6
    x = np.zeros(int(d * SR))
    for j, m in enumerate([96, 100, 103, 108, 103, 107]):     # C7 E7 G7 C8 …（ハ長調）
        y = bell_tone(hz(m), 0.45, (0.18, 0.1, 0.06, 0.03, 0.015)) * (0.9 - 0.09 * j)
        put1(x, y, 0.045 * j)
    sh = hp(noise(len(x)), 7000) * np.exp(-np.arange(len(x)) / SR / 0.15) * 0.06
    return x + sh

def s_boing():
    d = 0.5
    t = tt(d)
    f = 330 * (0.45 + 0.55 * np.exp(-t / 0.18)) * (1 + 0.09 * np.sin(2 * np.pi * 13 * t) * np.exp(-t / 0.25))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)) * np.minimum(1, t / 0.005) * np.exp(-t / 0.22)
    return lp(x, 2500)

def s_ding():
    return bell_tone(hz(88), 0.4, (0.22, 0.12, 0.07, 0.03, 0.015))   # E6

def s_blip():
    d = 0.15
    x = np.zeros(int(d * SR))
    put1(x, sine_sweep(880, 1200, 0.05, 0.04, 0.001), 0)
    put1(x, sine_sweep(1320, 1760, 0.09, 0.035, 0.001) * 0.9, 0.045)
    return x

def s_click():
    """バックル／カードを差す「カチッ」：軽い樹脂の打撃（カ）＋ 18 ms 後にラッチが掛かる金属的な小さな音（チッ）"""
    d = 0.12
    x = np.zeros(int(d * SR))
    put1(x, click(3, 1800, 7000) * 0.55, 0)                                          # カ（差し込み）
    put1(x, ring([1150, 2350], 0.04, [0.008, 0.005], [0.16, 0.08]), 0.0005)          # 樹脂の胴鳴り
    put1(x, click(3, 3000, 11000) * 1.0, 0.018)                                      # チッ（ラッチ）
    put1(x, ring([3350, 5150, 7300], 0.06, [0.014, 0.008, 0.004], [0.32, 0.16, 0.07]), 0.018)
    return x

def s_buzz():
    """はじく「ブッ」：低い矩形波ぎみのブザー（G2 と増4度上の 2 音）を丸めた 0.3 秒"""
    d = 0.3
    t = tt(d)
    x = np.zeros(len(t))
    for f, a in ((98.0, 1.0), (98.0 * 2 ** 0.5, 0.45)):   # 増4度：うなりが速く、揺れて聞こえない
        ph = 2 * np.pi * f * t
        x += a * sum(np.sin(k * ph) / k for k in range(1, 40, 2) if k * f < 3500)    # 奇数倍音＝矩形波
    x = lp(x, 1500, 2)
    x = hp(x, 70, 2)
    env = np.minimum(1, t / 0.004) * (0.7 + 0.3 * np.exp(-t / 0.05)) * np.clip((d - t) / 0.035, 0, 1)
    return x * env

def s_lock():
    """透明カバーが閉まる「ガシャン」（小）：樹脂のぶつかる低い音＋ラッチの金属音＋小さな揺れ"""
    d = 0.42
    x = np.zeros(int(d * SR))
    put1(x, fade_tail(sine_sweep(210, 85, 0.14, 0.04, 0.001), 2400) * 0.85, 0)                         # ガ（ふたが当たる）
    nb = int(0.07 * SR)
    put1(x, bp(noise(nb), 900, 5500) * env_exp(nb, 0.016, 0.0004) * 0.8, 0)
    put1(x, ring([780, 1630], 0.12, [0.03, 0.02], [0.22, 0.12]), 0.001)              # 樹脂の胴鳴り
    for dt, g in ((0.034, 0.75), (0.058, 0.45), (0.083, 0.28), (0.112, 0.15)):      # シャン（ラッチ＋ふたの跳ね）
        put1(x, click(4, 2200, 10000) * g, dt)
    put1(x, ring([1870, 2980, 4460], 0.3, [0.07, 0.05, 0.03], [0.22, 0.15, 0.08]), 0.034)
    ns = int(0.25 * SR)
    put1(x, hp(noise(ns), 4500) * env_exp(ns, 0.05, 0.003) * 0.12, 0.03)
    return x

def s_stamp():
    """はんこ「ドン」：低いサンプ＋紙をたたく音＋はんこを持ち上げる小さな紙の音"""
    d = 0.36
    x = np.zeros(int(d * SR))
    put1(x, fade_tail(sine_sweep(140, 50, 0.3, 0.075, 0.0015), 4800) * 1.0, 0)                        # ドン
    nl = int(0.08 * SR)
    put1(x, lp(noise(nl), 450) * env_exp(nl, 0.02, 0.001) * 0.9, 0)
    np_ = int(0.05 * SR)
    put1(x, bp(noise(np_), 1300, 6500) * env_exp(np_, 0.01, 0.0004) * 0.35, 0.002)   # 紙をたたく
    nu = int(0.08 * SR)
    lift = bp(noise(nu), 2200, 7000) * np.sin(np.pi * np.arange(nu) / nu) ** 2 * 0.1  # はんこを離す
    put1(x, lift, 0.2)
    return x

def s_jan():
    """締めの「ジャン」：BGM の終止と同じ C の和音"""
    d = 1.5
    t = tt(d)
    n = len(t)
    x = np.zeros(n)
    for m in (48, 55, 60, 64, 67, 72):
        f = hz(m)
        ph = 2 * np.pi * f * t
        saw = sum(np.sin(k * ph) / k for k in range(1, 14) if k * f < 9000)
        a = np.minimum(1, t / 0.006) * (0.35 * np.exp(-t / 0.5) + 0.65 * np.exp(-t / 0.09))
        x += lp(saw * a, 3200) * 0.25
    x += bell_tone(hz(84), d, (0.8, 0.4, 0.25, 0.1, 0.05)) * 0.35
    kick = fade_tail(sine_sweep(130, 45, 0.35, 0.12, 0.001), 4800)
    put1(x, kick * 0.9, 0)
    cy = hp(noise(n), 4500) * env_exp(n, 0.4, 0.002) * 0.25
    return x + cy

BANK = {
    "paper": s_paper, "pon": s_pon, "whoosh": s_whoosh, "blip": s_blip, "boing": s_boing, "ding": s_ding,
    "type": s_type, "kira": s_kira,
    "click": s_click, "buzz": s_buzz, "lock": s_lock, "stamp": s_stamp, "jan": s_jan,
}

def finish(x):
    """DC 除去（20 Hz HPF）→ 頭 0.5 ms フェードイン → 末尾フェード → ピーク -6 dBFS"""
    x = hp(np.asarray(x, float), 20, 2)
    x = fade_head(x, 24)
    x = fade_tail(x, min(len(x) // 4, int(0.02 * SR)))
    return x / (np.abs(x).max() + 1e-12) * PEAK


def render(name, seed=2026):
    global rng
    if name not in BANK:
        raise ValueError(f"Unknown sound effect: {name}")
    stable_seed = int.from_bytes(hashlib.sha256(f"{seed}:{name}".encode()).digest()[:8], "big")
    rng = np.random.default_rng(stable_seed)
    return finish(BANK[name]())
