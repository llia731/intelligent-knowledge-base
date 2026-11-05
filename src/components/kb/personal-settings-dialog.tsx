import * as Dialog from "@radix-ui/react-dialog";
import { BriefcaseBusiness, GraduationCap, Smile, UserRound, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ACCESS_ROLES, type AccessRole } from "@/lib/kb/access";
import { DEFAULT_PERSONAL_PREFERENCES, useKb } from "@/lib/kb/store";
import type { PersonalPreferences } from "@/lib/kb/types";
import "./personal-settings-dialog.css";

type Tab = "profile" | "appearance" | "search" | "notifications";
const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "个人资料" },
  { key: "appearance", label: "界面偏好" },
  { key: "search", label: "检索偏好" },
  { key: "notifications", label: "通知偏好" },
];
const AVATARS = [
  { key: "user", icon: UserRound, label: "个人" },
  { key: "briefcase", icon: BriefcaseBusiness, label: "工作" },
  { key: "graduation-cap", icon: GraduationCap, label: "学术" },
  { key: "smile", icon: Smile, label: "微笑" },
] as const;

function Selection({ value, onChange, options }: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return <div className="ps-choices" role="radiogroup">
    {options.map((option) => <label key={option.value} className={value === option.value ? "ps-choice selected" : "ps-choice"}>
      <input type="radio" checked={value === option.value} onChange={() => onChange(option.value)} />
      {option.label}
    </label>)}
  </div>;
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return <div className="ps-field"><div className="ps-label">{title}</div>{children}</div>;
}

