#!/usr/bin/env node
/** Real Modao /search capture and inline SVG extraction; reuse existing local servers. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
const out = path.resolve(process.env.IKB_SEARCH_OUTPUT || "artifacts/modao-v1/pr16-visual");
const mode = process.env.IKB_SEARCH_CAPTURE_MODE || "both";
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
    await p.goto(kind === "source" ? source : new URL("/search", react).href, {
      waitUntil: "networkidle",
    });
    if (kind === "source") {
      await p.getByText("总览", { exact: true }).last().click();
      await p
        .locator(".rn-list-item.page")
        .filter({ has: p.locator(".editable-span").getByText("智能检索", { exact: true }) })
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
        host.id = "audit-search-host";
        host.style.cssText =
          "position:fixed;inset:0;z-index:2147483647;width:1920px;height:1080px;overflow:hidden;background:white";
        const copy = area.cloneNode(true);
        copy.style.cssText =
          "position:relative;left:0;top:0;transform:none;width:1920px;height:1080px";
        host.append(copy);
        document.body.append(host);
      });
    } else {
      await p.locator(".shell[data-app-ready=true]").waitFor();
      if (process.env.IKB_SEARCH_FIXTURE === "live9") {
        await p.evaluate(() => {
          const stored = JSON.parse(localStorage.getItem("zhishi-kb-v1"));
          stored.state.collections = ["产品知识库", "技术文档库", "客户档案库", "法规标准库"];
          stored.state.docs = Array.from({ length: 9 }, (_, i) => ({
            id: `visual-search-${i + 1}`,
            title: `本地检索验收文档 ${String(i + 1).padStart(2, "0")}.pdf`,
            collection: i % 2 ? "产品知识库" : "技术文档库",
            content: `SearchEvidence 本地合成检索正文 ${i + 1}，仅用于浏览器验收。`,
            status: "indexed",
            sensitivity: "public",
            owner: "合成验收作者",
            updatedAt: `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
            chunks: [
              {
                id: `visual-chunk-${i}`,
                index: 0,
                text: `SearchEvidence 本地合成摘要 ${i + 1}，不是生产文档。`,
              },
            ],
            shareNote: "",
          }));
          localStorage.setItem("zhishi-kb-v1", JSON.stringify(stored));
        });
        await p.reload({ waitUntil: "networkidle" });
        await p.locator(".shell[data-app-ready=true]").waitFor();
        await p.getByLabel("检索关键词", { exact: true }).fill("SearchEvidence");
        await p.getByRole("button", { name: "检索", exact: true }).click();
        await p.getByLabel("相关度未计算", { exact: true }).first().waitFor();
        const targetPage = Number(process.env.IKB_SEARCH_PAGE || 1);
        for (let i = 1; i < targetPage; i++)
          await p.getByRole("button", { name: "下一页", exact: true }).click();
        if (await p.getByRole("button", { name: "关闭提示", exact: true }).count())
          await p.getByRole("button", { name: "关闭提示", exact: true }).click();
        await p.evaluate(() => window.scrollTo(0, 0));
        r.fixture = `9 synthetic local records; actual keyword search and pagination; page ${targetPage}; no scores/services mocked`;
      }
    }
    await p.screenshot({ path: path.join(out, kind + "-native.png"), caret: "initial" });
    const selector = kind === "source" ? "#audit-search-host" : "main";
    const meta = await p.locator(selector).evaluate((el) => ({
      text: el.innerText,
      items: [
        ...el.querySelectorAll(
          '.widget,.rich-text,input,select,textarea,article,section,aside,table,thead,tbody,tr,th,td,[class*="search"],h1,h2,h3,button',
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
            fontFamily: s.fontFamily,
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
            checked: "checked" in e ? e.checked : null,
            disabled: "disabled" in e ? e.disabled : null,
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
    if (kind === "source") {
      const clipping = await p.locator('#audit-search-host').evaluate(el => [...el.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>1200&&r.height>600&&[s.overflow,s.overflowX,s.overflowY].some(x=>['hidden','clip','auto','scroll'].includes(x))}).map(e=>({tag:e.tagName,cls:String(e.className),cid:e.getAttribute('data-cid'),rect:e.getBoundingClientRect().toJSON(),overflow:getComputedStyle(e).overflow,html:e.outerHTML.slice(0,300)})));
      await fs.writeFile(path.join(out,'clipping-probe.json'),JSON.stringify(clipping,null,2));
      await p.evaluate(() => {
        const host = document.querySelector("#audit-search-host"),
          copy = host.firstElementChild;
        // Supplemental canvas: reveal only large runtime clipping containers.
        // Widget dimensions and coordinates must remain unchanged.
        const nodes = [...host.querySelectorAll('[data-cid]')];
        const before = nodes.map(e => e.getBoundingClientRect().toJSON());
        const adjusted = [];
        for (const e of host.querySelectorAll('*')) {
          const rect = e.getBoundingClientRect(), style = getComputedStyle(e);
          if (rect.width >= 1280 && rect.height >= 990 &&
              [style.overflowX, style.overflowY].some(v => ['hidden','clip','auto','scroll'].includes(v))) {
            adjusted.push({className:String(e.className),cid:e.getAttribute('data-cid'),rect:rect.toJSON(),overflow:style.overflow});
            e.style.setProperty('overflow','visible','important');
          }
        }
        const after = nodes.map(e => e.getBoundingClientRect().toJSON());
        if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Overflow capture changed widget geometry');
        window.__sourceOverflowAudit = {adjusted,widgetCount:nodes.length,widgetGeometryUnchanged:true,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},note:'Supplemental unclipped source DOM canvas; original 1920x1080 frames were saved before these capture-only changes.'};
        host.style.position = "absolute";
        host.style.height = "1324px";
        copy.style.height = "1324px";
        document.documentElement.style.setProperty("overflow", "visible", "important");
        document.body.style.setProperty("overflow", "visible", "important");
        document.body.style.minHeight = "1324px";
      });
      await fs.writeFile(path.join(out, 'source-overflow-audit.json'), JSON.stringify(await p.evaluate(() => window.__sourceOverflowAudit), null, 2));
      await p.screenshot({
        path: path.join(out, "source-full.png"),
        fullPage: true,
        caret: "initial",
      });
    } else {
      await p.screenshot({
        path: path.join(out, "react-full.png"),
        fullPage: true,
        caret: "initial",
      });
    }
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
