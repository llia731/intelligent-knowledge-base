import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NeedPerm } from "@/components/app-shell";
import { ACCESS_ROLES, type AccessRole } from "@/lib/kb/access";
import { collectionNames } from "@/lib/kb/collections";
import { useKb } from "@/lib/kb/store";

export const Route = createFileRoute("/_app/permissions")({ component: Page });

const CARDS: { role: string; desc: string }[] = [
  { role: "管理员", desc: "全站配置、用户与角色管理、审计查看" },
  { role: "知识库 Owner", desc: "负责单一知识库权限分配与内容治理" },
  { role: "编辑者", desc: "可上传、编辑与提交审核" },
  { role: "读者", desc: "可检索与问答，不能改文档" },
  { role: "访客", desc: "仅可查看已公开内容" },
];

function Page() {
  return (
    <NeedPerm perm="权限设置">
      <PermBody />
    </NeedPerm>
  );
}

function PermBody() {
  const users = useKb((s) => s.users);
  const docs = useKb((s) => s.docs);
  const collections = useKb((s) => s.collections);
  const acl = useKb((s) => s.acl);
  const setAcl = useKb((s) => s.setAcl);
  const names = collectionNames(docs, collections);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  function toggle(collection: string, role: AccessRole) {
    const current = acl[collection] ?? [];
    const next = current.includes(role) ? current.filter((item) => item !== role) : [...current, role];
    setAcl(collection, next);
  }

  return (
    <div>
      <div className="head-row">
        <div>
          <h1 className="page-h">权限设置</h1>
          <p className="page-sub">基于 RBAC 的知识库访问控制与安全防护</p>
        </div>
        <button type="button" className="btn" onClick={() => setOpen(true)}>新增角色</button>
      </div>
      <section className="card p-4">
        <h2 className="text-base font-semibold">角色管理</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {CARDS.map((card) => (
            <article key={card.role} className="rounded-xl border border-[var(--m-line)] p-3">
              <h3 className="text-sm font-semibold">{card.role}</h3>
              <p className="mt-2 text-xs leading-5 text-[var(--m-sub)]">{card.desc}</p>
            </article>
          ))}
        </div>
        <p className="note mt-3">卡片文案来自原型。真正生效的是下方知识库矩阵，以及后台「角色权限」里的页面开关。空的知识库勾选表示不额外限制。</p>
      </section>

      <section className="card mt-4 overflow-auto p-4">
        <h2 className="mb-3 text-base font-semibold">知识库访问矩阵</h2>
        <table className="table">
          <thead>
            <tr>
              <th>知识库</th>
              {ACCESS_ROLES.map((role) => <th key={role}>{role}</th>)}
            </tr>
          </thead>
          <tbody>
            {names.map((name) => (
              <tr key={name}>
                <td className="font-medium">{name}</td>
                {ACCESS_ROLES.map((role) => (
                  <td key={role}>
                    <input
                      type="checkbox"
                      aria-label={`${name} ${role}`}
                      checked={(acl[name] ?? []).includes(role)}
                      onChange={() => toggle(name, role)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card mt-4 overflow-auto p-4">
        <h2 className="mb-3 text-base font-semibold">成员</h2>
        <table className="table">
          <thead><tr><th>姓名</th><th>邮箱</th><th>部门</th><th>角色标签</th><th>状态</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.dept}</td>
                <td>{user.roleLabel}</td>
                <td>{user.enabled ? "启用" : user.lastLogin === "—" ? "待验证" : "禁用"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {open ? (
        <div className="overlay" onClick={() => setOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(event) => { event.preventDefault(); setOpen(false); setNote("自定义角色不会写入鉴权。请在现有五种演示角色上调整矩阵。"); }}>
            <h2 className="text-lg font-semibold">新增角色</h2>
            <p className="page-sub">原型提供了新增入口。当前权限模型固定为五种演示角色，不能在浏览器里发明一种绕过服务端的新角色。</p>
            <input className="field mt-3" placeholder="角色名称（仅作说明，不会保存为新权限）" />
            <div className="mt-4 flex gap-2">
              <button className="btn" type="submit">知道了</button>
              <button className="btn ghost" type="button" onClick={() => setOpen(false)}>取消</button>
            </div>
          </form>
        </div>
      ) : null}
      {note ? <p className="note mt-3">{note}</p> : null}
    </div>
  );
}
