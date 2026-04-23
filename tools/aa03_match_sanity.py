#!/usr/bin/env python3
"""
AA03 glyph matcher sanity harness (no Node required).

This mirrors the JS matcher pipeline:
- clamp/parse points
- dedupe close neighbors
- resample to fixed count
- normalize width/height and center
- Earth Mover's Distance via Hungarian assignment

It runs deterministic checks for:
1) exact template -> correct top match
2) low-noise variants -> stable top match
3) random squiggles -> should not score high
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Dict, Iterable, List, Sequence, Tuple

Point = Tuple[float, float]

REGION_GLYPHS: Dict[str, List[Point]] = {
    "crd": [(0.12, 0.86), (0.25, 0.60), (0.45, 0.40), (0.72, 0.20), (0.86, 0.32), (0.64, 0.58), (0.41, 0.78), (0.20, 0.90)],
    "worm": [(0.14, 0.20), (0.32, 0.18), (0.46, 0.32), (0.55, 0.54), (0.70, 0.72), (0.84, 0.84), (0.62, 0.80), (0.45, 0.66), (0.36, 0.42), (0.18, 0.28)],
    "dcc": [(0.15, 0.18), (0.85, 0.18), (0.74, 0.36), (0.67, 0.53), (0.57, 0.72), (0.43, 0.72), (0.33, 0.53), (0.26, 0.36), (0.15, 0.18)],
    "aa": [(0.14, 0.78), (0.31, 0.24), (0.52, 0.58), (0.72, 0.22), (0.86, 0.78), (0.67, 0.62), (0.52, 0.82), (0.33, 0.62), (0.14, 0.78)],
}

ENH_GLYPHS: Dict[str, List[Point]] = {
    "force-lattice": [(0.15, 0.15), (0.85, 0.15), (0.85, 0.85), (0.15, 0.85), (0.15, 0.15), (0.5, 0.5), (0.85, 0.85)],
    "precision-mark": [(0.15, 0.85), (0.5, 0.15), (0.85, 0.85), (0.5, 0.56), (0.15, 0.85)],
    "resonance-loop": [(0.22, 0.5), (0.34, 0.28), (0.56, 0.2), (0.75, 0.34), (0.82, 0.56), (0.67, 0.76), (0.42, 0.8), (0.24, 0.64), (0.22, 0.5)],
    "vital-knot": [(0.2, 0.2), (0.8, 0.8), (0.6, 0.5), (0.8, 0.2), (0.2, 0.8), (0.4, 0.5), (0.2, 0.2)],
    "swift-circuit": [(0.16, 0.62), (0.35, 0.28), (0.55, 0.48), (0.72, 0.18), (0.84, 0.4), (0.62, 0.72), (0.42, 0.58), (0.26, 0.82)],
    "merchant-sigil": [(0.22, 0.2), (0.78, 0.2), (0.78, 0.6), (0.5, 0.82), (0.22, 0.6), (0.22, 0.2), (0.5, 0.5), (0.78, 0.6)],
    "overflow-channel": [(0.14, 0.3), (0.34, 0.2), (0.52, 0.3), (0.64, 0.48), (0.52, 0.68), (0.34, 0.8), (0.14, 0.7), (0.26, 0.52), (0.42, 0.5), (0.6, 0.52), (0.82, 0.7)],
    "stability-anchor": [(0.5, 0.15), (0.5, 0.8), (0.32, 0.56), (0.5, 0.8), (0.68, 0.56), (0.5, 0.8)],
    "echo-ward": [(0.2, 0.8), (0.22, 0.22), (0.78, 0.22), (0.8, 0.8), (0.6, 0.62), (0.4, 0.62), (0.2, 0.8)],
    "surge-glyph": [(0.18, 0.72), (0.42, 0.18), (0.58, 0.46), (0.74, 0.2), (0.82, 0.42), (0.64, 0.82), (0.48, 0.56), (0.34, 0.8)],
}


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def to_points(points: Sequence[Sequence[float]]) -> List[Point]:
    out: List[Point] = []
    for p in points:
        if len(p) < 2:
            continue
        out.append((clamp(float(p[0]), 0.0, 1.0), clamp(float(p[1]), 0.0, 1.0)))
    if len(out) <= 1:
        return out
    deduped = [out[0]]
    for p in out[1:]:
        q = deduped[-1]
        if math.dist(p, q) >= 0.003:
            deduped.append(p)
    return deduped


def resample_path(path: Sequence[Point], sample_count: int = 48) -> List[Point]:
    src = to_points(path)
    if not src:
        return []
    if len(src) == 1:
        return [src[0]] * max(2, sample_count)

    segments = []
    total = 0.0
    for i in range(1, len(src)):
        seg_len = math.dist(src[i - 1], src[i])
        total += seg_len
        segments.append((src[i - 1], src[i], seg_len, total))
    if total <= 1e-5:
        return [src[0]] * sample_count

    out: List[Point] = []
    for step in range(sample_count):
        target = (step / max(1, sample_count - 1)) * total
        seg = next((s for s in segments if s[3] >= target), segments[-1])
        a, b, seg_len, cumulative = seg
        prev_cum = cumulative - seg_len
        ratio = 0.0 if seg_len <= 1e-5 else clamp((target - prev_cum) / seg_len, 0.0, 1.0)
        out.append((a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio))
    return out


def normalize_cloud(points: Sequence[Point]) -> List[Point]:
    if not points:
        return []
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    w = max(0.001, max_x - min_x)
    h = max(0.001, max_y - min_y)
    return [((p[0] - min_x) / w - 0.5, (p[1] - min_y) / h - 0.5) for p in points]


def preprocess(points: Sequence[Sequence[float]], sample_count: int = 48) -> List[Point]:
    return normalize_cloud(resample_path(to_points(points), sample_count))


def hungarian_min_cost(cost: List[List[float]]) -> float:
    n = len(cost)
    if n == 0 or any(len(row) != n for row in cost):
        return float("inf")
    u = [0.0] * (n + 1)
    v = [0.0] * (n + 1)
    p = [0] * (n + 1)
    way = [0] * (n + 1)

    for row in range(1, n + 1):
        p[0] = row
        minv = [float("inf")] * (n + 1)
        used = [False] * (n + 1)
        col0 = 0
        while True:
            used[col0] = True
            row0 = p[col0]
            delta = float("inf")
            col1 = 0
            for col in range(1, n + 1):
                if used[col]:
                    continue
                cur = cost[row0 - 1][col - 1] - u[row0] - v[col]
                if cur < minv[col]:
                    minv[col] = cur
                    way[col] = col0
                if minv[col] < delta:
                    delta = minv[col]
                    col1 = col
            for col in range(0, n + 1):
                if used[col]:
                    u[p[col]] += delta
                    v[col] -= delta
                else:
                    minv[col] -= delta
            col0 = col1
            if p[col0] == 0:
                break
        while True:
            col1 = way[col0]
            p[col0] = p[col1]
            col0 = col1
            if col0 == 0:
                break

    assignment = [-1] * n
    for col in range(1, n + 1):
        if p[col] > 0:
            assignment[p[col] - 1] = col - 1
    total = 0.0
    for r, c in enumerate(assignment):
        if c < 0:
            return float("inf")
        total += cost[r][c]
    return total


def emd(a: List[Point], b: List[Point]) -> float:
    if not a or len(a) != len(b):
        return float("inf")
    matrix = [[math.dist(pa, pb) for pb in b] for pa in a]
    return hungarian_min_cost(matrix) / len(a)


def score_from_distance(distance: float) -> float:
    if not math.isfinite(distance):
        return 0.0
    return clamp(1.0 - (distance / 1.25), 0.0, 1.0)


def confidence_from_distances(best_distance: float, second_distance: float) -> float:
    if not math.isfinite(best_distance):
        return 0.0
    safe_second = second_distance if math.isfinite(second_distance) and second_distance > 0 else best_distance + 0.25
    separation = clamp((safe_second - best_distance) / max(1e-6, safe_second), 0.0, 1.0)
    distance_quality = math.exp(-((best_distance / 0.065) ** 2))
    return clamp(distance_quality * (0.55 + 0.45 * separation), 0.0, 1.0)


def noisy_variant(points: Sequence[Point], noise: float, seed: int) -> List[Point]:
    rng = random.Random(seed)
    out: List[Point] = []
    for x, y in points:
        nx = clamp(x + rng.uniform(-noise, noise), 0.0, 1.0)
        ny = clamp(y + rng.uniform(-noise, noise), 0.0, 1.0)
        out.append((nx, ny))
    return out


def random_squiggle(count: int, seed: int) -> List[Point]:
    rng = random.Random(seed)
    x, y = rng.random(), rng.random()
    pts = [(x, y)]
    for _ in range(count - 1):
        x = clamp(x + rng.uniform(-0.22, 0.22), 0.0, 1.0)
        y = clamp(y + rng.uniform(-0.22, 0.22), 0.0, 1.0)
        pts.append((x, y))
    return pts


@dataclass
class MatchResult:
    glyph: str
    distance: float
    score: float


def rank(stroke: Sequence[Sequence[float]], glyphs: Dict[str, List[Point]]) -> List[MatchResult]:
    s = preprocess(stroke, 48)
    rows = []
    for gid, template in glyphs.items():
        d = emd(s, preprocess(template, 48))
        rows.append(MatchResult(glyph=gid, distance=d, score=score_from_distance(d)))
    rows.sort(key=lambda r: r.distance)
    return rows


def run_exact_tests(glyphs: Dict[str, List[Point]], label: str) -> None:
    print(f"\n== Exact template tests ({label}) ==")
    failures = 0
    for gid, tpl in glyphs.items():
        ranked = rank(tpl, glyphs)
        top = ranked[0]
        ok = top.glyph == gid
        if not ok:
            failures += 1
        print(f"{gid:18s} -> top={top.glyph:18s} d={top.distance:.4f} score={top.score:.3f} {'OK' if ok else 'FAIL'}")
    print(f"failures: {failures}")


def run_noise_tests(glyphs: Dict[str, List[Point]], label: str, noise: float = 0.02) -> None:
    print(f"\n== Noisy template tests ({label}, noise={noise}) ==")
    failures = 0
    seed = 100
    for gid, tpl in glyphs.items():
        candidate = noisy_variant(tpl, noise=noise, seed=seed)
        seed += 1
        ranked = rank(candidate, glyphs)
        top = ranked[0]
        ok = top.glyph == gid
        if not ok:
            failures += 1
        print(f"{gid:18s} -> top={top.glyph:18s} d={top.distance:.4f} score={top.score:.3f} {'OK' if ok else 'FAIL'}")
    print(f"failures: {failures}")


def run_squiggle_tests(glyphs: Dict[str, List[Point]], label: str, n: int = 12) -> None:
    print(f"\n== Squiggle tests ({label}) ==")
    scores = []
    for i in range(n):
        sq = random_squiggle(count=18, seed=500 + i)
        ranked = rank(sq, glyphs)
        top = ranked[0]
        second = ranked[1] if len(ranked) > 1 else ranked[0]
        confidence = confidence_from_distances(top.distance, second.distance)
        scores.append(confidence)
        print(
            f"squiggle#{i:02d} -> top={top.glyph:18s} d={top.distance:.4f} "
            f"score={top.score:.3f} conf={confidence:.3f}"
        )
    avg = sum(scores) / len(scores)
    print(f"avg squiggle confidence: {avg:.3f} (lower is better)")


def run_confidence_tests(glyphs: Dict[str, List[Point]], label: str) -> None:
    print(f"\n== Confidence calibration ({label}) ==")
    exact_conf: List[float] = []
    noisy_conf: List[float] = []
    squig_conf: List[float] = []

    for index, (gid, tpl) in enumerate(glyphs.items()):
        exact_ranked = rank(tpl, glyphs)
        exact_second = exact_ranked[1] if len(exact_ranked) > 1 else exact_ranked[0]
        exact_conf.append(confidence_from_distances(exact_ranked[0].distance, exact_second.distance))

        noisy_ranked = rank(noisy_variant(tpl, noise=0.015, seed=200 + index), glyphs)
        noisy_second = noisy_ranked[1] if len(noisy_ranked) > 1 else noisy_ranked[0]
        noisy_conf.append(confidence_from_distances(noisy_ranked[0].distance, noisy_second.distance))

    for i in range(20):
        sq_ranked = rank(random_squiggle(count=18, seed=900 + i), glyphs)
        sq_second = sq_ranked[1] if len(sq_ranked) > 1 else sq_ranked[0]
        squig_conf.append(confidence_from_distances(sq_ranked[0].distance, sq_second.distance))

    print(
        f"exact conf avg/min: {sum(exact_conf)/len(exact_conf):.3f} / {min(exact_conf):.3f}\n"
        f"noisy conf avg/min: {sum(noisy_conf)/len(noisy_conf):.3f} / {min(noisy_conf):.3f}\n"
        f"squig conf avg/max: {sum(squig_conf)/len(squig_conf):.3f} / {max(squig_conf):.3f}"
    )


def main() -> None:
    run_exact_tests(REGION_GLYPHS, "region")
    run_noise_tests(REGION_GLYPHS, "region", noise=0.015)
    run_squiggle_tests(REGION_GLYPHS, "region")
    run_confidence_tests(REGION_GLYPHS, "region")

    run_exact_tests(ENH_GLYPHS, "enhancement")
    run_noise_tests(ENH_GLYPHS, "enhancement", noise=0.015)
    run_squiggle_tests(ENH_GLYPHS, "enhancement")
    run_confidence_tests(ENH_GLYPHS, "enhancement")


if __name__ == "__main__":
    main()
