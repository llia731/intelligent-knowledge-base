#!/usr/bin/env node
/** Real Modao /library capture and inline SVG extraction; reuse existing local servers. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
const out = path.resolve(process.env.IKB_LIBRARY_OUTPUT || "artifacts/modao-v1/pr15-visual");
const mode = process.env.IKB_LIBRARY_CAPTURE_MODE || "both";
const react = process.env.IKB_VISUAL_BASE_URL || "http://127.0.0.1:8080";
const source =
  process.env.IKB_MODAO_URL || "http://127.0.0.1:8081/pm2mv9dlt722tkxks-mvak915c/index.html";
for (const u of [react, source])
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(u).hostname))
    throw Error("localhost only");
await fs.mkdir(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.IKB_CHROMIUM_PATH || "/usr/bin/chromium",
});
const report = {
  browser: b.version(),
  viewport: { width: 1920, height: 1080, dpr: 1 },
  results: [],
};
for (const kind of ["source", "react"].filter((k) => mode === "both" || mode === k)) {
  const c = await b.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      locale: "zh-CN",
      timezoneId: "Asia/Tokyo",
      reducedMotion: "reduce",
      colorScheme: "light",
    }),
    p = await c.newPage();
  p.setDefaultNavigationTimeout(30000);
  const r = { kind, pageErrors: [], consoleErrors: [], failedRequests: [] };
  p.on("pageerror", (e) => r.pageErrors.push(String(e)));
  p.on("console", (m) => {
    if (m.type() === "error") r.consoleErrors.push(m.text());
  });
  p.on("requestfailed", (q) =>
    r.failedRequests.push({ url: q.url(), error: q.failure()?.errorText }),
  );
  try {
    await p.goto(kind === "source" ? source : new URL("/library", react).href, {
      waitUntil: "networkidle",
    });
    if (kind === "source") {
      await p.getByText("总览", { exact: true }).last().click();
      await p
        .locator(".rn-list-item.page")
        .filter({ has: p.locator(".editable-span").getByText("知识管理", { exact: true }) })
        .click();
      await p
        .locator(".mb-design-page .preview-switch-btn")
        .filter({ hasText: /^演示$/ })
        .click();
      await p.waitForTimeout(350);
      await p.screenshot({ path: path.join(out, "source-editor.png"), caret: "initial" });
      await p.evaluate(() => {
        const area = document.querySelector(".mb-preview-page .zoom-area");
        if (!area) throw Error("missing prototype runtime");
        const host = document.createElement("div");
        host.id = "audit-library-host";
        host.style.cssText =
          "position:fixed;inset:0;z-index:2147483647;width:1920px;height:1080px;overflow:hidden;background:white";
        const copy = area.cloneNode(true);
        copy.style.cssText =
          "position:relative;left:0;top:0;transform:none;width:1920px;height:1080px";
        host.append(copy);
        document.body.append(host);
      });
    } else {
      await p.locator(".library-layout").waitFor();
      if (process.env.IKB_LIBRARY_FIXTURE === "prototype") {
        const fixture = JSON.parse(
          await fs.readFile(
            new URL("./fixtures/modao-library-documents.json", import.meta.url),
            "utf8",
          ),
        );
        await p.evaluate((items) => {
          const stored = JSON.parse(localStorage.getItem("zhishi-kb-v1"));
          stored.state.docs = items.map((item) => ({
            ...item,
            content: "用于墨刀截图对照的合成文档，非原始文件正文。",
            status: "indexed",
            sensitivity: "internal",
            owner: "视觉验收合成数据",
            chunks: [],
            shareNote: "",
          }));
          localStorage.setItem("zhishi-kb-v1", JSON.stringify(stored));
        }, fixture);
        await p.reload({ waitUntil: "networkidle" });
        r.fixture =
          "Four original prototype filenames/categories/dates; synthetic content and permissions; no invented file size/tags/card sample counts";
      }
    }
    await p.screenshot({ path: path.join(out, kind + "-native.png"), caret: "initial" });
    const selector = kind === "source" ? "#audit-library-host" : "main";
    const meta = await p.locator(selector).evaluate((el) => ({
      text: el.innerText,
      items: [
        ...el.querySelectorAll(
          '.widget,.rich-text,input,select,textarea,table,thead,tbody,tr,th,td,[class*="library"],h1,h2,h3,button',
        ),
      ]
        .filter((e) => e.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }))
        .map((e) => {
          const s = getComputedStyle(e);
          return {
            tag: e.tagName,
            cls: String(e.className),
            cid: e.getAttribute("data-cid"),
            text: (
              e.innerText ||
              e.getAttribute("aria-label") ||
              e.getAttribute("placeholder") ||
              ""
            ).slice(0, 400),
            rect: e.getBoundingClientRect().toJSON(),
            fontSize: s.fontSize,
            lineHeight: s.lineHeight,
            fontWeight: s.fontWeight,
            color: s.color,
            background: s.background,
            backgroundImage: s.backgroundImage,
            border: s.border,
            borderRadius: s.borderRadius,
            padding: s.padding,
            gap: s.gap,
          };
        }),
      icons: [...el.querySelectorAll(".wIcon,.wButton:has(svg)")].map((e) => {
        const svg = e.querySelector("svg");
        return {
          cid: e.getAttribute("data-cid"),
          rect: e.getBoundingClientRect().toJSON(),
          html: e.innerHTML,
          svg: svg?.outerHTML,
          color: getComputedStyle(e).color,
          svgColor: svg ? getComputedStyle(svg).color : null,
          svgFill: svg ? getComputedStyle(svg).fill : null,
          svgStroke: svg ? getComputedStyle(svg).stroke : null,
          paths: svg
            ? [...svg.querySelectorAll("path,line,polyline,rect,circle")].map((a) => ({
                tag: a.tagName,
                d: a.getAttribute("d"),
                stroke: getComputedStyle(a).stroke,
                fill: getComputedStyle(a).fill,
                strokeWidth: getComputedStyle(a).strokeWidth,
              }))
            : [],
        };
      }),
      images: [...el.querySelectorAll("img")].map((e) => ({
        src: e.src,
        rect: e.getBoundingClientRect().toJSON(),
      })),
    }));
    await fs.writeFile(path.join(out, kind + "-geometry.json"), JSON.stringify(meta, null, 2));
    await p.addStyleTag({
      content:
        '*,*::before,*::after{font-family:"Noto Sans CJK SC",sans-serif!important;animation:none!important;transition:none!important}',
    });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(out, kind + ".png"), caret: "initial" });
    r.itemCount = meta.items.length;
    r.iconCount = meta.icons.length;
    console.log(
      "CAPTURED " + kind + " " + r.itemCount + " widgets / " + r.iconCount + " inline icons",
    );
  } catch (e) {
    r.error = String(e);
    process.exitCode = 1;
  } finally {
    report.results.push(r);
    await c.close();
  }
}
await b.close();
await fs.writeFile(path.join(out, "capture-report.json"), JSON.stringify(report, null, 2));
if (report.results.some((r) => r.pageErrors.length)) process.exitCode = 1;
