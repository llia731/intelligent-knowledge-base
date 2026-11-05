#!/usr/bin/env node
/** UI-only interaction audit against localhost. Separate fresh browser state per case. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const base = process.env.IKB_VISUAL_BASE_URL || "http://127.0.0.1:8080";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw Error("localhost only");
const out = path.resolve(process.env.IKB_V16_OUTPUT || "artifacts/modao-v1/pr12-v16");
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
const open = async (p) => {
  await p.locator("#modao-personal-center").click();
  await p.getByRole("dialog").waitFor();
};
const tab = async (p, name) => p.getByRole("tab", { name, exact: true }).click();
const save = async (p) => {
  await p.getByRole("button", { name: "保存", exact: true }).click();
  await p.getByRole("dialog").waitFor({ state: "hidden" });
};
const prefs = () => ({
  avatar: "smile",
  theme: "system",
  defaultLayout: "card",
  compactSidebar: false,
  searchMode: "keyword",
  searchSort: "updated",
  searchPageSize: 50,
  expandSynonyms: false,
  notificationChannels: ["sms", "wecom"],
  notificationFrequency: "daily",
});
// Use existing class-based field containers only where the starting PR has no accessible label.
const field = (p, text) =>
  p
    .locator(".ps-field")
    .filter({ has: p.locator(".ps-label").getByText(text, { exact: true }) })
    .locator("select");
const chooseSelect = async (p, aliases, value) => {
  for (const t of aliases) {
    const a = p.getByLabel(t, { exact: true });
    if (await a.count()) {
      await a.selectOption(String(value));
      return;
    }
  }
  for (const t of aliases) {
    const a = field(p, t);
    if (await a.count()) {
      await a.selectOption(String(value));
      return;
    }
  }
  throw Error("Missing select " + aliases);
};
async function editAll(p) {
  await p.getByLabel("显示名称", { exact: true }).fill("V16验收草稿");
  await p.getByLabel("所属部门", { exact: true }).fill("验收组");
  await p.getByRole("button", { name: "微笑", exact: true }).click();
  await tab(p, "界面偏好");
  await p.getByRole("radio", { name: "跟随系统", exact: true }).check();
  await p.getByRole("radio", { name: "卡片", exact: true }).check();
  await p.getByRole("switch", { name: /紧凑侧边栏/ }).uncheck();
  await tab(p, "检索偏好");
  await chooseSelect(p, ["默认检索模式", "默认模式"], "keyword");
  await chooseSelect(p, ["默认排序"], "updated");
  await chooseSelect(p, ["默认每页条数", "每页条数"], 50);
  await p.getByRole("switch", { name: /同义词扩展/ }).uncheck();
  await tab(p, "通知偏好");
  for (const n of ["站内信", "邮件"])
    await p.getByRole("checkbox", { name: n, exact: true }).uncheck();
  for (const n of ["短信", "企业微信"])
    await p.getByRole("checkbox", { name: n, exact: true }).check();
  await p.getByRole("radio", { name: "每日摘要", exact: true }).check();
}
try {
  await run("four-tabs-layout", async ({ p, r, shot, go }) => {
    await go("/");
    await open(p);
    r.observations.bounds = [];
    for (const [id, name] of [
      ["profile", "个人资料"],
      ["appearance", "界面偏好"],
      ["search", "检索偏好"],
      ["notifications", "通知偏好"],
    ]) {
      await tab(p, name);
      await shot(id);
      r.observations.bounds.push({ id, ...(await p.getByRole("dialog").boundingBox()) });
    }
    for (const a of r.observations.bounds) {
      assert.ok(Math.abs(a.width - 768) <= 1, "Expected 768px width: " + JSON.stringify(a));
      assert.ok(Math.abs(a.height - 620) <= 1, "Expected 620px height: " + JSON.stringify(a));
      assert.ok(Math.abs(a.x - 704) <= 1, "Content-centered x=704");
      assert.ok(Math.abs(a.y - 229) <= 1, "Vertically centered y≈229/230");
    }
  });
  await run("draft-save-reload", async ({ p, r, shot, go, state }) => {
    await go("/");
    await open(p);
    await editAll(p);
    await tab(p, "个人资料");
    assert.equal(await p.getByLabel("显示名称", { exact: true }).inputValue(), "V16验收草稿");
    assert.equal(
      await p.getByRole("button", { name: "微笑", exact: true }).getAttribute("aria-pressed"),
      "true",
    );
    await tab(p, "界面偏好");
    assert.equal(await p.getByRole("radio", { name: "跟随系统", exact: true }).isChecked(), true);
    await tab(p, "检索偏好");
    assert.equal(
      await field(
        p,
        (await p.locator(".ps-label").allTextContents()).includes("默认检索模式")
          ? "默认检索模式"
          : "默认模式",
      ).inputValue(),
      "keyword",
    );
    await tab(p, "通知偏好");
    assert.equal(await p.getByRole("radio", { name: "每日摘要", exact: true }).isChecked(), true);
    await shot("draft");
    await save(p);
    await p.reload({ waitUntil: "networkidle" });
    const s = await state();
    assert.deepEqual(s.profile, { name: "V16验收草稿", dept: "验收组" });
    assert.deepEqual(s.personalPreferences, prefs());
    await open(p);
    await shot("restored");
    r.observations.saved = s.personalPreferences;
    assert.equal(
      await p.getByRole("button", { name: "微笑", exact: true }).getAttribute("aria-pressed"),
      "true",
    );
    await shot("restored-profile");
    await tab(p, "界面偏好");
    assert.equal(await p.getByRole("radio", { name: "跟随系统", exact: true }).isChecked(), true);
    assert.equal(await p.getByRole("radio", { name: "卡片", exact: true }).isChecked(), true);
    assert.equal(await p.getByRole("switch", { name: /紧凑侧边栏/ }).isChecked(), false);
    await shot("restored-appearance");
    await tab(p, "检索偏好");
    assert.equal(await p.getByLabel("默认检索模式", { exact: true }).inputValue(), "keyword");
    assert.equal(await p.getByLabel("默认排序", { exact: true }).inputValue(), "updated");
    assert.equal(await p.getByLabel("默认每页条数", { exact: true }).inputValue(), "50");
    assert.equal(await p.getByRole("switch", { name: /同义词扩展/ }).isChecked(), false);
    await shot("restored-search");
    await tab(p, "通知偏好");
    for (const n of ["短信", "企业微信"])
      assert.equal(await p.getByRole("checkbox", { name: n, exact: true }).isChecked(), true);
    for (const n of ["站内信", "邮件"])
      assert.equal(await p.getByRole("checkbox", { name: n, exact: true }).isChecked(), false);
    assert.equal(await p.getByRole("radio", { name: "每日摘要", exact: true }).isChecked(), true);
    await shot("restored-notifications");
  });
  for (const [id, action] of [
    ["cancel", "取消"],
    ["close", "关闭个人中心"],
    ["escape", "Escape"],
    ["backdrop", "backdrop"],
  ])
    await run("discard-" + id, async ({ p, r, shot, go, state }) => {
      await go("/");
      await open(p);
      await p.getByLabel("显示名称", { exact: true }).fill("已保存姓名");
      await save(p);
      const before = await state();
      await open(p);
      await editAll(p);
      await shot("dirty");
      if (action === "Escape") await p.keyboard.press("Escape");
      else if (action === "backdrop") await p.mouse.click(300, 100);
      else await p.getByRole("button", { name: action, exact: true }).click();
      await p.getByRole("dialog").waitFor({ state: "hidden" });
      assert.deepEqual((await state()).profile, before.profile);
      assert.deepEqual((await state()).personalPreferences, before.personalPreferences);
      await open(p);
      assert.equal(await p.getByLabel("显示名称", { exact: true }).inputValue(), "已保存姓名");
      await shot("reopened");
    });
  await run("keyboard-layering", async ({ p, r, shot, go }) => {
    await go("/");
    await open(p);
    const d = p.getByRole("dialog");
    r.observations.focusOrder = [];
    for (let i = 0; i < 35; i++) {
      await p.keyboard.press("Tab");
      assert.equal(
        await d.evaluate((e) => e.contains(document.activeElement)),
        true,
        "Tab must stay in dialog",
      );
      r.observations.focusOrder.push(
        await p.evaluate(() => ({
          tag: document.activeElement.tagName,
          label: document.activeElement.getAttribute("aria-label"),
          text: document.activeElement.textContent?.slice(0, 35),
        })),
      );
    }
    for (let i = 0; i < 12; i++) {
      await p.keyboard.press("Shift+Tab");
      assert.equal(
        await d.evaluate((e) => e.contains(document.activeElement)),
        true,
        "Shift+Tab stays inside",
      );
    }
    const t = p.getByRole("tab", { name: "个人资料", exact: true });
    await t.focus();
    await p.keyboard.press("ArrowRight");
    assert.equal(
      await p.getByRole("tab", { name: "界面偏好", exact: true }).getAttribute("aria-selected"),
      "true",
    );
    assert.equal(
      await p
        .getByRole("tab", { name: "界面偏好", exact: true })
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await p.keyboard.press("ArrowLeft");
    await p.keyboard.press("ArrowLeft");
    assert.equal(
      await p.getByRole("tab", { name: "通知偏好", exact: true }).getAttribute("aria-selected"),
      "true",
    );
    await shot("keyboard");
    await p.keyboard.press("Escape");
    assert.equal(
      await p.locator("#modao-personal-center").evaluate((e) => e === document.activeElement),
      true,
      "Return focus to actual opener",
    );
  });
  await run("accessible-fields", async ({ p, r, shot, go }) => {
    await go("/");
    await open(p);
    await tab(p, "界面偏好");
    assert.equal(
      await p.getByRole("radiogroup", { name: "主题", exact: true }).count(),
      1,
      "Theme radio group needs an accessible name",
    );
    await tab(p, "检索偏好");
    for (const n of ["默认检索模式", "默认排序", "默认每页条数"])
      assert.equal(
        await p.getByRole("combobox", { name: n, exact: true }).count(),
        1,
        n + " must be labelled",
      );
    await shot("fields");
  });
  await run("legacy-migration", async ({ p, r, shot, go, state }) => {
    await go("/");
    await open(p);
    await p.getByLabel("显示名称", { exact: true }).fill("旧版保留用户");
    await p.getByLabel("所属部门", { exact: true }).fill("旧版保留部门");
    await save(p);
    const before = await state();
    await p.evaluate(() => {
      const k = "zhishi-kb-v1",
        s = JSON.parse(localStorage.getItem(k));
      delete s.state.personalPreferences;
      s.state.freshSecret = "zsk_live_PR12LegacySynthetic";
      localStorage.setItem(k, JSON.stringify(s));
    });
    await p.reload({ waitUntil: "networkidle" });
    const s = await state();
    assert.deepEqual(s.profile, before.profile);
    assert.deepEqual(s.docs, before.docs);
    assert.deepEqual(s.grants, before.grants);
    assert.equal(s.freshSecret, "");
    assert.equal(
      await p.evaluate(() =>
        localStorage.getItem("zhishi-kb-v1").includes("zsk_live_PR12LegacySynthetic"),
      ),
      false,
    );
    assert.deepEqual(s.personalPreferences, {
      avatar: "user",
      theme: "light",
      defaultLayout: "list",
      compactSidebar: true,
      searchMode: "hybrid",
      searchSort: "relevance",
      searchPageSize: 10,
      expandSynonyms: true,
      notificationChannels: ["inbox", "email"],
      notificationFrequency: "hourly",
    });
    await open(p);
    await shot("migrated");
  });
  await run("partial-preferences-migration", async ({ p, r, shot, go, state }) => {
    await go("/");
    await open(p);
    await save(p);
    await p.evaluate(() => {
      const k = "zhishi-kb-v1",
        s = JSON.parse(localStorage.getItem(k));
      s.state.personalPreferences = { theme: "dark", notificationChannels: ["sms"] };
      localStorage.setItem(k, JSON.stringify(s));
    });
    await p.reload({ waitUntil: "networkidle" });
    const s = await state();
    assert.equal(s.personalPreferences.theme, "dark");
    assert.deepEqual(s.personalPreferences.notificationChannels, ["sms"]);
    assert.equal(s.personalPreferences.searchPageSize, 10);
    await open(p);
    await tab(p, "通知偏好");
    assert.equal(await p.getByRole("checkbox", { name: "短信", exact: true }).isChecked(), true);
    await shot("migrated");
  });
  await run("roles-permissions", async ({ p, r, shot, go }) => {
    await go("/admin/roles");
    await p.getByRole("button", { name: /普通用户/ }).click();
    await p.getByRole("checkbox", { name: "普通用户 用户管理 查看", exact: true }).check();
    await open(p);
    await p.locator("#role-switch").selectOption("普通用户");
    await save(p);
    await go("/admin/users");
    await p.getByRole("heading", { name: "用户管理", exact: true }).waitFor();
    await shot("allowed");
    await open(p);
    await p.locator("#role-switch").selectOption("系统管理员");
    await save(p);
    await go("/admin/roles");
    await p.getByRole("button", { name: /普通用户/ }).click();
    await p.getByRole("checkbox", { name: "普通用户 用户管理 查看", exact: true }).uncheck();
    await open(p);
    await p.locator("#role-switch").selectOption("普通用户");
    await save(p);
    await go("/admin/users");
    await p.getByText("当前角色没有「用户管理」权限。", { exact: false }).waitFor();
    await shot("denied");
  });
  await run("radio-keyboard", async ({ p, r, shot, go }) => {
    await go("/");
    await open(p);
    await tab(p, "界面偏好");
    await p.getByRole("radio", { name: "浅色", exact: true }).focus();
    await p.keyboard.press("ArrowRight");
    assert.equal(
      await p.getByRole("radio", { name: "深色", exact: true }).isChecked(),
      true,
      "Native radio arrow selection must work",
    );
    await shot("arrow");
  });
  await run("quick-entry-focus", async ({ p, shot, go }) => {
    await go("/");
    const quick = p.getByRole("button", { name: "个人中心", exact: true });
    await quick.click();
    await p.getByRole("dialog").waitFor();
    await p.keyboard.press("Escape");
    assert.equal(await quick.evaluate((e) => e === document.activeElement), true);
    await quick.click();
    await save(p);
    assert.equal(await quick.evaluate((e) => e === document.activeElement), true);
    await shot("returned");
  });
  await run("narrow-viewports", async ({ p, r, shot, go }) => {
    r.observations.bounds = [];
    for (const [width, height] of [
      [1280, 720],
      [800, 600],
      [375, 812],
    ]) {
      await p.setViewportSize({ width, height });
      await go("/");
      await p.getByRole("button", { name: "个人中心", exact: true }).click();
      await tab(p, "通知偏好");
      const box = await p.getByRole("dialog").boundingBox();
      r.observations.bounds.push({ width, height, dialog: box });
      assert.ok(
        box.x >= 15 &&
          box.y >= 15 &&
          box.x + box.width <= width - 15 &&
          box.y + box.height <= height - 15,
      );
      assert.equal(
        await p.getByRole("dialog").evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        true,
      );
      await shot(String(width));
      await save(p);
    }
  });
} finally {
  await b.close();
}
