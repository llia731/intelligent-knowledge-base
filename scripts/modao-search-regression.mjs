#!/usr/bin/env node
/** UI-only interaction audit against localhost. Separate fresh browser state per case. */
import { waitForAppReady } from "./modao-browser-ready.mjs";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const base = process.env.IKB_VISUAL_BASE_URL || "http://127.0.0.1:8080";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw Error("localhost only");
const out = path.resolve(process.env.IKB_SEARCH_TEST_OUTPUT || "artifacts/modao-v1/pr16-search");
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
    await waitForAppReady(p);
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
const QUERY = "SearchBoundary";
const articles = (p) => p.locator("main article");
const titles = (p) => articles(p).locator("h3").allTextContents();
const total = async (p) =>
  Number((await p.locator(".pager").innerText()).match(/共\s*(\d+)\s*条/)?.[1]);
async function fixture(p, n, { chunks = 1, types = false, deny = false } = {}) {
  await p.evaluate(
    ({ n, chunks, types, deny }) => {
      const stored = JSON.parse(localStorage.getItem("zhishi-kb-v1"));
      stored.state.collections = ["技术文档库", "产品知识库", "客户档案库", "法规标准库"];
      const dates = ["02", "09", "01", "08", "03", "07", "04", "06", "05"];
      stored.state.docs = Array.from({ length: n }, (_, i) => ({
        id: `search-fixture-${String(i + 1).padStart(2, "0")}`,
        title: `检索边界文档 ${String(i + 1).padStart(2, "0")}.${types ? ["pdf", "csv", "png"][i % 3] : "pdf"}`,
        collection: i % 2 ? "产品知识库" : "技术文档库",
        content: `SearchBoundary OtherBoundary 合成检索文档 ${i + 1}`,
        status: "indexed",
        sensitivity: deny && i === 0 ? "restricted" : "public",
        owner: i % 2 ? "乙作者" : "甲作者",
        updatedAt: `2026-10-${dates[i % 9]}T00:00:00.000Z`,
        chunks: Array.from({ length: chunks }, (_, j) => ({
          id: `chunk-${i}-${j}`,
          index: j,
          text: `SearchBoundary OtherBoundary 合成片段 ${i + 1}-${j + 1}`,
        })),
        shareNote: "",
      }));
      if (deny) {
        stored.state.accessRole = "普通用户";
        stored.state.role = "user";
        stored.state.acl = { 产品知识库: ["系统管理员"] };
      }
      stored.state.searches = 18;
      stored.state.traces = [];
      localStorage.setItem("zhishi-kb-v1", JSON.stringify(stored));
    },
    { n, chunks, types, deny },
  );
  await p.reload({ waitUntil: "networkidle" });
  await waitForAppReady(p);
}
async function submit(p, q = QUERY) {
  await p.getByLabel("检索关键词", { exact: true }).fill(q);
  await p.getByRole("button", { name: "检索", exact: true }).click();
}
async function allTitles(p) {
  const list = [];
  for (let i = 0; i < 30; i++) {
    list.push(...(await titles(p)));
    const next = p.getByRole("button", { name: "下一页", exact: true });
    if (await next.isDisabled()) break;
    await next.click();
  }
  return list;
}
try {
  for (const n of [0, 1, 4, 5, 9])
    await run(`boundary-${n}`, async ({ p, r, go, shot, state }) => {
      await go("/search");
      await fixture(p, n);
      await submit(p);
      assert.equal(await total(p), n);
      assert.equal(await p.getByRole("button", { name: "上一页", exact: true }).isDisabled(), true);
      assert.equal(await articles(p).count(), Math.min(4, n));
      await shot("first-page");
      const s = await state(),
        found = await allTitles(p);
      assert.equal(found.length, n);
      assert.equal(new Set(found).size, n);
      assert.equal(await p.getByRole("button", { name: "下一页", exact: true }).isDisabled(), true);
      assert.equal((await state()).searches, s.searches);
      assert.equal((await state()).traces.length, s.traces.length);
      r.observations.actualTitles = found;
      await shot("last-page");
    });
  await run("unique-documents", async ({ p, r, go, shot }) => {
    await go("/search");
    await fixture(p, 3, { chunks: 3 });
    await submit(p);
    r.observations.total = await total(p);
    r.observations.titles = await allTitles(p);
    await shot("chunks");
    assert.equal(
      r.observations.total,
      3,
      "Each document appears once even when several chunks match",
    );
    assert.equal(new Set(r.observations.titles).size, r.observations.titles.length);
  });
  await run("no-fixed-result-cap", async ({ p, r, go, shot }) => {
    await go("/search");
    await fixture(p, 17);
    await submit(p);
    r.observations.total = await total(p);
    await shot("total");
    assert.equal(r.observations.total, 17, "Search total must not silently stop at 12 hits");
    assert.equal((await allTitles(p)).length, 17);
  });
  await run("real-time-sort", async ({ p, r, go, shot }) => {
    await go("/search");
    await fixture(p, 9);
    await submit(p);
    await p.getByRole("button", { name: "下一页", exact: true }).click();
    await p.getByLabel("排序", { exact: true }).selectOption("按时间");
    r.observations.first = await titles(p);
    await shot("sorted");
    assert.ok(
      r.observations.first[0].includes("02"),
      "Latest date is doc 02, not reverse input order",
    );
    assert.equal(await p.getByRole("button", { name: "上一页", exact: true }).isDisabled(), true);
  });
  await run("no-fabricated-relevance", async ({ p, r, go, shot, state }) => {
    await go("/search");
    await fixture(p, 1);
    await submit(p);
    r.observations.text = await articles(p).first().innerText();
    r.observations.trace = (await state()).traces[0];
    await shot("local-score");
    assert.equal(
      await p.getByLabel("相关度未计算", { exact: true }).count(),
      1,
      "A local keyword score is not semantic relevance",
    );
    assert.ok(!/\b0\.9\d\b/.test(r.observations.text), "No fabricated probability");
    assert.ok(r.observations.trace.ms >= 0);
  });
  await run("multiple-knowledge-bases", async ({ p, r, go, shot }) => {
    await go("/search");
    await fixture(p, 9);
    await submit(p);
    const a = p.getByRole("checkbox", { name: "技术文档库", exact: true }),
      b = p.getByRole("checkbox", { name: "产品知识库", exact: true });
    await a.uncheck();
    assert.equal(await total(p), 4);
    await b.uncheck();
    assert.equal(await total(p), 0);
    await a.check();
    await b.check();
    assert.equal(await total(p), 9);
    await shot("both-selected");
  });
  await run("document-type-filter", async ({ p, go, shot }) => {
    await go("/search");
    await fixture(p, 6, { types: true });
    await submit(p);
    assert.equal(await total(p), 2);
    await p.getByRole("checkbox", { name: "表格", exact: true }).check();
    assert.equal(await total(p), 4);
    await p.getByRole("checkbox", { name: "图标", exact: true }).check();
    assert.equal(await total(p), 6);
    await p.getByRole("checkbox", { name: "文档", exact: true }).uncheck();
    assert.equal(await total(p), 4);
    await shot("extension-types");
    assert.equal(await p.getByRole("checkbox", { name: "问答", exact: true }).isDisabled(), true);
  });
  await run("date-author-level-filters", async ({ p, r, go, shot }) => {
    await go("/search");
    await fixture(p, 9);
    await submit(p);
    await p.getByLabel("起始日期", { exact: true }).fill("2026-10-08");
    await p.getByLabel("截止日期", { exact: true }).fill("2026-10-09");
    assert.equal(await total(p), 2);
    await p.getByLabel("作者", { exact: true }).fill("乙作者");
    assert.equal(await total(p), 2);
    await p.getByLabel("起始日期", { exact: true }).fill("2026-10-10");
    await p.getByRole("alert").filter({ hasText: "起始日期不能晚于截止日期" }).waitFor();
    assert.equal(await total(p), 0);
    await shot("invalid-date");
    await p.getByRole("button", { name: "重置", exact: true }).click();
    assert.equal(await total(p), 9);
  });
  await run("advanced-syntax-is-not-a-parser", async ({ p, r, go, shot, state }) => {
    await go("/search");
    await fixture(p, 9);
    const before = await state();
    await p.getByRole("button", { name: "title:微调", exact: true }).click();
    assert.equal(await p.getByLabel("检索关键词", { exact: true }).inputValue(), "title:微调");
    await p.getByRole("button", { name: "检索", exact: true }).click();
    await p.getByRole("alert").filter({ hasText: "不支持高级语法解析" }).waitFor();
    assert.equal((await state()).searches, before.searches);
    await shot("unsupported-grammar");
  });
  await run("scope-mode-sort-do-not-inflate-audit", async ({ p, r, go, shot, state }) => {
    await go("/search");
    await fixture(p, 9);
    await submit(p);
    const s = await state();
    await p.getByRole("button", { name: "下一页", exact: true }).click();
    await p.getByRole("button", { name: "混合模式", exact: true }).click();
    assert.equal(await p.getByRole("button", { name: "上一页", exact: true }).isDisabled(), true);
    await p.getByLabel("排序", { exact: true }).selectOption("按时间");
    const after = await state();
    assert.equal(after.searches, s.searches);
    assert.equal(after.traces.length, s.traces.length);
    await p
      .getByText(/固定同义词扩展/)
      .first()
      .waitFor();
    await shot("mode-boundary");
  });
  await run("query-draft-and-submit", async ({ p, r, go, shot, state }) => {
    await go("/search");
    await fixture(p, 9);
    await submit(p);
    await p.getByRole("button", { name: "下一页", exact: true }).click();
    await p.getByLabel("检索关键词", { exact: true }).fill("NoMatchingToken");
    assert.equal(await total(p), 9, "Unsubmitted draft does not silently change results");
    await p.getByRole("button", { name: "检索", exact: true }).click();
    assert.equal(await total(p), 0);
    assert.equal(await p.getByRole("button", { name: "上一页", exact: true }).isDisabled(), true);
    await shot("zero-after-submit");
  });
  await run("acl-does-not-leak", async ({ p, r, go, shot, state }) => {
    await go("/search");
    await fixture(p, 9, { deny: true });
    await submit(p);
    const ts = await allTitles(p);
    assert.equal(ts.length, 4);
    assert.ok(!ts.some((t) => t.includes("01")));
    assert.ok(!(await state()).traces[0].hits.some((h) => h.title.includes("01")));
    await shot("authorized-results");
  });
  await run("exports-feedback-unavailable", async ({ p, r, go, shot }) => {
    await go("/search");
    await fixture(p, 1);
    await submit(p);
    const downloads = [];
    p.on("download", (d) => downloads.push(d.suggestedFilename()));
    for (const name of ["导出", "批量下载", "有帮助", "无帮助"])
      assert.equal(
        await p.getByRole("button", { name, exact: true }).first().isDisabled(),
        true,
        name,
      );
    assert.deepEqual(downloads, []);
    await shot("honest-disabled-controls");
  });
  await run("local-source-and-copy", async ({ p, r, go, shot, c }) => {
    await c.grantPermissions(["clipboard-read", "clipboard-write"]);
    await go("/search");
    await fixture(p, 1);
    await submit(p);
    await articles(p).first().getByRole("button", { name: "复制摘要", exact: true }).click();
    await p.getByRole("status").filter({ hasText: "已复制本地摘要" }).waitFor();
    r.observations.clipboard = await p.evaluate(() => navigator.clipboard.readText());
    assert.ok(r.observations.clipboard.includes("SearchBoundary"));
    await articles(p).first().getByRole("button", { name: "查看本地来源", exact: true }).click();
    await p
      .getByRole("dialog")
      .getByText(/SearchBoundary/)
      .waitFor();
    await shot("source");
    await p.keyboard.press("Escape");
    assert.equal(await p.getByRole("dialog").count(), 0);
  });
  await run("clipboard-failure-no-fake-success", async ({ p, r, go, shot }) => {
    await go("/search");
    await fixture(p, 1);
    await submit(p);
    await p.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async () => {
            throw new DOMException("Deliberate clipboard failure", "NotAllowedError");
          },
        },
      }),
    );
    await articles(p).first().getByRole("button", { name: "复制摘要", exact: true }).click();
    await p.getByRole("status").filter({ hasText: "复制失败" }).waitFor();
    assert.equal(await p.getByText(/已复制/).count(), 0);
    await shot("copy-failed");
  });
  await run("category-path-filter", async ({ p, go, shot }) => {
    await go("/search");
    await fixture(p, 6);
    await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("zhishi-kb-v1"));
      s.state.docs[0].collection = "技术文档库 / 研发";
      s.state.docs[1].collection = "产品知识库 / 运营";
      localStorage.setItem("zhishi-kb-v1", JSON.stringify(s));
    });
    await p.reload({ waitUntil: "networkidle" });
    await waitForAppReady(p);
    await submit(p);
    await p.getByLabel("分类", { exact: true }).selectOption("研发");
    assert.equal(await total(p), 1);
    assert.ok((await titles(p))[0].includes("01"));
    await shot("stored-path");
    await p.getByRole("button", { name: "重置", exact: true }).click();
    assert.equal(await total(p), 6);
  });
  await run("tags-are-reference-only", async ({ p, go, shot }) => {
    await go("/search");
    await fixture(p, 5);
    await p.getByRole("button", { name: "LLM", exact: true }).click();
    assert.equal(await total(p), 2);
    await submit(p);
    assert.equal(await total(p), 5);
    assert.equal(await p.getByRole("button", { name: "LLM", exact: true }).isDisabled(), true);
    assert.equal(
      await p.getByRole("button", { name: "LLM", exact: true }).getAttribute("aria-pressed"),
      "false",
    );
    await p.getByText("本地未记录独立标签", { exact: true }).waitFor();
    await shot("no-invented-tags");
  });
  await run("client-url-query-resets-page", async ({ p, go, shot }) => {
    await go("/search");
    await fixture(p, 9);
    await submit(p);
    await p.getByRole("button", { name: "下一页", exact: true }).click();
    await p.getByRole("button", { name: "下一页", exact: true }).click();
    const input = p.getByRole("search").locator("input");
    await input.fill("OtherBoundary");
    await input.press("Enter");
    await p.waitForURL(/q=OtherBoundary/);
    await p.waitForFunction(
      () => document.querySelector('input[aria-label="检索关键词"]').value === "OtherBoundary",
    );
    assert.equal(await p.getByRole("button", { name: "上一页", exact: true }).isDisabled(), true);
    assert.equal(await total(p), 9);
    await shot("url-page-one");
  });
  await run("empty-query-and-responsive", async ({ p, r, go, shot, state }) => {
    await go("/search");
    await fixture(p, 1);
    await submit(p);
    const before = await state();
    await submit(p, "");
    assert.equal(await total(p), 0);
    assert.equal((await state()).searches, before.searches);
    await p.getByRole("alert").filter({ hasText: "请输入普通关键词" }).waitFor();
    r.observations.viewports = [];
    for (const size of [
      { width: 1280, height: 720 },
      { width: 800, height: 600 },
      { width: 375, height: 812 },
    ]) {
      await p.setViewportSize(size);
      await go("/search");
      const dims = await p.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(dims.scroll <= dims.width, JSON.stringify({ size, dims }));
      await shot(`${size.width}-page`);
      r.observations.viewports.push({ size, dims });
    }
  });
  await run("source-layout", async ({ p, r, go, shot }) => {
    await go("/search");
    r.observations.query = await p.locator(".search-intro").boundingBox();
    assert.deepEqual(r.observations.query, { x: 445, y: 168, width: 1280, height: 286 });
    r.observations.filters = await p.locator(".search-filters").boundingBox();
    assert.equal(r.observations.filters.x, 445);
    assert.equal(r.observations.filters.y, 478);
    assert.equal(r.observations.filters.width, 256);
    const first = await articles(p).first().boundingBox();
    assert.equal(first.x, 725);
    assert.equal(first.y, 530);
    await shot("reference-examples");
  });
} finally {
  await b.close();
}
