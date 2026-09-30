import math
import os
import re
from kit import ROOT, Frame, cylinder, displace, lathe, rbox, rod, sphere, torus, tube
from plant import leaf, pebble

WOOD, EDGE, DOOR, DARK, BRASS, SAND, LID, LAMP = '#aa7954', '#bc9169', '#c29b71', '#73533d', '#bf9762', '#dccb9f', '#73533d', '#fff1c9'
STONES = ['#9c958a', '#b9876a', '#8f8a82', '#a7a092', '#c39a76', '#9c958a']
GRASS = ['#6f8d58', '#809a62', '#5f7d4f']
ARCH, ARCH_LIGHT, DRIFT, POT, MOSS = '#8e8a80', '#9a958a', '#8b6b4e', '#bd8469', '#7d8f5a'
FLOOR = 0.88
EYE = (0.3, 0.35, 1.0)


def water_size():
    source = open(os.path.join(ROOT, 'src', 'models', 'furniture.js')).read()
    found = re.search(r"TANK_WATER\s*=\s*\{[^}]*'fish-tank':\s*\[([^\]]+)\]", source)
    return tuple(float(v) for v in found.group(1).split(',')) if found else (1.42, 0.6, 0.5)


W, H, D = water_size()
SX, SZ, TOP = W / 1.42, D / 0.5, FLOOR + H


def stand():
    parts = [rbox([W + 0.18, 0.62, D + 0.16], (0, 0.39, 0), WOOD, bevel=0.025, surface='wood')]
    parts.append(rbox([W + 0.22, 0.07, D + 0.2], (0, 0.075, 0), DARK, bevel=0.02, surface='wood'))
    parts.append(rbox([W + 0.24, 0.045, D + 0.22], (0, 0.718, 0), EDGE, bevel=0.018, surface='wood'))
    parts.append(rbox([W + 0.2, 0.03, D + 0.18], (0, 0.687, 0), EDGE, bevel=0.012, surface='wood'))
    doors = round((W + 0.18) / 0.8)
    door = (W + 0.14) / doors
    face = D / 2 + 0.08
    for i in range(doors):
        x = (i - (doors - 1) / 2) * door
        f = Frame((x, 0.39, face))
        w, h = door - 0.05, 0.46
        for dy in (-1, 1):
            parts.append(rbox([w, 0.06, 0.03], (0, dy * (h / 2 - 0.03), 0.015), DOOR, bevel=0.01, surface='wood', frame=f))
        for dx in (-1, 1):
            parts.append(rbox([0.06, h - 0.12, 0.03], (dx * (w / 2 - 0.03), 0, 0.015), DOOR, bevel=0.01, surface='wood', frame=f))
        parts.append(rbox([w - 0.12, h - 0.12, 0.014], (0, 0, 0.008), EDGE, bevel=0.006, surface='wood', frame=f))
        parts.append(rbox([w - 0.2, h - 0.2, 0.02], (0, 0, 0.012), DOOR, bevel=0.012, surface='wood', frame=f))
        knob = (1 if x < 0 else -1) * (door / 2 - 0.09)
        parts.append(lathe([(0.0, 0.0), (0.012, 0.0), (0.008, 0.012), (0.02, 0.025), (0.018, 0.034), (0.0, 0.036)], (knob, 0.01, 0.03), BRASS, segments=14, surface='metal', layer='metal', frame=f, rotation=(math.pi / 2, 0, 0)))
    for x in (-1, 1):
        for z in (-1, 1):
            parts.append(lathe([(0.0, 0.0), (0.03, 0.0), (0.042, 0.015), (0.04, 0.03), (0.032, 0.042), (0.0, 0.042)], (x * (W / 2 + 0.01), 0, z * (D / 2 + 0.01)), DARK, segments=16, surface='wood'))
    return parts


def floor():
    parts = [rbox([W + 0.08, 0.05, D + 0.08], (0, 0.785, 0), DARK, bevel=0.012, surface='wood')]
    sand = rbox([W, 0.07, D], (0, 0.845, 0), SAND, bevel=0.012, surface='stone', dice=0.09)
    for v in sand.data.vertices:
        if v.co.z > 0.02:
            v.co.z += 0.018 * max(0, -v.co.y / (D / 2))
    sand.data.update()
    parts.append(displace(sand, 0.006, scale=22, seed=4))
    grains = [(-0.62, 0.18), (-0.44, 0.05), (-0.3, 0.19), (-0.18, -0.06), (-0.05, 0.16), (0.08, 0.04), (0.22, 0.2), (0.34, 0.08), (0.52, 0.2), (0.64, 0.02),
              (-0.56, -0.02), (-0.24, 0.1), (0.12, 0.17), (0.3, -0.02), (0.6, 0.12), (-0.66, 0.08), (-0.1, 0.21), (0.44, 0.18)]
    for k, (x, z) in enumerate(grains):
        s = 0.012 + (k % 4) * 0.004
        parts.append(sphere((s * 1.2, s * 0.7, s), (x * SX, FLOOR + 0.002, z * SZ), STONES[k % 6], subdivisions=1, surface='stone', rotation=(0, k * 0.7, 0)))
    for k, (x, z, size) in enumerate([(-0.5, 0.12, 0.05), (-0.38, -0.1, 0.04), (0.18, 0.15, 0.045), (0.46, -0.08, 0.055), (0.58, 0.14, 0.035), (-0.12, 0.02, 0.03)]):
        parts.append(pebble((size * 1.3, size * 0.7, size), (x * SX, FLOOR + 0.005, z * SZ), STONES[k], seed=k + 20, rotation=(0, k, 0)))
    return parts


