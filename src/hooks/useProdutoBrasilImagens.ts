import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { compressImage, uploadAndGetSignedUrl } from "@/lib/utils/storage-helper";

export interface ProdutoBrasilImagem {
  id: string;
  produto_brasil_id: string;
  image_url: string;
  image_path: string | null;
  etapa: string;
  origem: string;
  descricao: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export const ETAPA_LABELS: Record<string, string> = {
  china_source: "Fotos da China (Origem)",
  product_analysis: "Análise de Produto",
  development: "Desenvolvimento / Ajustes",
  approved_catalog: "Aprovadas para Cadastro",
  marketing: "Fotos Finais (Catálogo)",
};

export const ORIGEM_LABELS: Record<string, string> = {
  china_supplier: "Fornecedor China",
  internal_team: "Equipe Interna",
  marketing_team: "Marketing",
};

const ETAPA_ORDER = ["china_source", "product_analysis", "development", "approved_catalog", "marketing"];

export function useProdutoBrasilImagens(produtoBrasilId: string | undefined) {
  return useQuery({
    queryKey: ["produto-brasil-imagens", produtoBrasilId],
    enabled: !!produtoBrasilId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produto_brasil_imagens" as any)
        .select("*")
        .eq("produto_brasil_id", produtoBrasilId!)
        .order("created_at") as any);
      if (error) throw error;
      const imgs = (data || []) as ProdutoBrasilImagem[];
      // Sort by etapa order then date
      return imgs.sort((a, b) => {
        const ea = ETAPA_ORDER.indexOf(a.etapa);
        const eb = ETAPA_ORDER.indexOf(b.etapa);
        if (ea !== eb) return ea - eb;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    },
  });
}

export function useUploadProdutoImagem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      produtoBrasilId,
      file,
      etapa,
      origem,
      descricao,
    }: {
      produtoBrasilId: string;
      file: File;
      etapa: string;
      origem: string;
      descricao?: string;
    }) => {
      const compressed = await compressImage(file);
      const filePath = `${produtoBrasilId}/${Date.now()}-${file.name}`;
      const result = await uploadAndGetSignedUrl("produto-brasil-imagens", filePath, compressed);
      if (result.error) throw result.error;

      const { error } = await (supabase
        .from("produto_brasil_imagens" as any)
        .insert({
          produto_brasil_id: produtoBrasilId,
          image_url: result.signedUrl,
          image_path: filePath,
          etapa,
          origem,
          descricao: descricao || null,
          uploaded_by: user?.id || null,
        }) as any);
      if (error) throw error;

      // Log to historico
      await (supabase.from("produto_brasil_historico" as any).insert({
        produto_brasil_id: produtoBrasilId,
        tipo: "foto_adicionada",
        descricao: `Foto adicionada na etapa "${ETAPA_LABELS[etapa] || etapa}"`,
        user_id: user?.id || null,
        metadata: { etapa, origem, file_name: file.name },
      }) as any);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-imagens", vars.produtoBrasilId] });
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-historico", vars.produtoBrasilId] });
      toast.success("Imagem enviada!");
    },
    onError: () => toast.error("Erro ao enviar imagem"),
  });
}

export function useImportChinaPhotos() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      produtoBrasilId,
      submissaoId,
    }: {
      produtoBrasilId: string;
      submissaoId: string;
    }) => {
      // Check if already imported
      const { data: existing } = await (supabase
        .from("produto_brasil_imagens" as any)
        .select("id")
        .eq("produto_brasil_id", produtoBrasilId)
        .eq("etapa", "china_source")
        .limit(1) as any);
      if (existing && existing.length > 0) return;

      // Get china_produto_cores photos
      const { data: cores } = await (supabase
        .from("china_produto_cores" as any)
        .select("cor_nome, foto_url")
        .eq("submissao_id", submissaoId) as any);

      const photosToInsert = (cores || [])
        .filter((c: any) => c.foto_url)
        .map((c: any) => ({
          produto_brasil_id: produtoBrasilId,
          image_url: c.foto_url,
          etapa: "china_source",
          origem: "china_supplier",
          descricao: `Cor: ${c.cor_nome}`,
          uploaded_by: user?.id || null,
        }));

      if (photosToInsert.length > 0) {
        await (supabase.from("produto_brasil_imagens" as any).insert(photosToInsert) as any);
        await (supabase.from("produto_brasil_historico" as any).insert({
          produto_brasil_id: produtoBrasilId,
          tipo: "fotos_china_importadas",
          descricao: `${photosToInsert.length} foto(s) importada(s) da submissão China`,
          user_id: user?.id || null,
        }) as any);
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-imagens", vars.produtoBrasilId] });
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-historico", vars.produtoBrasilId] });
    },
  });
}

export function useDeleteProdutoImagem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, produtoBrasilId, imagePath }: { id: string; produtoBrasilId: string; imagePath?: string | null }) => {
      if (imagePath) {
        await supabase.storage.from("produto-brasil-imagens").remove([imagePath]);
      }
      const { error } = await (supabase
        .from("produto_brasil_imagens" as any)
        .delete()
        .eq("id", id) as any);
      if (error) throw error;
      return produtoBrasilId;
    },
    onSuccess: (produtoBrasilId) => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-imagens", produtoBrasilId] });
      toast.success("Imagem removida");
    },
  });
}
