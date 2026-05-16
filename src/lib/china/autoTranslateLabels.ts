/**
 * autoTranslateLabels — completa label_pt / label_cn / label_en quando o
 * usuário só preenche um ou dois idiomas. Best-effort: se a IA falha, devolve
 * o input original (com fallback PT→EN→CN para nunca ficar vazio).
 *
 * Chama a edge function `china-translate-labels` (Gemini Flash).
 */
import { invokeChat } from "@/lib/ai/invokeChat";

export interface LabelTriad {
  pt: string;
  cn: string;
  en: string;
}

export interface LabelInput {
  pt?: string | null;
  cn?: string | null;
  en?: string | null;
}

function fallback(input: LabelInput): LabelTriad {
  const pt = (input.pt || "").trim();
  const cn = (input.cn || "").trim();
  const en = (input.en || "").trim();
  return {
    pt: pt || en || cn || "",
    cn: cn || pt || en || "",
    en: en || pt || cn || "",
  };
}

function isComplete(input: LabelInput): boolean {
  return !!(input.pt && input.pt.trim() && input.cn && input.cn.trim() && input.en && input.en.trim());
}

/** Traduz um único rótulo. Nunca lança — sempre devolve os 3 idiomas. */
export async function autoTranslateLabel(
  input: LabelInput,
  opts: { context?: string; timeoutMs?: number } = {},
): Promise<LabelTriad> {
  if (isComplete(input)) return fallback(input);
  // Se está completamente vazio, não chama IA.
  if (!input.pt && !input.cn && !input.en) return { pt: "", cn: "", en: "" };

  const { data, error } = await invokeChat<{ items: Array<{ id: string } & LabelTriad> }>(
    "china-translate-labels",
    {
      items: [{ id: "x", pt: input.pt || "", cn: input.cn || "", en: input.en || "" }],
      context: opts.context,
    },
    { timeoutMs: opts.timeoutMs ?? 25_000 },
  );

  if (error || !data?.items?.[0]) return fallback(input);
  return fallback(data.items[0]);
}

/** Traduz um lote (até 50). Mantém a ordem do input. */
export async function autoTranslateLabelsBatch(
  inputs: Array<LabelInput & { id: string }>,
  opts: { context?: string; timeoutMs?: number } = {},
): Promise<Array<LabelTriad & { id: string }>> {
  if (inputs.length === 0) return [];
  // Tudo completo → no-op
  if (inputs.every(isComplete)) {
    return inputs.map((i) => ({ id: i.id, ...fallback(i) }));
  }

  const { data, error } = await invokeChat<{ items: Array<{ id: string } & LabelTriad> }>(
    "china-translate-labels",
    {
      items: inputs.slice(0, 50).map((i) => ({
        id: i.id,
        pt: i.pt || "",
        cn: i.cn || "",
        en: i.en || "",
      })),
      context: opts.context,
    },
    { timeoutMs: opts.timeoutMs ?? 45_000 },
  );

  if (error || !data?.items) {
    return inputs.map((i) => ({ id: i.id, ...fallback(i) }));
  }

  const byId = new Map(data.items.map((it) => [it.id, it]));
  return inputs.map((i) => {
    const got = byId.get(i.id);
    return { id: i.id, ...fallback(got ?? i) };
  });
}
