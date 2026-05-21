// src/hooks/useBriefingExport.ts
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeChat } from "@/lib/ai/invokeChat";
import { triggerBlobDownload } from "@/lib/utils/storage-download";
import { exportBriefingPdf } from "@/lib/briefings/exportPdf";
import { exportBriefingXlsx } from "@/lib/briefings/exportXlsx";
import type {
  BriefingExportConfig,
  BriefingExportFormato,
} from "@/lib/briefings/exportTypes";
import { DEFAULT_EXPORT_CONFIG } from "@/lib/briefings/exportTypes";
import type { Briefing, TemplateSection } from "@/hooks/useBriefingChat";
import { toast } from "sonner";

interface Args {
  briefing: Briefing;
  sections: TemplateSection[];
  projetoNome?: string | null;
  autorNome?: string | null;
}

interface ResumoResp {
  resumo: string;
  mensagem_chave: string;
  riscos: string[];
}

async function carregarAprovacoes(briefingId: string) {
  const { data } = await supabase
    .from("fluxo_aprovacao_instancias")
    .select("*")
    .eq("briefing_id", briefingId)
    .order("ordem", { ascending: true });
  return (data ?? []).map((row: any) => ({
    ordem: Number(row.ordem ?? 0),
    nome: String(row.nome_etapa ?? row.nome ?? "Etapa"),
    responsaveis: Array.isArray(row.responsaveis)
      ? row.responsaveis.map((r: any) => r?.nome || r?.email || r).filter(Boolean)
      : [],
    status: String(row.status ?? "pendente"),
    decidido_em: row.decidido_em ?? null,
    parecer: row.parecer ?? null,
  }));
}

export function useBriefingExport({ briefing, sections, projetoNome, autorNome }: Args) {
  const [loadingPreset, setLoadingPreset] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [config, setConfig] = useState<BriefingExportConfig>(() => ({
    ...DEFAULT_EXPORT_CONFIG,
    titulo: briefing.titulo,
  }));

  const carregarPreset = useCallback(async () => {
    setLoadingPreset(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("briefing_export_presets")
        .select("config")
        .eq("user_id", uid)
        .eq("is_default", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.config) {
        setConfig((prev) => ({
          ...prev,
          ...(data.config as Partial<BriefingExportConfig>),
          titulo: briefing.titulo,
        }));
      }
    } finally {
      setLoadingPreset(false);
    }
  }, [briefing.titulo]);

  const salvarPreset = useCallback(
    async (cfg: BriefingExportConfig) => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      // Não salvamos o logo no preset (pode ser grande). O usuário recarrega quando quiser.
      const { logoDataUrl, ...persistivel } = cfg;
      try {
        await supabase.from("briefing_export_presets").upsert(
          {
            user_id: uid,
            nome: "Padrão",
            is_default: true,
            config: persistivel as any,
          },
          { onConflict: "user_id,nome" } as any,
        );
      } catch {
        // best-effort
      }
    },
    [],
  );


  const exportar = useCallback(
    async (formato: BriefingExportFormato, cfg: BriefingExportConfig) => {
      setExporting(true);
      const tid = toast.loading(
        formato === "pdf" ? "Gerando PDF..." : "Gerando planilha...",
      );
      try {
        // Resumo da IA (opcional)
        let resumo: ResumoResp | null = null;
        if (cfg.incluir.resumoExecutivo) {
          const { data, error } = await invokeChat<ResumoResp>(
            "briefing-export-summary",
            {
              titulo: briefing.titulo,
              tipo: briefing.tipo,
              campos: briefing.payload ?? {},
              idioma: cfg.idioma,
              nivel: cfg.nivel,
            },
            { timeoutMs: 60_000 },
          );
          if (!error && data) resumo = data;
        }

        const aprovacoes = cfg.incluir.aprovacoes
          ? await carregarAprovacoes(briefing.id)
          : [];

        const payload = {
          briefing,
          sections,
          config: cfg,
          projetoNome,
          autorNome,
          aprovacoes,
          resumo,
        };

        const slug = briefing.titulo
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60) || "briefing";

        let blob: Blob;
        let ext: string;
        if (formato === "pdf") {
          blob = await exportBriefingPdf(payload);
          ext = "pdf";
        } else {
          blob = await exportBriefingXlsx(payload);
          ext = "xlsx";
        }

        const url = URL.createObjectURL(blob);
        triggerBlobDownload(url, `${slug}.${ext}`);

        // Salva preset (best-effort)
        salvarPreset(cfg);

        toast.success("Exportação concluída", { id: tid });
      } catch (err: any) {
        toast.error(err?.message || "Erro ao exportar", { id: tid });
      } finally {
        setExporting(false);
      }
    },
    [briefing, sections, projetoNome, autorNome, salvarPreset],
  );

  return { config, setConfig, exportar, exporting, loadingPreset, carregarPreset };
}
