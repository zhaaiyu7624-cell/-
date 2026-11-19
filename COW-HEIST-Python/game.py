"""Python game rules and mouse input for COW HEIST."""
from dataclasses import dataclass
from random import Random

import pygame as pg

from levels import LEVELS, SETTINGS, TARGETS, read_progress, write_progress

FIELD = pg.Rect(116, 254, 728, 299)
ROUND_SECONDS = SETTINGS['seconds']
CAPTURE_SECONDS = SETTINGS['baseCapture']
REACH = 47
SPAWNS = [(184, 313), (335, 315), (485, 312), (639, 315), (772, 324),
          (226, 430), (383, 451), (540, 464), (692, 442), (779, 512),
          (260, 505), (463, 510), (604, 365), (357, 382), (748, 377), (163, 493)]


@dataclass(eq=False)
class Cow:
    position: pg.Vector2
    kind: str
    velocity: pg.Vector2
    turn_in: float
    lift: float = 0

    @property
    def points(self):
        return TARGETS[self.kind]['points']

    @property
    def gold(self):
        return self.kind == 'gold'

    @property
    def duration(self):
        return CAPTURE_SECONDS * TARGETS[self.kind]['durationFactor']


class Game:
    def __init__(self, seed=None):
        self.rng = Random(seed)
        self.ship = pg.Vector2(480, 405)
        self.level_index = 0
        self.unlocked, self.best = read_progress()
        self.restart('title')

    @property
    def level(self):
        return LEVELS[self.level_index]

    def make_cow(self, position, kind):
        direction = pg.Vector2(1, 0).rotate(self.rng.randrange(360))
        pace = self.level['speed'] * (.28 if TARGETS[kind]['points'] < 0 else 1)
        return Cow(pg.Vector2(position), kind, direction * self.rng.uniform(10, 25) * pace,
                   self.rng.uniform(1.3, 3.5))

    def restart(self, phase='countdown'):
        self.phase = phase
        self.remaining = ROUND_SECONDS
        self.score = self.captures = self.mistakes = 0
        self.countdown = 3
        self.respawns = []
        self.hazard_index = 0
        self.hazard_at = self.level['interval']
        self.last_points = 0
        self.capture_serial = 0
        self.pressed = False
        self.lock = None
        self.popups = []
        self.ship.update(480, 405)
        self.cursor = self.ship.copy()
        kinds = ['cow'] * self.level['cow'] + ['gold'] * self.level['gold']
        self.cows = [self.make_cow(position, kind) for position, kind in zip(SPAWNS, kinds)]
        self.spawn_hazard()

    def select_level(self, index):
        if 0 <= index <= self.unlocked:
            self.level_index = index
            self.restart()

    def toggle_pause(self):
        if self.phase in ('playing', 'countdown'):
            self.resume_phase = self.phase
            self.phase = 'paused'
        elif self.phase == 'paused':
            self.phase = self.resume_phase
        else:
            return
        self.pressed = False
        self.lock = None

    def handle(self, event):
        if event.type == pg.WINDOWFOCUSLOST and self.phase in ('playing', 'countdown'):
            self.toggle_pause()
        if event.type == pg.KEYDOWN:
            if event.key in (pg.K_p, pg.K_ESCAPE):
                self.toggle_pause()
            elif event.key == pg.K_RETURN:
                self.primary()
            elif self.phase == 'levels' and pg.K_1 <= event.key <= pg.K_4:
                self.select_level(event.key - pg.K_1)
            elif event.key == pg.K_r and self.phase in ('ended', 'paused'):
                self.restart()
            elif event.key == pg.K_m and self.phase in ('levels', 'paused', 'ended'):
                self.phase = 'title' if self.phase != 'ended' else 'levels'
        if event.type == pg.MOUSEMOTION:
            self.cursor.update(event.pos)
        if event.type == pg.MOUSEBUTTONUP and event.button == 1:
            self.pressed = False
        if event.type == pg.MOUSEBUTTONDOWN and event.button == 1:
            if self.phase == 'levels':
                for index, rect in enumerate(self.level_buttons()):
                    if rect.collidepoint(event.pos):
                        self.select_level(index)
            elif self.phase in ('title', 'ended', 'paused') and pg.Rect(360, 439, 240, 52).collidepoint(event.pos):
                self.primary()
            elif self.phase == 'playing':
                self.cursor.update(event.pos)
                self.pressed = True

    @staticmethod
    def level_buttons():
        return [pg.Rect(275 + (i % 2) * 211, 272 + (i // 2) * 78, 198, 64)
                for i in range(len(LEVELS))]

    def primary(self):
        if self.phase == 'paused':
            self.toggle_pause()
        elif self.phase == 'title':
            self.phase = 'levels'
        elif self.phase == 'ended':
            if self.score >= self.level['goal'] and self.level_index + 1 < len(LEVELS):
                self.select_level(self.level_index + 1)
            else:
                self.restart()

    def update(self, elapsed):
        if self.phase == 'countdown':
            self.countdown = max(0, self.countdown - elapsed)
            if self.countdown == 0:
                self.phase = 'playing'
            return
        if self.phase != 'playing':
            return
        # The timer uses wall-clock elapsed time. Cap movement to avoid a large
        # jump in position or an instant capture after a stalled frame.
        seconds = min(self.remaining, elapsed, 0.08)
        self.remaining = max(0, self.remaining - elapsed)
        if self.remaining == 0:
            self.phase = 'ended'
            self.best[self.level_index] = max(self.best[self.level_index], self.score)
            if self.score >= self.level['goal']:
                self.unlocked = max(self.unlocked, min(len(LEVELS) - 1, self.level_index + 1))
            write_progress(self.unlocked, self.best)
            self.pressed = False
            self.lock = None
            return
        target = pg.Vector2(
            max(FIELD.left + 18, min(FIELD.right - 18, self.cursor.x)),
            max(FIELD.top + 18, min(FIELD.bottom - 18, self.cursor.y)))
        self.ship = self.ship.lerp(target, min(1, seconds * 12))
        self.pick_target()
        for cow in self.cows:
            if cow is self.lock:
                cow.lift = min(1, cow.lift + seconds / cow.duration)
            elif cow.lift:
                cow.lift = max(0, cow.lift - seconds * 1.4)
            elif cow.points > 0 or self.level_index == 3:
                self.wander(cow, seconds)
        if self.lock and self.lock.lift >= 1:
            self.capture(self.lock)
        self.replenish()
        self.popups = [(pos, points, age + seconds)
                       for pos, points, age in self.popups if age + seconds < 1]

    def pick_target(self):
        # Hold the same cow until it leaves the beam or the player lets go.
        if not self.pressed:
            self.lock = None
            return
        if self.lock and self.lock.position.distance_to(self.ship) <= REACH:
            return
        nearby = [cow for cow in self.cows if cow.position.distance_to(self.ship) <= REACH]
        self.lock = min(nearby, key=lambda cow: cow.position.distance_squared_to(self.ship),
                        default=None)

    def wander(self, cow, seconds):
        cow.turn_in -= seconds
        if cow.turn_in <= 0:
            cow.turn_in = self.rng.uniform(1.3, 3.5)
            cow.velocity.rotate_ip(self.rng.uniform(-85, 85))
        target = cow.position + cow.velocity * seconds
        if not FIELD.inflate(-46, -39).collidepoint(target):
            cow.velocity.rotate_ip(145)
        elif any(other is not cow and target.distance_to(other.position) < 44
                 for other in self.cows):
            cow.velocity.rotate_ip(75)
        else:
            cow.position = target

    def spawn(self, kind):
        # Prefer the spot with the most space from the other targets and UFO.
        occupied = [target.position for target in self.cows] + [self.ship]
        clearance, position = max((min(other.distance_squared_to(point)
                                       for other in occupied), point) for point in SPAWNS)
        if clearance < 52 ** 2:
            return False
        self.cows.append(self.make_cow(position, kind))
        return True

    def spawn_hazard(self):
        kinds = self.level['kinds']
        if self.spawn(kinds[self.hazard_index % len(kinds)]):
            self.hazard_index += 1

    def replenish(self):
        time = ROUND_SECONDS - self.remaining
        for job in self.respawns[:]:
            at, kind = job
            if time >= at and self.spawn(kind):
                self.respawns.remove(job)
        if time >= self.hazard_at:
            if sum(target.points < 0 for target in self.cows) < self.level['hazards']:
                self.spawn_hazard()
            self.hazard_at = time + self.level['interval']

    def capture(self, cow):
        self.score = max(0, self.score + cow.points)
        self.last_points = cow.points
        self.capture_serial += 1
        if cow.points > 0:
            self.captures += 1
            time = ROUND_SECONDS - self.remaining
            self.respawns.append((time + SETTINGS['respawnSeconds'], cow.kind))
        else:
            self.mistakes += 1
        self.popups.append((self.ship.copy(), cow.points, 0))
        self.cows.remove(cow)
        self.lock = None
