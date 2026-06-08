import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAvancarItem } from "@/hooks/useKanbanAprovacoes";

interface Props {
  itemId: string;
}

interface ItemInfo {
  status: string;
  responsavel_atual_id: string | null;
  etapa_nome: string | null;
  lote_nome: string | null;
  pipeline_nome: string | null;
}

export function BriefingAprovacaoBanner({ itemId }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const avancar = useAvancarItem();
  const [info, setInfo] = useState<ItemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [comentario, setComentario] = useState("");
  const [showComentario, setShowComentario] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("aprovacao_documento_itens")
        .select(`
          status, responsavel_atual_id,
          fluxo_aprovacao_etapas!aprovacao_documento_itens_etapa_atual_id_fkey(nome),
          fluxo_aprovacao_config!aprovacao_documento_itens_pipeline_id_fkey(nome),
          fluxo_aprovacao_instancias(lote_nome)
        `)
        .eq("id", itemId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setInfo({
          status: (data as any).status,
          responsavel_atual_id: (data as any).responsavel_atual_id,
          etapa_nome: (data as any).fluxo_aprovacao_etapas?.nome ?? null,
          pipeline_nome: (data as any).fluxo_aprovacao_config?.nome ?? null,
          lote_nome: (data as any).fluxo_aprovacao_instancias?.lote_nome ?? null,
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  if (loading || !info) return null;
  if (info.status !== "em_andamento") return null;

  const isResponsavel = info.responsavel_atual_id === user?.id;

  async function decidir(decisao: "aprovado" | "rejeitado") {
    await avancar.mutateAsync({
      itemId,
      decisao,
      comentario: comentario.trim() || undefined,
    });
    navigate("/dashboard/central/aprovacoes");
  }

  return (
    <div className="sticky top-0 z-20 -mx-6 -mt-6 mb-2 border-b bg-primary/5 backdrop-blur px-6 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Revisão para aprovação</span>
            {info.etapa_nome && (
              <Badge variant="secondary" className="text-[10px]">{info.etapa_nome}</Badge>
            )}
            {info.pipeline_nome && (
              <Badge variant="outline" className="text-[10px]">{info.pipeline_nome}</Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isResponsavel
              ? "Revise o conteúdo abaixo e registre sua decisão. O briefing está em modo leitura."
              : "Você não é o responsável atual desta etapa — apenas acompanhamento."}
          </p>
        </div>

        {isResponsavel && (
          <div className="flex items-center gap-2">
            {!showComentario ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowComentario(true)}
                  disabled={avancar.isPending}
                >
                  Adicionar comentário
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => decidir("rejeitado")}
                  disabled={avancar.isPending}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" /> Rejeitar
                </Button>
                <Button
                  size="sm"
                  onClick={() => decidir("aprovado")}
                  disabled={avancar.isPending}
                >
                  {avancar.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Aprovar e avançar
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setShowComentario(false)}>
                Ocultar comentário
              </Button>
            )}
          </div>
        )}
      </div>

      {isResponsavel && showComentario && (
        <div className="mt-3 flex items-end gap-2">
          <Textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Comentário enviado ao histórico (opcional)"
            className="text-xs min-h-[60px]"
          />
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => decidir("rejeitado")}
              disabled={avancar.isPending}
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" /> Rejeitar
            </Button>
            <Button
              size="sm"
              onClick={() => decidir("aprovado")}
              disabled={avancar.isPending}
            >
              {avancar.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Aprovar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
