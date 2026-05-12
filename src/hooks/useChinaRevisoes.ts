
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Anotacao {
  tipo: string;
  descricao: string;
  campo?: string;
}

export type IdiomaRevisao = "pt" | "zh" | "en";

export interface RevisaoAnexo {
  path: string;
  nome: string;
  tamanho?: number;
  mime?: string;
  lado: "brasil" | "china";
}

export interface Revisao {
  id: string;
  documento_id: string;
  submissao_id: string;
  rodada: number;
  resultado: string;
  motivo_rejeicao: string | null;
  anotacoes: Anotacao[];
  revisado_por: string | null;
  contestado_por: string | null;
  contestacao_texto: string | null;
  acao_tipo: string | null;
  acao_por_nome: string | null;
  created_at: string;
  anexos: RevisaoAnexo[];
  motivo_idioma_origem: IdiomaRevisao | null;
  motivo_traducoes: Partial<Record<IdiomaRevisao, string>>;
  contestacao_idioma_origem: IdiomaRevisao | null;
  contestacao_traducoes: Partial<Record<IdiomaRevisao, string>>;
}

async function getUserName(): Promise<{ id: string; nome: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: "", nome: "Usuário" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", user.id)
    .single();
  return { id: user.id, nome: (profile as any)?.nome || user.email?.split("@")[0] || "Usuário" };
}

export function useRevisoesPorSubmissao(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["china-revisoes", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_doc_revisoes" as any)
        .select("*")
        .eq("submissao_id", submissaoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Revisao[];
    },
  });
}

export function useCriarRevisao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      documento_id: string;
      submissao_id: string;
      resultado: "aprovado" | "rejeitado";
      motivo_rejeicao?: string;
      anotacoes?: Anotacao[];
      acao_tipo?: string;
    }) => {
      const user = await getUserName();

      // Get current round
      const { data: existing } = await supabase
        .from("china_doc_revisoes" as any)
        .select("rodada")
        .eq("documento_id", params.documento_id)
        .order("rodada", { ascending: false })
        .limit(1);

      const rodada = ((existing as any)?.[0]?.rodada || 0) + 1;

      const { error } = await supabase
        .from("china_doc_revisoes" as any)
        .insert({
          documento_id: params.documento_id,
          submissao_id: params.submissao_id,
          rodada,
          resultado: params.resultado,
          motivo_rejeicao: params.motivo_rejeicao || null,
          anotacoes: params.anotacoes || [],
          revisado_por: user.id,
          acao_tipo: params.acao_tipo || params.resultado,
          acao_por_nome: user.nome,
        } as any);
      if (error) throw error;

      // Update document status
      await supabase
        .from("china_produto_documentos" as any)
        .update({ status: params.resultado } as any)
        .eq("id", params.documento_id);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["china-revisoes", vars.submissao_id] });
      queryClient.invalidateQueries({ queryKey: ["china-ficha-docs", vars.submissao_id] });
      const msg = vars.resultado === "aprovado"
        ? "Documento aprovado! 文件已批准！"
        : "Documento rejeitado. 文件已拒绝。";
      toast.success(msg);
    },
  });
}

export function useDarCiencia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      documento_id: string;
      submissao_id: string;
    }) => {
      const user = await getUserName();

      const { data: existing } = await supabase
        .from("china_doc_revisoes" as any)
        .select("rodada")
        .eq("documento_id", params.documento_id)
        .order("rodada", { ascending: false })
        .limit(1);

      const rodada = ((existing as any)?.[0]?.rodada || 0) + 1;

      const { error } = await supabase
        .from("china_doc_revisoes" as any)
        .insert({
          documento_id: params.documento_id,
          submissao_id: params.submissao_id,
          rodada,
          resultado: "ciencia",
          revisado_por: user.id,
          acao_tipo: "ciencia",
          acao_por_nome: user.nome,
          anotacoes: [],
        } as any);
      if (error) throw error;

      await supabase
        .from("china_produto_documentos" as any)
        .update({ status: "ciencia" } as any)
        .eq("id", params.documento_id);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["china-revisoes", vars.submissao_id] });
      queryClient.invalidateQueries({ queryKey: ["china-ficha-docs", vars.submissao_id] });
      toast.success("Ciência registrada! 已确认！");
    },
  });
}

