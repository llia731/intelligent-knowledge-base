import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NeedPerm } from "@/components/app-shell";
import { useKb } from "@/lib/kb/store";

export const Route = createFileRoute("/_app/admin/review")({
  component: () => <NeedPerm perm="内容审核"><ReviewPage /></NeedPerm>,
});

const SAMPLES = [
  { tag: "政治敏感", who: "提交人：匿名用户 · 2 小时前", title: "请问如何评价当前国际形势下的技术封锁政策？", body: "AI 回答：技术封锁政策对全球供应链产生了深远影响，各国都在积极推动自主可控的技术发展战略……" },
  { tag: "侵权投诉", who: "提交人：陈志强 · 3 小时前", title: "回答中引用了某厂商未公开的技术白皮书内容", body: "用户反馈该回答包含受版权保护的材料，要求删除相关引用并限制后续回答……" },
  { tag: "低质回答", who: "提交人：王雅婷 · 5 小时前", title: "回答过于简略，没有给出可执行步骤", body: "用户询问如何配置知识库权限，但回答只提供了入口路径，缺少截图与分步说明……" },
  { tag: "虚假信息", who: "提交人：系统自动标记 · 6 小时前", title: "回答中关于产品价格的信息与官网不一致", body: "系统检测到回答中的价格数据与知识库最新版本存在差异，置信度 0.42……" },
];

function ReviewPage() {
  const reviews = useKb((s) => s.reviews);
  const docs = useKb((s) => s.docs);
  const resolveReview = useKb((s) => s.resolveReview);
  const [tab, setTab] = useState<"待审核" | "已通过" | "已拒绝">("待审核");
  const [risk, setRisk] = useState("全部风险");
  const [picked, setPicked] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const map = { 待审核: "open", 已通过: "passed", 已拒绝: "rejected" } as const;
  const rows = reviews.filter((item) => item.status === map[tab]);
  const counts = {
    待审核: reviews.filter((item) => item.status === "open").length,
    已通过: reviews.filter((item) => item.status === "passed").length,
    已拒绝: reviews.filter((item) => item.status === "rejected").length,
  };

  function act(ids: string[], pass: boolean) {
    ids.forEach((id) => resolveReview(id, pass));
    setPicked([]);
  }

  return (
    <div>
      <h1 className="page-h">内容审核</h1>
      <p className="page-sub">审查用户提交内容与 AI 生成回答的合规性</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["待审核", "已通过", "已拒绝"] as const).map((item) => (
          <button key={item} type="button" className={tab === item ? "btn" : "btn ghost"} onClick={() => setTab(item)}>
            {item} {counts[item]}
          </button>
        ))}
        <span className="note">原型示意计数为 18 / 342 / 56，上面数字是本地审核单。</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <select className="select" style={{ width: 140 }} value={risk} onChange={(e) => setRisk(e.target.value)} aria-label="风险">
          {["全部风险", "政治敏感", "侵权投诉", "低质回答", "虚假信息"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <button type="button" className="btn ghost" disabled={!picked.length} onClick={() => act(picked, true)}>批量通过</button>
        <button type="button" className="btn ghost" disabled={!picked.length} onClick={() => act(picked, false)}>批量拒绝</button>
      </div>
      <div className="mt-3 space-y-3">
        {rows.map((item) => {
          const doc = docs.find((entry) => entry.id === item.docId);
          return (
            <article key={item.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <label className="mr-2 text-xs"><input type="checkbox" checked={picked.includes(item.id)} onChange={() => setPicked((list) => list.includes(item.id) ? list.filter((id) => id !== item.id) : [...list, item.id])} /> 选择</label>
                  <span className={item.status === "open" ? "tag red" : "tag"}>{item.status === "open" ? "待处理" : item.status === "passed" ? "已通过" : "已拒绝"}</span>
                  <h3 className="mt-2 text-sm font-medium">{item.title}</h3>
                  <p className="text-xs text-[var(--m-sub)]">{item.status === "open" ? item.reason : `原审核原因：${item.reason}`}</p>
                </div>
                {tab === "待审核" ? (
                  <div className="flex gap-2">
                    <button type="button" className="btn" onClick={() => resolveReview(item.id, true)}>通过</button>
                    <button type="button" className="btn ghost" onClick={() => resolveReview(item.id, false)}>拒绝</button>
                  </div>
                 ) : null}
              </div>
              <button type="button" className="mt-2 text-xs text-[var(--m-blue)]" onClick={() => setOpenId(openId === item.id ? null : item.id)}>查看原文</button>
              {openId === item.id ? <p className="mt-2 whitespace-pre-wrap text-sm">{doc?.content || "这条反馈没有关联原文。"}</p> : null}
            </article>
          );
        })}
        {tab === "待审核" ? SAMPLES.filter((item) => risk === "全部风险" || item.tag === risk).map((item) => (
          <article key={item.title} className="card p-4 opacity-80">
            <span className="tag red">{item.tag}</span>
            <span className="ml-2 text-xs text-[var(--m-sub)]">{item.who}</span>
            <h3 className="mt-2 text-sm font-medium">{item.title}</h3>
            <p className="text-xs text-[var(--m-sub)]">{item.body}</p>
            <p className="note mt-2">原型示例，通过 / 拒绝不会改变审核单。</p>
          </article>
        )) : null}
      </div>
      <section className="card mt-4 p-4">
        <h2 className="text-sm font-semibold">自动审核规则</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["敏感词拦截", "命中敏感词库的内容自动进入人工复核"],
            ["版权比对", "与受保护文档相似度超过阈值则标记"],
            ["事实核查", "结构化数据与知识库版本交叉验证"],
            ["低质过滤", "答案过短、无来源引用时触发复审"],
          ].map(([title, desc]) => (
            <article key={title} className="rounded-xl bg-[var(--m-paper)] p-3">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-[var(--m-sub)]">{desc}</p>
            </article>
          ))}
        </div>
        <p className="note mt-2">规则卡片是原型说明。实际上传只会拦截身份证号、薪资明细、机密字样和受限密级。</p>
      </section>
    </div>
  );
}
