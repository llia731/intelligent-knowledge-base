import { createFileRoute } from "@tanstack/react-router";
import { PageTitle, Panel, NeedPerm } from "@/components/app-shell";
import { ACCESS_ROLES, ALL_PERMS, type AccessRole, type Perm } from "@/lib/kb/access";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";

export const Route = createFileRoute("/_app/admin/roles")({
  component: RolesPage,
});

const ROLE_DESC: Record<AccessRole, string> = {
  普通用户: "检索、问答、上传和查看自己的审计记录",
  内容审核员: "复核敏感内容，可召回受限知识",
  知识库管理员: "知识库、分块策略、审核与权限矩阵",
  开发者: "管理接入密钥，并使用检索和问答",
  系统管理员: "全部后台能力",
};

function RolesPage() {
  const grants = useKb((s) => s.grants);
  const setGrants = useKb((s) => s.setGrants);
  const can = useCan();
  if (!can("角色权限")) return <NeedPerm perm="角色权限">{null}</NeedPerm>;

  return (
    <div>
      <PageTitle kicker="RBAC" title="角色权限">
        <p className="max-w-md text-sm text-muted">勾选会立刻改变左下角对应角色能进入的页面，以及能否召回受限知识。</p>
      </PageTitle>
      <div className="grid gap-3">
        {ACCESS_ROLES.map((role) => (
          <Panel key={role} className="p-4">
            <h2 className="font-medium">{role}</h2>
            <p className="mt-1 text-sm text-muted">{ROLE_DESC[role]}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ALL_PERMS.map((perm) => {
                const on = (grants[role] ?? []).includes(perm);
                return (
                  <button
                    key={perm}
                    type="button"
                    onClick={() => {
                      const list = grants[role] ?? [];
                      const next = on ? list.filter((item) => item !== perm) : [...list, perm];
                      setGrants(role, next as Perm[]);
                    }}
                    className={
                      on
                        ? "min-h-10 rounded-md bg-teal px-3 text-sm text-teal-fg"
                        : "min-h-10 rounded-md border border-line px-3 text-sm text-muted"
                    }
                  >
                    {perm}
                  </button>
                );
              })}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