def arch():
    x, z = 0.34 * SX, -0.13 * SZ
    parts = [pebble((0.12, 0.1, 0.09), (x - 0.06, FLOOR + 0.05, z + 0.01), ARCH, seed=31),
             pebble((0.09, 0.14, 0.08), (x + 0.12, FLOOR + 0.07, z - 0.01), ARCH_LIGHT, seed=32)]
    bridge = torus(0.13, 0.045, (x + 0.03, FLOOR + 0.1, z), ARCH, arc=math.pi, major_segments=12, minor_segments=8, surface='stone')
    parts.append(displace(bridge, 0.014, scale=14, seed=33))
    parts.append(pebble((0.05, 0.03, 0.045), (x - 0.05, FLOOR + 0.225, z), MOSS, seed=34))
    return parts


def grass():
    parts = []
    clumps = [(-0.58, -0.16, 0.42, 0.12), (-0.5, -0.19, 0.3, -0.18), (-0.26, -0.19, 0.36, 0.08), (0.06, -0.18, 0.26, -0.1), (0.62, -0.12, 0.38, -0.14), (-0.66, -0.06, 0.28, 0.2), (0.5, -0.19, 0.32, 0.1)]
    for c, (x, z, h, lean) in enumerate(clumps):
        tall = h * H / 0.6
        for b in range(5):
            a = b * 1.26 + c
            base = (x * SX + math.cos(a) * 0.025, FLOOR + 0.012, z * SZ + math.sin(a) * 0.015)
            direction = (math.sin(lean) + math.cos(a) * 0.25, 1.0, math.sin(a) * 0.12)
            parts += leaf(base, direction, (math.sin(a), 0, 1), tall * (0.65 + 0.35 * ((b + c) % 3) / 2), 0.032, GRASS[(b + c) % 3], shape='grass', rows=6, cols=1, droop=0.14 * (1 if b % 2 else -1), cup=0.15, fold=0.12, twist=1.5 * (1 if (b + c) % 2 else -1), rib=None, thickness=0.003)
    return parts


def props():
    x, z = -0.2 * SX, -0.02 * SZ
    cave = [(0.0, 0.0), (0.05, 0.0), (0.075, 0.1), (0.08, 0.13), (0.07, 0.135), (0.066, 0.11), (0.042, 0.012), (0.0, 0.012)]
    parts = [lathe(cave, (x, FLOOR + 0.068, z), POT, segments=18, surface='ceramic', rotation=(math.pi / 2 - 0.12, 0.5, 0))]
    wood = [(-0.58 * SX, FLOOR + 0.02, 0.04 * SZ), (-0.44 * SX, FLOOR + 0.05, 0.0), (-0.3 * SX, FLOOR + 0.03, -0.05 * SZ)]
    parts.append(displace(tube(wood, 0.022, DRIFT, surface='wood', tip=0.5, resolution=4), 0.004, scale=30, seed=5))
    parts.append(tube([wood[1], (-0.42 * SX, FLOOR + 0.1, 0.02 * SZ), (-0.4 * SX, FLOOR + 0.14, 0.05 * SZ)], 0.009, DRIFT, surface='wood', tip=0.4, resolution=3))
    return parts


def frame():
    parts = []
    for x in (-1, 1):
        for z in (-1, 1):
            parts.append(rbox([0.034, H + 0.06, 0.034], (x * (W / 2 + 0.015), 0.81 + (H + 0.06) / 2, z * (D / 2 + 0.015)), DARK, bevel=0.008, surface='wood'))
            parts.append(sphere((0.012, 0.012, 0.012), (x * (W / 2 + 0.03), TOP - 0.02, z * (D / 2 + 0.03)), BRASS, subdivisions=1, surface='metal', layer='metal'))
    for z in (-1, 1):
        parts.append(rbox([W + 0.06, 0.035, 0.035], (0, TOP + 0.01, z * (D / 2 + 0.015)), DARK, bevel=0.008, surface='wood'))
        parts.append(rbox([W + 0.06, 0.03, 0.03], (0, 0.83, z * (D / 2 + 0.015)), DARK, bevel=0.008, surface='wood'))
    for x in (-1, 1):
        parts.append(rbox([0.035, 0.035, D + 0.06], (x * (W / 2 + 0.015), TOP + 0.01, 0), DARK, bevel=0.008, surface='wood'))
    parts.append(rbox([W + 0.12, 0.05, D + 0.12], (0, TOP + 0.055, 0), LID, bevel=0.018, surface='wood'))
    parts.append(rbox([W + 0.04, 0.03, D + 0.04], (0, TOP + 0.09, 0), LID, bevel=0.012, surface='wood'))
    parts.append(rbox([W * 0.3, 0.012, D * 0.5], (-W * 0.25, TOP + 0.106, 0.02), EDGE, bevel=0.005, surface='wood'))
    parts.append(torus(0.03, 0.007, (-W * 0.25, TOP + 0.112, D * 0.25 + 0.02), BRASS, arc=math.pi, major_segments=10, minor_segments=5, surface='metal', layer='metal'))
    parts.append(rbox([W - 0.12, 0.018, 0.06], (0, TOP + 0.022, D / 2 - 0.07), LAMP, bevel=0.006, layer='glow'))
    parts.append(rbox([W - 0.08, 0.012, 0.075], (0, TOP + 0.034, D / 2 - 0.07), BRASS, bevel=0.004, surface='metal', layer='metal'))
    return parts


def build():
    return stand() + floor() + arch() + grass() + props() + frame()
