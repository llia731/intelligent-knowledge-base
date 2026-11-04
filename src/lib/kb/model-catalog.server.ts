/**
 * Server-only catalog for approved, currently advertised chat models.
 *
 * The model gateway may also advertise embedding and reranking models.
 * Therefore discovery is ALWAYS intersected with an operator allowlist.
 * Absence of the allowlist means no model is exposed.
 */
export type ChatModelOption = { id: string; label: string };

export function approvedModelIds(): string[] {
  return [...new Set(
    (process.env.IKB_CHAT_MODELS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0 && id.length <= 128),
  )];
}

function configuredBaseUrl(): string | null {
  const raw = process.env.IKB_MODEL_BASE_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    // HTTP is allowed for an explicitly configured private deployment.
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function modelGatewayConfig(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = configuredBaseUrl();
  const apiKey = process.env.INTERNAL_LLM_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

export async function availableChatModels(): Promise<ChatModelOption[]> {
  const allowed = approvedModelIds();
  const gateway = modelGatewayConfig();
  if (!gateway || allowed.length === 0) return [];

  try {
    const response = await fetch(`${gateway.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${gateway.apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("data" in payload)) return [];
    const data = (payload as { data?: unknown }).data;
    if (!Array.isArray(data)) return [];

    const live = new Set<string>();
    for (const model of data) {
      if (model && typeof model === "object" && "id" in model && typeof model.id === "string") {
        live.add(model.id);
      }
    }

    return allowed.filter((id) => live.has(id)).map((id) => ({ id, label: id }));
  } catch {
    // Fail closed: do not claim a model is available when discovery failed.
    return [];
  }
}
