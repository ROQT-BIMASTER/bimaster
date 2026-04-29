import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export interface Fonte {
  id: string;
  tipo: "texto" | "pdf" | "url" | "imagem";
  titulo: string;
  conteudo: string;
}

export interface Briefing {
  tema: string;
  objetivo?: string;
  publico_alvo?: string;
  tom?: string;
  duracao_total?: number;
  numero_cenas?: number;
  formato?: "9:16" | "16:9" | "1:1";
  paleta_cores?: string[];
}

export interface Cena {
  numero: number;
  titulo: string;
  duracao_segundos: number;
  tipo_plano: string;
  movimento_camera: string;
  descricao_visual: string;
  narracao: string;
  audio_ambiente: string;
}

export interface RoteiroEstruturado {
  titulo: string;
  sinopse: string;
  conceito_visual: string;
  cenas: Cena[];
  cta: string;
  hashtags: string[];
}

export interface RoteiroSalvo {
  id: string;
  titulo: string;
  sinopse: string | null;
  briefing: Briefing;
  fontes: Array<{ tipo: string; titulo: string; tamanho: number }>;
  roteiro: RoteiroEstruturado;
  status: "rascunho" | "aprovado" | "enviado_para_video";
  modelo_usado: string | null;
  created_at: string;
  updated_at: string;
}

export function useRoteiristaIA() {
  const [generating, setGenerating] = useState(false);
  const [roteiroAtual, setRoteiroAtual] = useState<RoteiroEstruturado | null>(null);
  const [roteiroId, setRoteiroId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<RoteiroSalvo[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  const carregarHistorico = useCallback(async () => {
    setLoadingHistorico(true);
    try {
      const { data, error } = await supabase
        .from("roteiros_cinematograficos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      setHistorico((data as unknown as RoteiroSalvo[]) || []);
    } catch (e) {
      logger.error("[useRoteiristaIA] erro histórico:", e);
    } finally {
      setLoadingHistorico(false);
    }
  }, []);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  const gerarRoteiro = useCallback(
    async (briefing: Briefing, fontes: Fonte[]) => {
      if (!briefing.tema || briefing.tema.trim().length < 5) {
        toast.error("Informe o tema do vídeo (mínimo 5 caracteres)");
        return null;
      }
      setGenerating(true);
      try {
        const fontesPayload = fontes.map(f => ({
          tipo: f.tipo,
          titulo: f.titulo,
          conteudo: f.conteudo,
        }));

        const { data, error } = await supabase.functions.invoke(
          "roteirista-cinematografico",
          { body: { briefing, fontes: fontesPayload, roteiro_id: roteiroId } }
        );

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setRoteiroAtual(data.roteiro);
        if (data.roteiro_id) setRoteiroId(data.roteiro_id);
        toast.success(`Roteiro gerado: ${data.roteiro.cenas.length} cenas`);
        await carregarHistorico();
        return data.roteiro as RoteiroEstruturado;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao gerar roteiro";
        logger.error("[useRoteiristaIA] erro:", e);
        toast.error(msg);
        return null;
      } finally {
        setGenerating(false);
      }
    },
    [roteiroId, carregarHistorico]
  );

  const carregarRoteiro = useCallback((roteiro: RoteiroSalvo) => {
    setRoteiroAtual(roteiro.roteiro);
    setRoteiroId(roteiro.id);
    toast.success(`Roteiro "${roteiro.titulo}" carregado`);
  }, []);

  const novoRoteiro = useCallback(() => {
    setRoteiroAtual(null);
    setRoteiroId(null);
  }, []);

  const excluirRoteiro = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from("roteiros_cinematograficos")
          .delete()
          .eq("id", id);
        if (error) throw error;
        if (id === roteiroId) novoRoteiro();
        toast.success("Roteiro excluído");
        await carregarHistorico();
      } catch (e) {
        toast.error("Erro ao excluir");
      }
    },
    [roteiroId, novoRoteiro, carregarHistorico]
  );

  const atualizarStatus = useCallback(
    async (id: string, status: RoteiroSalvo["status"]) => {
      try {
        const { error } = await supabase
          .from("roteiros_cinematograficos")
          .update({ status })
          .eq("id", id);
        if (error) throw error;
        await carregarHistorico();
      } catch (e) {
        toast.error("Erro ao atualizar status");
      }
    },
    [carregarHistorico]
  );

  const atualizarCena = useCallback((index: number, patch: Partial<Cena>) => {
    setRoteiroAtual(prev => {
      if (!prev) return prev;
      const cenas = prev.cenas.map((c, i) => (i === index ? { ...c, ...patch } : c));
      return { ...prev, cenas };
    });
  }, []);

  return {
    generating,
    roteiroAtual,
    roteiroId,
    historico,
    loadingHistorico,
    gerarRoteiro,
    carregarRoteiro,
    novoRoteiro,
    excluirRoteiro,
    atualizarStatus,
    atualizarCena,
    setRoteiroAtual,
  };
}
