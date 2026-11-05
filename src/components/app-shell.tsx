import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  CircleHelp,
  House,
  KeyRound,
  LayoutDashboard,
  Library,
  Menu,
  MessageSquare,
  ScrollText,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ACCESS_ROLES, type AccessRole } from "@/lib/kb/access";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";
import { cn } from "@/lib/utils";

const USER_NAV = [
  { to: "/", perm: "首页", label: "首页", icon: House },
  { to: "/upload", perm: "知识上传", label: "知识上传", icon: Upload },
  { to: "/search", perm: "智能检索", label: "智能检索", icon: Search },
  { to: "/ask", perm: "AI问答", label: "AI 问答", icon: MessageSquare },
  { to: "/library", perm: "知识管理", label: "知识管理", icon: Library },
  { to: "/permissions", perm: "权限设置", label: "权限设置", icon: Shield },
  { to: "/audit", perm: "审计日志", label: "审计日志", icon: ScrollText },
] as const;

const ADMIN_NAV = [
  { to: "/admin", perm: "总览仪表盘", label: "总览仪表盘", icon: LayoutDashboard },
  { to: "/admin/users", perm: "用户管理", label: "用户管理", icon: Users },
  { to: "/admin/roles", perm: "角色权限", label: "角色权限", icon: ShieldCheck },
  { to: "/admin/config", perm: "知识库配置", label: "知识库配置", icon: Settings2 },
  { to: "/admin/review", perm: "内容审核", label: "内容审核", icon: Shield },
  { to: "/admin/logs", perm: "系统日志", label: "系统日志", icon: ScrollText },
  { to: "/admin/keys", perm: "API密钥", label: "API 密钥", icon: KeyRound },
] as const;

