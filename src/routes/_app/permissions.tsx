import { createFileRoute } from "@tanstack/react-router";
import { PageTitle, Panel, NeedPerm } from "@/components/app-shell";
import { ACCESS_ROLES, type AccessRole } from "@/lib/kb/access";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";

export const Route = createFileRoute("/_app/permissions")({
  component: PermissionsPage,
});

function PermissionsPage() {
  const users = useKb((s) => s.users);
  const docs = useKb((s) => s.docs);
  const collections = useKb((s) => s.collections);
  const acl = useKb((s) => s.acl);
  const setAcl = useKb((s) => s.setAcl);
  const settings = useKb((s) => s.settings);
  const connections = useKb((s) => s.connections);
  const can = useCan();
  const names = [...new Set([...docs.map((doc) => doc.collection), ...collections])];
  const vector = connections.find((item) => item.kind === "向量数据库");
  if (!can("权限设置")) return <NeedPerm perm="权限设置">{null}</NeedPerm>;

  return (
    <div>
      <PageTitle kicker="安全" title="权限设置">
        <p className="max-w-md text-sm text-muted">矩阵留空表示不额外限制。一旦勾选角色，只有这些角色能检索该知识库。</p>
      </PageTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-4">
          <h2 className="text-sm font-medium">用户</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {users.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>
                  <span className="font-medium">{user.name}</span>
                  <span className="mt-1 block text-xs text-muted">{user.email} · {user.dept}</span>
                </span>
                <span className={user.enabled ? "text-xs text-ok" : "text-xs text-copper"}>{user.enabled ? "启用" : "已停用"} · {user.roleLabel}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="overflow-x-auto p-4">
          <h2 className="text-sm font-medium">知识库可读角色</h2>
          <table className="mt-3 w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2 font-medium">知识库</th>
                {ACCESS_ROLES.map((role) => (
                  <th key={role} className="py-2 font-medium">{role.slice(0, 2)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {names.map((name) => (
                <tr key={name} className="border-t border-line">
                  <td className="py-2 pr-2">{name}</td>
                  {ACCESS_ROLES.map((role) => {
                    const readers = acl[name] ?? [];
                    const on = readers.includes(role);
                    return (
                      <td key={role} className="py-2">
                        <input
                          type="checkbox"
                          aria-label={`${name} ${role}`}
                          checked={on}
                          onChange={() => {
                            const next = on ? readers.filter((item) => item !== role) : [...readers, role];
                            setAcl(name, next as AccessRole[]);
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <h2 className="mb-3 mt-6 text-sm font-medium">正在生效的防护</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["敏感词扫描", "上传时检测身份证号、银行卡、机密和薪资明细，命中后进入审核。"],
          ["严格拒识", settings.strict ? "问答已开启严格模式，资料以外的制度细节不会被补全。" : "严格模式已关闭，仍要求事实来自资料。"],
          ["受限隔离", "没有「受限知识」权限的角色，检索和问答都拿不到受限文档。"],
          ["向量库", vector?.endpoint ? `已保存地址 ${vector.endpoint}，尚未接通。` : "未填写连接，检索使用本机关键词索引。"],
        ].map(([title, body]) => (
          <Panel key={title} className="p-4">
            <h3 className="font-medium">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
