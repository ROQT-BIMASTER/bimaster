import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { RrProdutoInput, RrLinhaInput } from "@/lib/validations/rr-produtos";

function makeHuggsId(): string {
  return `huggs-${crypto.randomUUID()}`;
}

function buildProdutoPayload(data: RrProdutoInput) {
  return {
    sku: data.sku,
    nome_comercial: data.nome_comercial,
    marca: data.marca ?? null,
    categoria: data.categoria ?? null,
    status: data.status ?? null,
    linha_notion_id: data.linha_notion_id ?? null,
    composicao_pt: !!data.composicao_pt,
    composicao_en: !!data.composicao_en,
    anvisa: data.anvisa ?? null,
    ultima_revisao_regulatoria: data.ultima_revisao_regulatoria ?? null,
    wf: data.wf ?? {},
  };
}

export function useCriarProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RrProdutoInput) => {
      const payload = {
        ...buildProdutoPayload(data),
        source_system: "huggs",
        notion_page_id: makeHuggsId(),
        synced_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("rr_produtos")
        .insert([payload as never]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rr_produtos"] });
      toast.success("Produto criado");
    },
    onError: (error: Error) =>
      toast.error("Erro ao salvar", { description: error.message }),
  });
}

export function useEditarProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      notion_page_id,
      data,
    }: {
      notion_page_id: string;
      data: RrProdutoInput;
    }) => {
      const payload = buildProdutoPayload(data);
      const { error } = await supabase
        .from("rr_produtos")
        .update(payload as never)
        .eq("notion_page_id", notion_page_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rr_produtos"] });
      toast.success("Produto atualizado");
    },
    onError: (error: Error) =>
      toast.error("Erro ao salvar", { description: error.message }),
  });
}

export function useDeletarProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notion_page_id: string) => {
      const { error } = await supabase
        .from("rr_produtos")
        .delete()
        .eq("notion_page_id", notion_page_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rr_produtos"] });
      toast.success("Produto removido");
    },
    onError: (error: Error) =>
      toast.error("Erro ao remover", { description: error.message }),
  });
}

export function useCriarLinha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RrLinhaInput) => {
      const payload = {
        nome: data.nome,
        marca: data.marca ?? null,
        status: data.status ?? null,
        source_system: "huggs",
        notion_page_id: makeHuggsId(),
        synced_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("rr_linhas")
        .insert([payload as never]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rr_linhas"] });
      toast.success("Linha criada");
    },
    onError: (error: Error) =>
      toast.error("Erro ao salvar", { description: error.message }),
  });
}
