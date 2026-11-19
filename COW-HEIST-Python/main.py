"""Run the Python desktop edition of COW HEIST."""
import pygame as pg

from game import Game
from view import HEIGHT, WIDTH, View


def main():
    pg.init()
    screen = pg.display.set_mode((WIDTH, HEIGHT))
    pg.display.set_caption('COW HEIST / Python Edition')
    clock = pg.time.Clock()
    game = Game()
    view = View(screen)
    try:
        while True:
            seconds = clock.tick(60) / 1000
            for event in pg.event.get():
                if event.type == pg.QUIT:
                    return
                game.handle(event)
            game.update(seconds)
            view.draw(game)
            pg.display.flip()
    finally:
        pg.quit()


if __name__ == '__main__':
    main()
