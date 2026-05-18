import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGruposCenarios, useGruposArquivados } from "@/hooks/useGrupoCenarios";
import { supabase } from "@/integrations/supabase/client";
import { Layers, ChevronRight, Archive, RotateCcw, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { NovoCenarioDialog } from "@/components/fabrica/cenarios/NovoCenarioDialog";
import { formatLocalDate } from "@/utils/dateUtils";

export function CenariosList() {
  const navigate = useNavigate();
  const { data: grupos = [], isLoading, refetch } = useGruposCenarios();
  const { data: arquivados = [], refetch: refetchArq } = useGruposArquivados();
  const [aba, setAba] = useState<"ativos" | "arquivados">("ativos");
  const [novoOpen, setNovoOpen] = useState(false);

  const handleReabrir = async (id: string) => {
    const { error } = await supabase.rpc("rpc_reabrir_cenario", { p_produto_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Cenário reaberto");
    refetchArq();
    refetch();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 rounded-md border p-0.5">
          <Button size="sm" variant={aba === "ativos" ? "default" : "ghost"} className="h-7" onClick={() => setAba("ativos")}>
            Ativos ({grupos.length})
          </Button>
          <Button size="sm" variant={aba === "arquivados" ? "default" : "ghost"} className="h-7" onClick={() => setAba("arquivados")}>
            <Archive className="h-3.5 w-3.5 mr-1" /> Arquivados ({arquivados.length})
          </Button>
        </div>
        <Button size="sm" onClick={() => setNovoOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo cenário
        </Button>
      </div>

      {aba === "ativos" ? (
        isLoading ? (
          <Skeleton className="h-40" />
        ) : grupos.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm">
            Nenhum cenário em aberto. Crie um para começar uma simulação.
          </Card>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {grupos.map((g) => (
              <Card
                key={g.grupo_cenario_id}
                className="p-3 hover:bg-accent/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/dashboard/fabrica/cenarios/${g.grupo_cenario_id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="font-medium truncate">{g.primeiro_nome}</h3>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {g.total} cenário{g.total > 1 ? "s" : ""} · criado em {formatLocalDate(g.created_at)}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {g.cenarios.slice(0, 4).map((c) => (
                        <Badge key={c.id} variant="outline" className="text-[10px]">
                          {c.cenario_label || c.codigo}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {arquivados.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">
              Nenhum cenário arquivado.
            </Card>
          ) : (
            arquivados.map((p) => (
              <Card key={p.id} className="p-3 flex items-center gap-3">
                <Archive className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.cenario_label || p.nome}</div>
                  <div className="text-xs text-muted-foreground">{p.codigo} · arquivado em {formatLocalDate(p.created_at)}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleReabrir(p.id)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reabrir
                </Button>
              </Card>
            ))
          )}
        </div>
      )}

      <NovoCenarioDialog open={novoOpen} onOpenChange={setNovoOpen} onSuccess={() => refetch()} />
    </div>
  );
}
