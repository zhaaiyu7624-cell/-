"""Pygame 场景与界面绘制。

本模块只读取游戏状态。灯光、场景、奶牛与提示环用图形原语生成，
绘制顺序从远景到近景，再叠加 HUD 和菜单。
"""
import math
from random import Random

import pygame as pg

from game import CAPTURE_SECONDS, FIELD, REACH
from levels import LEVELS

WIDTH, HEIGHT = 960, 640
CREAM = '#fff0d9'
MINT = '#a6f6d9'
MUTED = '#c8b9d6'
AMBER = '#ffc079'
INK = '#1c1930'


def oval(surface, color, x, y, width, height):
    pg.draw.ellipse(surface, color, (x - width / 2, y - height / 2, width, height))


class View:
    def __init__(self, screen):
        self.screen = screen
        self.fonts = {}
        self.background = self.make_farm()
        self.light = pg.Surface(screen.get_size(), pg.SRCALPHA).convert_alpha()

    def text(self, value, x, y, size, color=CREAM, align='topleft', bold=False):
        spec = (size, bold)
        if spec not in self.fonts:
            font = pg.font.Font(None, size)
            font.set_bold(bold)
            self.fonts[spec] = font
        image = self.fonts[spec].render(str(value), True, color)
        self.screen.blit(image, image.get_rect(**{align: (x, y)}))

    def make_farm(self):
        scene = pg.Surface((WIDTH, HEIGHT)).convert()
        rng = Random(17)
        for y in range(HEIGHT):
            shade = pg.Color('#17152e').lerp(pg.Color('#50456d'), min(y / 460, 1))
            pg.draw.line(scene, shade, (0, y), (WIDTH, y))
        for _ in range(97):
            x, y = rng.randrange(WIDTH), rng.randrange(18, 245)
            pg.draw.circle(scene, rng.choice(['#7f729e', '#c3acd2', '#fff0d9']),
                           (x, y), rng.choice((1, 1, 1, 2)))
        for radius in range(70, 34, -4):
            color = pg.Color('#2b2448').lerp(pg.Color('#60466f'), (70 - radius) / 42)
            pg.draw.circle(scene, color, (764, 144), radius)
        pg.draw.circle(scene, '#ffcfad', (764, 144), 34)
        for x, y, w, h in [(750, 137, 10, 6), (774, 150, 14, 9), (764, 126, 7, 4)]:
            oval(scene, '#dca7a2', x, y, w, h)
        for baseline, color in [(231, '#504168'), (254, '#3f395e'), (280, '#302f4e')]:
            ridge = [(x, baseline + rng.randrange(-45, 16)) for x in range(0, 961, 60)]
            pg.draw.polygon(scene, color, ridge + [(960, 600), (0, 600)])
        pg.draw.polygon(scene, '#54445c', [(830, 237), (872, 237), (960, 414), (960, 568)])
        pg.draw.rect(scene, '#292d44', FIELD.inflate(36, 24), border_radius=18)
        pg.draw.rect(scene, '#354d50', FIELD, border_radius=12)
        for y in range(FIELD.top + 10, FIELD.bottom - 10, 14):
            pg.draw.line(scene, '#3c5356', (FIELD.left + 12, y), (FIELD.right - 12, y))
        for _ in range(360):
            x = rng.randrange(FIELD.left + 10, FIELD.right - 10)
            y = rng.randrange(FIELD.top + 10, FIELD.bottom - 10)
            pg.draw.line(scene, rng.choice(['#4b6560', '#617367', '#3e5759']),
                         (x, y), (x + rng.choice((-2, 2, 3)), y - rng.randrange(2, 6)))
        for x, y, scale in [(48, 265, 1.2), (82, 195, .7), (885, 275, 1.1),
                            (920, 216, .72), (79, 529, 1), (901, 548, 1.35)]:
            pg.draw.rect(scene, '#3b3049', (x - 4, y - 28 * scale, 8, 28 * scale))
            for offset, color in [(0, '#243c4c'), (19, '#2e4355'), (36, '#385269')]:
                pg.draw.polygon(scene, color, [(x - 25 * scale, y - offset),
                                               (x + 25 * scale, y - offset),
                                               (x, y - 58 * scale - offset)])
        self.barn(scene)
        for x in range(FIELD.left, FIELD.right + 1, 26):
            for y in (FIELD.top, FIELD.bottom):
                pg.draw.rect(scene, '#a27570', (x - 2, y - 13, 4, 20))
        for y in (FIELD.top, FIELD.bottom):
            pg.draw.line(scene, '#795866', (FIELD.left, y - 5), (FIELD.right, y - 5), 4)
        for x, y in [(125, 540), (834, 546), (316, 242), (871, 390)]:
            oval(scene, '#bc6951', x, y, 19, 14)
            pg.draw.line(scene, '#78926a', (x, y - 6), (x + 3, y - 11), 2)
            for offset in (-4, 4):
                pg.draw.circle(scene, AMBER, (x + offset, y), 2)
        return scene

    @staticmethod
    def barn(surface):
        pg.draw.rect(surface, '#925267', (178, 180, 124, 70))
        pg.draw.polygon(surface, '#685078', [(166, 190), (195, 150), (246, 138),
                                             (296, 160), (310, 190)])
        pg.draw.line(surface, '#b087a2', (195, 150), (246, 138), 3)
        pg.draw.rect(surface, '#5b3c56', (220, 197, 40, 53))
        pg.draw.line(surface, AMBER, (220, 198), (220, 248), 2)
        pg.draw.line(surface, '#ba8077', (221, 199), (258, 246), 2)
        pg.draw.line(surface, '#ba8077', (258, 199), (221, 246), 2)
        for x in (189, 273):
            pg.draw.rect(surface, AMBER, (x, 203, 16, 16))
            pg.draw.line(surface, '#936469', (x + 8, 203), (x + 8, 219), 2)

    def draw_cow(self, cow):
        """按已保存的偏移画奶牛。暂停吸取时船移动也不会拖动奶牛。"""
        t = cow.lift
        x, y = cow.position + cow.visual_offset
        oval(self.screen, '#29383f', cow.position.x, cow.position.y + 13, 55 - t * 16, 14)
        y -= t * t * (3 - 2 * t) * 56
        size = 1 - .56 * t
        animal = pg.Surface((65, 42), pg.SRCALPHA)
        fur, spots = ('#efba65', '#a15c3a') if cow.gold else ('#fff0da', '#343045')
        for xx in (18, 31, 42):
            pg.draw.rect(animal, spots, (xx, 27, 5, 11), border_radius=2)
        pg.draw.line(animal, spots, (11, 21), (5, 27), 3)
        oval(animal, fur, 30, 22, 43, 25)
        oval(animal, spots, 19, 20, 14, 13)
        oval(animal, spots, 37, 27, 10, 8)
        for xx in (46, 57):
            pg.draw.polygon(animal, AMBER, [(xx, 11), (xx - 2, 3), (xx + 4, 9)])
        oval(animal, spots, 44, 14, 13, 6)
        oval(animal, fur, 52, 17, 21, 22)
        oval(animal, '#eaa8aa', 55, 24, 18, 11)
        pg.draw.circle(animal, INK, (56, 15), 2)
        pg.draw.circle(animal, '#b17785', (58, 24), 1)
        if cow.velocity.x < 0:
            animal = pg.transform.flip(animal, True, False)
        animal = pg.transform.smoothscale(animal, (int(65 * size), int(42 * size)))
        self.screen.blit(animal, animal.get_rect(center=(x, y)))

    def draw_hazard(self, target, ship):
        x, y = target.position.lerp(ship, target.lift)
        y -= target.lift * 54
        icon = pg.Surface((58, 63), pg.SRCALPHA)
        pg.draw.ellipse(icon, '#3a3244', (7, 50, 44, 9))
        if target.kind == 'pumpkin':
            for xx in (19, 29, 39):
                oval(icon, '#db6644', xx, 40, 21, 24)
            pg.draw.line(icon, '#87a16c', (29, 29), (33, 22), 4)
        elif target.kind == 'scarecrow':
            pg.draw.line(icon, '#c89a64', (29, 19), (29, 55), 5)
            pg.draw.line(icon, '#c89a64', (8, 33), (50, 33), 6)
            pg.draw.polygon(icon, '#965c71', [(22, 23), (36, 23), (40, 48), (18, 48)])
            oval(icon, AMBER, 29, 17, 18, 16)
            pg.draw.line(icon, '#66516d', (16, 13), (42, 13), 5)
        else:
            pg.draw.rect(icon, '#677e90', (15, 19, 28, 34), border_radius=4)
            for yy in (23, 46):
                pg.draw.line(icon, '#a5aaba', (15, yy), (42, yy), 3)
        pg.draw.polygon(icon, '#612e45', [(29, 24), (39, 42), (19, 42)])
        pg.draw.line(icon, '#ff8b67', (29, 29), (29, 35), 2)
        pg.draw.circle(icon, '#ff8b67', (29, 38), 1)
        k = 1 - target.lift * .6
        icon = pg.transform.smoothscale(icon, (int(58 * k), int(63 * k)))
        self.screen.blit(icon, icon.get_rect(midbottom=(x, y + 20)))

    def draw_ship(self, ship, active, when):
        x, y = ship
        y -= 56 + 4 * math.sin(when * 3)
        if active:
            self.light.fill((0, 0, 0, 0))
            pg.draw.polygon(self.light, (105, 255, 209, 53), [(x - 13, y), (x + 13, y),
                                                              (x + REACH, ship.y + 12),
                                                              (x - REACH, ship.y + 12)])
            for i in range(3):
                u = (when * .72 + i / 3) % 1
                pg.draw.ellipse(self.light, (150, 255, 222, 101),
                                (x - 13 - 32*u, y + (ship.y-y)*u, 26+64*u, 9+12*u), 1)
            self.screen.blit(self.light, (0, 0))
        oval(self.screen, '#322b53', x, y + 2, 86, 31)
        oval(self.screen, '#8872bc', x, y - 3, 91, 26)
        oval(self.screen, '#ac98dc', x, y - 5, 87, 16)
        oval(self.screen, '#4a7988', x, y - 16, 36, 26)
        oval(self.screen, '#8ed3cf', x - 2, y - 19, 29, 21)
        for dx in (-30, -15, 0, 15, 30):
            pg.draw.circle(self.screen, AMBER, (x + dx, y + 8 - abs(dx)*.07), 2)
        if active:
            oval(self.screen, MINT, x, y + 15, 24, 5)

    def draw(self, game):
        self.screen.blit(self.background, (0, 0))
        when = pg.time.get_ticks() / 1000
        for cow in sorted(game.cows, key=lambda animal: animal.position.y):
            if cow.warning_until is not None:
                # 警示环只是可见预告，此时场上没有可吸取的障碍模型。
                oval(self.screen, '#ffc079' if int(when * 6) % 2 else '#a85f52',
                     cow.position.x, cow.position.y, 42, 15)
                oval(self.screen, '#354d50', cow.position.x, cow.position.y, 31, 8)
            elif cow.hazard:
                self.draw_hazard(cow, game.ship)
            else:
                if cow.lift and cow is not game.lock:
                    pg.draw.ellipse(self.screen, '#6caa9d',
                                    (cow.position.x - 24, cow.position.y - 8, 48, 16), 1)
                self.draw_cow(cow)
        self.draw_ship(game.ship, game.pressed, when)
        if game.lock:
            x, y = game.lock.position
            rect = pg.Rect(x - 34, y - 23, 68, 46)
            pg.draw.ellipse(self.screen, '#69a79e', rect, 1)
            pg.draw.arc(self.screen, '#ff7562' if game.lock.hazard else MINT, rect, 0, math.tau * game.lock.lift, 4)
        for pos, points, age in game.popups:
            self.text(f'{points:+}', pos.x, pos.y - 65 - 24 * age, 34,
                      AMBER if points > 0 else '#ff7562', 'center', True)
        self.hud(game)
        if game.phase == 'countdown':
            self.text(math.ceil(game.countdown),480,325,110,MINT,'center',True)
        elif game.phase != 'playing':
            self.overlay(game)

    def hud(self, game):
        pg.draw.rect(self.screen, INK, (28, 24, 904, 67), border_radius=10)
        self.text('SCORE', 51, 36, 19, MUTED)
        self.text(f'{game.score:03d}', 49, 55, 33, MINT, bold=True)
        self.text(game.level['english'].upper(), 480, 38, 21, CREAM, 'midtop', True)
        pg.draw.rect(self.screen, '#534864', (375, 61, 210, 6), border_radius=3)
        pg.draw.rect(self.screen, MINT, (375, 61, max(0, min(game.score / game.level['goal'], 1) * 210), 6), border_radius=3)
        self.text(f"GOAL {game.level['goal']}", 480, 72, 17, MUTED, 'midtop')
        if game.combo:
            label = f'COMBO x{game.multiplier} / {game.combo}' if game.multiplier > 1 else f'STREAK {game.combo}'
            self.text(label, 198, 58, 22, MINT)
        self.text('TIME LEFT', 906, 36, 19, MUTED, 'topright')
        self.text(f'{math.ceil(game.remaining):02d}s', 906, 55, 33,
                  AMBER if game.remaining <= 10 else MINT, 'topright', True)
        self.text('MOUSE  /  MOVE      LEFT CLICK  /  ABDUCT      C  /  CAMERA      P  /  PAUSE      S  /  SOUND',
                  480, 590, 20, CREAM, 'midtop')
        self.text(f'DAIRY {CAPTURE_SECONDS:g}s +100  •  GOLD {2*CAPTURE_SECONDS:g}s +200  •  AVOID !',
                  480, 613, 18, MUTED, 'midtop')

    def camera_status(self, message, sample, size):
        pg.draw.rect(self.screen, INK, (22, 570, 916, 64), border_radius=8)
        self.text(message, 480, 580, 20, MINT, 'midtop', True)
        self.text('MOVE PALM / PINCH TO ABDUCT     C / SWITCH INPUT     P / PAUSE'
                  if sample is not None else 'MOUSE / MOVE & HOLD LEFT CLICK     C / RETRY CAMERA',
                  480, 608, 18, CREAM, 'midtop')
        if sample is None or not sample.image:
            return
        x, y = 772, 109
        self.screen.blit(pg.image.frombytes(sample.image, size, 'RGB'), (x, y))
        pg.draw.rect(self.screen, MINT, (x - 1, y - 1, size[0] + 2, size[1] + 2), 1)
        for u, v in sample.points:
            if 0 <= u < 1 and 0 <= v < 1:
                pg.draw.circle(self.screen, MINT, (int(x + u * size[0]), int(y + v * size[1])), 2)
        self.text('LOCAL CAMERA', x + size[0] / 2, y + size[1] + 5, 15, CREAM, 'midtop')

    def overlay(self, game):
        self.light.fill((19, 15, 35, 170))
        self.screen.blit(self.light, (0, 0))
        pg.draw.rect(self.screen, '#29243f', (239, 158, 482, 352), border_radius=20)
        pg.draw.rect(self.screen, '#6c667f', (239, 158, 482, 352), 1, border_radius=20)
        self.text('PYTHON EDITION   /   MIDNIGHT FARM', 480, 187, 20, MINT, 'midtop')
        if game.phase == 'levels':
            self.text('CHOOSE A MISSION', 480, 228, 37, CREAM, 'midtop', True)
            for i, rect in enumerate(game.level_buttons()):
                locked = i > game.unlocked
                pg.draw.rect(self.screen, '#383247' if locked else '#496366', rect, border_radius=8)
                self.text(f"{i+1}. {LEVELS[i]['english']}", rect.x+10, rect.y+10, 20, MUTED if locked else CREAM)
                details = 'LOCKED' if locked else f"Goal {LEVELS[i]['goal']}  /  Best {game.best[i]}"
                self.text(details, rect.x+10, rect.y+34, 17, MUTED)
            self.text('M / MAIN MENU    C / CAMERA', 480, 471, 18, MINT, 'midtop')
            return
        if game.phase == 'title':
            headline, description, button = 'COW HEIST', 'Move the UFO. Hold left click or pinch.', 'START RAID'
            detail = f'Four missions  /  Highest score {max(game.best)}'
        elif game.phase == 'paused':
            headline, description, button = 'PAUSED', 'The mission timer is paused.', 'RESUME'
            detail = 'R / Restart     M / Main menu'
        else:
            success = game.score >= game.level['goal']
            headline = 'MISSION CLEAR' if success else 'TARGET MISSED'
            description = f"{game.score}/{game.level['goal']} points  /  {game.captures} cows  /  {game.mistakes} hazards"
            button = 'NEXT MISSION' if success and game.level_index < len(LEVELS)-1 else 'PLAY AGAIN'
            detail = 'R / Retry      M / Mission selection'
        self.text(headline, 480, 241, 64 if game.phase == 'title' else 54, CREAM, 'midtop', True)
        self.text(description, 480, 339, 24, MUTED, 'midtop')
        self.text(detail, 480, 369, 21, CREAM, 'midtop')
        pg.draw.rect(self.screen, '#4f837f', (360, 443, 240, 52), border_radius=8)
        pg.draw.rect(self.screen, MINT, (360, 439, 240, 52), border_radius=8)
        self.text(button + '  >', 480, 465, 23, INK, 'center', True)
