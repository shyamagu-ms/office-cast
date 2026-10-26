"""The original synthesized Office Cast instrument set."""
from functools import lru_cache

import numpy as np
from .dsp import SR, bp, env_exp, fade_tail, hp, hz, lp, tt

def _rng(seed):
    return np.random.default_rng(seed)

@lru_cache(maxsize=None)
def marimba(m, d=0.9):
    f = hz(m)
    t = tt(d)
    n = len(t)
    tau = 0.42 * (440 / f) ** 0.45
    x = (np.sin(2 * np.pi * f * t) * env_exp(n, tau, 0.0015)
         + 0.22 * np.sin(2 * np.pi * f * 3.99 * t) * env_exp(n, tau * 0.18, 0.001)
         + 0.06 * np.sin(2 * np.pi * f * 9.9 * t) * env_exp(n, 0.012, 0.0005))
    nz = bp(_rng(m).standard_normal(int(0.012 * SR)), 800, 4000) * env_exp(int(0.012 * SR), 0.002, 0.0003)
    x[:len(nz)] += nz * 0.10
    return fade_tail(x)

@lru_cache(maxsize=None)
def xylo(m, d=0.45):
    f = hz(m)
    t = tt(d)
    n = len(t)
    x = (np.sin(2 * np.pi * f * t) * env_exp(n, 0.13, 0.001)
         + 0.35 * np.sin(2 * np.pi * f * 3.0 * t) * env_exp(n, 0.05, 0.001)
         + 0.10 * np.sin(2 * np.pi * f * 6.1 * t) * env_exp(n, 0.015, 0.0005))
    return fade_tail(x)

@lru_cache(maxsize=None)
def glock(m, d=1.6, tau=0.7):
    f = hz(m)
    t = tt(d)
    n = len(t)
    x = (np.sin(2 * np.pi * f * t) * env_exp(n, tau, 0.001)
         + 0.25 * np.sin(2 * np.pi * f * 2.76 * t) * env_exp(n, tau * 0.25, 0.001)
         + 0.10 * np.sin(2 * np.pi * f * 5.40 * t) * env_exp(n, tau * 0.08, 0.0005))
    return fade_tail(x)

@lru_cache(maxsize=None)
def pizz(m, d=0.7, tau=0.32, cut=2200):
    """ピチカート（弦をはじく）：倍音ごとに速く減衰＋胴鳴りのローパス"""
    f = hz(m)
    t = tt(d)
    n = len(t)
    x = np.zeros(n)
    for k in range(1, 12):
        if k * f > 7000:
            break
        x += np.sin(2 * np.pi * k * f * t * (1 + 0.0004 * k * k)) / k ** 1.1 * env_exp(n, tau / k ** 0.7, 0.003)
    x = lp(x, cut)
    return fade_tail(x)

@lru_cache(maxsize=None)
def beep(m, d=0.24):
    """s3（GitHub Copilot）用：やわらかいパルス波"""
    f = hz(m)
    t = tt(d)
    n = len(t)
    ph = 2 * np.pi * f * t
    x = sum((np.sin(k * np.pi * 0.25) / k) * np.cos(k * ph) for k in range(1, 16) if k * f < 9000)
    x = lp(x, 3200)
    a = np.minimum(1, t / 0.004) * (0.35 + 0.65 * np.exp(-t / 0.06)) * np.minimum(1, (d - t) / 0.03).clip(0)
    return x * a * 0.8

@lru_cache(maxsize=None)
def woodblock(hi=True):
    d = 0.12
    f = 1250 if hi else 900
    t = tt(d)
    n = len(t)
    x = np.sin(2 * np.pi * f * t) * env_exp(n, 0.022, 0.0004) + 0.4 * np.sin(2 * np.pi * f * 2.42 * t) * env_exp(n, 0.008, 0.0003)
    nz = bp(_rng(7 if hi else 8).standard_normal(n), 1500, 7000) * env_exp(n, 0.003, 0.0002)
    return fade_tail(x + nz * 0.5, 200)

@lru_cache(maxsize=None)
def tick():
    n = int(0.03 * SR)
    return bp(_rng(3).standard_normal(n), 2500, 9000) * env_exp(n, 0.004, 0.0002)

@lru_cache(maxsize=None)
def shaker(k=0):
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    x = hp(_rng(100 + k).standard_normal(n), 5500, 4)
    return x * np.minimum(1, t / 0.008) * np.exp(-t / 0.025)

@lru_cache(maxsize=None)
def kick():
    d = 0.32
    t = tt(d)
    f = 48 + 75 * np.exp(-t / 0.025)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(len(t), 0.11, 0.002)
    return fade_tail(x)
