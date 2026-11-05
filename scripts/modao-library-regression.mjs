#!/usr/bin/env node
/** UI-only interaction audit against localhost. Separate fresh browser state per case. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const base = process.env.IKB_VISUAL_BASE_URL || "http://127.0.0.1:8080";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw Error("localhost only");
const out = path.resolve(process.env.IKB_LIBRARY_TEST_OUTPUT || "artifacts/modao-v1/pr15-library");
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
  const go = async (url) => {
    await p.goto(new URL(url, base).href, { waitUntil: "networkidle" });
    await p.locator(".library-page:not([disabled])").waitFor();
  };
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
const first = (p) => p.locator("table tbody tr").first();
const fixture = JSON.parse(
  await fs.readFile(new URL("./fixtures/modao-library-documents.json", import.meta.url), "utf8"),
);
async function installFixture(p) {
  await p.locator(".library-page:not([disabled])").waitFor();
  await p.evaluate((items) => {
    const stored = JSON.parse(localStorage.getItem("zhishi-kb-v1"));
    stored.state.docs = items.map((item) => ({
      ...item,
      content: "视觉验收合成内容",
      status: "indexed",
      sensitivity: "internal",
      owner: "合成用户",
      chunks: [],
      shareNote: "",
    }));
    localStorage.setItem("zhishi-kb-v1", JSON.stringify(stored));
  }, fixture);
  await p.reload({ waitUntil: "networkidle" });
}
try {
  await run("ssr-hydration-gate", async ({ p, r, shot }) => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    let delayed = 0;
    await p.route(/\/src\/.*\.(tsx?|jsx?)(\?.*)?$/, async (route) => {
      delayed++;
      await gate;
      await route.continue();
    });
    try {
      await p.goto(new URL("/library", base).href, { waitUntil: "commit" });
      await p.locator(".library-page[disabled]").waitFor();
      const trigger = p
        .locator("tbody tr")
        .first()
        .getByRole("button", { name: "分享", exact: true });
      assert.equal(
        await trigger.isDisabled(),
        true,
        "SSR controls remain disabled before client initialization",
      );
      await shot("before-hydration-disabled");
      release();
      await p.locator(".library-page:not([disabled])").waitFor({ timeout: 30000 });
      assert.ok(delayed > 0, "Actual application JavaScript was deliberately held back");
      await trigger.click();
      await p.getByRole("dialog", { name: "分享文档", exact: true }).waitFor();
      await shot("first-click-after-hydration");
      r.observations.delayedScriptRequests = delayed;
    } finally {
      release();
    }
  });
  await run("source-layout", async ({ p, r, go, shot }) => {
    await go("/library");
    const selectors = {
      navigation: ".library-navigation",
      collections: ".library-collections",
      documents: ".library-documents",
      covers: ".library-cover",
      pagination: ".library-pagination",
    };
    r.observations.geometry = {};
    for (const [name, sel] of Object.entries(selectors))
      r.observations.geometry[name] = await p.locator(sel).first().boundingBox();
    const g = r.observations.geometry;
    assert.deepEqual(g.navigation, { x: 445, y: 168, width: 302, height: 662 });
    assert.equal(g.collections.x, 771);
    assert.equal(g.collections.y, 168);
    assert.equal(g.documents.y, 446);
    assert.equal(g.documents.height, 483);
    assert.equal(g.covers.height, 112);
    assert.equal(await p.locator(".library-cover-card").count(), 3);
    await shot("default");
  });
  await run("original-assets", async ({ p, r, go, shot }) => {
    await go("/library");
    const images = await p
      .locator(".library-page img")
      .evaluateAll((es) =>
        es.map((e) => ({ src: e.getAttribute("src"), loaded: e.complete && e.naturalWidth > 0 })),
      );
    assert.ok(images.length > 35);
    assert.ok(images.every((e) => e.loaded));
    assert.ok(images.every((e) => e.src.startsWith("/modao/library/")));
    r.observations.images = images;
    await shot("actual-svg-resources");
  });
  await run("pagination", async ({ p, r, go, shot }) => {
    await go("/library");
    assert.equal(await p.locator("tbody tr").count(), 4);
    await p.getByRole("button", { name: "下一页", exact: true }).click();
    assert.equal(await p.locator("tbody tr").count(), 2);
    assert.ok((await p.locator(".library-pagination").innerText()).includes("2/2"));
    await shot("page-2");
    await p.getByRole("button", { name: "上一页", exact: true }).click();
    assert.equal(await p.locator("tbody tr").count(), 4);
    assert.equal(await p.getByRole("button", { name: "上一页", exact: true }).isDisabled(), true);
  });
  await run("last-page-delete", async ({ p, r, go, shot }) => {
    await go("/library");
    await p.getByRole("button", { name: "下一页", exact: true }).click();
    await p.getByRole("checkbox", { name: "全选本页文档", exact: true }).check();
    await p
      .locator(".library-bulk-actions")
      .getByRole("button", { name: "删除", exact: true })
      .click();
    await p.getByRole("button", { name: "下一页", exact: true }).waitFor();
    assert.equal(await p.locator("tbody tr").count(), 4);
    assert.ok((await p.locator(".library-pagination").innerText()).includes("1/1"));
    await shot("clamped-to-page-1");
  });
  await run("filter-clears-selection", async ({ p, go, shot }) => {
    await go("/library");
    await first(p).getByRole("checkbox").check();
    await p.getByRole("button", { name: "公开", exact: true }).click();
    assert.equal(await p.locator("tbody tr").count(), 3);
    assert.equal(await p.locator(".library-picked-count").innerText(), "已选 0 项");
    assert.equal(
      await p
        .locator(".library-bulk-actions")
        .getByRole("button", { name: "删除", exact: true })
        .isDisabled(),
      true,
    );
    await shot("filter-selection-reset");
  });
  await run("project-kind-filters", async ({ p, go, shot }) => {
    await go("/library");
    await installFixture(p);
    await p.getByRole("button", { name: "Project Beta", exact: true }).click();
    assert.equal(await p.locator("tbody tr").count(), 1);
    await p.getByRole("cell", { name: "RAG 检索服务设计.md", exact: true }).waitFor();
    await p.getByRole("button", { name: "Project Beta", exact: true }).click();
    await p.getByRole("button", { name: "PDF", exact: true }).click();
    assert.equal(await p.locator("tbody tr").count(), 1);
    await shot("pdf");
    await p.getByRole("button", { name: "查看全部", exact: true }).click();
    assert.equal(await p.locator("tbody tr").count(), 4);
    assert.equal(await p.getByRole("button", { name: "下一页", exact: true }).isDisabled(), true);
  });
  await run("card-view", async ({ p, go, shot }) => {
    await go("/library");
    await p.getByRole("button", { name: "卡片", exact: true }).click();
    assert.equal(await p.locator(".library-document-cards > button").count(), 4);
    await p.locator(".library-document-cards > button").first().click();
    await p.getByRole("button", { name: "关闭", exact: true }).click();
    await shot("cards");
    await p.getByRole("button", { name: "列表", exact: true }).click();
    assert.equal(await p.locator("tbody tr").count(), 4);
  });
  await run("unsupported-is-honest", async ({ p, r, go, shot, state }) => {
    await go("/library");
    // SSR can render disabled controls before Zustand has initialized local persistence.
    // Establish the baseline only after the real application state exists; keep the full equality assertion.
    await p.waitForFunction(() =>
      Array.isArray(JSON.parse(localStorage.getItem("zhishi-kb-v1"))?.state?.docs),
    );
    const before = await state();
    assert.ok(
      before && Array.isArray(before.logs),
      "Initialized persistence is required before observing no-op behavior",
    );
    const requests = [];
    p.on("request", (q) => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(q.method())) requests.push(q.url());
    });
    for (const name of ["移动", "导出", "打标签", "改分类", "版本管理"])
      assert.equal(await p.getByRole("button", { name, exact: true }).isDisabled(), true, name);
    await p
      .locator(".library-boundary")
      .getByText(/尚未实现/)
      .waitFor();
    assert.deepEqual(await state(), before);
    assert.deepEqual(requests, []);
    assert.equal(await p.getByText(/导出成功|移动成功|版本恢复成功/).count(), 0);
    r.observations.mutationRequests = requests;
    await shot("disabled-with-disclosure");
  });
  await run("metadata-count-honesty", async ({ p, r, go, shot }) => {
    await go("/library");
    assert.deepEqual(await p.locator(".library-cover-meta").allTextContents(), [
      "0 文档—",
      "0 文档—",
      "0 文档—",
    ]);
    assert.equal(await first(p).locator("td").nth(3).innerText(), "—");
    assert.equal(await first(p).locator("td").nth(4).innerText(), "—");
    await first(p).getByRole("button", { name: "编辑", exact: true }).click();
    await p.getByLabel("分类", { exact: true }).fill("产品研发知识库");
    await p.getByRole("button", { name: "保存", exact: true }).click();
    await p.reload({ waitUntil: "networkidle" });
    assert.ok((await p.locator(".library-cover-meta").first().innerText()).includes("1 文档"));
    await shot("actual-local-count");
  });
  await run("local-search", async ({ p, go, shot }) => {
    await go("/library");
    await p.locator(".library-local-tools summary").click();
    await p.getByPlaceholder("搜索标题", { exact: true }).fill("年假政策说明");
    assert.equal(await p.locator("tbody tr").count(), 1);
    await shot("search");
    await p.getByRole("button", { name: "清除筛选", exact: true }).click();
    assert.equal(await p.locator("tbody tr").count(), 4);
  });
  await run("keyboard-actions", async ({ p, r, go, shot }) => {
    await go("/library");
    await first(p).getByRole("button", { name: "分享", exact: true }).focus();
    await p.keyboard.press("Enter");
    await p.getByRole("dialog", { name: "分享文档", exact: true }).waitFor();
    await p.keyboard.press("Escape");
    assert.equal(
      await first(p)
        .getByRole("button", { name: "分享", exact: true })
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await shot("focus-restored");
  });
  await run("responsive-viewports", async ({ p, r, go, shot }) => {
    r.observations.sizes = [];
    for (const size of [
      { width: 1280, height: 720 },
      { width: 800, height: 600 },
      { width: 375, height: 812 },
    ]) {
      await p.setViewportSize(size);
      await go("/library");
      const dims = await p.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: innerWidth,
      }));
      assert.ok(dims.scroll <= dims.width, JSON.stringify({ size, dims }));
      const cards = await p.locator(".library-cover-card").evaluateAll((es) =>
        es.map((e) => ({
          titleBottom: e.querySelector("h3").getBoundingClientRect().bottom,
          descriptionTop: e.querySelector("p").getBoundingClientRect().top,
          descriptionBottom: e.querySelector("p").getBoundingClientRect().bottom,
          metaTop: e.querySelector(".library-cover-meta").getBoundingClientRect().top,
          metaBottom: e.querySelector(".library-cover-meta").getBoundingClientRect().bottom,
          cardBottom: e.getBoundingClientRect().bottom,
        })),
      );
      for (const card of cards) {
        assert.ok(
          card.titleBottom <= card.descriptionTop,
          "Cover title must not overlap description " + JSON.stringify({ size, card }),
        );
        assert.ok(card.descriptionBottom <= card.metaTop, "Description must not overlap metadata");
        assert.ok(card.metaBottom < card.cardBottom, "Metadata remains inside its card");
      }
      await shot(`${size.width}-top`);
      await p.locator(".library-table-scroll").evaluate((e) => (e.scrollLeft = e.scrollWidth));
      await first(p).getByRole("button", { name: "分享", exact: true }).click();
      await p.getByRole("dialog", { name: "分享文档", exact: true }).waitFor();
      await shot(`${size.width}-share`);
      await p.keyboard.press("Escape");
      await shot(`${size.width}-page`);
      r.observations.sizes.push({ size, dims });
    }
  });
} finally {
  await b.close();
}
