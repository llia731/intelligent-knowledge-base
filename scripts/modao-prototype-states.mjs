#!/usr/bin/env node
/** Probe real offline prototype hotspots; preserve editor and 1:1 rendered state evidence. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
const url = process.env.IKB_MODAO_URL;
if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname))
  throw Error("IKB_MODAO_URL must be localhost");
const out = path.resolve(process.env.IKB_STATE_OUTPUT || "artifacts/modao-v1/prototype-states");
await fs.mkdir(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.IKB_CHROMIUM_PATH || "/usr/bin/chromium",
});
const results = [];
try {
  for (const [id, name] of [
    ["share", "知识管理"],
    ["profile", "首页"],
  ]) {
    const c = await b.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        locale: "zh-CN",
        timezoneId: "Asia/Tokyo",
      }),
      p = await c.newPage();
    p.setDefaultTimeout(10000);
    const r = { id, page: name, error: null, requests: [] };
    p.on("requestfailed", (q) => r.requests.push({ url: q.url(), error: q.failure()?.errorText }));
    try {
      await p.goto(url, { waitUntil: "networkidle" });
      await p.getByText("总览", { exact: true }).last().click();
      await p
        .locator(".rn-list-item.page")
        .filter({ has: p.locator(".editable-span").getByText(name, { exact: true }) })
        .click();
      await p
        .locator(".mb-design-page .preview-switch-btn")
        .filter({ hasText: /^演示$/ })
        .click();
      await p.waitForTimeout(300);
      if (id === "share") {
        const icons = await p.locator(".mb-preview-page .widget.wIcon").evaluateAll((es) =>
          es
            .filter((e) => e.querySelectorAll("circle").length === 3)
            .map((e) => ({ id: e.getAttribute("data-cid"), y: e.getBoundingClientRect().y }))
            .filter((e) => e.y > 0)
            .sort((a, b) => a.y - b.y),
        );
        if (!icons.length) throw Error("Share hotspot not found");
        r.hotspot = icons[0].id;
        await p.locator('.mb-preview-page [data-cid="' + r.hotspot + '"]').click();
        await p
          .locator(".mb-preview-page .rich-text")
          .filter({ hasText: /^分享文档$/ })
          .first()
          .waitFor();
      } else {
        await p
          .locator(".mb-preview-page .rich-text")
          .filter({ hasText: /^个人中心$/ })
          .first()
          .click();
      }
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(out, id + "-editor.png") });
      r.text = await p.locator(".mb-preview-page .zoom-area").innerText();
      await p.evaluate(() => {
        const area = document.querySelector(".mb-preview-page .zoom-area");
        const host = document.createElement("div");
        host.id = "audit-state-host";
        host.style.cssText =
          "position:fixed;inset:0;z-index:2147483647;width:1920px;height:1080px;overflow:hidden;background:white";
        const copy = area.cloneNode(true);
        copy.style.cssText =
          "position:relative;left:0;top:0;transform:none;width:1920px;height:1080px";
        host.append(copy);
        document.body.append(host);
      });
      await p.screenshot({ path: path.join(out, id + "-native.png") });
      await p.addStyleTag({
        content:
          '#audit-state-host *,#audit-state-host *::before,#audit-state-host *::after{font-family:"Noto Sans CJK SC",sans-serif!important;transition:none!important;animation:none!important}',
      });
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: path.join(out, id + ".png") });
      r.root = await p.locator("#audit-state-host").boundingBox();
    } catch (e) {
      r.error = String(e);
      process.exitCode = 1;
    }
    results.push(r);
    console.log(id + ": " + (r.error || "captured"));
    await c.close();
    await fs.writeFile(path.join(out, "states.json"), JSON.stringify(results, null, 2));
  }
  const app = process.env.IKB_VISUAL_BASE_URL || "http://127.0.0.1:8080";
  if (!["localhost", "127.0.0.1"].includes(new URL(app).hostname))
    throw Error("React URL must be localhost");
  for (const [id, route] of [
    ["share", "/library"],
    ["profile", "/"],
  ]) {
    const c = await b.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        locale: "zh-CN",
        timezoneId: "Asia/Tokyo",
      }),
      p = await c.newPage();
    const r = { id: "react-" + id, error: null };
    try {
      await p.goto(new URL(route, app).href, { waitUntil: "networkidle" });
      if (id === "share")
        await p.getByRole("button", { name: "分享", exact: true }).first().click();
      else await p.locator("#modao-personal-center").click();
      await p.screenshot({ path: path.join(out, "react-" + id + "-native.png") });
      await p.addStyleTag({
        content:
          '*,*::before,*::after{font-family:"Noto Sans CJK SC",sans-serif!important;animation:none!important;transition:none!important}',
      });
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: path.join(out, "react-" + id + ".png") });
      r.text = await p.locator("body").innerText();
      r.dialog = await p.locator(id === "share" ? ".modal" : ".drawer").boundingBox();
    } catch (e) {
      r.error = String(e);
      process.exitCode = 1;
    }
    results.push(r);
    await c.close();
    await fs.writeFile(path.join(out, "states.json"), JSON.stringify(results, null, 2));
  }
} finally {
  await b.close();
}
