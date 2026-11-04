import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageTitle, Panel, NeedPerm } from "@/components/app-shell";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";
import { formatTime } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin/review")({
  component: ReviewPage,
});

function ReviewPage() {
  const reviews = useKb((s) => s.reviews);
  const resolveReview = useKb((s) => s.resolveReview);
  const docs = useKb((s) => s.docs);
  const can = useCan();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!can("内容审核")) return <NeedPerm perm="内容审核">{null}</NeedPerm>;

  return (
    <div>
      <PageTitle kicker="治理" title="内容审核">
        <p className="max-w-md text-sm text-muted">通过后文档进入索引，可以被检索和问答引用；驳回后不再召回。</p>
      </PageTitle>
      {(() => {
        const current = reviews.find((item) => item.id === openId) ?? null;
        const doc = docs.find((item) => item.id === current?.docId);
        if (!current) return null;
        return (
          <Panel className="mb-4 p-4">
            <p className="text-xs tracking-widest text-copper">审核详情</p>
            <h2 className="mt-1 font-medium">{current.title}</h2>
            <p className="mt-2 text-sm text-muted">{current.reason}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{doc?.content ?? "这条反馈没有关联原文。"}</p>
          </Panel>
        );
      })()}
      <div className="grid gap-3">
        {reviews.map((item) => (
          <Panel key={item.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">{item.title}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">{item.reason}</p>
                <button type="button" className="mt-2 min-h-10 text-sm text-teal" onClick={() => setOpenId(item.id)}>
                  查看原文
                </button>
                <p className="mt-2 text-xs text-muted">{formatTime(item.createdAt)}</p>
              </div>
              {item.status === "open" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => resolveReview(item.id, true)}
                    className="min-h-11 rounded-md bg-teal px-4 text-sm text-teal-fg"
                  >
                    通过
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveReview(item.id, false)}
                    className="min-h-11 rounded-md border border-line px-4 text-sm"
                  >
                    驳回
                  </button>
                </div>
              ) : (
                <span className="text-sm text-muted">{item.status === "passed" ? "已通过" : "已驳回"}</span>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
