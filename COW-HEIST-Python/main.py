"""Run the Python desktop edition of COW HEIST."""
import sys
from time import monotonic

import pygame as pg

from camera import Gestures, Webcam
from game import FIELD, Game
from view import HEIGHT, WIDTH, View


def main():
    pg.init()
    screen = pg.display.set_mode((WIDTH, HEIGHT))
    pg.display.set_caption('COW HEIST / Python Edition')
    clock = pg.time.Clock()
    game = Game()
    view = View(screen)
    camera, gestures = Webcam(), Gestures()
    use_camera = False
    message = 'MOUSE MODE'

    def enable_camera():
        gestures.reset()
        game.pressed = False
        return camera.start()

    if '--camera' in sys.argv:
        use_camera = enable_camera()
    try:
        while True:
            seconds = clock.tick(60) / 1000
            for event in pg.event.get():
                if event.type == pg.QUIT:
                    return
                if event.type == pg.KEYDOWN and event.key == pg.K_c:
                    if use_camera:
                        use_camera = False
                        camera.stop()
                        game.pressed = False
                        message = 'MOUSE MODE'
                    else:
                        use_camera = enable_camera()
                    continue
                mouse_input = event.type in (pg.MOUSEMOTION, pg.MOUSEBUTTONDOWN, pg.MOUSEBUTTONUP)
                if not (use_camera and mouse_input and game.phase == 'playing'):
                    game.handle(event)

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
                        x, y = position
                        game.cursor.update(FIELD.left + FIELD.width * x, FIELD.top + FIELD.height * y)
                    game.pressed = pinched
                else:
                    game.pressed = False

            game.update(seconds)
            view.draw(game)
            if use_camera or message != 'MOUSE MODE':
                view.camera_status(message, camera.sample if use_camera else None, camera.preview_size)
            pg.display.flip()
    finally:
        camera.stop()
        if camera.thread:
            camera.thread.join(timeout=1)
        pg.quit()


if __name__ == '__main__':
    main()
