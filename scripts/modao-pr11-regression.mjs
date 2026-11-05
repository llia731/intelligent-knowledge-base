#!/usr/bin/env node
/** UI-only interaction audit against localhost. Separate fresh browser state per case. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const base = process.env.IKB_VISUAL_BASE_URL || "http://127.0.0.1:8080";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw Error("localhost only");
const out = path.resolve(process.env.IKB_PR11_OUTPUT || "artifacts/modao-v1/pr11-regression");
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
  p.setDefaultTimeout(7000);
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
  const shot = async (name) =>
    p.screenshot({ path: path.join(out, `${id}-${name}.png`), caret: "initial" });
  const go = async (url) => p.goto(new URL(url, base).href, { waitUntil: "networkidle" });
  const state = () => p.evaluate(() => JSON.parse(localStorage.getItem("zhishi-kb-v1"))?.state);
  try {
    await fn({ p, r, shot, go, state });
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
try {
  await run("profile", async ({ p, r, shot, go }) => {
    await go("/");
    await p.getByRole("button", { name: "个人中心", exact: true }).click();
    await p.getByLabel("显示名称", { exact: true }).fill("验收用户");
    await p.getByLabel("所属部门", { exact: true }).fill("验收组");
    await shot("drawer");
    await p.getByRole("button", { name: "保存", exact: true }).click();
    await p.reload({ waitUntil: "networkidle" });
    await p.getByRole("button", { name: "个人中心", exact: true }).click();
    assert.equal(await p.getByLabel("显示名称", { exact: true }).inputValue(), "验收用户");
    assert.equal(await p.getByLabel("所属部门", { exact: true }).inputValue(), "验收组");
    r.steps.push("个人中心打开", "保存显示名称与部门", "刷新后保留");
    r.observations.mouseSaveAndReload = true;
    await shot("persisted");
  });
  for (const pass of [true, false])
    await run(pass ? "review-approve" : "review-reject", async ({ p, r, shot, go, state }) => {
      await go("/admin/review");
      await go("/upload");
      const title = "验收审核" + (pass ? "通过" : "拒绝");
      await p.getByPlaceholder("文档标题").fill(title);
      await p
        .locator("textarea")
        .fill("此处为独立验收合成资料，包含机密字样，必须经过人工审核后才能写入知识检索索引。");
      await p.getByRole("button", { name: "开始入库", exact: true }).click();
      await p.getByText(new RegExp("《" + title + "》已进入人工复核")).waitFor();
      await go("/admin/review");
      const item = { title };
      const article = p
        .locator("article")
        .filter({ has: p.getByRole("heading", { name: item.title, exact: true }) });
      await article.getByRole("button", { name: "查看原文", exact: true }).click();
      await shot("before");
      await article.getByRole("button", { name: pass ? "通过" : "拒绝", exact: true }).click();
      await p.getByRole("button", { name: new RegExp("^" + (pass ? "已通过" : "已拒绝")) }).click();
      await p.getByRole("heading", { name: item.title, exact: true }).waitFor();
      await shot("after");
      r.observations.badgeText = await article.innerText();
      assert.equal(await article.getByText("待处理", { exact: true }).count(), 0);
      assert.equal(await article.locator(".tag").innerText(), pass ? "已通过" : "已拒绝");
      const n = await state();
      assert.equal(
        n.reviews.find((x) => x.title === item.title).status,
        pass ? "passed" : "rejected",
      );
      const doc = n.docs.find((x) => x.id === n.reviews.find((x) => x.title === item.title).docId);
      assert.equal(doc.status, pass ? "indexed" : "rejected");
      if (pass) assert.ok(doc.chunks.length > 0);
      else assert.equal(doc.chunks.length, 0);
      await p.reload({ waitUntil: "networkidle" });
      assert.equal(
        (await state()).reviews.find((x) => x.title === item.title).status,
        pass ? "passed" : "rejected",
      );
      r.steps.push(
        "查看原文",
        pass ? "审核通过并建立切片" : "审核拒绝并清空切片",
        "刷新后状态保留",
      );
      await p.getByRole("button", { name: new RegExp("^" + (pass ? "已通过" : "已拒绝")) }).click();
      await article.locator("h3").waitFor();
      assert.equal(await article.getByText("待处理", { exact: true }).count(), 0);
      r.observations.persisted = true;
    });
  await run("dashboard-zero", async ({ p, r, shot, go, state }) => {
    await go("/admin/review");
    await p.getByRole("button", { name: "通过", exact: true }).click();
    assert.equal((await state()).reviews.filter((x) => x.status === "open").length, 0);
    await go("/admin");
    const stat = p.locator("article").filter({ has: p.getByText("待审核内容", { exact: true }) });
    r.observations.initialRenderValue = await stat.locator(".v").innerText();
    // Full navigations initially render server seed data. Await the client value,
    // rather than freezing a pre-hydration observation before taking the screenshot.
    await stat.locator(".v").filter({ hasText: /^0$/ }).waitFor();
    r.observations.actual = await stat.locator(".v").innerText();
    await shot("zero-pending");
    assert.equal(r.observations.actual, "0", "No pending reviews should display zero");
    await p.reload({ waitUntil: "networkidle" });
    await stat.locator(".v").filter({ hasText: /^0$/ }).waitFor();
    assert.equal(await stat.locator(".v").innerText(), "0");
    assert.equal((await state()).reviews.filter((item) => item.status === "open").length, 0);
    await shot("zero-after-reload");
    r.steps.push("审核清零后显示0", "刷新后仍为0");
  });
  for (const legacy of [false, true])
    await run(legacy ? "keys-legacy" : "keys-new", async ({ p, r, shot, go, state }) => {
      await go("/admin/keys");
      await p.getByRole("button", { name: "创建密钥", exact: true }).click();
      const name = legacy ? "PR11旧版本迁移演示密钥" : "PR11新建演示密钥";
      await p.getByLabel("名称", { exact: true }).fill(name);
      await p.getByRole("button", { name: "创建", exact: true }).click();
      const secret = await p.getByText(/^zsk_live_[A-Za-z0-9]+$/, { exact: true }).innerText();
      assert.ok(secret.startsWith("zsk_live_"));
      const leaks = () =>
        p.evaluate(
          (s) => ({
            local: Object.keys(localStorage).filter((k) => localStorage.getItem(k).includes(s)),
            session: Object.keys(sessionStorage).filter((k) =>
              sessionStorage.getItem(k).includes(s),
            ),
          }),
          secret,
        );
      r.observations.newStorageLeakKeys = await leaks();
      assert.deepEqual(await leaks(), { local: [], session: [] });
      assert.equal((await state()).freshSecret, "");
      await shot("created");
      if (legacy) {
        await p.evaluate((s) => {
          const saved = JSON.parse(localStorage.getItem("zhishi-kb-v1"));
          saved.state.freshSecret = s;
          localStorage.setItem("zhishi-kb-v1", JSON.stringify(saved));
        }, secret);
        assert.ok((await leaks()).local.includes("zhishi-kb-v1"));
        r.observations.legacyFixtureInjected = true;
      }
      await p.reload({ waitUntil: "networkidle" });
      await shot("direct-reload");
      r.observations.afterReloadLeakKeys = await leaks();
      r.observations.fullSecretVisibleAfterReload = (await p.locator("body").innerText()).includes(
        secret,
      );
      assert.equal(r.observations.fullSecretVisibleAfterReload, false);
      assert.deepEqual(
        await leaks(),
        { local: [], session: [] },
        "Full secret must not remain in browser storage after reload",
      );
      assert.equal((await state()).freshSecret, "");
      const row = p.getByRole("row").filter({ hasText: name });
      assert.equal(await row.count(), 1, "Metadata must survive secret cleanup");
      await row.getByRole("button", { name: "查看", exact: true }).click();
      await p.getByRole("heading", { name: "密钥预览", exact: true }).waitFor();
      assert.ok(!(await p.locator(".modal").innerText()).includes(secret));
      await shot("masked-preview");
      await p.getByRole("button", { name: "关闭", exact: true }).click();
      await row.getByRole("button", { name: "撤销", exact: true }).click();
      await p.reload({ waitUntil: "networkidle" });
      assert.equal(await p.getByRole("row").filter({ hasText: name }).count(), 0);
      r.steps.push(
        "创建时只在界面显示完整值",
        "未点击我已保存即直接刷新",
        "本地与会话存储均无完整值",
        "密钥元数据仍保留",
        "查看仅掩码",
        "撤销后刷新仍消失",
      );
    });
} finally {
  await b.close();
}
