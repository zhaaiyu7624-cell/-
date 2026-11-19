# COW HEIST 2.4 / 星际偷牛计划

第二个个人作业的 Python 桌面游戏。玩家用摄像头手势或鼠标驾驶 UFO，通过四个 60 秒的递进关卡。随作业提供的 Three.js 网页版可展示同一规则的 3D 体验。Python 桌面版负责课程要求的完整 Python 应用演示。

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
- 点 **START RAID** 或按 Enter，选择已解锁的关卡，再等待 3 秒倒计时。移动光标将牵引光束的落点对准奶牛。
- 黑白牛持续吸取 1.2 秒得 100 分，黄牛 2.4 秒得 200 分。吸完危险南瓜、稻草人和油桶分别扣 80、100 和 120 分，最低为 0 分。奶牛锁定后停止游荡，松手或移开光束会冻结姿态和进度，重新照准地面落点即可续吸。
- 按 P 或 Esc 暂停或继续，切到其他窗口时自动暂停。60 秒到期后显示得分与胜负。
- 四关目标依次为 1000、2000、3200 和 4500 分。连捕第 3–4 只每次额外 30 分，第 5 只起每次额外 45 分；吸到障碍物或 6.5 秒未捕获会清零连击。通过后解锁下一关，最高分与解锁记录写入本机用户目录。按 R 重试，按 M 返回菜单，按 S 静音。鼠标模式无需摄像头。摄像头模式首次安装依赖后可离线运行。程序不会保存或上传摄像头画面。

## 代码阅读顺序

先读 `main.py` 的主循环，再读 `game.py` 的 `update`、`pick_target`、
`advance_capture` 和 `capture`。摄像头的坐标与光束状态如何计算，见
`camera.py`。分数和关卡参数取自 `levels.json`。Python 版进度单独存于
用户目录的 `.cow-heist-python-v24.json`，新版本从第一关开始记录。

## 文件

| 文件 | 用途 |
|---|---|
| `main.py` | Pygame 窗口和事件循环 |
| `game.py` | 鼠标输入、游戏状态、计时、捕获和计分 |
| `view.py` | 程序绘制的夜间农场、飞船、奶牛与界面 |
| `camera.py` | 摄像头采集、手势识别、位置平滑和捏合防抖 |
| `requirements-camera.txt` | 摄像头模式的依赖 |
| `assets/hand_landmarker.task` | 本地 Hand Landmarker 模型 |
| `levels.json` / `levels.py` | 四关配置、吸取时间、分数及本地记录 |
| `sounds.py` | 背景音乐播放与 Python 合成反馈音 |
| `requirements.txt` | 锁定 Pygame 版本 |
| `start-windows.cmd` | Windows 启动脚本 |
| `产品说明.docx` | 应用场景、用户、设计逻辑和普及分析 |
| `evidence/` | 实测画面与 AI 迭代记录索引 |
| `学习反思-待个人确认.docx` | 需按实际经历修改并确认的反思草稿 |

如提示找不到 `py`，请检查源码包所需的 Python 3.12 和 Launcher 是否已安装。如果显示摄像头不可用，检查「设置 → 隐私和安全性 → 相机 → 允许桌面应用访问你的相机」，或直接使用鼠标。

## 手势资源

模型为 Google MediaPipe Hand Landmarker，沿用原 3D 原型验证过的本地模型文件。模型的 SHA-256 为 `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`。

## 背景音乐

菜单和四关分别使用对应的原创 Python 配乐。作业包内的五首立体声 Ogg 从原项目自行合成的 WAV 转码，以减小提交包。按 S 同时静音或恢复配乐与音效。暂停游戏时音乐停住，继续后从原位置播放。
