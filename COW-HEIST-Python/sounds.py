"""用 Python 合成桌面版的两类短反馈音。"""
from array import array
from math import pi, sin

import pygame as pg

RATE = 22050


def make_sound(low, high):
    if pg.mixer.get_init() != (RATE, -16, 1):
        return None
    # 约 0.2 秒扫频，振幅先缓升再衰减，避免突然起音。
    length = RATE // 5
    phase = 0
    samples = array('h')
    for frame in range(length):
        fraction = frame / length
        phase += 2 * pi * (low + (high - low) * fraction) / RATE
        envelope = min(1, frame / 110) * (1 - fraction)
        samples.append(round(7800 * envelope * sin(phase)))
    return pg.mixer.Sound(buffer=samples.tobytes())
