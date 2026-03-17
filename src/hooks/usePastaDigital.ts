import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadAndGetSignedUrl } from "@/lib/utils/storage-helper";

export interface PastaDigitalItem {
  id: string;
  produto_brasil_id: string;
  fase: string;
  titulo: string;
  paginas: string | null;
  arquivo_url: string | null;
  arquivo_path: string | null;
  ordem: number;
  parent_id: string | null;
  departamento_id: string | null;
  parecer_status: string;
  parecer_por: string | null;
  parecer_data: string | null;
  parecer_observacao: string | null;
  created_by: string | null;
  created_at: string;
}

export const FASES_PASTA = [
  { key: "documentos_diversos", label: "Documentos Diversos", icon: "📄" },
  { key: "despacho", label: "Despacho", icon: "📋" },
  { key: "certidao", label: "Certidão de Publicação", icon: "📜" },
  { key: "emenda", label: "Emenda à Inicial", icon: "✏️" },
  { key: "laudo", label: "Laudo / Parecer Técnico", icon: "🔬" },
  { key: "registro", label: "Registro ANVISA", icon: "🏛️" },
  { key: "rotulagem", label: "Rotulagem / Arte Final", icon: "🎨" },
  { key: "formulacao", label: "Formulação / FDS", icon: "🧪" },
  { key: "contrato", label: "Contrato / Acordo", icon: "📝" },
  { key: "correspondencia", label: "Correspondência", icon: "✉️" },
] as const;

export const PARECER_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pendente: { label: "Pendente", color: "text-muted-foreground", bgColor: "bg-muted" },
  aprovado: { label: "Aprovado", color: "text-success", bgColor: "bg-success/10" },
  com_pendencia: { label: "Com Pendência", color: "text-warning", bgColor: "bg-warning/10" },
  rejeitado: { label: "Rejeitado", color: "text-destructive", bgColor: "bg-destructive/10" },
};

export function usePastaDigital(produtoBrasilId: string | undefined) {
  return useQuery({
    queryKey: ["pasta-digital", produtoBrasilId],
    enabled: !!produtoBrasilId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produto_brasil_pasta_digital" as any)
        .select("*")
        .eq("produto_brasil_id", produtoBrasilId!)
        .order("fase")
        .order("ordem") as any);
      if (error) throw error;
      return (data || []) as PastaDigitalItem[];
    },
  });
}

export function useAddPastaDigitalItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      produto_brasil_id: string;
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
        const path = `${params.produto_brasil_id}/${params.fase}/${Date.now()}_${params.file.name}`;
        const result = await uploadAndGetSignedUrl("pasta-digital", path, params.file);
        if (result.error) throw result.error;
        arquivo_url = result.signedUrl;
        arquivo_path = path;
      }

      // Get next ordem
      const { data: existing } = await (supabase
        .from("produto_brasil_pasta_digital" as any)
        .select("ordem")
        .eq("produto_brasil_id", params.produto_brasil_id)
        .eq("fase", params.fase)
        .order("ordem", { ascending: false })
        .limit(1) as any);

      const nextOrdem = (existing?.[0]?.ordem ?? -1) + 1;

      const { error } = await (supabase
        .from("produto_brasil_pasta_digital" as any)
        .insert({
          produto_brasil_id: params.produto_brasil_id,
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
      queryClient.invalidateQueries({ queryKey: ["pasta-digital", vars.produto_brasil_id] });
      toast.success("Peça adicionada à pasta digital");
    },
    onError: () => toast.error("Erro ao adicionar peça"),
  });
}

export function useEmitirParecer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      produto_brasil_id: string;
      parecer_status: string;
      parecer_observacao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase
        .from("produto_brasil_pasta_digital" as any)
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
      queryClient.invalidateQueries({ queryKey: ["pasta-digital", vars.produto_brasil_id] });
      toast.success("Parecer registrado");
    },
    onError: () => toast.error("Erro ao emitir parecer"),
  });
}

export function useDeletePastaDigitalItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; produto_brasil_id: string; arquivo_path?: string | null }) => {
      if (params.arquivo_path) {
        await supabase.storage.from("pasta-digital").remove([params.arquivo_path]);
      }
      const { error } = await (supabase
        .from("produto_brasil_pasta_digital" as any)
        .delete()
        .eq("id", params.id) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pasta-digital", vars.produto_brasil_id] });
      toast.success("Peça removida");
    },
    onError: () => toast.error("Erro ao remover peça"),
  });
}
