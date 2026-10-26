"""The existing four-times-oversampled true-peak limiter."""
import numpy as np
from scipy.signal import resample_poly
from .dsp import SR

def limiter(x, ceil_db, look=0.005, rel=0.08):
    """トゥルーピーク（4x オーバーサンプル）基準の先読みリミッタ。1 ms ブロック単位でゲインを計算し線形補間"""
    B = SR // 1000
    N = len(x)
    nb = (N + B - 1) // B
    up = np.abs(resample_poly(x, 4, 1, axis=0)).max(1)
    pk = np.zeros(nb * 4 * B)
    pk[:len(up)] = up[:nb * 4 * B]
    pk = pk.reshape(nb, 4 * B).max(1)
    c = 10 ** (ceil_db / 20)
    req = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    if req.min() >= 1.0:
        return x, 0.0
    L = max(1, int(look * 1000))
    g = req.copy()
    for j in range(1, L + 1):   # 先読み：未来の要求へ直線で近づく
        fut = np.r_[req[j:], np.ones(j)]
        g = np.minimum(g, fut + (1 - fut) * j / (L + 1))
    a = np.exp(-1 / (rel * 1000))
    y = np.empty(nb)
    cur = 1.0
    for k in range(nb):          # リリース：ゆっくり戻す
        cur = min(g[k], 1 - (1 - cur) * a)
        y[k] = cur
    bnd = np.minimum(np.r_[y[0], y], np.r_[y, y[-1]])   # ブロック境界の値（両隣の小さい方）
    gs = np.interp(np.arange(N), np.arange(nb + 1) * B, bnd)
    return x * gs[:, None], float(20 * np.log10(y.min()))
