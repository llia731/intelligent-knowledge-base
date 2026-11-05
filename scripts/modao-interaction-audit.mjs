#!/usr/bin/env node
/** UI-only interaction audit against localhost. Separate fresh browser state per case. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const base = process.env.IKB_VISUAL_BASE_URL || "http://127.0.0.1:8080";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw Error("localhost only");
const out = path.resolve(process.env.IKB_INTERACTION_OUTPUT || "artifacts/modao-v1/interactions");
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
  const r = { id, steps: [], observations: {}, pageErrors: [], error: null };
  p.on("pageerror", (e) => r.pageErrors.push(String(e)));
  const shot = async (name) => p.screenshot({ path: path.join(out, `${id}-${name}.png`) });
  const go = async (url) => p.goto(new URL(url, base).href, { waitUntil: "networkidle" });
  const state = () => p.evaluate(() => JSON.parse(localStorage.getItem("zhishi-kb-v1"))?.state);
  try {
    await fn({ p, r, shot, go, state });
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
  await run("share", async ({ p, r, shot, go, state }) => {
    await go("/library");
    await p.getByRole("button", { name: "分享", exact: true }).first().click();
    await p.getByRole("heading", { name: "分享文档", exact: true }).waitFor();
    await p.locator(".modal textarea").fill("PR10独立验收合成附言");
    await shot("dialog");
    await p.getByRole("button", { name: "保存分享附言", exact: true }).click();
    await p.reload({ waitUntil: "networkidle" });
    await p.getByRole("button", { name: "分享", exact: true }).first().click();
    assert.equal(await p.locator(".modal textarea").inputValue(), "PR10独立验收合成附言");
    await shot("persisted");
    assert.ok((await state()).logs.some((l) => JSON.stringify(l).includes("分享文档")));
    r.steps.push("打开分享弹窗", "保存附言", "刷新后重开附言保留", "写入审计");
    r.observations.externalShare = "Only a local note; no recipient, link or actual share delivery";
  });
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
      r.observations.persisted = true;
    });
  await run("roles-view", async ({ p, r, shot, go }) => {
    await go("/admin/roles");
    await p.getByRole("button", { name: /普通用户/ }).click();
    const cb = p.getByRole("checkbox", { name: "普通用户 用户管理 查看", exact: true });
    await cb.check();
    await p.getByRole("button", { name: "保存权限", exact: true }).click();
    await shot("grant");
    await p.locator("#modao-personal-center").click();
    await p.locator("#role-switch").selectOption("普通用户");
    await p.getByRole("button", { name: "保存", exact: true }).focus();
    await p.keyboard.press("Enter");
    r.observations.workaround = "Keyboard Enter used because backdrop intercepts pointer clicks";
    await go("/admin/users");
    await p.getByRole("heading", { name: "用户管理", exact: true }).waitFor();
    r.steps.push("授予普通用户查看用户管理", "切换普通用户", "直接访问用户管理通过");
    await shot("allowed");
    await p.locator("#modao-personal-center").click();
    await p.locator("#role-switch").selectOption("系统管理员");
    await p.getByRole("button", { name: "保存", exact: true }).focus();
    await p.keyboard.press("Enter");
    await go("/admin/roles");
    await p.getByRole("button", { name: /普通用户/ }).click();
    await p.getByRole("checkbox", { name: "普通用户 用户管理 查看", exact: true }).uncheck();
    await p.locator("#modao-personal-center").click();
    await p.locator("#role-switch").selectOption("普通用户");
    await p.getByRole("button", { name: "保存", exact: true }).focus();
    await p.keyboard.press("Enter");
    await go("/admin/users");
    await p.getByText("当前角色没有「用户管理」权限。", { exact: false }).waitFor();
    await shot("denied");
    r.steps.push("撤销查看授权后同一路由拒绝访问");
  });
  await run("roles-extra", async ({ p, r, shot, go }) => {
    await go("/admin/roles");
    const cb = p.getByRole("checkbox", { name: "系统管理员 用户管理 新增", exact: true });
    await cb.check();
    await p.getByRole("button", { name: "保存权限", exact: true }).click();
    await shot("saved");
    await p.reload({ waitUntil: "networkidle" });
    r.observations.extraAfterReload = await cb.isChecked();
    r.steps.push("勾选新增列", "保存后刷新", "记录新增列是否保留");
    await shot("reloaded");
  });
  await run("profile-keyboard", async ({ p, r, shot, go }) => {
    await go("/");
    await p.locator("#modao-personal-center").click();
    await p.getByLabel("显示名称", { exact: true }).fill("验收键盘用户");
    await p.getByLabel("所属部门", { exact: true }).fill("验收组");
    await p.getByRole("button", { name: "保存", exact: true }).focus();
    await p.keyboard.press("Enter");
    await p.reload({ waitUntil: "networkidle" });
    await p.locator("#modao-personal-center").click();
    assert.equal(await p.getByLabel("显示名称", { exact: true }).inputValue(), "验收键盘用户");
    await shot("persisted");
    r.steps.push("使用键盘激活保存", "刷新后信息保留");
    r.observations.workaround = "Keyboard-only; does not clear the pointer-blocking defect";
  });
  await run("review-seed", async ({ p, r, shot, go }) => {
    await go("/admin/review");
    await p.getByRole("button", { name: "查看原文", exact: true }).first().click();
    r.observations.orphanSeed = await p
      .getByText("这条反馈没有关联原文。", { exact: true })
      .isVisible();
    await p.getByRole("button", { name: "通过", exact: true }).click();
    await p.getByRole("button", { name: /^已通过/ }).click();
    const article = p
      .locator("article")
      .filter({ has: p.getByRole("heading", { name: "薪酬带宽说明草稿", exact: true }) });
    r.observations.badgeText = await article.innerText();
    await shot("contradictory-badges");
    r.steps.push("检查内置审核单原文", "通过后检查状态标签");
  });
  await run("dashboard-zero", async ({ p, r, shot, go, state }) => {
    await go("/admin/review");
    await p.getByRole("button", { name: "通过", exact: true }).click();
    assert.equal((await state()).reviews.filter((x) => x.status === "open").length, 0);
    await go("/admin");
    const stat = p.locator("article").filter({ has: p.getByText("待审核内容", { exact: true }) });
    r.observations.actual = await stat.locator(".v").innerText();
    await shot("zero-pending");
    assert.equal(r.observations.actual, "0", "No pending reviews should display zero");
  });
  await run("keys", async ({ p, r, shot, go, state }) => {
    await go("/admin/keys");
    await p.getByRole("button", { name: "创建密钥", exact: true }).click();
    await p.getByLabel("名称", { exact: true }).fill("PR10验收演示密钥");
    await p.getByRole("button", { name: "创建", exact: true }).click();
    const s = await state();
    assert.ok(s.freshSecret.startsWith("zsk_live_"));
    await shot("created");
    await p.reload({ waitUntil: "networkidle" });
    r.observations.fullSecretSurvivesReload = Boolean((await state()).freshSecret);
    await shot("full-secret-after-reload");
    await p.getByRole("button", { name: "我已保存", exact: true }).click();
    await p.reload({ waitUntil: "networkidle" });
    assert.equal((await state()).freshSecret, "");
    const row = p.getByRole("row").filter({ hasText: "PR10验收演示密钥" });
    await row.getByRole("button", { name: "查看", exact: true }).click();
    await p.getByRole("heading", { name: "密钥预览", exact: true }).waitFor();
    await shot("preview");
    await p.getByRole("button", { name: "关闭", exact: true }).click();
    await row.getByRole("button", { name: "撤销", exact: true }).click();
    assert.equal((await state()).keys.filter((k) => k.name === "PR10验收演示密钥").length, 0);
    await p.reload({ waitUntil: "networkidle" });
    assert.equal(await p.getByRole("row").filter({ hasText: "PR10验收演示密钥" }).count(), 0);
    r.steps.push("创建演示密钥", "确认保存后完整值清除", "查看仅预览", "撤销并刷新后消失");
    await shot("revoked");
  });
} finally {
  await b.close();
}
