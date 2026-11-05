#!/usr/bin/env node
/** V15: real localhost UI, native and shared-font screenshots. No synthetic share service. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
const base = process.env.IKB_VISUAL_BASE_URL || "http://127.0.0.1:8080";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw Error("localhost only");
const out = path.resolve(process.env.IKB_V15_VISUAL_OUTPUT || "artifacts/modao-v1/pr14-visual");
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
async function capture(id) {
  await p.screenshot({ path: path.join(out, id + "-native.png"), caret: "initial" });
  const style = await p.addStyleTag({
    content:
      '*,*::before,*::after{font-family:"Noto Sans CJK SC",sans-serif!important;animation:none!important;transition:none!important}',
  });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(out, id + ".png"), caret: "initial" });
  const meta = await p.locator(".sd-dialog").evaluate((el) => ({
    bounds: el.getBoundingClientRect().toJSON(),
    text: el.innerText,
    elements: [
      ...el.querySelectorAll(
        ".sd-header,.sd-enable,.sd-range,.sd-scopes,.sd-scope,.sd-department,.sd-cols,.sd-field,.sd-input,.sd-input-wrap,.sd-link-input,.sd-channel-buttons,.sd-summary,.sd-footer,.sd-service-notice,legend,input,select,textarea,button,small",
      ),
    ].map((e) => ({
      tag: e.tagName,
      cls: e.className,
      label: e.getAttribute("aria-label"),
      text: e.innerText,
      rect: e.getBoundingClientRect().toJSON(),
      fontSize: getComputedStyle(e).fontSize,
      lineHeight: getComputedStyle(e).lineHeight,
      color: getComputedStyle(e).color,
      background: getComputedStyle(e).backgroundColor,
      border: getComputedStyle(e).border,
      borderRadius: getComputedStyle(e).borderRadius,
      disabled: e.disabled ?? null,
      value: e.type === "password" ? "[redacted]" : (e.value ?? null),
    })),
  }));
  await fs.writeFile(path.join(out, id + "-geometry.json"), JSON.stringify(meta, null, 2));
  report.results.push({ id, bounds: meta.bounds });
  await style.evaluate((e) => e.remove());
  console.log("CAPTURED " + id);
}
try {
  await p.goto(new URL("/library", base).href, { waitUntil: "networkidle" });
  await p
    .locator("table tbody tr")
    .first()
    .getByRole("button", { name: "分享", exact: true })
    .click();
  await p.getByRole("dialog", { name: "分享文档", exact: true }).waitFor();
  await capture("empty-draft");
  // Match only the visible summary draft from the prototype; do not save, create a URL or enable sharing.
  await p
    .getByLabel("推荐摘要", { exact: true })
    .fill(
      "推荐一份 RAG 实践指南，涵盖了文档解析、向量化、检索排序与提示工程等关键环节，适合团队快速上手。",
    );
  await p.locator(".sd-header").click(); // Match the prototype unfocused textarea state by a real mouse click.
  await capture("source-summary-draft");
  await p.getByLabel("有效期", { exact: true }).click();
  await capture("expiry-menu");
  await p.keyboard.press("Escape");
} finally {
  await fs.writeFile(path.join(out, "capture-report.json"), JSON.stringify(report, null, 2));
  await c.close();
  await b.close();
}
if (report.pageErrors.length) process.exitCode = 1;
