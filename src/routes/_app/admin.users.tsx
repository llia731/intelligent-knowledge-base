import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NeedPerm } from "@/components/app-shell";
import { useKb } from "@/lib/kb/store";

export const Route = createFileRoute("/_app/admin/users")({
  component: () => <NeedPerm perm="用户管理"><UsersPage /></NeedPerm>,
});

function statusOf(user: { enabled: boolean; lastLogin: string }) {
  if (user.enabled) return "启用";
  if (user.lastLogin === "—") return "待验证";
  return "禁用";
}

function UsersPage() {
  const users = useKb((s) => s.users);
  const addUser = useKb((s) => s.addUser);
  const toggleUser = useKb((s) => s.toggleUser);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("全部角色");
  const [state, setState] = useState("全部状态");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dept, setDept] = useState("产品部");
  const [editing, setEditing] = useState<string | null>(null);
  const roles = ["全部角色", ...new Set(users.map((user) => user.roleLabel))];
  const rows = users.filter((user) => {
    const blob = `${user.name}${user.email}${user.dept}${user.roleLabel}`;
    if (q && !blob.toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (role !== "全部角色" && user.roleLabel !== role) return false;
    if (state !== "全部状态" && statusOf(user) !== state) return false;
    return true;
  });

  return (
    <div>
      <div className="head-row">
        <div>
          <h1 className="page-h">用户管理</h1>
          <p className="page-sub">管理系统用户账号、角色分配与启用状态</p>
        </div>
        <button type="button" className="btn" onClick={() => setOpen(true)}>新增用户</button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="field max-w-xs" placeholder="搜索用户" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" style={{ width: 160 }} value={role} onChange={(e) => setRole(e.target.value)} aria-label="全部角色">
          {roles.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="select" style={{ width: 140 }} value={state} onChange={(e) => setState(e.target.value)} aria-label="全部状态">
          {["全部状态", "启用", "待验证", "禁用"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      <section className="card overflow-auto">
        <table className="table">
          <thead>
            <tr><th>用户</th><th>角色</th><th>部门</th><th>最近登录</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="avatar">{user.name.slice(0, 1)}</span>
                    <span>
                      <span className="block font-medium">{user.name}</span>
                      <span className="block text-xs text-[var(--m-sub)]">{user.email}</span>
                    </span>
                  </div>
                </td>
                <td>{user.roleLabel}</td>
                <td>{user.dept}</td>
                <td>{user.lastLogin}</td>
                <td><span className={statusOf(user) === "启用" ? "tag green" : statusOf(user) === "待验证" ? "tag orange" : "tag"}>{statusOf(user)}</span></td>
                <td className="space-x-2">
                  <button type="button" className="text-sm text-[var(--m-blue)]" onClick={() => setEditing(user.id)}>编辑</button>
                  <button type="button" className="text-sm text-[var(--m-blue)]" onClick={() => toggleUser(user.id)}>{user.enabled ? "禁用" : "启用"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pager px-3 pb-3"><span>共 {rows.length} 条，第 1/1 页</span></div>
      </section>
      <p className="note mt-2">这些账号只存在于本地演示数据，不能登录，也不代替服务端鉴权。</p>

      {open ? (
        <div className="overlay" onClick={() => setOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            addUser({ name: name.trim(), email: email.trim(), dept: dept.trim() || "产品部" });
            setOpen(false);
            setName("");
            setEmail("");
          }}>
            <h2 className="text-lg font-semibold">新增用户</h2>
            <label className="mt-3 block text-sm">姓名<input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="mt-3 block text-sm">邮箱<input className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></label>
            <label className="mt-3 block text-sm">部门<input className="field mt-1" value={dept} onChange={(e) => setDept(e.target.value)} /></label>
            <p className="note mt-2">新用户的角色标签固定为普通用户。页面权限请到角色权限调整。</p>
            <div className="mt-4 flex gap-2">
              <button className="btn" type="submit">创建</button>
              <button className="btn ghost" type="button" onClick={() => setOpen(false)}>取消</button>
            </div>
          </form>
        </div>
      ) : null}
      {editing ? (
        <div className="overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">编辑用户</h2>
            <p className="page-sub">当前演示数据没有单独的资料编辑接口。可以在这里切换启用状态。</p>
            <button type="button" className="btn mt-4" onClick={() => { toggleUser(editing); setEditing(null); }}>切换启用状态</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
