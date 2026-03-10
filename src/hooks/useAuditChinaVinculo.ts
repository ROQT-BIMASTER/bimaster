import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AuditChinaResult {
  match: "alto" | "medio" | "baixo";
  confianca: number;
  motivo: string;
  alertas: string[];
  sugestao?: string | null;
}

interface AuditTarefaProdutoParams {
  tarefa: {
    titulo: string;
    descricao?: string;
    estagio?: string;
    secao_nome?: string;
    prioridade?: string;
  };
  submissao: {
    produto_codigo: string;
    produto_nome: string;
    status: string;
    formula_codigo?: string;
    ean_unidade?: string;
    ean_display?: string;
    ean_caixa_master?: string;
    peso_liquido_g?: number;
    peso_bruto_g?: number;
    qty_total?: number;
    observacoes_brasil?: string;
    observacoes_china?: string;
  };
}

interface AuditProjetoParams {
  projeto: {
    nome: string;
    secoes: string[];
  };
  submissao: AuditTarefaProdutoParams["submissao"] & {
    numero_ordem?: string;
    numero_item?: string;
  };
}

export function useAuditChinaVinculo() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditChinaResult | null>(null);

  const auditTarefaProduto = async (params: AuditTarefaProdutoParams): Promise<AuditChinaResult | null> => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("audit-china-vinculo", {
        body: { ...params, modo: "tarefa_produto" },
      });
      if (error) throw error;
      if (data?.match) {
        setResult(data as AuditChinaResult);
        return data as AuditChinaResult;
      }
      return null;
    } catch (e) {
      console.error("Audit China vínculo error:", e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const auditProjeto = async (params: AuditProjetoParams): Promise<AuditChinaResult | null> => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("audit-china-vinculo", {
        body: { ...params, modo: "projeto" },
      });
      if (error) throw error;
      if (data?.match) {
        setResult(data as AuditChinaResult);
        return data as AuditChinaResult;
      }
      return null;
    } catch (e) {
      console.error("Audit China projeto error:", e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => setResult(null);

  return { auditTarefaProduto, auditProjeto, loading, result, reset };
}
