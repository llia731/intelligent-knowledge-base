import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { Building2, Check, Copy, KeyRound, Link2, MessageSquare, Users, UserRound, X } from "lucide-react";
import type { KbDoc } from "@/lib/kb/types";
import { useKb } from "@/lib/kb/store";
import "./share-document-dialog.css";

type Scope = "organization" | "departments" | "owner";
type Expiry = "7" | "30" | "90" | "never";
const EXPIRIES: {value: Expiry; label: string}[] = [
  {value:"7",label:"7天"}, {value:"30",label:"30天"}, {value:"90",label:"90天"}, {value:"never",label:"永久有效"},
];
const SCOPES: {value:Scope; label:string; description:string; icon:typeof Users}[] = [
  {value:"organization",label:"全员",description:"组织内所有成员",icon:Users},
  {value:"departments",label:"指定部门",description:"仅选择的部门",icon:Building2},
  {value:"owner",label:"仅自己",description:"仅自己可以访问",icon:UserRound},
];

/** Modao V15 visual and draft-only adapter. No share endpoint is implemented. */
export function ShareDocumentDialog({doc, open, onOpenChange}:{
  doc: KbDoc | null;
  open: boolean;
  onOpenChange: (open:boolean)=>void;
}) {
  const saveShareNote = useKb(s=>s.shareDoc);
  const docs = useKb(s=>s.docs);
  const [enabled,setEnabled]=useState(false);
  const [scope,setScope]=useState<Scope>("organization");
  const [department,setDepartment]=useState("产品研发部");
  const [password,setPassword]=useState("");
  const [expiry,setExpiry]=useState<Expiry>("7");
  const [summary,setSummary]=useState("");
  const [savedNote,setSavedNote]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>{
    if (!open || !doc) return;
    setEnabled(false);
    setScope("organization");
    setDepartment("产品研发部");
    setPassword("");
    setExpiry("7");
    setSummary(doc.shareNote || "");
    setSavedNote(false);
    setMessage("");
  },[open,doc?.id]); // Do not reset draft when the backing document receives another store update.

  const liveDoc=doc && docs.some(item=>item.id===doc.id && item.status!=="trashed");
  const saveSummary=()=>{
    if(!doc || !liveDoc){setMessage("文档已删除或不可用，无法保存摘要。");return;}
    saveShareNote(doc.id,summary.trim());
    setSavedNote(true);
    setMessage("推荐摘要已保存到本地演示文档。尚未创建分享链接。");
  };
  const noShareService="尚未接入分享服务，无法生成、访问、复制或撤销实际分享链接。";
  return <Dialog.Root open={open} onOpenChange={(next)=>{
    if(!next) setPassword("");
    onOpenChange(next);
  }}>
    <Dialog.Portal>
      <Dialog.Overlay className="sd-backdrop"/>
      <Dialog.Content className="sd-dialog" aria-describedby="sd-desc">
        <header className="sd-header">
          <Dialog.Title><Link2 size={19}/> 分享文档</Dialog.Title>
          <Dialog.Close className="sd-close" aria-label="关闭分享"><X size={18}/></Dialog.Close>
        </header>
        <div className="sd-body">
          <p id="sd-desc" className="sr-only">为当前文档配置分享选项。尚未接入真实链接分享服务。</p>
          <label className="sd-enable">
            <span><strong>开启链接分享</strong><small>关闭后，已生成的分享链接将失效</small></span>
            <input aria-label="开启链接分享" type="checkbox" role="switch" checked={enabled}
              onChange={event=>{setEnabled(event.target.checked);setSavedNote(false);}}/>
          </label>
          <fieldset className="sd-fieldset">
            <legend>分享范围</legend>
            <div className="sd-scopes">
              {SCOPES.map(item=>{
                const Icon=item.icon;
                return <label key={item.value} className={scope===item.value?"sd-scope selected":"sd-scope"}>
                  <input name="sd-scope" type="radio" checked={scope===item.value}
                    onChange={()=>setScope(item.value)}/>
                  <Icon size={18}/>
                  <span><strong>{item.label}</strong><small>{item.description}</small></span>
                </label>;
              })}
            </div>
          </fieldset>
          <label className="sd-field">指定部门
            <select className="sd-input" value={department} onChange={e=>setDepartment(e.target.value)}
              aria-label="指定部门" disabled={scope!=="departments"}>
              <option value="产品研发部">产品研发部</option>
            </select>
          </label>
          <div className="sd-cols">
            <label className="sd-field">访问密码
              <span className="sd-input-wrap"><KeyRound size={15}/>
                <input aria-label="访问密码" type="password" autoComplete="off" placeholder="留空则无需密码"
                  value={password} onChange={e=>setPassword(e.target.value)}/>
              </span>
            </label>
            <label className="sd-field">有效期
              <select className="sd-input" aria-label="有效期" value={expiry}
                onChange={e=>setExpiry(e.target.value as Expiry)}>
                {EXPIRIES.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <div className="sd-field">
            <span>分享链接</span>
            <div className="sd-link">
              <input aria-label="分享链接" readOnly value="" placeholder="服务未接入，暂不可生成链接"/>
              <button type="button" disabled title={noShareService} aria-label="复制链接"><Copy size={15}/> 复制链接</button>
            </div>
          </div>
          <fieldset className="sd-fieldset sd-channels">
            <legend>分享到</legend>
            <div className="sd-channel-buttons">
              <button type="button" disabled title={noShareService}><MessageSquare size={16}/> 企业微信</button>
              <button type="button" disabled title={noShareService}><MessageSquare size={16}/> 钉钉</button>
              <button type="button" disabled title={noShareService}><MessageSquare size={16}/> 飞书</button>
            </div>
          </fieldset>
          <label className="sd-field">推荐摘要
            <textarea aria-label="推荐摘要" value={summary} rows={3}
              onChange={e=>{setSummary(e.target.value);setSavedNote(false);}}
              placeholder="输入推荐摘要，供分享时使用"/>
            <small>摘要会随链接一起发送给接收人（需分享服务接通）</small>
          </label>
          <p className="sd-service-notice" role="status">{message||noShareService}</p>
        </div>
        <footer className="sd-footer">
          <button type="button" className="sd-neutral" onClick={()=>{setPassword("");onOpenChange(false);}}>取消</button>
          <button type="button" className="sd-neutral" onClick={saveSummary} disabled={!liveDoc}>
            {savedNote?<Check size={16}/>:null} 保存推荐摘要
          </button>
          <button type="button" className="sd-primary" disabled title={noShareService}>确认分享</button>
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
