import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

type Ctx = { id: string; title: string; excerpt: string };

/** The UI only receives available IDs. Gateway secrets are never returned. */
export const getChatModels = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { availableChatModels } = await import("./model-catalog.server");
    return { models: await availableChatModels() };
  });

export const askKnowledge = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { question: string; contexts: Ctx[]; strict: boolean; modelId: string; style?: string }) => {
    const question = String(input?.question ?? "").trim();
    if (question.length < 1 || question.length > 2000) {
      throw new Error("请输入 1–2000 字的问题");
    }
    const modelId = String(input?.modelId ?? "").trim();
    if (!modelId || modelId.length > 128) {
      throw new Error("请选择可用的内网生成模型");
    }
    // Temporary prototype contexts: these remain client-provided until the
    // server-side authorized retrieval service replaces this interface.
    const contexts = (Array.isArray(input?.contexts) ? input.contexts : [])
      .slice(0, 6)
      .map((c) => ({
        id: String(c?.id ?? "").slice(0, 64),
        title: String(c?.title ?? "未命名").slice(0, 80),
        excerpt: String(c?.excerpt ?? "").slice(0, 700),
      }))
      .filter((c) => c.excerpt.length > 0);
    return { question, modelId, contexts, strict: Boolean(input?.strict), style: String(input?.style ?? "").slice(0, 40) };
  })
  .handler(async ({ data }) => {
    // The prototype passes evidence from the browser. Until authenticated,
    // server-side retrieval is implemented, refuse to use this flow against
    // a configured production database.
    if (process.env.DATABASE_URL?.trim()) {
      return { ok: false as const, error: "正式授权检索尚未接入，当前不能在生产环境提交问答" };
    }
    const { availableChatModels, modelGatewayConfig } = await import("./model-catalog.server");
    const models = await availableChatModels();
    if (!models.some((model) => model.id === data.modelId)) {
      return { ok: false as const, error: "所选模型当前不可用，请刷新模型列表" };
    }
    const gateway = modelGatewayConfig();
    if (!gateway) {
      return { ok: false as const, error: "内网模型网关尚未配置" };
    }
    if (data.contexts.length === 0) {
      return { ok: false as const, error: "没有已召回的知识片段，无法生成有依据的回答" };
    }
    const packed = data.contexts
      .map((c, i) => `【${i + 1}】《${c.title}》\n${c.excerpt}`)
      .join("\n\n");
    const system = [
      "你是企业知识库助手「智识」。只用简体中文，并且只根据给定资料回答。",
      "句末用【编号】标注依据，编号对应资料顺序。",
      "资料不足以回答时，直接说「知识库中没有足够依据」，不要编造天数、金额、入口或审批链。",
      data.strict
        ? "当前为严格模式：禁止用资料以外的常识补全任何具体制度。"
        : "可以整理语序，但事实必须来自资料。",
      data.style ? `回答风格：${data.style}。` : "",
    ].join("");

    let res: Response;
    try {
      res = await fetch(`${gateway.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gateway.apiKey}`,
        },
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          model: data.modelId,
          temperature: 0.2,
          max_tokens: 700,
          messages: [
            { role: "system", content: system },
            { role: "user", content: `资料：\n${packed}\n\n问题：${data.question}` },
          ],
        }),
      });
    } catch {
      return { ok: false as const, error: "内网模型网关连接失败或请求超时" };
    }
    if (!res.ok) {
      return { ok: false as const, error: `问答服务暂时不可用（${res.status}）` };
    }
    let body: { choices?: { message?: { content?: string } }[] };
    try {
      body = (await res.json()) as typeof body;
    } catch {
      return { ok: false as const, error: "模型返回格式异常" };
    }
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false as const, error: "没有生成回答" };
    return { ok: true as const, text };
  });
