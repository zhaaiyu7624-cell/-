"""Serve the bundled web edition locally with standard-library Python."""
import argparse
import os
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class StaticFiles(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.wasm': 'application/wasm',
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4173)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    dist = Path(__file__).resolve().parents[1] / 'dist'
    if not (dist / 'index.html').is_file():
        parser.exit(1, 'dist/index.html is missing. Run npm ci and npm run build, or extract the complete web package.\n')
    handler = partial(StaticFiles, directory=os.fspath(dist))
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError:
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    with server:
        url = f'http://127.0.0.1:{server.server_port}/'
        print(f'COW HEIST 2.0: {url}\nKeep this window open while playing.', flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