export function PersonalSettingsDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const profile = useKb((s) => s.profile);
  const preferences = useKb((s) => s.personalPreferences);
  const savePersonalSettings = useKb((s) => s.savePersonalSettings);
  const accessRole = useKb((s) => s.accessRole);
  const setAccessRole = useKb((s) => s.setAccessRole);
  const [tab, setTab] = useState<Tab>("profile");
  const [name, setName] = useState(profile.name);
  const [dept, setDept] = useState(profile.dept);
  const [draft, setDraft] = useState<PersonalPreferences>({ ...DEFAULT_PERSONAL_PREFERENCES });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("profile");
    setName(profile.name);
    setDept(profile.dept);
    setDraft({ ...DEFAULT_PERSONAL_PREFERENCES, ...preferences, notificationChannels: [...(preferences?.notificationChannels ?? ["inbox", "email"])] });
    setError("");
  }, [open]); // Reinitialize only when opened. Tab changes must preserve unsaved drafts.

  const patch = (next: Partial<PersonalPreferences>) => setDraft((previous) => ({ ...previous, ...next }));
  const save = () => {
    if (!name.trim()) { setError("请输入显示名称"); setTab("profile"); return; }
    savePersonalSettings({ name: name.trim(), dept: dept.trim() || "未分配" }, draft);
    onOpenChange(false);
  };
  const flipChannel = (channel: PersonalPreferences["notificationChannels"][number]) =>
    patch({ notificationChannels: draft.notificationChannels.includes(channel)
      ? draft.notificationChannels.filter((item) => item !== channel)
      : [...draft.notificationChannels, channel] });

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="ps-backdrop" />
      <Dialog.Content className="ps-dialog" aria-describedby="ps-description" onOpenAutoFocus={(event) => {
        // Let Radix focus the first navigable control; keep deterministic tab order.
        if (event.defaultPrevented) return;
      }}>
        <header className="ps-header">
          <Dialog.Title className="ps-title">个人中心与设置</Dialog.Title>
          <Dialog.Description id="ps-description" className="ps-subtitle">管理个人信息、界面、检索与通知偏好</Dialog.Description>
          <Dialog.Close className="ps-close" aria-label="关闭个人中心"><X size={18}/></Dialog.Close>
        </header>
        <div className="ps-tabs" role="tablist" aria-label="个人中心设置">
          {TABS.map((item) => <button type="button" role="tab" key={item.key} aria-selected={tab === item.key}
            tabIndex={tab === item.key ? 0 : -1}
            className={tab === item.key ? "ps-tab active" : "ps-tab"}
            onClick={() => setTab(item.key)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const index = TABS.findIndex((entry) => entry.key === tab);
              const next = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
              setTab(next.key);
              const list = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
              list?.[TABS.findIndex((entry) => entry.key === next.key)]?.focus();
            }}>{item.label}</button>)}
        </div>
        <div className="ps-body" role="tabpanel" aria-label={TABS.find((item) => item.key === tab)?.label}>
          {tab === "profile" && <>
            <h3 className="ps-section-title">基本信息</h3>
            <Field title="显示名称"><input className="ps-input" aria-label="显示名称" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} /></Field>
            <Field title="头像选择"><div className="ps-avatars">
              {AVATARS.map((item) => { const Icon = item.icon; return <button type="button" key={item.key} aria-label={item.label}
                aria-pressed={draft.avatar === item.key} className={draft.avatar === item.key ? "ps-avatar active" : "ps-avatar"}
                onClick={() => patch({ avatar: item.key })}><Icon size={22}/></button>; })}
            </div></Field>
            <Field title="所属部门"><input className="ps-input" aria-label="所属部门" value={dept} onChange={(e) => setDept(e.target.value)} /></Field>
            {error && <p className="ps-error" role="alert">{error}</p>}
          </>}
          {tab === "appearance" && <>
            <h3 className="ps-section-title">界面设置</h3>
            <Field title="主题偏好"><Selection value={draft.theme} onChange={(v) => patch({ theme: v as PersonalPreferences["theme"] })}
              options={[{value:"light",label:"浅色"},{value:"dark",label:"深色"},{value:"system",label:"跟随系统"}]}/></Field>
            <Field title="默认布局"><Selection value={draft.defaultLayout} onChange={(v) => patch({ defaultLayout: v as PersonalPreferences["defaultLayout"] })}
              options={[{value:"list",label:"列表"},{value:"card",label:"卡片"}]}/></Field>
            <label className="ps-toggle-row"><span><b>紧凑侧边栏</b><small>收起文字仅显示图标</small></span>
              <input type="checkbox" role="switch" checked={draft.compactSidebar} onChange={(e) => patch({compactSidebar:e.target.checked})}/></label>
            <p className="ps-note">偏好可以保存；整站深色主题与紧凑侧栏的实际切换仍需单独开发及验收。</p>
          </>}
          {tab === "search" && <>
            <h3 className="ps-section-title">默认检索设置</h3>
            <Field title="默认模式"><select className="ps-input" value={draft.searchMode}
              onChange={(e) => patch({searchMode:e.target.value as PersonalPreferences["searchMode"]})}>
              <option value="hybrid">混合检索</option><option value="vector">向量检索</option><option value="keyword">关键词检索</option>
            </select></Field>
            <Field title="默认排序"><select className="ps-input" value={draft.searchSort}
              onChange={(e) => patch({searchSort:e.target.value as PersonalPreferences["searchSort"]})}>
              <option value="relevance">相关度</option><option value="updated">更新时间</option><option value="popular">热度</option>
            </select></Field>
            <Field title="每页条数"><select className="ps-input" value={draft.searchPageSize}
              onChange={(e) => patch({searchPageSize:Number(e.target.value) as 10|20|50})}>
              <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
            </select></Field>
            <label className="ps-toggle-row"><span><b>同义词扩展</b><small>扩展相似表达以改善检索</small></span>
              <input type="checkbox" role="switch" checked={draft.expandSynonyms} onChange={(e) => patch({expandSynonyms:e.target.checked})}/></label>
            <p className="ps-note">这些设置暂作为个人默认值保存；向量检索、热度排序等能力尚未接入服务，不能视为已启用。</p>
          </>}
          {tab === "notifications" && <>
            <h3 className="ps-section-title">通知渠道</h3>
            <div className="ps-checkbox-grid">{([
              ["inbox", "站内信"], ["email", "邮件"], ["sms", "短信"], ["wecom", "企业微信"],
            ] as const).map(([key,label]) => <label className="ps-check" key={key}>
              <input type="checkbox" checked={draft.notificationChannels.includes(key)} onChange={() => flipChannel(key)}/>{label}
            </label>)}</div>
            <h3 className="ps-section-title ps-spaced">通知频率</h3>
            <div className="ps-frequency">{([
              ["realtime", "实时"], ["hourly", "每小时摘要"], ["daily", "每日摘要"], ["off", "关闭"],
            ] as const).map(([key,label]) => <label className="ps-check" key={key}>
              <input type="radio" name="ps-frequency" checked={draft.notificationFrequency===key}
                onChange={() => patch({ notificationFrequency:key })}/>{label}
            </label>)}</div>
            <p className="ps-note">仅保存偏好，尚未连接真实消息投递服务。</p>
          </>}
        </div>
        <footer className="ps-footer">
          <div className="ps-dev-role"><label htmlFor="role-switch">演示角色</label>
            <select id="role-switch" value={accessRole} onChange={(e) => setAccessRole(e.target.value as AccessRole)}>
              {ACCESS_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <span>仅影响本机演示权限</span>
          </div>
          <div className="ps-actions">
            <Dialog.Close className="ps-secondary" type="button">取消</Dialog.Close>
            <button className="ps-primary" type="button" onClick={save}>保存</button>
          </div>
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
