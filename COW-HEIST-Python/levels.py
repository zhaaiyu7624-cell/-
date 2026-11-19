"""Load the shared balance settings and keep desktop progress locally."""
import json
import os
from pathlib import Path

SETTINGS = json.loads(Path(__file__).with_name('levels.json').read_text(encoding='utf-8'))
LEVELS = SETTINGS['levels']
TARGETS = SETTINGS['targets']
PROGRESS_PATH = Path(os.environ.get('COW_HEIST_PROGRESS',
                                    Path.home() / '.cow-heist-python-v2.json'))


def read_progress():
    try:
        data = json.loads(PROGRESS_PATH.read_text(encoding='utf-8'))
        if not isinstance(data['unlocked'], int) or len(data['best']) != len(LEVELS):
            raise ValueError('Invalid progress')
        return max(0, min(len(LEVELS) - 1, data['unlocked'])), [max(0, int(x)) for x in data['best']]
    except (OSError, ValueError, KeyError, TypeError):
        return 0, [0] * len(LEVELS)


def write_progress(unlocked, best):
    # Write to a temporary file before replacing the last successful result.
    try:
        temporary = PROGRESS_PATH.with_suffix('.tmp')
        temporary.write_text(json.dumps({'unlocked': unlocked, 'best': best}), encoding='utf-8')
        temporary.replace(PROGRESS_PATH)
    except OSError:
        pass