function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M4 13.5V4.8L9 3l5 1.8V13.5L9 15.2 4 13.5Z" fill="none" stroke="#fff" strokeWidth="1.4" />
      <path d="M9 3.2v12" stroke="#fff" strokeWidth="1.4" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const adminMode = path === "/admin" || path.startsWith("/admin/");
  const [globalQuery, setGlobalQuery] = useState("");
  const accessRole = useKb((s) => s.accessRole);
  const setAccessRole = useKb((s) => s.setAccessRole);
  const profile = useKb((s) => s.profile);
  const saveProfile = useKb((s) => s.saveProfile);
  const logs = useKb((s) => s.logs);
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const [help, setHelp] = useState(false);
  const [name, setName] = useState(profile.name);
  const [dept, setDept] = useState(profile.dept);

  useEffect(() => {
    void useKb.persist.rehydrate();
  }, []);
  useEffect(() => {
    setName(profile.name);
    setDept(profile.dept);
  }, [profile.name, profile.dept]);

  const items = (adminMode ? ADMIN_NAV : USER_NAV).filter((item) => can(item.perm));
  const canAdmin = ADMIN_NAV.some((item) => can(item.perm));

  const nav = (
    <>
      <Link to={adminMode ? "/admin" : "/"} className="brand" onClick={() => setOpen(false)}>
        <span className="logo-mark"><Logo /></span>
        <span>
          <b>{adminMode ? "智识库后台" : "智能知识库"}</b>
          {adminMode ? <small>AI 知识库管理系统</small> : null}
        </span>
      </Link>
      <nav>
        {items.map((item) => {
          const active = item.to === "/admin" ? path === "/admin" : path === item.to;
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className={cn("nav-link", active && "active")}>
              <Icon />
              {item.label}
            </Link>
          );
        })}
        {!adminMode && canAdmin ? (
          <Link to="/admin" className="nav-link" onClick={() => setOpen(false)} style={{ marginTop: 8, color: "var(--m-blue)" }}>
            <LayoutDashboard />
            进入后台
          </Link>
        ) : null}
        {adminMode ? (
          <Link to="/" className="nav-link" onClick={() => setOpen(false)} style={{ marginTop: 8 }}>
            <House />
            返回用户端
          </Link>
        ) : null}
      </nav>
      <div className="side-foot">
        <button
          id="modao-personal-center"
          type="button"
          className="who"
          onClick={() => {
            setName(profile.name);
            setDept(profile.dept);
            setProfileOpen(true);
            setOpen(false);
          }}
        >
          <span className="avatar">{accessRole.slice(0, 1)}</span>
          <span>
            <strong>{accessRole}</strong>
            <span>admin@example.com</span>
          </span>
        </button>
      </div>
    </>
  );

  return (
    <div className="shell">
      <aside className="side">{nav}</aside>
      {open ? (
        <div className="mobile-scrim lg:hidden">
          <button type="button" aria-label="关闭菜单" className="absolute inset-0" onClick={() => setOpen(false)} />
          <aside className="mobile-side">{nav}</aside>
        </div>
      ) : null}
      <div className="main-col">
        <header className="topbar">
          <button type="button" className="menu-btn" aria-label="打开菜单" onClick={() => setOpen(true)}>
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
          <form
            role="search"
            className="search-form"
            onSubmit={(event) => {
              event.preventDefault();
              const q = globalQuery.trim();
              if (adminMode) {
                void navigate({ to: "/admin/users" });
                return;
              }
              void navigate({ to: "/search", search: { q } });
            }}
          >
            <Search size={16} />
            <input
              aria-label={adminMode ? "搜索用户、知识库、日志、API 密钥" : "全局搜索知识、文档、问答"}
              placeholder={adminMode ? "搜索用户、知识库、日志、API 密钥…" : "全局搜索知识、文档、问答…"}
              value={globalQuery}
              onChange={(event) => setGlobalQuery(event.target.value)}
            />
          </form>
          <span className="ml-auto flex items-center gap-1 relative">
            <button type="button" className="icon-btn" aria-label="通知" onClick={() => { setBell((v) => !v); setHelp(false); }}>
              <Bell size={18} />
            </button>
            <button type="button" className="icon-btn" aria-label="帮助" onClick={() => { setHelp(true); setBell(false); }}>
              <CircleHelp size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="设置"
              onClick={() => void navigate({ to: can("知识库配置") ? "/admin/config" : "/" })}
            >
              <Settings2 size={18} />
            </button>
            {bell ? (
              <div className="pop">
                <p className="px-2 py-1 text-xs text-[var(--m-faint)]">最近动态（本地记录，不是推送服务）</p>
                {logs.slice(0, 6).map((item) => (
                  <button key={item.id} type="button" onClick={() => { setBell(false); void navigate({ to: "/audit" }); }}>
                    <b className="font-medium">{item.action}</b>
                    <span className="block text-xs text-[var(--m-sub)]">{item.actor} · {item.target}</span>
                  </button>
                ))}
                {logs.length === 0 ? <p className="px-2 py-2 text-sm">暂无记录</p> : null}
              </div>
            ) : null}
          </span>
        </header>
        <main className="stage">
          <div className="stage-inner">{children}</div>
        </main>
      </div>

      {help ? (
        <div className="overlay" onClick={() => setHelp(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-semibold">使用说明</h2>
            <p className="page-sub">这是按墨刀 V1.0 复刻的产品界面。检索、上传、权限和审核会写入本地演示数据；模型列表只来自服务端目录，未配置时不能发送。</p>
            <ul className="mt-3 space-y-1 text-sm text-[var(--m-sub)]">
              <li>顶部搜索进入智能检索。</li>
              <li>左下角头像打开个人中心，可切换演示角色。</li>
              <li>后台与用户端侧栏分开，有权限时可从底部进入。</li>
            </ul>
            <button type="button" className="btn mt-4" onClick={() => setHelp(false)}>知道了</button>
          </div>
        </div>
      ) : null}

      {profileOpen ? (
        <div className="drawer-scrim">
          <button type="button" aria-label="关闭个人中心" className="absolute inset-0" onClick={() => setProfileOpen(false)} />
          <aside className="drawer">
            <p className="text-xs text-[var(--m-blue)]">当前身份</p>
            <h2 className="mt-1 text-2xl font-semibold">个人中心</h2>
            <p className="page-sub">显示名称会出现在审计记录里。当前角色：{accessRole}。</p>
            <label className="mt-4 block text-sm">
              显示名称
              <input className="field mt-1" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="mt-3 block text-sm">
              所属部门
              <input className="field mt-1" value={dept} onChange={(event) => setDept(event.target.value)} />
            </label>
            <label className="mt-3 block text-sm">
              演示角色
              <select
                id="role-switch"
                className="select mt-1"
                value={accessRole}
                onChange={(event) => setAccessRole(event.target.value as AccessRole)}
              >
                {ACCESS_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <p className="note mt-2">角色切换只影响本机演示权限，不会取代服务端鉴权。</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  saveProfile({ name: name.trim() || "当前用户", dept: dept.trim() || "未分配" });
                  setProfileOpen(false);
                }}
              >
                保存
              </button>
              <button type="button" className="btn ghost" onClick={() => setProfileOpen(false)}>取消</button>
            </div>
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
      <section className="card p-6 text-sm leading-6">
        当前角色没有「{perm}」权限。打开左下角个人中心可以切换演示角色；系统管理员也可以在角色权限里调整「查看」开关。
      </section>
    );
  }
  return <>{children}</>;
}

export function PageTitle({
  kicker,
  title,
  children,
}: {
  kicker?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="head-row">
      <div>
        {kicker ? <p className="text-xs text-[var(--m-blue)]">{kicker}</p> : null}
        <h1 className="page-h">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("card", className)}>{children}</section>;
}
