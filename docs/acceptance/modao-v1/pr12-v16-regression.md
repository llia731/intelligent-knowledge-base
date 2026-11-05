# PR #12：V16 独立回归报告

日期：2026-11-05（Asia/Tokyo）。结论：**类型检查、开发构建、PR #11 的6项回归及 V16 的15项专项回归均通过，V16可供人工复核。** 本结论不代替原生字体、原型外开发工具及产品行为的人工确认。本轮未开发 V15，未修改 main，未合并 PR。

## 来源与实际提交

- 远端 PR #12 head 与 `feat/modao-v16-personal-settings` 一致：`4489446bd365fdc43b68d775c5b0afe744f887cc`；起始工作树干净。
- 原 PR #11 基线：`459244f3255b9e038207779fad7694310994928c`。复用其 Playwright runner、6项断言、原ZIP和已提交的截图/几何资料，未新建测试工程。
- 本轮最终业务与脚本提交：`f44073277cb263dac17aff24d8e357ad21f6f528`，之后只追加报告和证据。
- 原ZIP SHA256仍为 `8c585bc0e158a22603410dc2578bf6fe9b6e6207285b124dd4eaf45c0646603b`。原型截图从PR #11证据包提取，逐个校验其manifest哈希；该包 SHA256 为 `1bfcf3fba30d44e2f35b2c44fad1b66ba3fd06de7e0560d2c5c16716acefc37a`。
- 继续使用既有 `/workspace/intelligent-knowledge-base`、Node `v24.22.1`、npm `11.9.0`、系统 Chromium `155.0.8059.79` 和项目 Playwright 依赖；React 服务为 localhost:8080。

## 检查结果与保留的失败

| 检查 | PR原提交 | 最终结果 |
|---|---|---|
| `npm run typecheck` | 退出0 | 退出0 |
| `npm run build:dev` | 退出0 | 退出0，依赖 use client 打包警告保留 |
| PR #11回归 | 初次5/6，首页首次编译超过旧7秒导航时限；同一业务提交改30秒导航时限后6/6 | 6/6，退出0 |
| V16专项 | 12项：9通过，3失败 | 扩充后15/15，退出0 |
| 四页签视觉采集 | 不同高度、位置随页签跳动 | 4/4，退出0；768×620，位置稳定 |

原提交的三项真实失败：

1. `four-tabs-layout`：个人资料 `(704,264,768,552)`；界面偏好 `(704,256.5,768,567)`；检索偏好 `(704,209,768,662)`；通知偏好 `(704,185,768,710)`。没有固定620px高度，通知频率单列及重复提示撑高窗口。
2. `keyboard-layering`：Escape关闭后没有恢复实际打开按钮的焦点。原实现没有 Radix Trigger，默认还焦点路径无目标。
3. `accessible-fields`：主题单选组无可访问名称，检索下拉只有视觉文本，无法通过其名称定位。

全部失败日志、截图、trace保留在证据包的 `v16-baseline/`；没有删除断言或使用 force click。

另一次最终并行执行中，旧 B02 脚本立即读到 SSR 初始值1并冻结为结果，随后同次截图已经显示0，还出现截图工具插入 `caret-color` 属性导致的 hydration 警告。原次失败完整保存在 `pr11-hydration-diagnostic/`。修正为：限时等待可见0，再断言0；刷新后重复可见值及存储待审数断言；截图使用 `caret:initial` 避免改写输入样式。**未改业务计数代码、未跳过B02、未改期望值**。最终通过依据的是可操作客户端界面及持久化状态。

## 本轮修改

业务改动仅在 `src/components/kb/personal-settings-dialog.tsx` 及其作用域CSS；没有改共享 `.modal`、store、权限模型或V15。

- 固定桌面768×620，主内容区域居中；窄视口限制最大高度、可滚动，1024px以下跟随侧栏布局居中。
- 按已取得的原型校正标题/页签/字段/页脚位置、14px正文和20px行高、颜色、输入填色、圆角、选项宽度和通知频率2×2排列。移除字段区重复能力提示，将“仅保存偏好”的说明保留在开发工具区域，避免改变正文尺寸。
- 将“基本信息/界面设置/默认检索设置”等名称对齐实际原型；恢复主题/布局/通知图标、24px头像图标、45×24开关、蓝色未选中边框、细线下拉箭头。企业微信项图标使用从原型实际控件读出的SVG路径，证据包含源SVG和运行时CID。
- 当前Chromium支持 `appearance:base-select`；在保留原生select/option语义、表单值和键盘行为的前提下，将菜单表面还原为140×180。已实际鼠标打开三项菜单、选择并刷新验证；不支持该CSS能力的浏览器保留原生下拉，未声称跨浏览器视觉通过。
- 为主题/布局单选组命名，原生radio分组使用独立name；关联可见label与输入；关联tab、tabpanel的ID。增加焦点环，明确保存/关闭后的实际入口焦点恢复。
- 保留未保存草稿、原子保存、取消/关闭/Escape/遮罩丢弃、旧状态默认值补齐，以及原 `#role-switch` 的即时本机演示角色行为。

## 相关浏览器回归

所有用例使用独立 browser context，不复用上一用例的localStorage；默认1920×1080、DPR1、zh-CN、Asia/Tokyo。没有调用生产模型、通知服务或真实账户接口。

### PR #11：6/6

- B01：普通鼠标点击保存姓名/部门，刷新重新打开恢复；不使用键盘绕过或强制点击。
- B02：审核归零、仪表盘0、刷新仍0，持久化open数也为0。
- B03通过/拒绝：实际UI上传合成敏感文档，处理后无“待处理”标签；索引/切片状态正确，刷新后仍正确。
- B05新建/旧版：创建时完整值只在界面；不点“我已保存”直接刷新，localStorage/sessionStorage均无完整值；旧格式合成值也清除，元数据保留，预览只有掩码、撤销持久化。

