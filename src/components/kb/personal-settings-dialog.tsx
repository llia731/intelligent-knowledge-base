import * as Dialog from "@radix-ui/react-dialog";
import {
  Briefcase,
  GraduationCap,
  Smile,
  UserRound,
  X,
  Sun,
  Moon,
  Monitor,
  List,
  LayoutGrid,
  Inbox,
  Mail,
  Smartphone,
  MessagesSquare,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
  { key: "briefcase", icon: Briefcase, label: "工作" },
  { key: "graduation-cap", icon: GraduationCap, label: "学术" },
  { key: "smile", icon: Smile, label: "微笑" },
] as const;

function Selection({
  value,
  onChange,
  options,
  label,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: typeof Sun }[];
}) {
  const name = useId();
  return (
    <div className="ps-choices" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label
          key={option.value}
          className={value === option.value ? "ps-choice selected" : "ps-choice"}
        >
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.icon && <option.icon size={16} aria-hidden="true" />}
          {option.label}
        </label>
      ))}
    </div>
  );
}

function Field({
  title,
  children,
  htmlFor,
}: {
  title: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="ps-field">
      {htmlFor ? (
        <label className="ps-label" htmlFor={htmlFor}>
          {title}
        </label>
      ) : (
        <div className="ps-label">{title}</div>
      )}
      {children}
    </div>
  );
}

