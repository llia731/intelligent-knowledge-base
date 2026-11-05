#!/usr/bin/env node
/** Reuse the preceding audit's real Modao hotspot/DOM capture method for component planning. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
const url =
  process.env.IKB_MODAO_URL || "http://127.0.0.1:8081/pm2mv9dlt722tkxks-mvak915c/index.html";
if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw Error("localhost only");
const out = path.resolve(process.env.IKB_PLAN_OUTPUT || "artifacts/modao-v1/pr11-plan");
await fs.mkdir(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.IKB_CHROMIUM_PATH || "/usr/bin/chromium",
});
const results = [];
async function capture(p, id) {
  await p.screenshot({ path: path.join(out, id + "-editor.png") });
  await p.evaluate(() => {
    const area = document.querySelector(".mb-preview-page .zoom-area");
    const host = document.createElement("div");
    host.id = "audit-plan-host";
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;width:1920px;height:1080px;overflow:hidden;background:white";
    const copy = area.cloneNode(true);
    copy.style.cssText = "position:relative;left:0;top:0;transform:none;width:1920px;height:1080px";
    host.append(copy);
    document.body.append(host);
  });
  await p.screenshot({ path: path.join(out, id + "-native.png") });
  const meta = await p.locator("#audit-plan-host").evaluate((el) => ({
    text: el.innerText,
    items: [
      ...el.querySelectorAll(".widget,.rich-text,input,select,textarea,.wBasket,.wTab,[role=tab]"),
    ]
      .filter((e) => e.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }))
      .map((e) => ({
        tag: e.tagName,
        cls: String(e.className),
        cid: e.getAttribute("data-cid"),
        text: (e.innerText || e.getAttribute("placeholder") || "").slice(0, 350),
        rect: e.getBoundingClientRect().toJSON(),
        fontSize: getComputedStyle(e).fontSize,
        borderRadius: getComputedStyle(e).borderRadius,
        borderColor: getComputedStyle(e).borderColor,
        lineHeight: getComputedStyle(e).lineHeight,
        fontWeight: getComputedStyle(e).fontWeight,
        color: getComputedStyle(e).color,
        background: getComputedStyle(e).backgroundColor,
        parent: e.parentElement?.getAttribute("style"),
      })),
  }));
  await p.addStyleTag({
    content:
      '#audit-plan-host *,#audit-plan-host *::before,#audit-plan-host *::after{font-family:"Noto Sans CJK SC",sans-serif!important;animation:none!important;transition:none!important}',
  });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(out, id + ".png") });
  await fs.writeFile(path.join(out, id + "-geometry.json"), JSON.stringify(meta, null, 2));
  await p.locator("#audit-plan-host").evaluate((e) => e.remove());
  results.push({
    id,
    files: [id + ".png", id + "-native.png", id + "-editor.png", id + "-geometry.json"],
  });
  await fs.writeFile(path.join(out, "states.json"), JSON.stringify(results, null, 2));
  console.log("CAPTURED " + id);
}
try {
  for (const name of ["知识管理", "首页"]) {
    const c = await b.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        locale: "zh-CN",
        timezoneId: "Asia/Tokyo",
      }),
      p = await c.newPage();
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
      if (name === "知识管理") {
        const icons = await p.locator(".mb-preview-page .widget.wIcon").evaluateAll((es) =>
          es
            .filter((e) => e.querySelectorAll("circle").length === 3)
            .map((e) => ({ id: e.getAttribute("data-cid"), y: e.getBoundingClientRect().y }))
            .filter((e) => e.y > 0)
            .sort((a, b) => a.y - b.y),
        );
        if (!icons.length) throw Error("Share hotspot not found");
        await p.locator('.mb-preview-page [data-cid="' + icons[0].id + '"]').click();
        await p.waitForTimeout(300);
        await capture(p, "v15-share");
        await p
          .locator(".mb-preview-page")
          .getByText(/^\s*7 天\s*$/)
          .first()
          .click();
        await p.waitForTimeout(200);
        await capture(p, "v15-expiry-options");
      } else {
        await p
          .locator(".mb-preview-page .rich-text")
          .filter({ hasText: /^个人中心$/ })
          .first()
          .click();
        await p.waitForTimeout(300);
        await capture(p, "v16-profile");
        for (const [id, label] of [
          ["v16-appearance", "界面偏好"],
          ["v16-search", "检索偏好"],
          ["v16-notifications", "通知偏好"],
        ]) {
          const tab = p.locator(".mb-preview-page").getByText(label, { exact: true });
          const count = await tab.count();
          let clicked = false;
          for (let i = 0; i < count; i++) {
            try {
              await tab.nth(i).click({ timeout: 1500 });
              clicked = true;
              break;
            } catch {}
          }
          if (!clicked) throw Error("Prototype tab not clickable: " + label);
          await p.waitForTimeout(300);
          await capture(p, id);
          if (id === "v16-search") {
            const control = p
              .locator(".mb-preview-page")
              .getByText(/^\s*混合检索\s*$/)
              .first();
            await control.click();
            await p.waitForTimeout(250);
            await capture(p, "v16-search-mode-options");
            await p
              .locator(".mb-preview-page .rich-text")
              .filter({ hasText: /^默认排序$/ })
              .first()
              .click();
            await p
              .locator(".mb-preview-page")
              .getByText(/^\s*相关度\s*$/)
              .first()
              .click();
            await p.waitForTimeout(200);
            await capture(p, "v16-sort-options");
            await p
              .locator(".mb-preview-page .rich-text")
              .filter({ hasText: /^默认每页条数$/ })
              .first()
              .click();
            await p
              .locator(".mb-preview-page")
              .getByText(/^\s*10 条\s*$/)
              .first()
              .click();
            await p.waitForTimeout(200);
            await capture(p, "v16-page-size-options");
          }
        }
      }
    } finally {
      await c.close();
    }
  }
} finally {
  await b.close();
}
