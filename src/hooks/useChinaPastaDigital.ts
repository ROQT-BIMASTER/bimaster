import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadAndGetSignedUrl } from "@/lib/utils/storage-helper";
import { DOCUMENT_CATEGORIES, CHINA_DOCUMENT_TYPES } from "@/lib/china-document-types";

export interface ChinaPastaDigitalItem {
  id: string;
  submissao_id: string;
  fase: string;
  titulo: string;
  paginas: string | null;
  arquivo_url: string | null;
  arquivo_path: string | null;
  documento_origem_id: string | null;
  ordem: number;
  parent_id: string | null;
  departamento_id: string | null;
  parecer_status: string;
  parecer_por: string | null;
  parecer_data: string | null;
  parecer_observacao: string | null;
  despacho_modulo: string | null;
  despacho_descricao: string | null;
  despacho_data: string | null;
  despacho_por: string | null;
  created_by: string | null;
  created_at: string;
}

export const FASES_CHINA_PASTA = [
  { key: "dados_oficiais", label: "Dados Oficiais", labelCn: "官方数据", icon: "📊" },
  { key: "formulacao", label: "Formulação / Composição", labelCn: "配方/成分", icon: "🧪" },
  { key: "doc_regulatoria", label: "Documentação Regulatória", labelCn: "法规文件", icon: "🛡️" },
  { key: "embalagem_facas", label: "Embalagem — Facas", labelCn: "包装-刀模", icon: "✂️" },
  { key: "embalagem_fotos_videos", label: "Embalagem — Fotos/Vídeos", labelCn: "包装-照片/视频", icon: "📸" },
  { key: "rotulagem", label: "Rotulagem", labelCn: "标签", icon: "🏷️" },
  { key: "etiquetas_brasil", label: "Etiquetas (Brasil Envia)", labelCn: "标签贴纸(巴西发)", icon: "🏷️" },
  { key: "eans_brasil", label: "EANs (Brasil Envia)", labelCn: "EAN码(巴西发)", icon: "📦" },
  { key: "artes", label: "Artes (Brasil/China)", labelCn: "设计稿", icon: "🎨" },
  { key: "despachos", label: "Despachos", labelCn: "调度", icon: "📋" },
  { key: "correspondencia", label: "Correspondência", labelCn: "通信", icon: "✉️" },
] as const;

export const PARECER_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pendente: { label: "Pendente", color: "text-muted-foreground", bgColor: "bg-muted" },
  aprovado: { label: "Aprovado", color: "text-success", bgColor: "bg-success/10" },
  com_pendencia: { label: "Com Pendência", color: "text-warning", bgColor: "bg-warning/10" },
  rejeitado: { label: "Rejeitado", color: "text-destructive", bgColor: "bg-destructive/10" },
};

export const DESPACHO_MODULOS = [
  { key: "composicao", label: "Composição INCI", icon: "🧪" },
  { key: "etiqueta_bula", label: "Etiqueta / Bula", icon: "🏷️" },
  { key: "fluxo_artes", label: "Motor de Artes", icon: "🎨" },
  { key: "embalagem", label: "Análise de Embalagem", icon: "📦" },
  { key: "regulatorio", label: "Regulatório", icon: "🛡️" },
  { key: "qualidade", label: "Qualidade", icon: "✅" },
] as const;

// Map china_produto_documentos tipo_documento to pasta digital fase
const TIPO_TO_FASE: Record<string, string> = {
  planilha_excel: "dados_oficiais",
  formula: "formulacao",
  volumetria: "formulacao",
  doc_regulatoria: "doc_regulatoria",
  faca_primaria: "embalagem_facas",
  faca_display: "embalagem_facas",
  faca_cartucho: "embalagem_facas",
  faca_tester: "embalagem_facas",
  amostra_foto: "embalagem_fotos_videos",
  amostra_video: "embalagem_fotos_videos",
  foto_confirmed_item: "embalagem_fotos_videos",
  foto_cores_todas: "embalagem_fotos_videos",
  foto_garrafa: "embalagem_fotos_videos",
  foto_garrafa_design: "embalagem_fotos_videos",
  foto_cores_produto: "embalagem_fotos_videos",
  foto_embalagem_ref: "embalagem_fotos_videos",
  foto_produto_individual: "embalagem_fotos_videos",
  foto_cores_pesos: "embalagem_fotos_videos",
  foto_rotulo: "rotulagem",
  foto_arte: "artes",
  etiqueta_fundo: "etiquetas_brasil",
  etiqueta_tester: "etiquetas_brasil",
  etiqueta_bula: "etiquetas_brasil",
  arte_display: "artes",
  ean_unitario: "eans_brasil",
  ean_display: "eans_brasil",
  ean_caixa: "eans_brasil",
  solicitacao_amostra_fotos: "embalagem_fotos_videos",
  solicitacao_amostra_videos: "embalagem_fotos_videos",
};

export function useChinaPastaDigital(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["china-pasta-digital", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_pasta_digital" as any)
        .select("*")
        .eq("submissao_id", submissaoId!)
        .order("fase")
        .order("ordem") as any);
      if (error) throw error;
      return (data || []) as ChinaPastaDigitalItem[];
    },
  });
}

export function useAddChinaPastaDigitalItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      submissao_id: string;
      fase: string;
      titulo: string;
      paginas?: string;
      departamento_id?: string;
      parent_id?: string;
      file?: File;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      let arquivo_url: string | null = null;
      let arquivo_path: string | null = null;

      if (params.file) {
        const path = `${params.submissao_id}/${params.fase}/${Date.now()}_${params.file.name}`;
        const result = await uploadAndGetSignedUrl("china-pasta-digital", path, params.file);
        if (result.error) throw result.error;
        arquivo_url = result.signedUrl;
        arquivo_path = path;
      }

      const { data: existing } = await (supabase
        .from("china_pasta_digital" as any)
        .select("ordem")
        .eq("submissao_id", params.submissao_id)
        .eq("fase", params.fase)
        .order("ordem", { ascending: false })
        .limit(1) as any);

      const nextOrdem = (existing?.[0]?.ordem ?? -1) + 1;

      const { error } = await (supabase
        .from("china_pasta_digital" as any)
        .insert({
          submissao_id: params.submissao_id,
          fase: params.fase,
          titulo: params.titulo,
          paginas: params.paginas || null,
          arquivo_url,
          arquivo_path,
          ordem: nextOrdem,
          parent_id: params.parent_id || null,
          departamento_id: params.departamento_id || null,
          created_by: user?.id,
        }) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["china-pasta-digital", vars.submissao_id] });
      toast.success("Peça adicionada à Pasta Digital China");
    },
    onError: () => toast.error("Erro ao adicionar peça"),
  });
}

export function useEmitirParecerChina() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      submissao_id: string;
      parecer_status: string;
      parecer_observacao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase
        .from("china_pasta_digital" as any)
        .update({
          parecer_status: params.parecer_status,
          parecer_por: user?.id,
          parecer_data: new Date().toISOString(),
          parecer_observacao: params.parecer_observacao || null,
        })
        .eq("id", params.id) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["china-pasta-digital", vars.submissao_id] });
      toast.success("Parecer registrado");
    },
    onError: () => toast.error("Erro ao emitir parecer"),
  });
}

export function useDespacharModulo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      submissao_id: string;
      despacho_modulo: string;
      despacho_descricao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase
        .from("china_pasta_digital" as any)
        .update({
          despacho_modulo: params.despacho_modulo,
          despacho_descricao: params.despacho_descricao || null,
          despacho_data: new Date().toISOString(),
          despacho_por: user?.id,
        })
        .eq("id", params.id) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["china-pasta-digital", vars.submissao_id] });
      toast.success("Documento despachado para módulo");
    },
    onError: () => toast.error("Erro ao despachar"),
  });
}

export function useDeleteChinaPastaDigitalItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; submissao_id: string; arquivo_path?: string | null }) => {
      if (params.arquivo_path) {
        await supabase.storage.from("china-pasta-digital").remove([params.arquivo_path]);
      }
      const { error } = await (supabase
        .from("china_pasta_digital" as any)
        .delete()
        .eq("id", params.id) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["china-pasta-digital", vars.submissao_id] });
      toast.success("Peça removida");
    },
    onError: () => toast.error("Erro ao remover peça"),
  });
}

export function useAutoImportChinaDocs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissaoId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if already imported
      const { data: existing } = await (supabase
        .from("china_pasta_digital" as any)
        .select("documento_origem_id")
        .eq("submissao_id", submissaoId)
        .not("documento_origem_id", "is", null) as any);
      
      const importedIds = new Set((existing || []).map((e: any) => e.documento_origem_id));

      // Get all docs for this submission
      const { data: docs } = await (supabase
        .from("china_produto_documentos" as any)
        .select("*")
        .eq("submissao_id", submissaoId) as any);

      if (!docs || docs.length === 0) return 0;

      const toInsert = docs
        .filter((d: any) => !importedIds.has(d.id))
        .map((d: any, idx: number) => {
          const fase = TIPO_TO_FASE[d.tipo_documento] || "correspondencia";
          const docType = CHINA_DOCUMENT_TYPES.find(t => t.tipo === d.tipo_documento);
          return {
            submissao_id: submissaoId,
            fase,
            titulo: docType ? docType.labelPt : d.nome_arquivo || d.tipo_documento,
            arquivo_url: d.arquivo_url,
            arquivo_path: d.arquivo_path,
            documento_origem_id: d.id,
            ordem: idx,
            parecer_status: d.status === "aprovado" ? "aprovado" : "pendente",
            created_by: user?.id,
          };
        });

      if (toInsert.length === 0) return 0;

      const { error } = await (supabase
        .from("china_pasta_digital" as any)
        .insert(toInsert) as any);
      if (error) throw error;

      return toInsert.length;
    },
    onSuccess: (count, submissaoId) => {
      queryClient.invalidateQueries({ queryKey: ["china-pasta-digital", submissaoId] });
      if (count && count > 0) {
        toast.success(`${count} documento(s) importado(s) para a Pasta Digital`);
      }
    },
    onError: () => toast.error("Erro na auto-importação"),
  });
}
