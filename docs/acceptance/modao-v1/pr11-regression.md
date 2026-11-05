# PR #11 独立浏览器回归

日期：2026-11-05，Asia/Tokyo。沿用同一个 Codex Cloud 工作区、项目依赖、系统 Chromium、原始墨刀 ZIP 及上一轮审计资料，没有创建新测试工程。

## 提交身份与结论

- 已核对远端 `refs/heads/fix/modao-v1-audit-b01-b05` 与 `refs/pull/11/head`：均为指定的 `f88428de889c80c77c24cf43bf63aa70b91e2c5f`，起始工作树干净。
- 上一轮复用来源：`audit/modao-v1-visual-results` 的 `cf57988c77f7b818fb1c4b01259c080d006c5066`，复用 Playwright runner、个人中心/审核/仪表盘用例、真实原型热点与 1:1 DOM 截图方法。B05 原旧脚本断言 localStorage 中存在完整值，已改为从界面取一次性值，再断言所有本地/会话存储都不包含该值。
- **指定提交：5/6 通过**。B01、B02、B03 两个分支、新建密钥路径通过；额外旧版本迁移路径失败。
- 最小修复后的业务提交：`b99e8718ed99094028c88140926cd4567c17d05c`，**6/6 通过**，浏览器脚本退出 0。
- 仅新增 `src/lib/kb/store.ts` 的 5 行 hydration 后持久化清理逻辑；其他业务代码不变。没有合并 PR、没有修改 main、没有接入生产数据或模型服务。

## 命令与结果

Node `v24.22.1`，npm `11.9.0`；沿用系统 Chromium `/usr/bin/chromium`（155.0.8059.79）。React 服务复用 `http://127.0.0.1:8080`。每个用例独立 browser context，1920×1080、DPR 1、zh-CN、Asia/Tokyo。

| 命令 | 指定提交退出码 | 最小修复后退出码 |
|---|---:|---:|
| `npm run typecheck` | 0 | 0 |
| `npm run build:dev` | 0 | 0 |
| `IKB_PR11_OUTPUT=/workspace/work/pr11/{baseline,final} node scripts/modao-pr11-regression.mjs` | 1 | 0 |

开发构建保留依赖模块 `use client` 打包警告，未将其当作构建失败。本轮未重跑与这四项缺陷无关的整套 `npm test`，也不声称上一轮的模板/品牌测试失败已解决。

## 实际浏览器回归

| 用例 | 验证步骤及断言 | 指定提交 | 最终 |
|---|---|---|---|
| profile / B01 | 首页个人中心→修改名称和部门→普通 Playwright `click()` 鼠标保存→刷新→重开，字段恢复；不使用 force、脚本 dispatch 或键盘绕过 | 通过 | 通过 |
| dashboard-zero / B02 | 处理初始唯一待审项；实际 open=0→后台统计为 0→刷新仍为 0 | 通过 | 通过 |
| review-approve / B03 | 通过真实 UI 上传合成敏感文档→通过→已通过页签；无“待处理”标签、只有已通过标签，文档 indexed 且有切片；刷新重新选页签再次核对 | 通过 | 通过 |
| review-reject / B03 | 独立 context 上传合成敏感文档→拒绝；无“待处理”标签、显示已拒绝，文档 rejected 且切片为空；刷新后标签和状态保留 | 通过 | 通过 |
| keys-new / B05 | 创建本地演示密钥；从界面读取完整值，不点“我已保存”直接刷新；界面不再显示完整值，遍历 localStorage/sessionStorage 均无完整值；预览只有掩码、元数据保留、撤销后刷新仍消失 | 通过 | 通过 |
| keys-legacy / B05 | 创建合成演示密钥后，向此独立 context 注入旧版格式 freshSecret；刷新；界面隐藏且存储必须清除完整值，同时保留密钥元数据 | **失败** | **通过** |

所有最终用例 pageerror 为 0。外部 Google Fonts / Grok 扩展资源加载失败仍记录在 consoleErrors/failedRequests，不影响上述本地操作；未删除日志或修改网络策略来掩盖它们。

## 实际发现与最小修复

`f88428d` 的 `partialize` 阻止新完整密钥写入存储，`merge` 将旧值从内存清除，但 Zustand rehydrate 并未自动把清理后的对象写回原 localStorage。因此旧版存储仍有完整值，虽然界面已经隐藏。

原始失败日志为：

```text
fail keys-legacy AssertionError [ERR_ASSERTION]: Full secret must not remain in browser storage after reload
+ local: ['zhishi-kb-v1']
- local: []
```

修复在 persist 的 `onRehydrateStorage` 成功回调中调用已有的 `dismissSecret()`。它经原有 set/partialize 路径将清理后的状态写回，保留其他数据；没有清空 localStorage、重置文档/账户或删除密钥元数据。异常 rehydrate 不执行重写。

最终同一用例的 `afterReloadLeakKeys` 为 `{ "local": [], "session": [] }`。profile、两种审核状态和密钥元数据也分别验证了刷新持久化没有被这次清理破坏。

## 证据和复现

下载本目录 `pr11-regression-evidence.zip`，校验 `.zip.sha256`，解压后通过本地 HTTP 打开 `index.html`。例如 `python -m http.server 8091 --bind 127.0.0.1 --directory <解压目录>`；云 Chromium 禁止 file://，因此使用本地 HTTP，无需外网。图库已实际验证21个段落、全部图片可加载、无 JavaScript 异常。其中包含：

- `baseline/`：指定提交的原始日志、6 个用例 trace 和截图，保留旧版密钥存储失败。
- `final/`：修复后同一 6 个用例的截图、trace、结果 JSON、原始日志。
- `plan/`：V15 默认/有效期菜单及 V16 四页签、检索菜单，均有原始预览器、原生字体、统一字体和 DOM 几何记录。
- `previous-reference/`：上一轮实际原型分享/个人中心及对应 React 截图，保留来源文件哈希。
- `commands.json`、`provenance.json`、`manifest.json`：命令、退出码、来源 SHA、所有文件 SHA256。

本地复现回归：

```bash
npm run dev
IKB_CHROMIUM_PATH=/usr/bin/chromium IKB_PR11_OUTPUT=work/pr11-regression node scripts/modao-pr11-regression.mjs
npm run typecheck
npm run build:dev
```

旧版迁移用例只向自己独立 context 注入本次 UI 生成的合成值，不读取或使用任何生产密钥。

V15/V16 的详细尺寸、字段、四页签菜单、组件文件和交互状态见 `v15-v16-component-plan.md`。它们仍是下一步实现计划，不能因为 B01 已修复就宣称 V16 已还原。B04 的细粒度权限持久化与其他页面视觉缺口也不属于本轮修复范围。