export function useContestarRevisao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      revisao_id: string;
      submissao_id: string;
      documento_id: string;
      contestacao_texto: string;
    }) => {
      const user = await getUserName();

      await supabase
        .from("china_doc_revisoes" as any)
        .update({
          resultado: "contestado",
          contestado_por: user.id,
          contestacao_texto: params.contestacao_texto,
          acao_tipo: "contestar",
          acao_por_nome: user.nome,
        } as any)
        .eq("id", params.revisao_id);

      await supabase
        .from("china_produto_documentos" as any)
        .update({ status: "contestado" } as any)
        .eq("id", params.documento_id);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["china-revisoes", vars.submissao_id] });
      queryClient.invalidateQueries({ queryKey: ["china-ficha-docs", vars.submissao_id] });
      toast.success("Contestação enviada! 异议已提交！");
    },
  });
}

const BUCKET = "china-documentos";

function detectLang(s: string): IdiomaRevisao {
  if (/[\u4e00-\u9fff]/.test(s)) return "zh";
  if (/[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(s) || /\b(de|para|não|com|que|aprovação|rejeição)\b/i.test(s)) return "pt";
  return "en";
}

async function uploadAnexos(
  files: File[],
  basePath: string,
  lado: "brasil" | "china",
): Promise<RevisaoAnexo[]> {
  const out: RevisaoAnexo[] = [];
  for (const f of files) {
    const safe = f.name.replace(/[^\w.\-]+/g, "_");
    const path = `${basePath}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
      contentType: f.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw error;
    out.push({ path, nome: f.name, tamanho: f.size, mime: f.type, lado });
  }
  return out;
}

/**
 * Brasil rejeita um documento com laudo técnico obrigatório + anexos opcionais.
 */
export function useRejeitarComLaudo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      documento_id: string;
      submissao_id: string;
      motivo: string;
      anexos?: File[];
    }) => {
      const user = await getUserName();
      const motivo = params.motivo.trim();
      if (!motivo) throw new Error("Laudo técnico é obrigatório.");

      const { data: existing } = await supabase
        .from("china_doc_revisoes" as any)
        .select("rodada")
        .eq("documento_id", params.documento_id)
        .order("rodada", { ascending: false })
        .limit(1);
      const rodada = ((existing as any)?.[0]?.rodada || 0) + 1;
      const idioma = detectLang(motivo);

      const { data: revInsert, error: revErr } = await supabase
        .from("china_doc_revisoes" as any)
        .insert({
          documento_id: params.documento_id,
          submissao_id: params.submissao_id,
          rodada,
          resultado: "rejeitado",
          motivo_rejeicao: motivo,
          motivo_idioma_origem: idioma,
          motivo_traducoes: { [idioma]: motivo },
          revisado_por: user.id,
          acao_tipo: "rejeitar",
          acao_por_nome: user.nome,
          anotacoes: [],
          anexos: [],
        } as any)
        .select("id")
        .single();
      if (revErr) throw revErr;
      const revisaoId = (revInsert as any).id as string;

      const anexos = params.anexos?.length
        ? await uploadAnexos(
            params.anexos,
            `revisoes/${params.submissao_id}/${revisaoId}`,
            "brasil",
          )
        : [];

      if (anexos.length) {
        await supabase
          .from("china_doc_revisoes" as any)
          .update({ anexos } as any)
          .eq("id", revisaoId);
      }

      await supabase
        .from("china_produto_documentos" as any)
        .update({ status: "rejeitado" } as any)
        .eq("id", params.documento_id);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["china-revisoes", vars.submissao_id] });
      queryClient.invalidateQueries({ queryKey: ["china-ficha-docs", vars.submissao_id] });
      queryClient.invalidateQueries({ queryKey: ["china-doc-versoes", vars.documento_id] });
      toast.success("Documento rejeitado com laudo técnico. 已附技术报告拒绝。");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao rejeitar documento."),
  });
}

/**
 * China substitui um documento rejeitado, anexando parecer técnico obrigatório,
 * novo arquivo principal e anexos opcionais de embasamento. A versão anterior
 * é arquivada em china_doc_versoes para preservar a trilha de auditoria.
 */
export function useContestarComParecer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      documento_id: string;
      submissao_id: string;
      tipo_documento: string;
      parecer: string;
      novo_arquivo: File;
      anexos?: File[];
    }) => {
      const user = await getUserName();
      const parecer = params.parecer.trim();
      if (!parecer) throw new Error("Parecer técnico é obrigatório.");
      if (!params.novo_arquivo) throw new Error("Novo arquivo é obrigatório.");

      // 1) Snapshot do documento atual
      const { data: docAtual, error: docErr } = await supabase
        .from("china_produto_documentos" as any)
        .select("id, tipo_documento, arquivo_path, arquivo_url, nome_arquivo")
        .eq("id", params.documento_id)
        .maybeSingle();
      if (docErr) throw docErr;

      // 2) Calcula nova rodada
      const { data: existing } = await supabase
        .from("china_doc_revisoes" as any)
        .select("rodada")
        .eq("documento_id", params.documento_id)
        .order("rodada", { ascending: false })
        .limit(1);
      const rodada = ((existing as any)?.[0]?.rodada || 0) + 1;

      // 3) Arquiva versão anterior (se houver path)
      if ((docAtual as any)?.arquivo_path) {
        await supabase.from("china_doc_versoes" as any).insert({
          documento_id: params.documento_id,
          submissao_id: params.submissao_id,
          tipo_documento: params.tipo_documento,
          rodada: rodada - 1,
          arquivo_path: (docAtual as any).arquivo_path,
          arquivo_url: (docAtual as any).arquivo_url,
          nome_arquivo: (docAtual as any).nome_arquivo || "arquivo",
          status_no_momento: "rejeitado",
          enviada_por: user.id,
        } as any);
      }

      // 4) Upload do novo arquivo principal
      const safe = params.novo_arquivo.name.replace(/[^\w.\-]+/g, "_");
      const novoPath = `versoes/${params.submissao_id}/${params.tipo_documento}/v${rodada}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(
        novoPath,
        params.novo_arquivo,
        { contentType: params.novo_arquivo.type || "application/octet-stream", upsert: false },
      );
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(novoPath);

      // 5) Atualiza documento corrente
      await supabase
        .from("china_produto_documentos" as any)
        .update({
          arquivo_path: novoPath,
          arquivo_url: pub.publicUrl,
          nome_arquivo: params.novo_arquivo.name,
          status: "pendente",
        } as any)
        .eq("id", params.documento_id);

      // 6) Cria revisão de contestação
      const idioma = detectLang(parecer);
      const { data: revInsert, error: revErr } = await supabase
        .from("china_doc_revisoes" as any)
        .insert({
          documento_id: params.documento_id,
          submissao_id: params.submissao_id,
          rodada,
          resultado: "contestado",
          contestado_por: user.id,
          contestacao_texto: parecer,
          contestacao_idioma_origem: idioma,
          contestacao_traducoes: { [idioma]: parecer },
          acao_tipo: "contestar",
          acao_por_nome: user.nome,
          anotacoes: [],
          anexos: [],
        } as any)
        .select("id")
        .single();
      if (revErr) throw revErr;
      const revisaoId = (revInsert as any).id as string;

      // 7) Upload dos anexos de embasamento
      const anexos = params.anexos?.length
        ? await uploadAnexos(
            params.anexos,
            `revisoes/${params.submissao_id}/${revisaoId}`,
            "china",
          )
        : [];
      if (anexos.length) {
        await supabase
          .from("china_doc_revisoes" as any)
          .update({ anexos } as any)
          .eq("id", revisaoId);
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["china-revisoes", vars.submissao_id] });
      queryClient.invalidateQueries({ queryKey: ["china-ficha-docs", vars.submissao_id] });
      queryClient.invalidateQueries({ queryKey: ["china-doc-versoes", vars.documento_id] });
      toast.success("Novo documento e parecer enviados. 新文件和技术意见已发送。");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao enviar correção."),
  });
}

/**
 * Persiste tradução cacheada em uma revisão (motivo ou contestação).
 */
export function useSalvarTraducaoRevisao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      revisao_id: string;
      submissao_id: string;
      campo: "motivo" | "contestacao";
      traducoes: Partial<Record<IdiomaRevisao, string>>;
      origem?: IdiomaRevisao;
    }) => {
      const patch: Record<string, unknown> = {};
      if (params.campo === "motivo") {
        patch.motivo_traducoes = params.traducoes;
        if (params.origem) patch.motivo_idioma_origem = params.origem;
      } else {
        patch.contestacao_traducoes = params.traducoes;
        if (params.origem) patch.contestacao_idioma_origem = params.origem;
      }
      const { error } = await supabase
        .from("china_doc_revisoes" as any)
        .update(patch as any)
        .eq("id", params.revisao_id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["china-revisoes", vars.submissao_id] });
    },
  });
}
