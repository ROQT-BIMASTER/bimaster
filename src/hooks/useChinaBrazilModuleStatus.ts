import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface ArteStatus {
  tipo: string;
  label: string;
  labelCn: string;
  etapa_atual: string;
  status_geral: string;
  count: number;
}

export interface CofreStatus {
  total: number;
  preenchidos: number;
  obrigatorios_total: number;
  obrigatorios_preenchidos: number;
}

export interface ComposicaoStatus {
  total_ingredientes: number;
  aprovados: number;
  pendentes: number;
  restritos: number;
  versao_atual: number;
  versao_status: string;
}

export interface BrazilModuleStatus {
  artes: ArteStatus[];
  cofre: CofreStatus;
  composicao: ComposicaoStatus;
}

const ARTE_TIPO_LABELS: Record<string, { pt: string; cn: string }> = {
  etiqueta_bula: { pt: "Etiqueta / Bula", cn: "标签/说明书" },
  etiqueta_fundo: { pt: "Etiqueta de Fundo", cn: "底部标签" },
  tester: { pt: "Tester", cn: "试用装" },
  etiqueta_teste: { pt: "Etiqueta de Teste", cn: "测试标签" },
  display: { pt: "Display", cn: "展示盒" },
};

const ETAPA_LABELS: Record<string, { pt: string; cn: string }> = {
  criacao: { pt: "Criação", cn: "创作" },
  embalagem: { pt: "Embalagem", cn: "包装" },
  desenvolvimento: { pt: "Desenvolvimento", cn: "开发" },
  regulatorio: { pt: "Regulatório", cn: "监管" },
  af_final: { pt: "Arte Final", cn: "终稿" },
};

const STATUS_LABELS: Record<string, { pt: string; cn: string }> = {
  em_andamento: { pt: "Em Andamento", cn: "进行中" },
  aguardando_aprovacao: { pt: "Aguardando", cn: "等待中" },
  aprovado: { pt: "Aprovado", cn: "已批准" },
  rejeitado: { pt: "Rejeitado", cn: "已拒绝" },
  af_recebida: { pt: "AF Recebida", cn: "终稿已收" },
};

export { ARTE_TIPO_LABELS, ETAPA_LABELS, STATUS_LABELS };

export function useChinaBrazilModuleStatus(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["china-brazil-modules", submissaoId],
    enabled: !!submissaoId,
    queryFn: async (): Promise<BrazilModuleStatus> => {
      // Parallel fetch all 3 modules
      const [artesRes, cofreItensRes, cofreDocsRes, composicaoRes, versoesRes] = await Promise.all([
        // 1. Fluxo de Artes - by produto_id = submissaoId
        supabase
          .from("produto_fluxo_artes")
          .select("tipo_checklist, etapa_atual, status_geral")
          .eq("produto_id", submissaoId!) as any,
        // 2. Cofre - itens for this submissão
        supabase
          .from("cofre_produto_itens" as any)
          .select("id, obrigatorio, status")
          .eq("submissao_id", submissaoId!) as any,
        // 2b. Cofre - documentos count
        supabase
          .from("china_produto_documentos")
          .select("cofre_item_id")
          .eq("submissao_id", submissaoId!)
          .not("cofre_item_id", "is", null) as any,
        // 3. Composição INCI
        supabase
          .from("produto_composicao")
          .select("status_anvisa")
          .eq("submissao_id", submissaoId!) as any,
        // 3b. Latest version status
        supabase
          .from("produto_composicao_versoes")
          .select("versao, status")
          .eq("submissao_id", submissaoId!)
          .order("versao", { ascending: false })
          .limit(1) as any,
      ]);

      // ── Artes ──
      const artesData = (artesRes.data || []) as any[];
      const artesGrouped = new Map<string, ArteStatus>();
      for (const a of artesData) {
        const existing = artesGrouped.get(a.tipo_checklist);
        if (existing) {
          existing.count++;
        } else {
          const labels = ARTE_TIPO_LABELS[a.tipo_checklist] || { pt: a.tipo_checklist, cn: a.tipo_checklist };
          artesGrouped.set(a.tipo_checklist, {
            tipo: a.tipo_checklist,
            label: labels.pt,
            labelCn: labels.cn,
            etapa_atual: a.etapa_atual,
            status_geral: a.status_geral,
            count: 1,
          });
        }
      }

      // ── Cofre ──
      const cofreItens = (cofreItensRes.data || []) as any[];
      const cofreDocs = (cofreDocsRes.data || []) as any[];
      const filledItemIds = new Set(cofreDocs.map((d: any) => d.cofre_item_id));
      const cofre: CofreStatus = {
        total: cofreItens.length,
        preenchidos: cofreItens.filter((i: any) => filledItemIds.has(i.id) || i.status === "aprovado").length,
        obrigatorios_total: cofreItens.filter((i: any) => i.obrigatorio).length,
        obrigatorios_preenchidos: cofreItens.filter((i: any) => i.obrigatorio && (filledItemIds.has(i.id) || i.status === "aprovado")).length,
      };

      // ── Composição ──
      const compItems = (composicaoRes.data || []) as any[];
      const latestVersion = (versoesRes.data || [])[0] as any;
      const composicao: ComposicaoStatus = {
        total_ingredientes: compItems.length,
        aprovados: compItems.filter((i: any) => i.status_anvisa === "conforme").length,
        pendentes: compItems.filter((i: any) => i.status_anvisa === "pendente" || i.status_anvisa === "em_analise").length,
        restritos: compItems.filter((i: any) => i.status_anvisa === "restrito" || i.status_anvisa === "atencao").length,
        versao_atual: latestVersion?.versao || 0,
        versao_status: latestVersion?.status || "sem_dados",
      };

      return {
        artes: Array.from(artesGrouped.values()),
        cofre,
        composicao,
      };
    },
  });
}
