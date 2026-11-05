#!/usr/bin/env node
/** UI-only interaction audit against localhost. Separate fresh browser state per case. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const base = process.env.IKB_VISUAL_BASE_URL || "http://127.0.0.1:8080";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw Error("localhost only");
const out = path.resolve(process.env.IKB_V15_OUTPUT || "artifacts/modao-v1/pr14-v15");
await fs.mkdir(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.IKB_CHROMIUM_PATH || "/usr/bin/chromium",
});
const results = [];
async function run(id, fn) {
  const c = await b.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    locale: "zh-CN",
    timezoneId: "Asia/Tokyo",
  });
  await c.tracing.start({ screenshots: true, snapshots: true });
  const p = await c.newPage();
  p.setDefaultTimeout(5000);
  p.setDefaultNavigationTimeout(30000);
  const r = {
    id,
    steps: [],
    observations: {},
    pageErrors: [],
    consoleErrors: [],
    failedRequests: [],
    error: null,
  };
  p.on("pageerror", (e) => r.pageErrors.push(String(e)));
  p.on("console", (m) => {
    if (m.type() === "error") r.consoleErrors.push(m.text());
  });
  p.on("requestfailed", (q) =>
    r.failedRequests.push({ url: q.url(), error: q.failure()?.errorText }),
  );
  const shot = async (name) => {
    await p.screenshot({ path: path.join(out, `${id}-${name}.png`) });
    const style = await p.addStyleTag({
      content:
        '*,*::before,*::after{font-family:"Noto Sans CJK SC",sans-serif!important;animation:none!important;transition:none!important}',
    });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(out, `${id}-${name}-normalized.png`) });
    await style.evaluate((e) => e.remove());
  };
  const go = async (url) => p.goto(new URL(url, base).href, { waitUntil: "networkidle" });
  const state = () => p.evaluate(() => JSON.parse(localStorage.getItem("zhishi-kb-v1"))?.state);
  try {
    await fn({ p, r, shot, go, state, c });
    assert.deepEqual(r.pageErrors, [], "No browser runtime exceptions");
    r.status = "pass";
  } catch (e) {
    r.status = "fail";
    r.error = String(e);
    await shot("failure").catch(() => {});
    process.exitCode = 1;
  } finally {
    await c.tracing.stop({ path: path.join(out, id + "-trace.zip") });
    await c.close();
    results.push(r);
    await fs.writeFile(path.join(out, "results.json"), JSON.stringify(results, null, 2));
    console.log(r.status + " " + id + " " + (r.error || ""));
  }
}
const docRows = (p) =>
  p.locator("table tbody tr").filter({ has: p.getByRole("button", { name: "分享", exact: true }) });
const open = async (p, index = 0) => {
  const row = docRows(p).nth(index);
  const title = await row.locator("td").nth(1).innerText();
  await row.getByRole("button", { name: "分享", exact: true }).click();
  await p.getByRole("dialog", { name: "分享文档", exact: true }).waitFor();
  return title;
};
const noLeaks = async (p, secret) =>
  p.evaluate(
    (value) => ({
      local: Object.keys(localStorage).filter((k) => localStorage.getItem(k).includes(value)),
      session: Object.keys(sessionStorage).filter((k) => sessionStorage.getItem(k).includes(value)),
      audit: JSON.stringify(
        JSON.parse(localStorage.getItem("zhishi-kb-v1"))?.state?.logs ?? [],
      ).includes(value),
    }),
    secret,
  );
const emptyLeak = { local: [], session: [], audit: false };
const close = async (p, name = "取消") => {
  await p.getByRole("button", { name, exact: true }).click();
  await p.getByRole("dialog").waitFor({ state: "hidden" });
};
const saveSummary = async (p) =>
  p.getByRole("button", { name: "保存推荐摘要", exact: true }).click();
try {
  await run("layout-fields", async ({ p, r, shot, go }) => {
    await go("/library");
    await open(p);
    await shot("default");
    r.observations.bounds = await p.getByRole("dialog").boundingBox();
    const a = r.observations.bounds;
    assert.equal(a.width, 672);
    assert.equal(a.height, 820);
    assert.equal(a.x, 752);
    assert.equal(a.y, 130);
    for (const n of ["开启链接分享", "指定部门", "访问密码", "有效期", "分享链接", "推荐摘要"])
      assert.equal(await p.getByLabel(n, { exact: true }).count(), 1, n + " accessible");
    assert.equal(
      await p.getByRole("switch", { name: "开启链接分享", exact: true }).isChecked(),
      false,
    );
    assert.equal(await p.getByRole("radio", { name: /全员/ }).isChecked(), true);
    assert.equal(await p.getByLabel("有效期", { exact: true }).inputValue(), "7");
    assert.equal(await p.getByLabel("分享链接", { exact: true }).inputValue(), "");
    for (const text of ["组织内所有人", "选择可见部门", "仅文档所有者"])
      await p.getByText(text, { exact: true }).waitFor();
    r.observations.overflow = await p
      .getByRole("dialog")
      .evaluate((e) => ({ x: e.scrollWidth > e.clientWidth, y: e.scrollHeight > e.clientHeight }));
  });
  await run("scope-department", async ({ p, r, shot, go, state }) => {
    await go("/library");
    await open(p);
    assert.equal(await p.getByLabel("指定部门", { exact: true }).isEnabled(), false);
    await p.getByRole("radio", { name: /指定部门/ }).check();
    assert.equal(await p.getByLabel("指定部门", { exact: true }).isEnabled(), true);
    assert.deepEqual(
      await p.getByLabel("指定部门", { exact: true }).locator("option").allTextContents(),
      ["产品研发部"],
    );
    await p.getByLabel("指定部门", { exact: true }).selectOption("产品研发部");
    await p.getByRole("switch", { name: "开启链接分享", exact: true }).check();
    await shot("departments");
    await p.getByRole("radio", { name: /仅自己/ }).check();
    assert.equal(await p.getByLabel("指定部门", { exact: true }).isEnabled(), false);
    await close(p);
    await open(p);
    assert.equal(await p.getByRole("radio", { name: /全员/ }).isChecked(), true);
    assert.equal(
      await p.getByRole("switch", { name: "开启链接分享", exact: true }).isChecked(),
      false,
    );
    r.observations.persisted = (await state()) ?? null;
  });
  await run("expiry-values", async ({ p, r, shot, go }) => {
    await go("/library");
    await open(p);
    const select = p.getByLabel("有效期", { exact: true });
    assert.deepEqual(
      (await select.locator("option").allTextContents()).map((s) => s.replace(/\s/g, "")),
      ["7天", "30天", "90天", "永久有效"],
    );
    for (const value of ["7", "30", "90", "never"]) {
      await select.selectOption(value);
      assert.equal(await select.inputValue(), value);
    }
    await select.click();
    await shot("menu");
    await p.keyboard.press("Escape");
    r.observations.values = ["7", "30", "90", "never"];
  });
  await run("expiry-mouse", async ({ p, r, shot, go }) => {
    await go("/library");
    await open(p);
    await p.getByLabel("有效期", { exact: true }).click();
    await p.getByRole("option", { name: "30 天", exact: true }).click();
    assert.equal(await p.getByLabel("有效期", { exact: true }).inputValue(), "30");
    await shot("selected-30-days");
    r.observations.method = "Real mouse click opens picker and selects 30 天";
  });
  await run("summary-save", async ({ p, r, shot, go, state }) => {
    await go("/library");
    const title = await open(p);
    await p.getByLabel("推荐摘要", { exact: true }).fill("  V15合成推荐摘要已保存  ");
    await saveSummary(p);
    await p.getByRole("status").filter({ hasText: /本地/ }).waitFor();
    await shot("saved");
    const s = await state();
    assert.equal(s.docs.find((d) => d.title === title).shareNote, "V15合成推荐摘要已保存");
    r.observations.audit = s.logs[0];
    assert.equal(
      s.logs[0].action,
      "保存推荐摘要",
      "Local summary save must not be audited as real sharing",
    );
    assert.ok(s.logs[0].result.includes("未创建分享链接"));
    await p.reload({ waitUntil: "networkidle" });
    await open(p);
    assert.equal(
      await p.getByLabel("推荐摘要", { exact: true }).inputValue(),
      "V15合成推荐摘要已保存",
    );
    assert.equal(await p.getByLabel("分享链接", { exact: true }).inputValue(), "");
    await shot("restored");
  });
  await run("summary-dirty-status", async ({ p, r, shot, go }) => {
    await go("/library");
    await open(p);
    await p.getByLabel("推荐摘要", { exact: true }).fill("保存版本A");
    await saveSummary(p);
    await p
      .getByRole("status")
      .filter({ hasText: /已保存/ })
      .waitFor();
    await p.getByLabel("推荐摘要", { exact: true }).fill("未保存版本B");
    r.observations.status = await p.getByRole("status").innerText();
    await shot("dirty");
    assert.ok(
      !r.observations.status.includes("已保存"),
      "Edited draft must not retain saved-success status",
    );
  });
  for (const kind of ["cancel", "escape", "close", "backdrop"])
    await run("discard-" + kind, async ({ p, r, shot, go, state }) => {
      await go("/library");
      const title = await open(p);
      await p.getByLabel("推荐摘要", { exact: true }).fill("原已存摘要");
      await saveSummary(p);
      const before = await state();
      await p.getByLabel("推荐摘要", { exact: true }).fill("不应保存的草稿");
      const secret = "V15_" + kind + "_SyntheticPassword";
      await p.getByLabel("访问密码", { exact: true }).fill(secret);
      await shot("dirty");
      if (kind === "escape") await p.keyboard.press("Escape");
      else if (kind === "backdrop") await p.mouse.click(300, 100);
      else await close(p, kind === "close" ? "关闭分享" : "取消");
      await p.getByRole("dialog").waitFor({ state: "hidden" });
      const after = await state();
      assert.deepEqual(after.logs, before.logs);
      assert.equal(after.docs.find((d) => d.title === title).shareNote, "原已存摘要");
      assert.deepEqual(await noLeaks(p, secret), emptyLeak);
      await open(p);
      assert.equal(await p.getByLabel("访问密码", { exact: true }).inputValue(), "");
      assert.equal(await p.getByLabel("推荐摘要", { exact: true }).inputValue(), "原已存摘要");
      await shot("reopened");
    });
  await run("password-lifetime", async ({ p, r, shot, go, state }) => {
    await go("/library");
    await open(p);
    const secret = "V15_Private_Synthetic_" + Date.now();
    await p.getByLabel("访问密码", { exact: true }).fill(secret);
    assert.equal(await p.getByLabel("访问密码", { exact: true }).getAttribute("type"), "password");
    await p.getByLabel("推荐摘要", { exact: true }).fill("与密码无关的合成摘要");
    await saveSummary(p);
    r.observations.whileOpen = await noLeaks(p, secret);
    assert.deepEqual(r.observations.whileOpen, emptyLeak);
    await p.reload({ waitUntil: "networkidle" });
    assert.deepEqual(await noLeaks(p, secret), emptyLeak);
    await open(p);
    assert.equal(await p.getByLabel("访问密码", { exact: true }).inputValue(), "");
    await shot("after-refresh");
    r.observations.afterRefresh = await noLeaks(p, secret);
  });
  await run("no-share-service", async ({ p, r, shot, go }) => {
    const mutations = [];
    p.on("request", (q) => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(q.method()))
        mutations.push({ url: q.url(), method: q.method() });
    });
    await go("/library");
    await open(p);
    await p.getByRole("switch", { name: "开启链接分享", exact: true }).check();
    await p.getByRole("radio", { name: /仅自己/ }).check();
    await p.getByLabel("访问密码", { exact: true }).fill("V15_NoService_Synthetic");
    await p.getByLabel("有效期", { exact: true }).selectOption("90");
    assert.equal(await p.getByLabel("分享链接", { exact: true }).inputValue(), "");
    assert.equal(await p.getByRole("dialog").locator("a[href]").count(), 0);
    for (const name of ["复制链接", "企业微信", "钉钉", "飞书", "确认分享"])
      assert.equal(
        await p.getByRole("button", { name, exact: true }).isDisabled(),
        true,
        name + " must be disabled",
      );
    const text = await p.getByRole("status").innerText();
    assert.ok(text.includes("未接入"));
    assert.ok(!/复制成功|分享成功|已分享/.test(text));
    assert.deepEqual(mutations, []);
    r.observations.httpMutations = mutations;
    await shot("disabled");
  });
  await run("cross-document", async ({ p, r, shot, go, state }) => {
    await go("/library");
    const a = await open(p, 0);
    await p.getByLabel("推荐摘要", { exact: true }).fill("文档A独立摘要");
    await p.getByLabel("访问密码", { exact: true }).fill("V15_DocA_Private");
    await p.getByRole("radio", { name: /仅自己/ }).check();
    await p.getByLabel("有效期", { exact: true }).selectOption("90");
    await saveSummary(p);
    await close(p);
    const b = await open(p, 1);
    assert.notEqual(a, b);
    assert.equal(await p.getByLabel("推荐摘要", { exact: true }).inputValue(), "");
    assert.equal(await p.getByLabel("访问密码", { exact: true }).inputValue(), "");
    assert.equal(await p.getByLabel("有效期", { exact: true }).inputValue(), "7");
    assert.equal(await p.getByRole("radio", { name: /全员/ }).isChecked(), true);
    await p.getByLabel("推荐摘要", { exact: true }).fill("文档B独立摘要");
    await saveSummary(p);
    await shot("doc-b");
    await close(p);
    await open(p, 0);
    assert.equal(await p.getByLabel("推荐摘要", { exact: true }).inputValue(), "文档A独立摘要");
    const s = await state();
    assert.equal(s.docs.find((d) => d.title === a).shareNote, "文档A独立摘要");
    assert.equal(s.docs.find((d) => d.title === b).shareNote, "文档B独立摘要");
    assert.deepEqual(await noLeaks(p, "V15_DocA_Private"), emptyLeak);
  });
  await run("keyboard-focus", async ({ p, r, shot, go }) => {
    await go("/library");
    const trigger = docRows(p).first().getByRole("button", { name: "分享", exact: true });
    await open(p);
    const dialog = p.getByRole("dialog");
    r.observations.focus = [];
    for (let i = 0; i < 36; i++) {
      await p.keyboard.press("Tab");
      assert.equal(await dialog.evaluate((e) => e.contains(document.activeElement)), true);
      r.observations.focus.push(
        await p.evaluate(() => ({
          tag: document.activeElement.tagName,
          label: document.activeElement.getAttribute("aria-label"),
          text: document.activeElement.textContent?.slice(0, 24),
        })),
      );
    }
    for (let i = 0; i < 10; i++) {
      await p.keyboard.press("Shift+Tab");
      assert.equal(await dialog.evaluate((e) => e.contains(document.activeElement)), true);
    }
    await p.getByLabel("推荐摘要", { exact: true }).focus();
    await p.keyboard.press("Tab");
    assert.equal(
      await p
        .getByRole("button", { name: "保存推荐摘要", exact: true })
        .evaluate((e) => e === document.activeElement),
      true,
      "Footer Tab order follows left-to-right visual order",
    );
    await p.keyboard.press("Tab");
    assert.equal(
      await p
        .getByRole("button", { name: "取消", exact: true })
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await p.getByRole("radio", { name: /全员/ }).focus();
    await p.keyboard.press("ArrowRight");
    assert.equal(await p.getByRole("radio", { name: /指定部门/ }).isChecked(), true);
    await shot("focus");
    await p.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(
      await trigger.evaluate((e) => e === document.activeElement),
      true,
      "Restore actual share trigger focus",
    );
  });
  await run("navigate-reset", async ({ p, r, shot, go }) => {
    await go("/library");
    await open(p);
    await p.getByLabel("访问密码", { exact: true }).fill("V15_Navigation_Private");
    await p.getByLabel("推荐摘要", { exact: true }).fill("路由离开未保存摘要");
    await go("/");
    await go("/library");
    await open(p);
    assert.equal(await p.getByLabel("访问密码", { exact: true }).inputValue(), "");
    assert.equal(await p.getByLabel("推荐摘要", { exact: true }).inputValue(), "");
    assert.deepEqual(await noLeaks(p, "V15_Navigation_Private"), emptyLeak);
    await shot("returned");
  });
  await run("viewport-fit", async ({ p, r, shot, go }) => {
    r.observations.bounds = [];
    for (const [width, height] of [
      [1280, 900],
      [800, 600],
      [375, 812],
    ]) {
      await p.setViewportSize({ width, height });
      await go("/library");
      await open(p);
      const a = await p.getByRole("dialog").boundingBox();
      r.observations.bounds.push({ viewport: { width, height }, dialog: a });
      await shot(String(width));
      assert.ok(
        a.x >= 10 && a.y >= 10 && a.x + a.width <= width - 10 && a.y + a.height <= height - 10,
      );
      assert.equal(
        await p.getByRole("dialog").evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        true,
      );
      await close(p);
    }
  });
  await run("library-view-edit", async ({ p, r, shot, go, state }) => {
    await go("/library");
    const row = docRows(p).first();
    const title = await row.locator("td").nth(1).innerText();
    await row.getByRole("button", { name: "查看", exact: true }).click();
    await p.getByRole("heading", { name: title, exact: true }).waitFor();
    await shot("view");
    await p.getByRole("button", { name: "关闭", exact: true }).click();
    await row.getByRole("button", { name: "编辑", exact: true }).click();
    await p.getByLabel("标题", { exact: true }).fill("V15回归编辑后的文档");
    await p.getByRole("button", { name: "保存", exact: true }).click();
    await p.getByRole("cell", { name: "V15回归编辑后的文档", exact: true }).waitFor();
    await p.reload({ waitUntil: "networkidle" });
    assert.ok((await state()).docs.some((d) => d.title === "V15回归编辑后的文档"));
    await open(p);
    await shot("share-after-edit");
    assert.equal(await p.getByRole("heading", { name: "分享文档", exact: true }).count(), 1);
  });
  await run("library-delete-restore", async ({ p, r, shot, go, state }) => {
    await go("/library");
    const row = docRows(p).first();
    const title = await row.locator("td").nth(1).innerText();
    await row.getByRole("button", { name: "删除", exact: true }).click();
    await p.getByRole("button", { name: "回收站", exact: true }).click();
    const trashed = p
      .getByRole("row")
      .filter({ has: p.getByRole("cell", { name: title, exact: true }) });
    await trashed.waitFor();
    await trashed.getByRole("checkbox").check();
    await p.getByRole("button", { name: "恢复", exact: true }).click();
    await p.getByRole("button", { name: "返回文档", exact: true }).click();
    await p.getByRole("cell", { name: title, exact: true }).waitFor();
    await shot("restored");
  });
  await run("library-new-collection", async ({ p, r, shot, go, state }) => {
    await go("/library");
    await p.getByRole("button", { name: "新建知识库", exact: true }).click();
    await p.getByPlaceholder("知识库名称", { exact: true }).fill("V15回归合成知识库");
    await p.getByRole("button", { name: "创建", exact: true }).click();
    await p.reload({ waitUntil: "networkidle" });
    assert.ok((await state()).collections.includes("V15回归合成知识库"));
    await shot("created");
  });
} finally {
  await b.close();
}
