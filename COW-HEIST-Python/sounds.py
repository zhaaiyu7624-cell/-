"""桌面版原创配乐播放和反馈音合成。"""
from array import array
from math import pi, sin
from pathlib import Path

import pygame as pg

RATE = 44100
CHANNELS = 2
MUSIC_DIR = Path(__file__).resolve().parent / 'assets' / 'music'


def make_sound(low, high):
    if pg.mixer.get_init() != (RATE, -16, CHANNELS):
        return None
    # 约 0.2 秒扫频，振幅先缓升再衰减，避免突然起音。
    length = RATE // 5
    phase = 0
    samples = array('h')
    for frame in range(length):
        fraction = frame / length
        phase += 2 * pi * (low + (high - low) * fraction) / RATE
        envelope = min(1, frame / 110) * (1 - fraction)
        value = round(7800 * envelope * sin(phase))
        samples.extend((value, value))
    return pg.mixer.Sound(buffer=samples.tobytes())


class BackgroundMusic:
    """按场景播放一条循环音乐。Pygame 流式解码，避免一次读入完整配乐。"""

    def __init__(self):
        self.track = None
        self.started = False
        self.paused = False
        self.muted = False

    def sync(self, phase, level):
        if not pg.mixer.get_init():
            return
        in_round = phase in ('countdown', 'playing', 'paused', 'ended')
        track = f'bgm_level_{level + 1}' if in_round else 'bgm_menu'
        if track != self.track:
            # 只在曲目变化时加载；逐帧调用也不会重启或叠加同一首歌。
            self.track = track
            self.started = False
            self.paused = False
            try:
                pg.mixer.music.load(str(MUSIC_DIR / f'{track}.ogg'))
                self.apply_volume()
                pg.mixer.music.play(loops=-1, fade_ms=220)
                self.started = True
            except (OSError, pg.error) as error:
                print(f'无法播放背景音乐 {track}：{error}')
        if not self.started:
            return
        should_pause = phase == 'paused'
        if should_pause != self.paused:
            if should_pause:
                pg.mixer.music.pause()
            else:
                pg.mixer.music.unpause()
            self.paused = should_pause

    def set_muted(self, muted):
        self.muted = muted
        self.apply_volume()
        if muted and pg.mixer.get_init():
            pg.mixer.stop()

    def apply_volume(self):
        if pg.mixer.get_init():
            pg.mixer.music.set_volume(0 if self.muted else .38)
