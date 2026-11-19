"""Small synthesized sounds for successful and hazardous captures."""
from array import array
from math import pi, sin

import pygame as pg

RATE = 22050


def make_sound(low, high):
    if pg.mixer.get_init() != (RATE, -16, 1):
        return None
    length = RATE // 5
    phase = 0
    samples = array('h')
    for frame in range(length):
        fraction = frame / length
        phase += 2 * pi * (low + (high - low) * fraction) / RATE
        envelope = min(1, frame / 110) * (1 - fraction)
        samples.append(round(7800 * envelope * sin(phase)))
    return pg.mixer.Sound(buffer=samples.tobytes())
