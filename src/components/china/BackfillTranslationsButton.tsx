/**
 * BackfillTranslationsButton — dispara a edge function `china-backfill-translations`
 * para preencher label_pt/cn/en faltantes em templates, categorias e itens custom,
 * e overrides de categoria. Usa cache global — chamadas repetidas são baratas.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Languages, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { invokeChat } from "@/lib/ai/invokeChat";

interface Props {
  submissaoId?: string;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "ghost";
}

export function BackfillTranslationsButton({ submissaoId, size = "sm", variant = "outline" }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const tid = toast.loading("Reprocessando traduções...");
    const { data, error } = await invokeChat<{
      processados: number; traduzidos: number; cacheHits: number; falhas: number; demoraMs: number;
    }>(
      "china-backfill-translations",
      submissaoId ? { submissaoId } : {},
      { timeoutMs: 120_000 },
    );
    setLoading(false);
    toast.dismiss(tid);
    if (error || !data) {
      toast.error(error?.userMessage || "Falha ao reprocessar traduções");
      return;
    }
    toast.success(
      `Traduções reprocessadas: ${data.traduzidos} preenchidas · ${data.cacheHits} via cache · ${data.falhas} falhas`,
    );
  }

  return (
    <Button type="button" size={size} variant={variant} onClick={handleClick} disabled={loading} className="gap-1.5">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
      Reprocessar traduções
    </Button>
  );
}