export function PersonalSettingsDialog({
  open,
  onOpenChange,
}: {
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
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab("profile");
    setName(profile.name);
    setDept(profile.dept);
    setDraft({
      ...DEFAULT_PERSONAL_PREFERENCES,
      ...preferences,
      notificationChannels: [...(preferences?.notificationChannels ?? ["inbox", "email"])],
    });
    setError("");
  }, [open]); // Reinitialize only when opened. Tab changes must preserve unsaved drafts.

  const patch = (next: Partial<PersonalPreferences>) =>
    setDraft((previous) => ({ ...previous, ...next }));
  const save = () => {
    if (!name.trim()) {
      setError("请输入显示名称");
      setTab("profile");
      return;
    }
    savePersonalSettings({ name: name.trim(), dept: dept.trim() || "未分配" }, draft);
    onOpenChange(false);
  };
  const flipChannel = (channel: PersonalPreferences["notificationChannels"][number]) =>
    patch({
      notificationChannels: draft.notificationChannels.includes(channel)
        ? draft.notificationChannels.filter((item) => item !== channel)
        : [...draft.notificationChannels, channel],
    });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ps-backdrop" />
        <Dialog.Content
          className="ps-dialog"
          aria-describedby="ps-description"
          onOpenAutoFocus={(event) => {
            if (!event.defaultPrevented && document.activeElement instanceof HTMLElement) {
              returnFocus.current = document.activeElement;
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const opener = returnFocus.current?.isConnected
              ? returnFocus.current
              : document.getElementById("modao-personal-center");
            opener?.focus();
          }}
        >
          <header className="ps-header">
            <Dialog.Title className="ps-title">个人中心与设置</Dialog.Title>
            <Dialog.Description id="ps-description" className="ps-subtitle">
              管理个人信息、界面、检索与通知偏好
            </Dialog.Description>
            <Dialog.Close className="ps-close" aria-label="关闭个人中心">
              <X size={20} />
            </Dialog.Close>
          </header>
          <div className="ps-tabs" role="tablist" aria-label="个人中心设置">
            {TABS.map((item) => (
              <button
                type="button"
                role="tab"
                key={item.key}
                id={`ps-tab-${item.key}`}
                aria-controls="ps-panel"
                aria-selected={tab === item.key}
                tabIndex={tab === item.key ? 0 : -1}
                className={tab === item.key ? "ps-tab active" : "ps-tab"}
                onClick={() => setTab(item.key)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  const index = TABS.findIndex((entry) => entry.key === tab);
                  const next =
                    TABS[
                      (index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length
                    ];
                  setTab(next.key);
                  const list =
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                      '[role="tab"]',
                    );
                  list?.[TABS.findIndex((entry) => entry.key === next.key)]?.focus();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div
            className={`ps-body ps-body-${tab}`}
            id="ps-panel"
            role="tabpanel"
            aria-labelledby={`ps-tab-${tab}`}
          >
            {tab === "profile" && (
              <>
                <h3 className="ps-section-title">个人资料</h3>
                <Field title="显示名称" htmlFor="ps-name">
                  <input
                    id="ps-name"
                    className="ps-input"
                    aria-label="显示名称"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError("");
                    }}
                  />
                </Field>
                <Field title="头像">
                  <div className="ps-avatars">
                    {AVATARS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          type="button"
                          key={item.key}
                          aria-label={item.label}
                          aria-pressed={draft.avatar === item.key}
                          className={draft.avatar === item.key ? "ps-avatar active" : "ps-avatar"}
                          onClick={() => patch({ avatar: item.key })}
                        >
                          <Icon size={22} />
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field title="所属部门" htmlFor="ps-department">
                  <input
                    id="ps-department"
                    className="ps-input"
                    aria-label="所属部门"
                    value={dept}
                    onChange={(e) => setDept(e.target.value)}
                  />
                </Field>
                {error && (
                  <p className="ps-error" role="alert">
                    {error}
                  </p>
                )}
              </>
            )}
            {tab === "appearance" && (
              <>
                <h3 className="ps-section-title">界面偏好</h3>
                <Field title="主题">
                  <Selection
                    label="主题"
                    value={draft.theme}
                    onChange={(v) => patch({ theme: v as PersonalPreferences["theme"] })}
                    options={[
                      { value: "light", label: "浅色", icon: Sun },
                      { value: "dark", label: "深色", icon: Moon },
                      { value: "system", label: "跟随系统", icon: Monitor },
                    ]}
                  />
                </Field>
                <Field title="默认布局">
                  <Selection
                    label="默认布局"
                    value={draft.defaultLayout}
                    onChange={(v) =>
                      patch({ defaultLayout: v as PersonalPreferences["defaultLayout"] })
                    }
                    options={[
                      { value: "list", label: "列表", icon: List },
                      { value: "card", label: "卡片", icon: LayoutGrid },
                    ]}
                  />
                </Field>
                <label className="ps-toggle-row">
                  <span>
                    <b>紧凑侧边栏</b>
                    <small>收起文字仅显示图标</small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={draft.compactSidebar}
                    onChange={(e) => patch({ compactSidebar: e.target.checked })}
                  />
                </label>
              </>
            )}
            {tab === "search" && (
              <>
                <h3 className="ps-section-title">检索偏好</h3>
                <Field title="默认检索模式" htmlFor="ps-search-mode">
                  <select
                    id="ps-search-mode"
                    className="ps-input"
                    value={draft.searchMode}
                    onChange={(e) =>
                      patch({ searchMode: e.target.value as PersonalPreferences["searchMode"] })
                    }
                  >
                    <option value="hybrid">混合检索</option>
                    <option value="vector">向量检索</option>
                    <option value="keyword">关键词检索</option>
                  </select>
                </Field>
                <Field title="默认排序" htmlFor="ps-search-sort">
                  <select
                    id="ps-search-sort"
                    className="ps-input"
                    value={draft.searchSort}
                    onChange={(e) =>
                      patch({ searchSort: e.target.value as PersonalPreferences["searchSort"] })
                    }
                  >
                    <option value="relevance">相关度</option>
                    <option value="updated">更新时间</option>
                    <option value="popular">热度</option>
                  </select>
                </Field>
                <Field title="默认每页条数" htmlFor="ps-page-size">
                  <select
                    id="ps-page-size"
                    className="ps-input"
                    value={draft.searchPageSize}
                    onChange={(e) =>
                      patch({ searchPageSize: Number(e.target.value) as 10 | 20 | 50 })
                    }
                  >
                    <option value={10}>10 条</option>
                    <option value={20}>20 条</option>
                    <option value={50}>50 条</option>
                  </select>
                </Field>
                <label className="ps-toggle-row">
                  <span>
                    <b>同义词扩展</b>
                    <small>自动扩展查询中的同义词以提升召回</small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={draft.expandSynonyms}
                    onChange={(e) => patch({ expandSynonyms: e.target.checked })}
                  />
                </label>
              </>
            )}
            {tab === "notifications" && (
              <>
                <h3 className="ps-section-title">通知偏好</h3>
                <div className="ps-field ps-notification-field">
                  <div className="ps-label">通知渠道</div>
                  <div className="ps-checkbox-grid">
                    {(
                      [
                        ["inbox", "站内信", Inbox],
                        ["email", "邮件", Mail],
                        ["sms", "短信", Smartphone],
                        ["wecom", "企业微信", MessagesSquare],
                      ] as const
                    ).map(([key, label, Icon]) => (
                      <label className="ps-check" key={key}>
                        <input
                          type="checkbox"
                          checked={draft.notificationChannels.includes(key)}
                          onChange={() => flipChannel(key)}
                        />
                        <Icon size={16} aria-hidden="true" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="ps-field ps-notification-field">
                  <div className="ps-label">通知频率</div>
                  <div className="ps-frequency">
                    {(
                      [
                        ["realtime", "实时"],
                        ["hourly", "每小时摘要"],
                        ["daily", "每日摘要"],
                        ["off", "关闭"],
                      ] as const
                    ).map(([key, label]) => (
                      <label className="ps-check" key={key}>
                        <input
                          type="radio"
                          name="ps-frequency"
                          checked={draft.notificationFrequency === key}
                          onChange={() => patch({ notificationFrequency: key })}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <footer className="ps-footer">
            <div className="ps-dev-role">
              <label htmlFor="role-switch">演示角色</label>
              <select
                id="role-switch"
                value={accessRole}
                onChange={(e) => setAccessRole(e.target.value as AccessRole)}
              >
                {ACCESS_ROLES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <span>仅本机演示；主题、侧栏、检索及通知偏好仅保存</span>
            </div>
            <div className="ps-actions">
              <Dialog.Close className="ps-secondary" type="button">
                取消
              </Dialog.Close>
              <button className="ps-primary" type="button" onClick={save}>
                保存
              </button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
