"""读取关卡参数，在用户目录保存独立的 Python 版通关纪录。"""
import json
import os
from pathlib import Path

SETTINGS = json.loads(Path(__file__).with_name('levels.json').read_text(encoding='utf-8'))
LEVELS = SETTINGS['levels']
TARGETS = SETTINGS['targets']
PROGRESS_PATH = Path(os.environ.get('COW_HEIST_PROGRESS',
                                    Path.home() / '.cow-heist-python-v24.json'))


def read_progress():
    """首次运行或存档内容无效时，只开放第一关并提供零分纪录。"""
    try:
        data = json.loads(PROGRESS_PATH.read_text(encoding='utf-8'))
        if not isinstance(data['unlocked'], int) or len(data['best']) != len(LEVELS):
            raise ValueError('Invalid progress')
        return max(0, min(len(LEVELS) - 1, data['unlocked'])), [max(0, int(x)) for x in data['best']]
    except (OSError, ValueError, KeyError, TypeError):
        return 0, [0] * len(LEVELS)


def write_progress(unlocked, best):
    # 先在同一目录写临时文件，再替换正式存档，避免留下半份 JSON。
    try:
        temporary = PROGRESS_PATH.with_suffix('.tmp')
        temporary.write_text(json.dumps({'unlocked': unlocked, 'best': best}), encoding='utf-8')
        temporary.replace(PROGRESS_PATH)
    except OSError:
        pass
