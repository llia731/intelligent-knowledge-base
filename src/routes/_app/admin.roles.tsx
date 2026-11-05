import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NeedPerm } from "@/components/app-shell";
import { ACCESS_ROLES, type AccessRole, type Perm } from "@/lib/kb/access";
import { useKb } from "@/lib/kb/store";

export const Route = createFileRoute("/_app/admin/roles")({
  component: () => <NeedPerm perm="角色权限"><RolesPage /></NeedPerm>,
});

const MODULES: { label: string; perm: Perm }[] = [
  { label: "用户管理", perm: "用户管理" },
  { label: "角色权限", perm: "角色权限" },
  { label: "知识库配置", perm: "知识库配置" },
  { label: "内容审核", perm: "内容审核" },
  { label: "系统日志", perm: "系统日志" },
  { label: "API 密钥", perm: "API密钥" },
  { label: "受限知识", perm: "受限知识" },
];

const COUNTS: Record<string, string> = {
  系统管理员: "3 人",
  知识库管理员: "8 人",
  内容审核员: "5 人",
  开发者: "12 人",
  普通用户: "2,430 人",
};

function RolesPage() {
  const grants = useKb((s) => s.grants);
  const setGrants = useKb((s) => s.setGrants);
  const [role, setRole] = useState<AccessRole>("系统管理员");
  const [extra, setExtra] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState("");

  function toggleView(perm: Perm) {
    const current = grants[role] ?? [];
    const next = current.includes(perm) ? current.filter((item) => item !== perm) : [...current, perm];
    setGrants(role, next);
  }

  return (
    <div>
      <h1 className="page-h">角色权限</h1>
      <p className="page-sub">配置角色组与细粒度功能权限矩阵</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">角色列表</h2>
            <span className="text-xs text-[var(--m-faint)]">人数为原型示例</span>
          </div>
          <ul className="space-y-2">
            {ACCESS_ROLES.map((item) => (
              <li key={item}>
                <button type="button" className={`w-full rounded-xl px-3 py-2 text-left ${role === item ? "bg-[var(--m-paper)]" : ""}`} onClick={() => setRole(item)}>
                  <span className="block text-sm font-semibold">{item === "开发者" ? "API 开发者" : item}</span>
                  <span className="text-xs text-[var(--m-sub)]">{COUNTS[item]}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">权限矩阵：{role === "开发者" ? "API 开发者" : role}</h2>
              <p className="text-xs text-[var(--m-sub)]">「查看」立即写入演示权限。新增 / 编辑 / 删除 / 导出只保存在本页，不代表服务端鉴权。</p>
            </div>
            <button type="button" className="btn" onClick={() => setSaved("查看列已即时生效。其余列只留在当前页面。")}>保存权限</button>
          </div>
          {saved ? <p className="note mb-2">{saved}</p> : null}
          <div className="overflow-auto">
            <table className="table">
              <thead>
                <tr><th>功能模块</th><th>查看</th><th>新增</th><th>编辑</th><th>删除</th><th>导出</th></tr>
              </thead>
              <tbody>
                {MODULES.map((mod) => (
                  <tr key={mod.perm}>
                    <td>{mod.label}</td>
                    {["查看", "新增", "编辑", "删除", "导出"].map((col) => {
                      const key = `${role}:${mod.perm}:${col}`;
                      const checked = col === "查看" ? (grants[role] ?? []).includes(mod.perm) : Boolean(extra[key]);
                      return (
                        <td key={col}>
                          <input
                            type="checkbox"
                            aria-label={`${role} ${mod.label} ${col}`}
                            checked={checked}
                            onChange={() => {
                              if (col === "查看") toggleView(mod.perm);
                              else setExtra((map) => ({ ...map, [key]: !map[key] }));
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section className="card mt-4 p-4">
        <h2 className="text-sm font-semibold">数据范围说明</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["全部数据", "系统管理员、安全审计员"],
            ["所在部门", "知识库管理员、内容审核员"],
            ["仅个人数据", "API 开发者、普通用户"],
            ["自定义范围", "可指定知识库集合"],
          ].map(([title, desc]) => (
            <article key={title} className="rounded-xl bg-[var(--m-paper)] p-3">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-[var(--m-sub)]">{desc}</p>
            </article>
          ))}
        </div>
        <p className="note mt-2">数据范围说明来自原型，当前检索只执行知识库 ACL 和「受限知识」权限。</p>
      </section>
    </div>
  );
}
