import { createFileRoute, Link } from "@tanstack/react-router";
import { FilePlus2, KeyRound, Shield, UserPlus } from "lucide-react";
import { NeedPerm } from "@/components/app-shell";
import { useKb } from "@/lib/kb/store";

export const Route = createFileRoute("/_app/admin/")({
  component: () => (
    <NeedPerm perm="总览仪表盘">
      <Dashboard />
    </NeedPerm>
  ),
});

const STATS = [
  { label: "注册用户", value: "2,458", delta: "+128 本周新增" },
  { label: "知识库文档", value: "12,846", delta: "+342 今日新增" },
  { label: "API 调用", value: "892,341", delta: "+13% 较昨日" },
  { label: "待审核内容", value: "18", delta: "需要尽快处理" },
];

const QUICK = [
  { to: "/admin/users", title: "新增用户", desc: "创建后台账号并分配角色", icon: UserPlus },
  { to: "/admin/config", title: "新增知识源", desc: "接入文档或网页来源", icon: FilePlus2 },
  { to: "/admin/review", title: "内容审核", desc: "处理待审内容与反馈", icon: Shield },
  { to: "/admin/keys", title: "创建 API 密钥", desc: "为第三方应用分配权限", icon: KeyRound },
] as const;

const FEED = [
  { title: "新用户注册", desc: "产品部 王雅婷 已完成邮箱验证并加入「内容运营」角色", time: "2 分钟前" },
  { title: "知识库同步完成", desc: "产品帮助中心 来源同步成功，新增 24 篇文档，索引耗时 5 分 12 秒", time: "25 分钟前" },
  { title: "审核提醒", desc: "用户提交的回答因敏感被标记为「政治敏感」，等待人工复核", time: "1 小时前" },
  { title: "安全告警", desc: "API 密钥 ak-7f3a… 在短时间内触发 403 异常 23 次", time: "3 小时前" },
];

function Dashboard() {
  const logs = useKb((s) => s.logs);
  const reviews = useKb((s) => s.reviews);
  const openReviews = reviews.filter((item) => item.status === "open").length;
  return (
    <div>
      <h1 className="page-h">总览仪表盘</h1>
      <p className="page-sub">实时掌握系统运行状态与用户活跃情况</p>
      <div className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {STATS.map((item, index) => (
          <article key={item.label} className="stat" title="原型示例指标">
            <p className="k">{item.label}</p>
            <p className="v">{index === 3 ? String(openReviews) : item.value}</p>
            <p className="d">{index === 3 ? `本地待审 ${openReviews} 条` : item.delta}</p>
          </article>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_320px]">
        <section className="card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">近 7 日活跃趋势</h2>
            <span className="tag">最近 7 天</span>
          </div>
          <div className="flex h-48 items-end gap-3 px-2">
            {[42, 55, 48, 70, 63, 80, 74].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-md bg-[#dbe7ff]" style={{ height: `${h}%` }} />
                <span className="text-xs text-[var(--m-faint)]">{["周一", "周二", "周三", "周四", "周五", "周六", "周日"][i]}</span>
              </div>
            ))}
          </div>
          <p className="note mt-2">趋势柱为原型示意，没有接入统计服务。</p>
        </section>
        <section className="card p-4">
          <h2 className="text-sm font-semibold">快捷操作</h2>
          <div className="mt-3 space-y-2">
            {QUICK.map((item) => (
              <Link key={item.to} to={item.to} className="flex gap-3 rounded-xl bg-[var(--m-paper)] px-3 py-3">
                <item.icon size={16} className="mt-0.5 text-[var(--m-blue)]" />
                <span>
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="block text-xs text-[var(--m-sub)]">{item.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <section className="card mt-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">最近动态</h2>
          <Link to="/admin/logs" className="text-xs text-[var(--m-blue)]">查看全部</Link>
        </div>
        <ul className="space-y-3">
          {FEED.map((item) => (
            <li key={item.title}>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-[var(--m-sub)]">{item.desc}</p>
              <p className="text-xs text-[var(--m-faint)]">{item.time}</p>
            </li>
          ))}
          {logs.slice(0, 3).map((item) => (
            <li key={item.id}>
              <p className="text-sm font-medium">{item.action}</p>
              <p className="text-xs text-[var(--m-sub)]">{item.actor} · {item.target} · {item.result}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
