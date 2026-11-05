#!/usr/bin/env node
/** Read-only browser evidence. Never interprets Modao's private geometry encoding.
 * Requires existing localhost React and an unmodified extracted Modao ZIP server.
 * Usage: IKB_MODAO_URL=http://127.0.0.1:8081/<zip-root>/index.html node scripts/modao-visual-audit.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
const routes = [
  ["home", "/", "首页"],
  ["upload", "/upload", "知识上传"],
  ["search", "/search", "智能检索"],
  ["ask", "/ask", "AI问答"],
  ["library", "/library", "知识管理"],
  ["permissions", "/permissions", "权限设置"],
  ["audit", "/audit", "审计日志"],
  ["admin-home", "/admin", "总览仪表盘"],
  ["admin-users", "/admin/users", "用户管理"],
  ["admin-roles", "/admin/roles", "角色权限"],
  ["admin-config", "/admin/config", "知识库配置"],
  ["admin-review", "/admin/review", "内容审核"],
  ["admin-logs", "/admin/logs", "系统日志"],
  ["admin-keys", "/admin/keys", "API密钥"],
];
const out = path.resolve(process.env.IKB_AUDIT_OUTPUT || "artifacts/modao-v1/audit");
const app = process.env.IKB_VISUAL_BASE_URL || "http://127.0.0.1:8080";
const proto = process.env.IKB_MODAO_URL;
for (const url of [app, proto])
  if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
    throw Error("Both URLs must be localhost");
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.IKB_CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
});
const config = {
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  locale: "zh-CN",
  timezoneId: "Asia/Tokyo",
  reducedMotion: "reduce",
  colorScheme: "light",
};
const report = {
  browser: browser.version(),
  config,
  font: "Noto Sans CJK SC",
  normalization:
    "Only review overlay, viewport scale, font and animation; no source layout/content edits",
  results: [],
};
const fontCSS =
  '*,*::before,*::after{font-family:"Noto Sans CJK SC",sans-serif !important;animation:none!important;transition:none!important;caret-color:transparent!important}';
async function geometry(page, root) {
  return page.locator(root).evaluate((el) => ({
    bounds: el.getBoundingClientRect().toJSON(),
    text: el.innerText,
    elements: [
      ...el.querySelectorAll(
        "h1,h2,h3,.rich-text,.card,.modao-metric,.modao-panel,.sidebar,.topbar,main,table,input,select,textarea,button",
      ),
    ].map((e) => {
      const s = getComputedStyle(e);
      return {
        tag: e.tagName,
        cls: String(e.className),
        text: (e.innerText || e.getAttribute("aria-label") || "").slice(0, 180),
        rect: e.getBoundingClientRect().toJSON(),
        font: s.fontFamily,
        fontSize: s.fontSize,
        color: s.color,
        background: s.backgroundColor,
        borderRadius: s.borderRadius,
      };
    }),
  }));
}
try {
  for (const [id, route, name] of routes) {
    for (const kind of ["react", "prototype"]) {
      const dir = path.join(out, kind);
      await fs.mkdir(dir, { recursive: true });
      const context = await browser.newContext(config),
        p = await context.newPage();
      const events = { pageErrors: [], consoleErrors: [], failedRequests: [], httpErrors: [] };
      p.on("pageerror", (e) => events.pageErrors.push(String(e)));
      p.on("console", (m) => {
        if (m.type() === "error") events.consoleErrors.push(m.text());
      });
      p.on("requestfailed", (r) =>
        events.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }),
      );
      p.on("response", (r) => {
        if (r.status() >= 400) events.httpErrors.push({ url: r.url(), status: r.status() });
      });
      const result = { id, kind, name, route, events, error: null };
      try {
        const response = await p.goto(kind === "react" ? new URL(route, app).href : proto, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        result.status = response.status();
        if (kind === "prototype") {
          await p.getByText("总览", { exact: true }).last().click();
          const item = p
            .locator(".rn-list-item.page")
            .filter({ has: p.locator(".editable-span").getByText(name, { exact: true }) });
          await item.click();
          await p.waitForTimeout(450);
          await p.screenshot({ path: path.join(dir, id + "-editor.png") });
          result.pageRecordId = await item.getAttribute("data-cid");
          result.source = await p
            .locator(".zoom-area")
            .first()
            .locator("#canvas > .group-list > .rResCanvas")
            .first()
            .evaluate((el) => ({
              canvasId: el.getAttribute("data-cid"),
              width: el.clientWidth,
              height: el.clientHeight,
              html: el.outerHTML.slice(0, 600),
            }));
          if (result.source.width !== 1920 || result.source.height !== 1080)
            throw Error("Unexpected artboard dimensions");
          // Clone actual runtime-rendered canvas with its CSS/SVGs. No scene reconstruction.
          await p.evaluate(() => {
            const canvas = document.querySelector(".zoom-area #canvas");
            const host = document.createElement("div");
            host.id = "audit-host";
            host.style.cssText =
              "position:fixed;inset:0;width:1920px;height:1080px;z-index:2147483647;overflow:hidden;background:white";
            const copy = canvas.cloneNode(true);
            copy.id = "audit-source-canvas";
            copy.style.cssText = "position:relative;width:1920px;height:1080px;transform:none";
            host.append(copy);
            document.body.append(host);
          });
          await p.addStyleTag({
            content:
              '#audit-host [class*="InteractionMarker"],#audit-host .canvas-title{display:none!important}',
          });
        } else {
          await p.locator("h1").first().waitFor();
          result.heading = await p.locator("h1").first().innerText();
          if (!result.heading.replace(/\s/g, "").includes(name.replace(/\s/g, "")))
            throw Error("Unexpected heading " + result.heading);
          result.overflow = await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          );
        }
        await p.evaluate(() => document.fonts.ready);
        await p.screenshot({ path: path.join(dir, id + "-native.png") });
        await p.addStyleTag({ content: fontCSS });
        await p.evaluate(() => document.fonts.ready);
        await p.screenshot({ path: path.join(dir, id + ".png") });
        const dom = await geometry(p, kind === "prototype" ? "#audit-host" : "body");
        await fs.writeFile(path.join(dir, id + "-geometry.json"), JSON.stringify(dom, null, 2));
        result.font = await p
          .locator(kind === "prototype" ? "#audit-host .rich-text" : "h1")
          .first()
          .evaluate((e) => getComputedStyle(e).fontFamily);
        result.files = [
          `${kind}/${id}.png`,
          `${kind}/${id}-native.png`,
          `${kind}/${id}-geometry.json`,
        ];
      } catch (e) {
        result.error = String(e);
        process.exitCode = 1;
      }
      report.results.push(result);
      await fs.writeFile(path.join(out, "capture-report.json"), JSON.stringify(report, null, 2));
      console.log(`${result.error ? "FAIL" : "CAPTURED"} ${kind}/${id} ${result.error || ""}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
