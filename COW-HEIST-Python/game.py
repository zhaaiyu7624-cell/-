"""COW HEIST 2.4 的 Python 游戏规则。

本模块负责状态、捕获、计时和计分。鼠标和摄像头都只更新 cursor（目标
位置）与 pressed（光束开关），所以不用为两种输入各实现一套游戏规则。
坐标使用 Pygame 像素，时间统一用秒，捕获进度用 0 到 1 的小数。
"""
from dataclasses import dataclass, field
from math import exp
from random import Random

import pygame as pg

from levels import LEVELS, SETTINGS, TARGETS, read_progress, write_progress

FIELD = pg.Rect(116, 254, 728, 299)
ROUND_SECONDS = SETTINGS['seconds']
CAPTURE_SECONDS = SETTINGS['baseCapture']
# JSON 与网页共用世界单位，桌面版用比例尺换成像素。
PIXELS_PER_UNIT = 40
BEAM = SETTINGS['beam']
MOTION = SETTINGS['motion']
HAZARD = SETTINGS['hazard']
COMBO = SETTINGS['combo']
REACH = round(BEAM['cowHoldRadius'] * PIXELS_PER_UNIT)
SEPARATION = MOTION['separation'] * PIXELS_PER_UNIT
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
    turn: float = 0
    mobile: bool = False
    warning_until: float | None = None
    last_hit: float = float('-inf')
    # 地面 position 是命中判定依据。偏移只供渲染，悬停时和进度一起冻结。
    visual_offset: pg.Vector2 = field(default_factory=pg.Vector2)

    @property
    def points(self):
        return TARGETS[self.kind]['points']

    @property
    def gold(self):
        return self.kind == 'gold'

    @property
    def hazard(self):
        return self.points < 0

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
        """从统一配置采样移动速度。四关奶牛使用同一速度范围。"""
        danger = TARGETS[kind]['points'] < 0
        low = MOTION['hazardMinSpeed'] if danger else MOTION['minSpeed']
        high = MOTION['hazardMaxSpeed'] if danger else MOTION['maxSpeed']
        direction = pg.Vector2(1, 0).rotate(self.rng.randrange(360))
        return Cow(pg.Vector2(position), kind,
                   direction * self.rng.uniform(low, high) * PIXELS_PER_UNIT,
                   self.rng.uniform(2.3, 4.8))

    def restart(self, phase='countdown'):
        """新回合重置计分、目标和效果，保留此前存档中的纪录。"""
        self.phase = phase
        self.remaining = ROUND_SECONDS
        self.score = self.captures = self.mistakes = self.combo = 0
        self.multiplier = 1
        self.last_cow_at = float('-inf')
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
        # 锁关逻辑放在规则层，鼠标点击与数字键都不能跳过关卡解锁。
        if 0 <= index <= self.unlocked:
            self.level_index = index
            self.restart()

    def toggle_pause(self):
        # 记录原阶段，以便暂停后能恢复到倒计时或正在进行的回合。
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
        """把 Pygame 窗口、键盘、鼠标事件转换为游戏状态变更。"""
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
        """每帧推进当前状态，先结算计时，再移动、判定、捕获和补位。"""
        if self.phase == 'countdown':
            self.countdown = max(0, self.countdown - elapsed)
            if self.countdown == 0:
                self.phase = 'playing'
            return
        if self.phase != 'playing':
            return
        # 正式倒计时使用实际帧间隔，60 秒即结算。模拟步长另设上限，
        # 以免窗口卡顿后瞬间移动或一次补进过多吸取进度。
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
        self.ship = self.ship.lerp(target, 1 - exp(-seconds * BEAM['aimFollowRate']))
        time = ROUND_SECONDS - self.remaining
        if time - self.last_cow_at >= COMBO['expireSeconds']:
            self.reset_combo()
        self.activate_hazards(time)
        self.pick_target()
        for cow in self.cows:
            if cow.warning_until is not None:
                continue
            if cow is self.lock:
                self.advance_capture(cow, seconds, time)
            elif cow.hazard:
                cow.lift = max(0, cow.lift - BEAM['decayRate'] * min(
                    seconds, max(0, time - cow.last_hit - BEAM['graceSeconds'])))
                if cow.mobile:
                    self.wander(cow, seconds)
            elif cow.lift == 0:
                # 已开始吸取的牛退出锁定时，进度与姿态整个回合内均保持。
                self.wander(cow, seconds)
        if self.lock and self.lock.lift >= 1:
            self.capture(self.lock)
        self.replenish()
        self.popups = [(pos, points, age + seconds)
                       for pos, points, age in self.popups if age + seconds < 1]

    def advance_capture(self, cow, seconds, time):
        """按剩余进度累加时间，同时分离碰撞与视觉动画。

        黑白牛和黄牛的 duration 来自同一套倍率配置。最后 30% 用
        渐变偏移把模型送向飞船，避免续吸时突然跳到新的飞船位置。
        """
        previous = cow.lift
        progress = previous + seconds / cow.duration
        cow.lift = 1 if progress >= 1 - 1e-9 else progress
        cow.last_hit = time
        if cow.hazard:
            return

        start = BEAM['cowPullStart']
        old_pull = max(0, (previous - start) / (1 - start)) ** 2
        new_pull = max(0, (cow.lift - start) / (1 - start)) ** 2
        weight = (new_pull - old_pull) / (1 - old_pull)
        cow.visual_offset = cow.visual_offset.lerp(self.ship - cow.position, weight)

    @staticmethod
    def radius(cow, sustained=False):
        """给奶牛更宽松的续接范围，障碍物用原有较窄的判定。"""
        if cow.hazard:
            key = 'holdRadius' if sustained else 'acquireRadius'
        else:
            key = 'cowHoldRadius' if sustained or cow.lift > 0 else 'cowAcquireRadius'
        return BEAM[key] * PIXELS_PER_UNIT

    def pick_target(self):
        # 已锁定的目标优先维持。否则按地面距离选择最近的一个，
        # 警示环尚未变成障碍时，即使玩家照到也不可锁定。
        if not self.pressed:
            self.lock = None
            return
        if self.lock and self.lock.position.distance_to(self.ship) <= self.radius(self.lock, True):
            return
        nearby = (cow for cow in self.cows if cow.warning_until is None
                  and cow.position.distance_to(self.ship) <= self.radius(cow))
        self.lock = min(nearby, key=lambda cow: cow.position.distance_squared_to(self.ship),
                        default=None)

    def wander(self, cow, seconds):
        """平滑转向。预测一步的位置，保持围栏及目标之间的间距。"""
        def free(velocity, step):
            target = cow.position + velocity * step
            return (FIELD.inflate(-46, -39).collidepoint(target)
                    and all(other is cow or target.distance_to(other.position) >= SEPARATION
                            for other in self.cows))

        cow.turn_in -= seconds
        if cow.turn_in <= 0:
            cow.turn_in = self.rng.uniform(2.3, 4.8)
            cow.turn = self.rng.uniform(-33, 33)
        if not free(cow.velocity, .72) and abs(cow.turn) < 1:
            # 只选择新的转向角，实际旋转仍受每秒最大角速度约束。
            for angle in (45, -45, 90, -90, 145, -145, 180):
                if free(cow.velocity.rotate(angle), .95):
                    cow.turn = angle
                    break
        cap = 63 * seconds
        step = max(-cap, min(cap, cow.turn))
        cow.velocity.rotate_ip(step)
        cow.turn -= step
        if free(cow.velocity, seconds):
            cow.position += cow.velocity * seconds

    def spawn(self, kind):
        """选择有间隔的空位。高关障碍有机会靠近奶牛前进路线。"""
        danger = TARGETS[kind]['points'] < 0
        places = list(SPAWNS)
        self.rng.shuffle(places)
        if danger and self.level_index > 0:
            near = []
            for cow in self.cows:
                if not cow.hazard and cow.velocity.length_squared() > 0:
                    direction = cow.velocity.normalize().rotate(self.rng.uniform(-32, 32))
                    distance = self.rng.uniform(HAZARD['nearCowMin'], HAZARD['nearCowMax'])
                    near.append(cow.position + direction * distance * PIXELS_PER_UNIT)
            self.rng.shuffle(near)
            places = near + places
        safe = HAZARD['safeDistance'] * PIXELS_PER_UNIT
        for position in places:
            point = pg.Vector2(position)
            if not FIELD.inflate(-46, -39).collidepoint(point) or point.distance_to(self.ship) <= safe:
                continue
            if any(point.distance_to(c.position) < (HAZARD['spacing'] * PIXELS_PER_UNIT
                   if danger and c.hazard else SEPARATION + 8) for c in self.cows):
                continue
            new = self.make_cow(point, kind)
            if danger:
                new.warning_until = ROUND_SECONDS - self.remaining + HAZARD['warningSeconds']
                new.mobile = self.hazard_index % self.level['hazards'] < self.level['movingHazards']
            self.cows.append(new)
            return True
        return False

    def activate_hazards(self, time):
        """先显示橙色预警。飞船靠近预警点时延迟激活，防止光束下突然生成。"""
        for cow in self.cows:
            if (cow.warning_until is not None and time >= cow.warning_until
                    and cow.position.distance_to(self.ship) >= HAZARD['safeDistance'] * PIXELS_PER_UNIT):
                cow.warning_until = None

    def spawn_hazard(self):
        kinds = self.level['kinds']
        if self.spawn(kinds[self.hazard_index % len(kinds)]):
            self.hazard_index += 1

    def replenish(self):
        """奶牛按种类延迟补回。预警中的障碍也占一个上限名额。"""
        time = ROUND_SECONDS - self.remaining
        for job in self.respawns[:]:
            at, kind = job
            if time >= at and self.spawn(kind):
                self.respawns.remove(job)
        if time >= self.hazard_at:
            if sum(target.points < 0 for target in self.cows) < self.level['hazards']:
                self.spawn_hazard()
            self.hazard_at = time + self.level['interval']

    def reset_combo(self):
        self.combo = 0
        self.multiplier = 1

    def capture(self, cow):
        """只有进度条走满且目标仍在场中，才允许结算一次。"""
        if cow not in self.cows or cow.lift < 1:
            return
        self.cows.remove(cow)
        self.lock = None
        points = cow.points
        self.capture_serial += 1
        if cow.hazard:
            self.mistakes += 1
            self.reset_combo()
        else:
            self.captures += 1
            self.combo += 1
            time = ROUND_SECONDS - self.remaining
            self.last_cow_at = time
            if self.combo >= COMBO['tripleAt']:
                self.multiplier = 3
            elif self.combo >= COMBO['doubleAt']:
                self.multiplier = 2
            if self.multiplier > 1:
                points += COMBO['bonusUnit'] * self.multiplier
            self.respawns.append((time + SETTINGS['respawnSeconds'], cow.kind))
        self.score = max(0, self.score + points)
        self.last_points = points
        self.popups.append((self.ship.copy(), points, 0))
