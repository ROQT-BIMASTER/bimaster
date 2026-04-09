import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Shield, Loader2, FileText, Download, AlertTriangle, Lock, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface ShareDoc {
  id: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  categoria: string;
  lote: string | null;
  metadata: any;
  url: string | null;
}

interface ShareData {
  produto_nome: string;
  lote_nome: string | null;
  expires_at: string;
  documentos: ShareDoc[];
}

const CATEGORIA_LABELS: Record<string, string> = {
  orcamento: "Orçamento", nf: "Nota Fiscal", art: "ART",
  embalagem_tampa: "Tampa", embalagem_frasco: "Frasco",
  embalagem_rotulo: "Rótulo", embalagem_caixa: "Caixa",
  materia_prima: "Matéria-Prima", evidencia: "Evidência",
  contrato: "Contrato", geral: "Geral",
};

export default function CofreSharePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setError("Token não fornecido"); setLoading(false); return; }

    supabase.functions.invoke("cofre-share", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      body: { token },
    })
      .then(({ data: json, error: fnError }) => {
        if (fnError) throw new Error(fnError.message || "Erro desconhecido");
        setData(json as ShareData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
          <p className="text-sm text-gray-500">Validando acesso...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3 max-w-sm px-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            {error.includes("expirado") ? (
              <AlertTriangle className="h-8 w-8 text-red-500" />
            ) : (
              <Lock className="h-8 w-8 text-red-500" />
            )}
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Acesso negado</h1>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const expiresAt = new Date(data.expires_at);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <Shield className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <h1 className="font-semibold text-gray-900">Cofre de Documentos</h1>
            <p className="text-xs text-gray-500">
              {data.produto_nome || "Produto"} 
              {data.lote_nome && <> • Lote: {data.lote_nome}</>}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] text-gray-500">
            Expira: {expiresAt.toLocaleDateString("pt-BR")} {expiresAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </Badge>
        </div>
      </div>

      {/* Documents */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        <p className="text-xs text-gray-500">{data.documentos.length} documento(s) compartilhado(s)</p>
        
        {data.documentos.map((doc) => (
          <div key={doc.id} className="bg-white rounded-lg border p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{doc.nome_arquivo}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-[10px]">
                  {CATEGORIA_LABELS[doc.categoria] || doc.categoria}
                </Badge>
                {doc.lote && (
                  <Badge variant="outline" className="text-[10px] gap-0.5">
                    <Package className="h-2.5 w-2.5" /> {doc.lote}
                  </Badge>
                )}
              </div>
            </div>
            {doc.url ? (
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => window.open(doc.url!, "_blank")}>
                <Download className="h-3.5 w-3.5" /> Baixar
              </Button>
            ) : (
              <span className="text-xs text-gray-400">Indisponível</span>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-[10px] text-gray-400">
        Compartilhado com segurança via BiMaster
      </div>
    </div>
  );
}
