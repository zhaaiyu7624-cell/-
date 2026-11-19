# COW HEIST / 星际偷牛计划

第二个个人作业的 Python 桌面游戏。玩家用摄像头手势或鼠标驾驶 UFO，在 60 秒内通过牵引奶牛获得至少 100 分。原 Three.js 网页可以作为前期交互原型展示。

## Windows 11 运行

**摄像头模式（Windows x64）**：安装 Python 3.12 后完整解压最新版，关闭旧游戏窗口，双击 `start-camera-windows.cmd`。首次需要联网安装 OpenCV 和 MediaPipe。允许 Windows 桌面应用访问摄像头，并关掉正在占用摄像头的应用。可按 C 在摄像头与鼠标之间切换。

**鼠标模式**：双击 `start-windows.cmd`。运行中按 C 也能启用已安装依赖的摄像头模式。

**源码包**：安装 [Python 3.12](https://www.python.org/downloads/windows/)，保留 Python Launcher，再双击 `start-windows.cmd`。首次启动需要联网安装 Pygame。也可在解压目录打开 PowerShell，执行：

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe main.py
```

在 Linux 或 macOS 上，可以用 Python 3.12 建立虚拟环境、安装 `requirements.txt`，再用环境内的 Python 运行 `main.py`。

## 操作

- 摄像头模式下，将一只手完整放进预览画面。移动掌心控制飞船，捏住拇指和食指启动光束，松开停止。摄像头画面仅在进程内处理，右上角显示镜像预览和手部关键点。
- 点 **START RAID** 或按 Enter 开始。移动光标将牵引光束的落点对准奶牛。
- 按住鼠标左键约 1.2 秒完成吸取。普通牛 10 分，金色牛 25 分。提前松手或移开会让进度回落。
- 按 P 或 Esc 暂停或继续，切到其他窗口时自动暂停。60 秒到期后显示得分与胜负。
- 点 **PLAY AGAIN** 或按 Enter 重玩。鼠标模式无需摄像头。摄像头模式首次安装依赖后可离线运行。程序不会保存或上传摄像头画面。

## 文件

| 文件 | 用途 |
|---|---|
| `main.py` | Pygame 窗口和事件循环 |
| `game.py` | 鼠标输入、游戏状态、计时、捕获和计分 |
| `view.py` | 程序绘制的夜间农场、飞船、奶牛与界面 |
| `camera.py` | 摄像头采集、手势识别、位置平滑和捏合防抖 |
| `requirements-camera.txt` | 摄像头模式的依赖 |
| `assets/hand_landmarker.task` | 本地 Hand Landmarker 模型 |
| `requirements.txt` | 锁定 Pygame 版本 |
| `start-windows.cmd` | Windows 启动脚本 |
| `产品说明.docx` | 应用场景、用户、设计逻辑和普及分析 |
| `evidence/` | 实测画面与 AI 迭代记录索引 |
| `学习反思-待个人确认.docx` | 需按实际经历修改并确认的反思草稿 |

如提示找不到 `py`，请检查源码包所需的 Python 3.12 和 Launcher 是否已安装。如果显示摄像头不可用，检查「设置 → 隐私和安全性 → 相机 → 允许桌面应用访问你的相机」，或直接使用鼠标。

## 手势资源

模型为 Google MediaPipe Hand Landmarker，沿用原 3D 原型验证过的本地模型文件。模型的 SHA-256 为 `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`。
