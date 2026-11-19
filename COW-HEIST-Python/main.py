"""启动 Python 作业版，连接输入、规则、声音和画面。"""
import sys
from time import monotonic

import pygame as pg

from camera import Gestures, Webcam
from game import FIELD, Game
from view import HEIGHT, WIDTH, View
from sounds import RATE, make_sound


def main():
    """运行 Pygame 主循环，按事件、游戏规则、绘制的顺序处理一帧。"""
    pg.mixer.pre_init(RATE, -16, 1)
    pg.init()
    screen = pg.display.set_mode((WIDTH, HEIGHT))
    pg.display.set_caption('COW HEIST 2.4 / Python Edition')
    clock = pg.time.Clock()
    game = Game()
    view = View(screen)
    camera, gestures = Webcam(), Gestures()
    use_camera = False
    message = 'MOUSE MODE'
    success_sound, hazard_sound = make_sound(480, 1020), make_sound(235, 102)
    muted = False

    def enable_camera():
        gestures.reset()
        game.pressed = False
        return camera.start()

    if '--camera' in sys.argv:
        use_camera = enable_camera()
    try:
        while True:
            seconds = clock.tick(60) / 1000
            previous_phase = game.phase
            for event in pg.event.get():
                if event.type == pg.QUIT:
                    return
                if event.type == pg.KEYDOWN and event.key == pg.K_s:
                    muted = not muted
                    continue
                if event.type == pg.KEYDOWN and event.key == pg.K_c:
                    if use_camera:
                        use_camera = False
                        camera.stop()
                        game.pressed = False
                        message = 'MOUSE MODE'
                    else:
                        use_camera = enable_camera()
                    continue
                # 手势模式中，鼠标仍可点菜单，但不能在回合中覆盖手势。
                mouse_input = event.type in (pg.MOUSEMOTION, pg.MOUSEBUTTONDOWN, pg.MOUSEBUTTONUP)
                if not (use_camera and mouse_input and game.phase == 'playing'):
                    game.handle(event)

            if use_camera and game.phase == 'title' and previous_phase != 'title':
                camera.stop()
                use_camera = False
                message = 'MOUSE MODE'
            if use_camera and camera.error:
                use_camera = False
                game.pressed = False
                message = camera.error + ' / MOUSE MODE'
            if use_camera:
                sample = camera.sample
                position, pinched = gestures.update(sample, monotonic())
                message = camera.status if position is None else ('BEAM ON' if pinched else 'HAND LOCKED')
                if game.phase == 'playing':
                    if position is not None:
                        # 手势输出是 0–1 的相对坐标，乘农场尺寸转为像素。
                        x, y = position
                        game.cursor.update(FIELD.left + FIELD.width * x, FIELD.top + FIELD.height * y)
                    game.pressed = pinched
                else:
                    game.pressed = False

            # 比较捕获序号，一次结算只触发一次提示音。
            serial = game.capture_serial
            game.update(seconds)
            if not muted and game.capture_serial != serial:
                sound = success_sound if game.last_points > 0 else hazard_sound
                if sound:
                    sound.play()
            view.draw(game)
            if use_camera or message != 'MOUSE MODE':
                view.camera_status(message, camera.sample if use_camera else None, camera.preview_size)
            pg.display.flip()
    finally:
        # 窗口退出时通知后台线程归还相机，再关闭 Pygame。
        camera.stop()
        if camera.thread:
            camera.thread.join(timeout=1)
        pg.quit()


if __name__ == '__main__':
    main()
