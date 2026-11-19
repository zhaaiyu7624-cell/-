"""Python game rules and mouse input for COW HEIST."""
from dataclasses import dataclass
from random import Random

import pygame as pg

FIELD = pg.Rect(116, 254, 728, 299)
ROUND_SECONDS = 60
GOAL = 100
CAPTURE_SECONDS = 1.2
REACH = 47
SPAWNS = [(184, 313), (335, 315), (485, 312), (639, 315), (772, 324),
          (226, 430), (383, 451), (540, 464), (692, 442), (779, 512)]


@dataclass(eq=False)
class Cow:
    position: pg.Vector2
    gold: bool
    velocity: pg.Vector2
    turn_in: float
    lift: float = 0

    @property
    def points(self):
        return 25 if self.gold else 10


class Game:
    def __init__(self, seed=None):
        self.rng = Random(seed)
        self.ship = pg.Vector2(480, 405)
        self.restart('title')

    def make_cow(self, position, gold):
        direction = pg.Vector2(1, 0).rotate(self.rng.randrange(360))
        return Cow(pg.Vector2(position), gold, direction * self.rng.uniform(9, 20),
                   self.rng.uniform(1.3, 3.5))

    def restart(self, phase='playing'):
        self.phase = phase
        self.remaining = ROUND_SECONDS
        self.score = self.captures = 0
        self.pressed = False
        self.lock = None
        self.popups = []
        self.ship.update(480, 405)
        self.cursor = self.ship.copy()
        self.cows = [self.make_cow(position, i in (3, 8))
                     for i, position in enumerate(SPAWNS)]

    def toggle_pause(self):
        if self.phase in ('playing', 'paused'):
            self.phase = 'paused' if self.phase == 'playing' else 'playing'
            self.pressed = False
            self.lock = None

    def handle(self, event):
        if event.type == pg.WINDOWFOCUSLOST:
            if self.phase == 'playing':
                self.toggle_pause()
            return
        if event.type == pg.KEYDOWN:
            if event.key in (pg.K_p, pg.K_ESCAPE):
                self.toggle_pause()
            elif event.key == pg.K_RETURN:
                if self.phase in ('title', 'ended'):
                    self.restart()
                elif self.phase == 'paused':
                    self.toggle_pause()
        if event.type == pg.MOUSEMOTION:
            self.cursor.update(event.pos)
        if event.type == pg.MOUSEBUTTONUP and event.button == 1:
            self.pressed = False
        if event.type == pg.MOUSEBUTTONDOWN and event.button == 1:
            if self.phase in ('title', 'ended', 'paused'):
                if pg.Rect(360, 439, 240, 52).collidepoint(event.pos):
                    if self.phase == 'paused':
                        self.toggle_pause()
                    else:
                        self.restart()
            elif self.phase == 'playing':
                self.cursor.update(event.pos)
                self.pressed = True

    def update(self, elapsed):
        if self.phase != 'playing':
            return
        # The timer uses wall-clock elapsed time. Cap movement to avoid a large
        # jump in position or an instant capture after a stalled frame.
        seconds = min(self.remaining, elapsed, 0.08)
        self.remaining = max(0, self.remaining - elapsed)
        if self.remaining == 0:
            self.phase = 'ended'
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
                cow.lift = min(1, cow.lift + seconds / CAPTURE_SECONDS)
            elif cow.lift:
                cow.lift = max(0, cow.lift - seconds * 1.4)
            else:
                self.wander(cow, seconds)
        if self.lock and self.lock.lift >= 1:
            self.capture(self.lock)
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

    def capture(self, cow):
        self.score += cow.points
        self.captures += 1
        self.popups.append((self.ship.copy(), cow.points, 0))
        self.cows.remove(cow)
        self.lock = None
        # Spawn farthest from the herd so a replacement cannot overlap a cow.
        position = max(SPAWNS, key=lambda point: min(
            other.position.distance_squared_to(point) for other in self.cows))
        self.cows.append(self.make_cow(position, self.rng.random() < 0.20))
