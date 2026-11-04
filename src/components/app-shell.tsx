import { Link, useRouterState } from "@tanstack/react-router";
import {
  House,
  KeyRound,
  LayoutDashboard,
  Library,
  MessageSquare,
  Search,
  ScrollText,
  Settings2,
  Shield,
  ShieldCheck,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useKb } from "@/lib/kb/store";
import { ACCESS_ROLES } from "@/lib/kb/access";
import { useCan } from "@/lib/kb/use-can";
import { cn } from "@/lib/utils";

const USER_NAV = [
  { to: "/", label: "首页", icon: House },
  { to: "/upload", label: "知识上传", icon: Upload },
  { to: "/search", label: "智能检索", icon: Search },
  { to: "/ask", label: "AI问答", icon: MessageSquare },
  { to: "/library", label: "知识管理", icon: Library },
  { to: "/permissions", label: "权限设置", icon: Shield },
  { to: "/audit", label: "审计日志", icon: ScrollText },
] as const;

const ADMIN_NAV = [
  { to: "/admin", label: "总览仪表盘", icon: LayoutDashboard },
  { to: "/admin/users", label: "用户管理", icon: Users },
  { to: "/admin/roles", label: "角色权限", icon: ShieldCheck },
  { to: "/admin/config", label: "知识库配置", icon: Settings2 },
  { to: "/admin/review", label: "内容审核", icon: Shield },
  { to: "/admin/logs", label: "系统日志", icon: ScrollText },
  { to: "/admin/keys", label: "API密钥", icon: KeyRound },
] as const;

function NavLink({
  to,
  label,
  icon: Icon,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: typeof Search;
  onNavigate?: () => void;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const active = path === to;
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-teal text-teal-fg"
          : "text-sidebar-fg/90 hover:bg-white/10 hover:text-sidebar-fg",
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const accessRole = useKb((s) => s.accessRole);
  const setAccessRole = useKb((s) => s.setAccessRole);
  const profile = useKb((s) => s.profile);
  const saveProfile = useKb((s) => s.saveProfile);
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState(profile.name);
  const [dept, setDept] = useState(profile.dept);
  const userNav = USER_NAV.filter((item) => can(item.label));
  const adminNav = ADMIN_NAV.filter((item) => can(item.label));

  useEffect(() => {
    void useKb.persist.rehydrate();
  }, []);
  useEffect(() => {
    setName(profile.name);
    setDept(profile.dept);
  }, [profile.name, profile.dept]);

  const nav = (
    <div className="flex h-full min-h-0 flex-col px-3 py-5">
      <Link to="/" className="flex shrink-0 items-center gap-3 px-2" onClick={() => setOpen(false)}>
        <span className="grid size-9 place-items-center rounded-md bg-teal font-display text-lg text-teal-fg">
          知
        </span>
        <span>
          <span className="block font-display text-lg leading-none text-sidebar-fg">智识库</span>
          <span className="mt-1 block text-xs tracking-wide text-sidebar-muted">企业知识 · 可溯源</span>
        </span>
      </Link>
      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
        <nav className="flex flex-col gap-1">
          {userNav.map((item) => (
            <NavLink key={item.to} {...item} onNavigate={() => setOpen(false)} />
          ))}
        </nav>
        {adminNav.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-xs tracking-wide text-sidebar-muted">后台</p>
            {adminNav.map((item) => (
              <NavLink key={item.to} {...item} onNavigate={() => setOpen(false)} />
            ))}
          </div>
        ) : (
          <p className="px-3 text-xs leading-5 text-sidebar-muted">当前角色没有后台权限。可在下方切换角色。</p>
        )}
      </div>
      <div className="mt-4 shrink-0 rounded-lg border border-white/10 p-3">
        <label className="text-xs text-sidebar-muted" htmlFor="role-switch">
          当前角色
        </label>
        <select
          id="role-switch"
          value={accessRole}
          onChange={(event) => setAccessRole(event.target.value as (typeof ACCESS_ROLES)[number])}
          className="mt-2 min-h-10 w-full rounded-md bg-white/10 px-2 text-sm text-sidebar-fg"
        >
          {ACCESS_ROLES.map((item) => (
            <option key={item} value={item} className="text-ink">
              {item}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-sidebar lg:block">{nav}</aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="关闭菜单"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
          />
          <aside className="relative h-full w-72 max-w-[85vw] bg-sidebar">{nav}</aside>
        </div>
      ) : null}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-md border border-line lg:hidden"
            aria-label="打开菜单"
            onClick={() => setOpen(true)}
          >
            {open ? <X className="size-4" /> : <House className="size-4" />}
          </button>
          <p className="hidden text-sm text-muted sm:block">AI 生成内容仅供参考</p>
          <button
            type="button"
            onClick={() => {
              setName(profile.name);
              setDept(profile.dept);
              setProfileOpen(true);
            }}
            className="ml-auto min-h-11 rounded-md border border-line px-3 text-sm"
          >
            {profile.name || "个人中心"}
          </button>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      {profileOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label="关闭个人中心" className="absolute inset-0 bg-ink/40" onClick={() => setProfileOpen(false)} />
          <aside className="relative z-10 h-full w-full max-w-md overflow-auto bg-card p-6">
            <p className="text-xs tracking-widest text-copper">当前身份</p>
            <h2 className="mt-1 font-display text-3xl">个人中心</h2>
            <p className="mt-2 text-sm text-muted">显示名称会出现在审计日志里。当前角色：{accessRole}。</p>
            <label className="mt-5 block text-sm">
              显示名称
              <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-line px-3" />
            </label>
            <label className="mt-3 block text-sm">
              所属部门
              <input value={dept} onChange={(event) => setDept(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-line px-3" />
            </label>
            <button
              type="button"
              onClick={() => {
                saveProfile({ name: name.trim() || "当前用户", dept: dept.trim() || "未分配" });
                setProfileOpen(false);
              }}
              className="mt-6 min-h-11 rounded-md bg-ink px-4 text-sm text-paper"
            >
              保存
            </button>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

export function NeedPerm({ perm, children }: { perm: string; children: ReactNode }) {
  const can = useCan();
  if (!can(perm)) {
    return (
      <Panel className="p-6 text-sm leading-6">
        当前角色没有「{perm}」权限。左下角可以切换角色；系统管理员也可以在角色权限里调整。
      </Panel>
    );
  }
  return <>{children}</>;
}

export function PageTitle({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs tracking-widest text-copper">{kicker}</p>
        <h1 className="mt-1 font-display text-3xl text-ink">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-lg border border-line bg-card", className)}>{children}</section>
  );
}
