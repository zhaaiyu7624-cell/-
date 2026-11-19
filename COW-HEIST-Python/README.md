# COW HEIST / 星际偷牛计划

第二个个人作业的 Python 桌面游戏。玩家用鼠标驾驶 UFO，在 60 秒内通过牵引奶牛获得至少 100 分。原 Three.js 网页可以作为前期交互原型展示。

## Windows 11 运行

**便携包（Windows x64）**：完整解压，再双击 `start-windows.cmd`。包内附带 Python 与 Pygame，可直接离线运行。

**源码包**：安装 [Python 3.12](https://www.python.org/downloads/windows/)，保留 Python Launcher，再双击 `start-windows.cmd`。首次启动需要联网安装 Pygame。也可在解压目录打开 PowerShell，执行：

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe main.py
```

在 Linux 或 macOS 上，可以用 Python 3.12 建立虚拟环境、安装 `requirements.txt`，再用环境内的 Python 运行 `main.py`。

## 操作

- 点 **START RAID** 或按 Enter 开始。移动光标将牵引光束的落点对准奶牛。
- 按住鼠标左键约 1.2 秒完成吸取。普通牛 10 分，金色牛 25 分。提前松手或移开会让进度回落。
- 按 P 或 Esc 暂停或继续，切到其他窗口时自动暂停。60 秒到期后显示得分与胜负。
- 点 **PLAY AGAIN** 或按 Enter 重玩。游戏无需摄像头或联网，也不采集玩家数据。

## 文件

| 文件 | 用途 |
|---|---|
| `main.py` | Pygame 窗口和事件循环 |
| `game.py` | 鼠标输入、游戏状态、计时、捕获和计分 |
| `view.py` | 程序绘制的夜间农场、飞船、奶牛与界面 |
| `requirements.txt` | 锁定 Pygame 版本 |
| `start-windows.cmd` | Windows 启动脚本 |
| `产品说明.docx` | 应用场景、用户、设计逻辑和普及分析 |
| `evidence/` | 实测画面与 AI 迭代记录索引 |
| `学习反思-待个人确认.docx` | 需按实际经历修改并确认的反思草稿 |

如提示找不到 `py`，请检查源码包所需的 Python 3.12 和 Launcher 是否已安装。如果便携包无法启动，请先确认电脑是 x64 Windows，并保留 `runtime` 目录与启动脚本在同一目录。
