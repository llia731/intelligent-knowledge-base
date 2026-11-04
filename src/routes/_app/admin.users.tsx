import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageTitle, NeedPerm } from "@/components/app-shell";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";

export const Route = createFileRoute("/_app/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const users = useKb((s) => s.users);
  const toggleUser = useKb((s) => s.toggleUser);
  const addUser = useKb((s) => s.addUser);
  const can = useCan();
  const [keyword, setKeyword] = useState("");
  const [draft, setDraft] = useState({ name: "", email: "", dept: "产品部" });
  if (!can("用户管理")) return <NeedPerm perm="用户管理">{null}</NeedPerm>;

  return (
    <div>
      <PageTitle kicker="账号" title="用户管理">
        <p className="max-w-sm text-sm text-muted">停用后该账号只保留在名单里。新增用户会写入审计日志。</p>
      </PageTitle>
      <form
        className="mb-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.name.trim()) return;
          addUser(draft);
          setDraft({ name: "", email: "", dept: "产品部" });
        }}
      >
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索用户名、邮箱、部门..." className="min-h-11 flex-1 rounded-md border border-line bg-card px-3 text-sm" />
        <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="新增用户姓名" className="min-h-11 rounded-md border border-line bg-card px-3 text-sm" />
        <button type="submit" className="min-h-11 rounded-md bg-teal px-4 text-sm text-teal-fg">新增用户</button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">用户</th>
              <th className="px-4 py-3 font-medium">部门</th>
              <th className="px-4 py-3 font-medium">角色</th>
              <th className="px-4 py-3 font-medium">最后登录</th>
              <th className="px-4 py-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {users
              .filter((user) => `${user.name}${user.email}${user.dept}${user.roleLabel}`.includes(keyword.trim()))
              .map((user) => (
              <tr key={user.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-muted">{user.email}</p>
                </td>
                <td className="px-4 py-3">{user.dept}</td>
                <td className="px-4 py-3">{user.roleLabel}</td>
                <td className="px-4 py-3 tabular-nums">{user.lastLogin}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleUser(user.id)}
                    className="min-h-10 rounded-md border border-line px-3 text-sm"
                  >
                    {user.enabled ? "启用" : "禁用"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
