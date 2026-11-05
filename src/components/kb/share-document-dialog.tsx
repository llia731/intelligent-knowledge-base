import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Check,
  Copy,
  LockKeyhole,
  Link2,
  Share2,
  Send,
  MessageCircle,
  Clock3,
  X,
} from "lucide-react";
import type { KbDoc } from "@/lib/kb/types";
import { useKb } from "@/lib/kb/store";
import "./share-document-dialog.css";

type Scope = "organization" | "departments" | "owner";
type Expiry = "7" | "30" | "90" | "never";
const EXPIRIES: { value: Expiry; label: string }[] = [
  { value: "7", label: "7 天" },
  { value: "30", label: "30 天" },
  { value: "90", label: "90 天" },
  { value: "never", label: "永久有效" },
];
const SCOPES: { value: Scope; label: string; description: string }[] = [
  { value: "organization", label: "全员", description: "组织内所有人" },
  { value: "departments", label: "指定部门", description: "选择可见部门" },
  { value: "owner", label: "仅自己", description: "仅文档所有者" },
];

/** Modao V15 visual and draft-only adapter. No share endpoint is implemented. */
export function ShareDocumentDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: KbDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const saveShareNote = useKb((s) => s.shareDoc);
  const docs = useKb((s) => s.docs);
  const [enabled, setEnabled] = useState(false);
  const [scope, setScope] = useState<Scope>("organization");
  const [department, setDepartment] = useState("产品研发部");
  const [password, setPassword] = useState("");
  const [expiry, setExpiry] = useState<Expiry>("7");
  const [summary, setSummary] = useState("");
  const [savedNote, setSavedNote] = useState(false);
  const [message, setMessage] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open || !doc) return;
    setEnabled(false);
    setScope("organization");
    setDepartment("产品研发部");
    setPassword("");
    setExpiry("7");
    setSummary(doc.shareNote || "");
    setSavedNote(false);
    setMessage("");
  }, [open, doc?.id]); // Do not reset draft when the backing document receives another store update.

  const liveDoc = doc && docs.some((item) => item.id === doc.id && item.status !== "trashed");
  const saveSummary = () => {
    if (!doc || !liveDoc) {
      setMessage("文档已删除或不可用，无法保存摘要。");
      return;
    }
    saveShareNote(doc.id, summary.trim());
    setSavedNote(true);
    setMessage("推荐摘要已保存到本地演示文档。尚未创建分享链接。");
  };
  const noShareService = "尚未接入分享服务，无法生成、访问、复制或撤销实际分享链接。";
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setPassword("");
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="sd-backdrop" />
        <Dialog.Content
          className="sd-dialog"
          aria-describedby="sd-desc"
          onOpenAutoFocus={(event) => {
            if (!event.defaultPrevented && document.activeElement instanceof HTMLElement)
              returnFocus.current = document.activeElement;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
          }}
        >
          <header className="sd-header">
            <Dialog.Title>
              <Share2 size={16} aria-hidden="true" />
              分享文档
            </Dialog.Title>
            <Dialog.Close className="sd-close" aria-label="关闭分享">
              <X size={20} />
            </Dialog.Close>
          </header>
          <div className="sd-body">
            <p id="sd-desc" className="sr-only">
              当前文档：{doc?.title}。配置分享选项，尚未接入真实链接分享服务。
            </p>
            <label className="sd-enable">
              <span>
                <strong>开启链接分享</strong>
                <small>关闭后，已生成的分享链接将失效</small>
              </span>
              <input
                aria-label="开启链接分享"
                type="checkbox"
                role="switch"
                checked={enabled}
                onChange={(event) => {
                  setEnabled(event.target.checked);
                  setSavedNote(false);
                }}
              />
            </label>
            <fieldset className="sd-fieldset sd-range">
              <legend>分享范围</legend>
              <div className="sd-scopes">
                {SCOPES.map((item) => {
                  return (
                    <label
                      key={item.value}
                      className={scope === item.value ? "sd-scope selected" : "sd-scope"}
                    >
                      <input
                        name="sd-scope"
                        type="radio"
                        checked={scope === item.value}
                        onChange={() => setScope(item.value)}
                      />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className="sd-field sd-department">
              <span className="sr-only">指定部门</span>
              <select
                className="sd-input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                aria-label="指定部门"
                disabled={scope !== "departments"}
              >
                <option value="产品研发部">产品研发部</option>
              </select>
            </label>
            <div className="sd-cols">
              <label className="sd-field">
                访问密码
                <span className="sd-input-wrap">
                  <LockKeyhole size={15} aria-hidden="true" />
                  <input
                    aria-label="访问密码"
                    type="password"
                    autoComplete="off"
                    aria-describedby="sd-password-help"
                    placeholder="设置访问密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </span>
                <small id="sd-password-help">留空表示无需密码</small>
              </label>
              <label className="sd-field">
                有效期
                <span className="sd-expiry-wrap">
                  <Clock3 size={16} aria-hidden="true" />
                  <select
                    className="sd-input"
                    aria-label="有效期"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value as Expiry)}
                  >
                    {EXPIRIES.map((item) => (
                      <option value={item.value} key={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            </div>
            <div className="sd-field sd-link-field">
              <span>分享链接</span>
              <div className="sd-link">
                <span className="sd-link-input">
                  <Link2 size={15} aria-hidden="true" />
                  <input
                    aria-label="分享链接"
                    readOnly
                    value=""
                    placeholder="分享服务未接入，暂不可生成链接"
                  />
                </span>
                <button type="button" disabled title={noShareService} aria-label="复制链接">
                  <Copy size={15} /> 复制链接
                </button>
              </div>
            </div>
            <fieldset className="sd-fieldset sd-channels">
              <legend>分享到</legend>
              <div className="sd-channel-buttons">
                <button type="button" disabled title={noShareService}>
                  <Building2 size={16} aria-hidden="true" /> 企业微信
                </button>
                <button type="button" disabled title={noShareService}>
                  <Send size={16} aria-hidden="true" /> 钉钉
                </button>
                <button type="button" disabled title={noShareService}>
                  <MessageCircle size={16} aria-hidden="true" /> 飞书
                </button>
              </div>
            </fieldset>
            <label className="sd-field sd-summary">
              推荐摘要
              <textarea
                aria-label="推荐摘要"
                value={summary}
                rows={3}
                onChange={(e) => {
                  setSummary(e.target.value);
                  setSavedNote(false);
                  setMessage("");
                }}
                placeholder="输入推荐摘要，供分享时使用"
              />
              <small>摘要会随链接一起发送给接收人</small>
            </label>
            <p className="sd-service-notice" role="status">
              {message || noShareService}
            </p>
          </div>
          <footer className="sd-footer">
            <button
              type="button"
              className="sd-neutral"
              onClick={() => {
                setPassword("");
                onOpenChange(false);
              }}
            >
              取消
            </button>
            <button
              type="button"
              className="sd-neutral sd-save-summary"
              onClick={saveSummary}
              disabled={!liveDoc}
            >
              {savedNote ? <Check size={16} /> : null} 保存推荐摘要
            </button>
            <button type="button" className="sd-primary" disabled title={noShareService}>
              确认分享
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
