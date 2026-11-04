import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageTitle, Panel, NeedPerm } from "@/components/app-shell";
import type { ResourceLink } from "@/lib/kb/types";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";

export const Route = createFileRoute("/_app/admin/config")({
  component: ConfigPage,
});

function ConfigPage() {
  const roleOk = useCan();
  const settings = useKb((s) => s.settings);
  const saveSettings = useKb((s) => s.saveSettings);
  const connections = useKb((s) => s.connections);
  const saveConnections = useKb((s) => s.saveConnections);
  const addCollection = useKb((s) => s.addCollection);
  const collections = useKb((s) => s.collections);
  const [chunkSize, setChunkSize] = useState(settings.chunkSize);
  const [overlap, setOverlap] = useState(settings.overlap);
  const [strict, setStrict] = useState(settings.strict);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [links, setLinks] = useState<ResourceLink[]>(connections);
  const [linksSaved, setLinksSaved] = useState(false);
  useEffect(() => {
    setLinks(connections);
  }, [connections]);
  if (!roleOk("知识库配置")) return <NeedPerm perm="知识库配置">{null}</NeedPerm>;

  return (
    <div>
      <PageTitle kicker="配置" title="知识库配置" />
      <Panel className="mb-4 p-5">
        <h2 className="font-medium">新建知识库</h2>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            addCollection(name);
            setName("");
          }}
        >
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：算法规范库" className="min-h-11 flex-1 rounded-md border border-line px-3 text-sm" />
          <button type="submit" className="min-h-11 rounded-md bg-teal px-4 text-sm text-teal-fg">新建知识库</button>
        </form>
        {collections.length > 0 ? <p className="mt-2 text-sm text-ok">已登记：{collections.join("、")}。上传和首页会立刻出现这些知识库。</p> : null}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="font-medium">分块策略</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            分块要兼顾上下文完整和检索粒度。保存后会对已索引文档全量重新切片。
          </p>
          <label className="mt-4 block text-sm">
            切片长度 {chunkSize}
            <input
              type="range"
              min={160}
              max={520}
              step={20}
              value={chunkSize}
              onChange={(event) => setChunkSize(Number(event.target.value))}
              className="mt-2 w-full accent-teal"
            />
          </label>
          <label className="mt-4 block text-sm">
            重叠 {overlap}
            <input
              type="range"
              min={0}
              max={120}
              step={10}
              value={overlap}
              onChange={(event) => setOverlap(Number(event.target.value))}
              className="mt-2 w-full accent-teal"
            />
          </label>
          <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={strict}
              onChange={(event) => setStrict(event.target.checked)}
              className="size-4 accent-teal"
            />
            仅知识库作答（禁止用资料外的数字补全）
          </label>
          <button
            type="button"
            className="mt-4 min-h-11 rounded-md bg-teal px-4 text-sm text-teal-fg"
            onClick={() => {
              saveSettings({ chunkSize, overlap, strict });
              setSaved(true);
            }}
          >
            保存并重新索引
          </button>
          {saved ? <p className="mt-2 text-sm text-ok">已生效。建议在低峰期调整切片长度。</p> : null}
        </Panel>
        <Panel className="p-5">
          <h2 className="font-medium">外部资源连接</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            生成模型、嵌入模型和向量数据库暂时不发起连接。这里只保留接口地址、资源标识和密钥引用。
          </p>
          <div className="mt-4 space-y-4">
            {links.map((link) => (
              <fieldset key={link.id} className="rounded-md border border-line p-3">
                <legend className="px-1 text-sm font-medium">{link.kind}</legend>
                <p className="text-xs text-copper">未连接 · 配置已保留</p>
                <label className="mt-2 block text-sm">
                  显示名称
                  <input
                    value={link.label}
                    onChange={(event) =>
                      setLinks((rows) => rows.map((row) => (row.id === link.id ? { ...row, label: event.target.value } : row)))
                    }
                    className="mt-1 min-h-11 w-full rounded-md border border-line px-3 text-sm"
                  />
                </label>
                <label className="mt-2 block text-sm">
                  接口地址
                  <input
                    value={link.endpoint}
                    onChange={(event) =>
                      setLinks((rows) =>
                        rows.map((row) => (row.id === link.id ? { ...row, endpoint: event.target.value } : row)),
                      )
                    }
                    placeholder="https://"
                    className="mt-1 min-h-11 w-full rounded-md border border-line px-3 text-sm"
                  />
                </label>
                <label className="mt-2 block text-sm">
                  {link.kind === "向量数据库" ? "库名 / 集合" : "资源标识"}
                  <input
                    value={link.identifier}
                    onChange={(event) =>
                      setLinks((rows) =>
                        rows.map((row) => (row.id === link.id ? { ...row, identifier: event.target.value } : row)),
                      )
                    }
                    placeholder={link.kind === "向量数据库" ? "库名" : "模型标识"}
                    className="mt-1 min-h-11 w-full rounded-md border border-line px-3 text-sm"
                  />
                </label>
                <label className="mt-2 block text-sm">
                  密钥引用
                  <input
                    value={link.secretRef}
                    onChange={(event) =>
                      setLinks((rows) =>
                        rows.map((row) => (row.id === link.id ? { ...row, secretRef: event.target.value } : row)),
                      )
                    }
                    placeholder="不填写明文密钥"
                    className="mt-1 min-h-11 w-full rounded-md border border-line px-3 text-sm"
                  />
                </label>
                <label className="mt-2 block text-sm">
                  附加参数
                  <input
                    value={link.extra}
                    onChange={(event) =>
                      setLinks((rows) => rows.map((row) => (row.id === link.id ? { ...row, extra: event.target.value } : row)))
                    }
                    className="mt-1 min-h-11 w-full rounded-md border border-line px-3 text-sm"
                  />
                </label>
              </fieldset>
            ))}
          </div>
          <button
            type="button"
            className="mt-4 min-h-11 rounded-md bg-ink px-4 text-sm text-paper"
            onClick={() => {
              saveConnections(links);
              setLinksSaved(true);
            }}
          >
            保存连接配置
          </button>
          {linksSaved ? <p className="mt-2 text-sm text-ok">已写入本机。不会向这些地址发起连接。</p> : null}
        </Panel>
      </div>
    </div>
  );
}
