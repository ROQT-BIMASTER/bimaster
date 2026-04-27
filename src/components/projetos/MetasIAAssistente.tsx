import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Loader2, Target, ListChecks, FileText } from "lucide-react";
import { useProjetoIA } from "@/hooks/useProjetoIA";
import type { ProjetoMeta } from "@/hooks/useProjetoMetas";

interface Props {
  projetoId: string;
  metaSelecionada?: ProjetoMeta | null;
}

export function MetasIAAssistente({ projetoId, metaSelecionada }: Props) {
  const { metasDiagnostico, metasPlanoAcao, metasPautaReuniao, loading } = useProjetoIA();
  const [diagnostico, setDiagnostico] = useState<string>("");
  const [planoAcao, setPlanoAcao] = useState<{
    resumo: string;
    etapas: { titulo: string; descricao: string; prazo_dias: number; criticidade: string }[];
  } | null>(null);
  const [pauta, setPauta] = useState<string>("");

  const rodarDiagnostico = async () => {
    const r = await metasDiagnostico(projetoId);
    setDiagnostico(r.summary);
  };

  const rodarPlano = async () => {
    if (!metaSelecionada) return;
    const r = await metasPlanoAcao(metaSelecionada.id, projetoId);
    setPlanoAcao(r);
  };

  const rodarPauta = async () => {
    const r = await metasPautaReuniao(projetoId);
    setPauta(r.pauta);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Assistente IA — Metas
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Diagnóstico, plano de ação e pauta para reuniões.
        </p>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {/* Diagnóstico */}
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                onClick={rodarDiagnostico}
                disabled={loading === "metas_diagnostico"}
              >
                {loading === "metas_diagnostico" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : (
                  <Target className="h-3.5 w-3.5 mr-2" />
                )}
                Gerar diagnóstico geral
              </Button>
              {diagnostico && (
                <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-md p-3 border">
                  {diagnostico}
                </div>
              )}
            </div>

            <Separator />

            {/* Plano de ação */}
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                onClick={rodarPlano}
                disabled={!metaSelecionada || loading === "metas_plano_acao"}
                title={!metaSelecionada ? "Selecione uma meta na lista" : ""}
              >
                {loading === "metas_plano_acao" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : (
                  <ListChecks className="h-3.5 w-3.5 mr-2" />
                )}
                Plano de ação para meta selecionada
              </Button>
              {!metaSelecionada && (
                <p className="text-[10px] text-muted-foreground italic">
                  Selecione uma meta na lista para gerar plano específico.
                </p>
              )}
              {planoAcao && (
                <div className="space-y-2">
                  <p className="text-xs font-medium">{planoAcao.resumo}</p>
                  {planoAcao.etapas?.map((e, i) => (
                    <div key={i} className="rounded-md border p-2.5 bg-muted/20 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{e.titulo}</p>
                        <Badge
                          variant={
                            e.criticidade === "alta"
                              ? "destructive"
                              : e.criticidade === "media"
                                ? "default"
                                : "secondary"
                          }
                          className="text-[9px] uppercase"
                        >
                          {e.criticidade}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{e.descricao}</p>
                      <p className="text-[10px] text-primary">Prazo: {e.prazo_dias} dia(s)</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Pauta de reunião */}
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                onClick={rodarPauta}
                disabled={loading === "metas_pauta_reuniao"}
              >
                {loading === "metas_pauta_reuniao" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : (
                  <FileText className="h-3.5 w-3.5 mr-2" />
                )}
                Gerar pauta de reunião
              </Button>
              {pauta && (
                <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-md p-3 border">
                  {pauta}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
