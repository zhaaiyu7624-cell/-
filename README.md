# COW HEIST 2.4 / 星际偷牛计划

- 网页 3D 试玩，请下载 [COW-HEIST-Web-2.4.zip](https://github.com/zhaaiyu7624-cell/-/raw/refs/heads/main/COW-HEIST-Web-2.4.zip)，完整解压后双击 `start-browser-windows.cmd`。已装 Python 3.12 时无需安装 Node.js。
- 课程提交，请下载 [COW-HEIST-Python-Source.zip](https://github.com/zhaaiyu7624-cell/-/raw/refs/heads/main/COW-HEIST-Python-Source.zip)。包内有 Python 桌面程序、摄像头启动脚本、产品文档、实验截图、迭代索引和反思草稿。提交时请补充原始 AI 对话截图和个人反思。
- [网页开发说明](COW-HEIST-Web/README.md) · [Python 应用说明](COW-HEIST-Python/README.md)

- [原创音频文件清单与生成说明](COW-HEIST-Web/AUDIO.md)

## 双击即玩的单文件版

在 GitHub 文件页下载原始文件 `COW-HEIST-2.4.html`，保存后用 Chrome 或 Edge 打开，选择鼠标模式即可离线试玩。页面、3D 资源、声音和手势资源都内嵌在一个文件中。摄像头模式取决于浏览器权限；课堂提交仍以 Python 作业包为主。

开发者可在 `COW-HEIST-Web` 目录执行 `npm ci`，然后用 `node scripts/build-standalone.mjs` 生成 HTML。生成过程需要 FFmpeg。
