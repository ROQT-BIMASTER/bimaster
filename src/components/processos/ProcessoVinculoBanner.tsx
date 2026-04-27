import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Workflow, CheckCircle2, ExternalLink, Loader2, Clock } from "lucide-react";
import { useLinksDoRegistro, useConcluirModuloLink, type ModuloLinkStatus } from "@/hooks/useModuloProcessoLink";
import { cn } from "@/lib/utils";

interface Props {
  moduloCodigo: string;
  registroId: string | undefined | null;
  className?: string;
}

const STATUS_BADGE: Record<ModuloLinkStatus, { label: string; variant: any; icon: any }> = {
  pendente: { label: "Pendente", variant: "outline", icon: Clock },
  em_andamento: { label: "Em andamento", variant: "secondary", icon: Workflow },
  concluido: { label: "Concluído", variant: "success", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", variant: "outline", icon: Clock },
};

export function ProcessoVinculoBanner({ moduloCodigo, registroId, className }: Props) {
  const navigate = useNavigate();
  const { data: links = [], isLoading } = useLinksDoRegistro(moduloCodigo, registroId);
  const concluir = useConcluirModuloLink();
  const [obs, setObs] = useState("");

  if (isLoading || !registroId || links.length === 0) return null;

  const ativos = links.filter((l) => l.status !== "cancelado");
  if (ativos.length === 0) return null;

  const irParaProcesso = (link: typeof links[number]) => {
    if (link.entidade_tipo === "produto") navigate(`/dashboard/produto-brasil/${link.entidade_id}`);
    else if (link.entidade_tipo === "projeto") navigate(`/dashboard/projetos/${link.entidade_id}`);
    else navigate(`/dashboard/processos/perfis`);
  };

  return (
    <Card className={cn("border-primary/40 bg-primary/5 p-4", className)}>
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary/10 p-2">
          <Workflow className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">
              Este registro faz parte de {ativos.length === 1 ? "um processo" : `${ativos.length} processos`}
            </span>
          </div>
          <div className="space-y-2">
            {ativos.map((l) => {
              const cfg = STATUS_BADGE[l.status];
              const Icon = cfg.icon;
              return (
                <div key={l.id} className="flex items-center gap-2 flex-wrap rounded-md border border-border bg-card p-2">
                  <Badge variant={cfg.variant} className="gap-1 text-[10px]">
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Etapa</span>
                  <span className="text-xs font-medium text-foreground">{l.etapa_label ?? l.etapa_codigo ?? "—"}</span>
                  {l.perfil_nome && (
                    <>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{l.perfil_nome}</span>
                    </>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => irParaProcesso(l)}>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Ver processo
                    </Button>
                    {l.status !== "concluido" && (
                      <Button
                        size="sm"
                        variant="success"
                        className="h-7 text-xs"
                        disabled={concluir.isPending}
                        onClick={() =>
                          concluir.mutate({
                            modulo_codigo: l.modulo_codigo,
                            registro_id: l.registro_id,
                            etapa_id: l.etapa_id,
                            observacoes: obs || undefined,
                          })
                        }
                      >
                        {concluir.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                        Concluir etapa
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
