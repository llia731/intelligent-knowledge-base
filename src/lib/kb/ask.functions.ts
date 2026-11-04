import { createServerFn } from "@tanstack/react-start";

type Ctx = { id: string; title: string; excerpt: string };

export const askKnowledge = createServerFn({ method: "POST" })
  .validator((input: { question: string; contexts: Ctx[]; strict: boolean; style?: string }) => {
    const question = String(input?.question ?? "").trim();
    if (question.length < 1 || question.length > 2000) {
      throw new Error("请输入 1–2000 字的问题");
    }
    const contexts = (Array.isArray(input?.contexts) ? input.contexts : [])
      .slice(0, 6)
      .map((c) => ({
        id: String(c?.id ?? "").slice(0, 64),
        title: String(c?.title ?? "未命名").slice(0, 80),
        excerpt: String(c?.excerpt ?? "").slice(0, 700),
      }))
      .filter((c) => c.excerpt.length > 0);
    return { question, contexts, strict: Boolean(input?.strict), style: String(input?.style ?? "").slice(0, 40) };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "当前环境未开启 AI 问答" };
    }
    const packed =
      data.contexts.map((c, i) => `【${i + 1}】《${c.title}》\n${c.excerpt}`).join("\n\n") ||
      "（没有命中任何已授权资料）";
    const system = [
      "你是企业知识库助手「智识」。只用简体中文，并且只根据给定资料回答。",
      "句末用【编号】标注依据，编号对应资料顺序。",
      "资料不足以回答时，直接说「知识库中没有足够依据」，不要编造天数、金额、入口或审批链。",
      data.strict
        ? "当前为严格模式：禁止用资料以外的常识补全任何具体制度。"
        : "可以整理语序，但事实必须来自资料。",
      data.style ? `回答风格：${data.style}。` : "",
    ].join("");

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `资料：\n${packed}\n\n问题：${data.question}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return { ok: false as const, error: `问答服务暂时不可用（${res.status}）` };
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false as const, error: "没有生成回答" };
    return { ok: true as const, text };
  });
