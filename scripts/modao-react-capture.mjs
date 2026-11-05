#!/usr/bin/env node
/** Capture all 14 named routes from an already running localhost React app.
 *  Requires the project's playwright dependency. No auth bypass.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const routes = [
  ["home", "/", "首页"], ["upload", "/upload", "知识上传"],
  ["search", "/search", "智能检索"], ["ask", "/ask", "AI问答"],
  ["library", "/library", "知识管理"], ["permissions", "/permissions", "权限设置"],
  ["audit", "/audit", "审计日志"], ["admin-home", "/admin", "总览仪表盘"],
  ["admin-users", "/admin/users", "用户管理"],
  ["admin-roles", "/admin/roles", "角色权限"],
  ["admin-config", "/admin/config", "知识库配置"],
  ["admin-review", "/admin/review", "内容审核"],
  ["admin-logs", "/admin/logs", "系统日志"],
  ["admin-keys", "/admin/keys", "API密钥"],
];
const base = new URL(process.env.IKB_VISUAL_BASE_URL || "http://127.0.0.1:8080");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
  throw new Error("Capture only permitted against localhost");
}
const output = path.resolve(process.env.IKB_VISUAL_OUTPUT || "./artifacts/modao-v1/react");
await fs.mkdir(output, { recursive: true });
const launch = { headless: true };
if (process.env.IKB_CHROMIUM_PATH) launch.executablePath = process.env.IKB_CHROMIUM_PATH;
const browser = await chromium.launch(launch);
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1, reducedMotion: "reduce", locale: "zh-CN",
  colorScheme: "light",
});
const results = [];
try {
  for (const [id, route, expected] of routes) {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", err => errors.push("pageerror: " + err.message));
    page.on("console", msg => {
      if (msg.type() === "error") errors.push("console: " + msg.text());
    });
    let status = null, actualUrl = null, heading = null, error = null;
    try {
      const response = await page.goto(new URL(route, base).href, {
        waitUntil: "domcontentloaded", timeout: 25000,
      });
      status = response?.status() ?? null;
      await page.locator("body").waitFor({ timeout: 10000 });
      await page.waitForTimeout(800);
      actualUrl = page.url();
      heading = await page.locator("h1").first().textContent().catch(() => null);
      await page.screenshot({ path: path.join(output, id + ".png"), fullPage: true });
      if (new URL(actualUrl).pathname !== route) error = "route redirected or changed";
      else if (status !== 200) error = "HTTP " + status;
      else if (!heading) error = "missing h1 (possibly authentication gate)";
      else if (!heading.replace(/\s/g, "").includes(expected.replace(/\s/g, ""))) {
        error = "unexpected heading: " + heading;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    results.push({ id, route, expected, status, actualUrl, heading, error, consoleErrors: errors });
    console.log((error ? "FAIL " : "CAPTURED ") + id + ": " + (error || heading));
    await page.close();
  }
} finally {
  await context.close();
  await browser.close();
}
await fs.writeFile(path.join(output, "capture-results.json"),
  JSON.stringify({ viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 }, results }, null, 2) + "\n");
const failures = results.filter(item => item.error).length;
console.log("Captured " + results.length + " pages; failures: " + failures);
if (failures) process.exitCode = 1;
