#!/usr/bin/env node
/** V16 only: capture four tabs with controlled synthetic profile data. Reuses project Playwright. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
const base = process.env.IKB_VISUAL_BASE_URL || "http://127.0.0.1:8080";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw Error("localhost only");
const out = path.resolve(process.env.IKB_V16_VISUAL_OUTPUT || "artifacts/modao-v1/pr12-visual");
await fs.mkdir(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.IKB_CHROMIUM_PATH || "/usr/bin/chromium",
});
const c = await b.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  locale: "zh-CN",
  timezoneId: "Asia/Tokyo",
  reducedMotion: "reduce",
  colorScheme: "light",
});
const p = await c.newPage();
p.setDefaultNavigationTimeout(30000);
const report = {
  browser: b.version(),
  viewport: { width: 1920, height: 1080, dpr: 1 },
  fixture: { name: "系统管理员", dept: "平台产品部" },
  pageErrors: [],
  consoleErrors: [],
  failedRequests: [],
  results: [],
};
p.on("pageerror", (e) => report.pageErrors.push(String(e)));
p.on("console", (m) => {
  if (m.type() === "error") report.consoleErrors.push(m.text());
});
p.on("requestfailed", (q) =>
  report.failedRequests.push({ url: q.url(), error: q.failure()?.errorText }),
);
try {
  await p.goto(base, { waitUntil: "networkidle" });
  await p.locator("#modao-personal-center").click();
  await p.getByLabel("显示名称", { exact: true }).fill(report.fixture.name);
  await p.getByLabel("所属部门", { exact: true }).fill(report.fixture.dept);
  await p.getByRole("button", { name: "保存", exact: true }).click();
  await p.reload({ waitUntil: "networkidle" });
  await p.locator("#modao-personal-center").click();
  for (const [id, name] of [
    ["profile", "个人资料"],
    ["appearance", "界面偏好"],
    ["search", "检索偏好"],
    ["notifications", "通知偏好"],
  ]) {
    await p.getByRole("tab", { name, exact: true }).click();
    await p.screenshot({ path: path.join(out, id + "-native.png") });
    const style = await p.addStyleTag({
      content:
        '*,*::before,*::after{font-family:"Noto Sans CJK SC",sans-serif!important;animation:none!important;transition:none!important}',
    });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(out, id + ".png") });
    const geometry = await p
      .getByRole("dialog")
      .evaluate((e) => ({
        bounds: e.getBoundingClientRect().toJSON(),
        text: e.innerText,
        elements: [
          ...e.querySelectorAll(
            ".ps-title,.ps-subtitle,.ps-tabs,.ps-tab,.ps-section-title,.ps-label,.ps-input,.ps-avatars,.ps-avatar,.ps-choices,.ps-choice,.ps-toggle-row,.ps-checkbox-grid,.ps-frequency,.ps-check,.ps-footer,.ps-actions,.ps-primary,.ps-secondary,input,select",
          ),
        ].map((a) => ({
          tag: a.tagName,
          cls: a.className,
          text: a.innerText || a.getAttribute("aria-label") || "",
          rect: a.getBoundingClientRect().toJSON(),
          font: getComputedStyle(a).fontFamily,
          fontSize: getComputedStyle(a).fontSize,
          lineHeight: getComputedStyle(a).lineHeight,
          color: getComputedStyle(a).color,
          background: getComputedStyle(a).backgroundColor,
          checked: "checked" in a ? a.checked : null,
          value: "value" in a ? a.value : null,
        })),
      }));
    await fs.writeFile(path.join(out, id + "-geometry.json"), JSON.stringify(geometry, null, 2));
    report.results.push({ id, name, bounds: geometry.bounds });
    await style.evaluate((e) => e.remove());
    console.log("CAPTURED " + id);
  }
} finally {
  await fs.writeFile(path.join(out, "capture-report.json"), JSON.stringify(report, null, 2));
  await c.close();
  await b.close();
}
if (report.pageErrors.length) process.exitCode = 1;