### V16：15/15

| 用例 | 实际验证 |
|---|---|
| four-tabs-layout | 四页签逐一截图；每态宽768、高620、x704、y230，容差1px |
| draft-save-reload | 修改所有页签，切回之前页签仍保留；保存、刷新后逐页断言头像、姓名、部门、主题、布局、开关、3个下拉、通知渠道及频率 |
| discard-cancel / close / escape / backdrop | 四条独立退出路径；不更改已有profile/preferences，重新打开恢复已保存值 |
| keyboard-layering | Tab循环35次、Shift+Tab12次不离开窗口；左右方向键切换及首尾循环正确；Escape后焦点回账户入口 |
| accessible-fields | 主题组有名称，3个下拉可按可见字段名定位，tab/tabpanel关联 |
| legacy-migration | 注入无personalPreferences的旧资料及合成freshSecret，补齐默认值；保留原姓名、部门、文档、权限，旧完整值清除 |
| partial-preferences-migration | 部分旧偏好保留既有主题/渠道，缺失字段补默认值，界面实际恢复 |
| roles-permissions | 授予普通用户查看用户管理后可访问；撤销后拒绝；角色切换可用且保存可点击 |
| radio-keyboard | 实际焦点+ArrowRight更改主题radio选择 |
| quick-entry-focus | 首页快捷个人中心入口，Escape及保存后均还焦点到该实际按钮 |
| narrow-viewports | 1280×720、800×600、375×812，窗口位于视口内、无内部横溢出、可保存 |
| select-mouse-options | 真实鼠标打开模式/排序/条数菜单并选择；保存刷新后仍为keyword/updated/50 |

最终两套回归均无 JavaScript pageerror。Google Fonts/Grok扩展资源失败仍记录在consoleErrors/failedRequests；没有过滤掉原日志或改变网络策略来伪造无错误报告。

## 四页签截图与原型对照

`visual/`提供最终原生字体及统一字体图、字段/控件几何、完整视口并排和768×620组件裁切对照。组件裁切按各自实际边界，未对组件进行缩放。`prototype-reference/`保存校验过的原型图和来源哈希。

最终视觉对照通过真实UI将隔离测试资料设置为“系统管理员/平台产品部”，以匹配原型示例；没有硬编码进业务组件。基线截图保留初始本地资料，“当前用户/产品部”的文本差异不计算成几何失败。不计算不同数据状态下的像素合格百分比。

| 锚点 | 原型 | 最终React |
|---|---|---|
| 窗口 | (704,229)，768×620 | (704,230)，768×620 |
| 标题 | (729,254)，20px | (729,255)，20px |
| 个人资料标题 | (729,397)，14px | (729,397)，14px |
| 姓名 / 头像 / 部门标签y | 437 / 523 / 619 | 437 / 523 / 619 |
| 界面主题 / 布局标签y | 437 / 523 | 437 / 523 |
| 检索模式 / 排序 / 条数标签y | 437 / 523 / 609 | 437 / 523 / 609 |
| 通知渠道 / 频率标签y | 437 / 589 | 437 / 589 |

除个人资料外，部分原型标签x728、React x729，仍记录1px差异；标题/外框也有1px纵向差异，供人工复核，不修改为假零差。完整表见 `visual/anchor-comparison.json`。

## 原型未定义 / 尚待人工确认

以下没有自行新增业务行为，也不因自动化通过而视作完成：

1. 页脚的本机演示角色工具及“偏好仅保存”说明不在原型内。为保留既有角色/权限回归而继续可见；位置、正式产品中是否保留需确认，未在截图中隐藏它来提高相似度。
2. 演示角色仍即时生效，不随四页签取消回滚。是否将其纳入保存/取消事务，是原型未定义的产品决定。
3. 主题、紧凑侧栏、默认布局、检索默认值及通知渠道目前保存和恢复；全站应用、真实向量/热度服务与通知投递不在本轮开发范围，未擅自接入或生成成功反馈。
4. 现有空姓名阻止保存、空部门回填“未分配”的规则，未由原型明确规定；本轮沿用实现，不新增长度限制或确认弹窗，需产品确认。
5. 原生PingFangSC资源缺失。统一Noto Sans CJK SC用于结构对照，不宣称字形/字重逐像素通过。深色和移动端完整原型、其他浏览器的视觉基线仍需明确；本轮只验证当前Chromium和窄视口可操作性。

## 命令、产物及复现

```bash
npm run typecheck
npm run build:dev
IKB_CHROMIUM_PATH=/usr/bin/chromium IKB_PR11_OUTPUT=work/pr12-core node scripts/modao-pr11-regression.mjs
IKB_CHROMIUM_PATH=/usr/bin/chromium IKB_V16_OUTPUT=work/pr12-v16 node scripts/modao-v16-regression.mjs
IKB_CHROMIUM_PATH=/usr/bin/chromium IKB_V16_VISUAL_OUTPUT=work/pr12-visual node scripts/modao-v16-visual-capture.mjs
```

沿用 `npm run dev` 的本地服务即可。没有重跑与本轮无关的整套 `npm test`，不声称此前模板/品牌测试失败已被解决。

下载同目录 `pr12-v16-regression-evidence.zip` 并校验 `.sha256`。解压后使用本地静态服务打开index.html（云Chromium禁止file://）。包内包含修复前后171张截图、trace、原始日志、SSR时序诊断、四页签对照、原型SVG、命令退出码、来源及文件SHA256。图库已实际验证44个段落、4组对照加载、诊断证据展开且无JavaScript异常；全部PNG有效性、图库本地路径和manifest哈希均已校验。未修改main，未合并PR，未开发V15。
