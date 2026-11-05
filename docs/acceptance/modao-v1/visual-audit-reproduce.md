# 复现视觉验收

使用结果分支安装好的依赖和 Node 24。所有浏览器脚本只允许 localhost，不注入生产凭据。沿用现有本地演示配置；不要用生产数据库/模型配置启动。

终端一：

```bash
npm run dev
```

终端二（工作目录放在 work，ZIP 原件不改）：

```bash
python scripts/modao-audit-server.py prototype/智能知识库V1.0.zip --output work/modao-prototype --port 8081
```

脚本会打印实际原型 URL。本次 ZIP 的根目录为 `pm2mv9dlt722tkxks-mvak915c`。如果端口正在运行同一源文件的服务，直接复用。

终端三：

```bash
mkdir -p work/modao-v1-audit
python scripts/modao-zip-inventory.py prototype/智能知识库V1.0.zip --out work/modao-v1-audit/inventory.json
IKB_CHROMIUM_PATH=/usr/bin/chromium IKB_VISUAL_OUTPUT=work/modao-v1-audit/react-native node scripts/modao-react-capture.mjs
IKB_CHROMIUM_PATH=/usr/bin/chromium IKB_AUDIT_OUTPUT=work/modao-v1-audit/paired IKB_MODAO_URL=http://127.0.0.1:8081/pm2mv9dlt722tkxks-mvak915c/index.html node scripts/modao-visual-audit.mjs
IKB_CHROMIUM_PATH=/usr/bin/chromium IKB_STATE_OUTPUT=work/modao-v1-audit/prototype-states IKB_MODAO_URL=http://127.0.0.1:8081/pm2mv9dlt722tkxks-mvak915c/index.html node scripts/modao-prototype-states.mjs
IKB_CHROMIUM_PATH=/usr/bin/chromium IKB_INTERACTION_OUTPUT=work/modao-v1-audit/interactions node scripts/modao-interaction-audit.mjs
python scripts/modao-audit-gallery.py work/modao-v1-audit
```

最后一条交互审计命令当前预期退出 1：个人中心鼠标保存、待审数量清零显示有真实失败。不要 force click、跳过用例或删除断言来改成绿色。其余只记录能力边界的观察型用例，应阅读 `observations` 字段，不能用 pass 状态代替完整业务签收。

`modao-audit-gallery.py` 需要环境已安装的 Pillow，浏览器脚本使用项目 Playwright。打开生成的 `index.html` 可离线浏览。本云环境的 Chromium 策略禁止 file://，已用 localhost 静态服务验证图库全部图片与滑块。遇到同样策略时运行 `python -m http.server 8090 --bind 127.0.0.1 --directory work/modao-v1-audit`，访问 `http://127.0.0.1:8090/index.html`；不需要外网。所有相对证据路径以解压后的 ZIP 根目录为准。Playwright trace 可在项目环境用 `npx playwright show-trace <trace.zip>` 打开。

先确认系统安装 `Noto Sans CJK SC`；没有该字体时，统一字体图仍可能发生 fallback，不应做字形签收。原型运行器私有 DOM 或 SVG 特征变更会令脚本失败，需重新检查选择器，不能静默改为猜测坐标/截图。

文件命名：

- `react-native/`：PR #10 原始全页截图与错误报告。
- `paired/{prototype,react}/<id>-native.png`：统一视口、原生字体策略下的截图，原型已消除预览器缩放。
- `paired/{prototype,react}/<id>.png`：同视口、同系统字体的结构对照图。
- `paired/prototype/<id>-editor.png`：原始墨刀预览器上下文，证明实际选页与源画布。
- `*-geometry.json`：DOM 文本、几何、颜色/字体和控件信息。
- `prototype-states/`：原型实际热点弹窗与 React 对应态，包含原生/统一字体图。
- `interactions/`：交互截图、完整错误及 trace。
- `manifest.json`：证据文件 SHA256；`commands.json`：实际命令退出码。

原始截图工具的 800ms 等待不足以保证首次 Vite 编译与 hydration 完成。保留它的原始结果，再使用配对工具的 networkidle 和独立 context 复核；不删除原错误报告。
