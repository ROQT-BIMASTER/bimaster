import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Workflow, ArrowLeft, Info, Play, Loader2 } from "lucide-react";
import { useProcessos, useProcesso } from "@/hooks/suporte/useProcessos";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { ProcessoCanvas } from "@/components/suporte/ProcessoCanvas";
import { ProcessoExecucaoDia } from "@/components/suporte/ProcessoExecucaoDia";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProcessoOnboardingGuide } from "@/components/suporte/ProcessoOnboardingGuide";
import { invokeChat } from "@/lib/ai/invokeChat";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export default function SuporteProcessoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selecionado, setSelecionado] = useState<string | null>(id ?? null);

  const { data: processos = [], isLoading } = useProcessos();
  const { data: filas = [] } = useSuporteFilas();
  const { data: proc } = useProcesso(selecionado);

  const filaMap = useMemo(() => {
    const m = new Map<string, (typeof filas)[number]>();
    filas.forEach((f) => m.set(f.id, f));
    return m;
  }, [filas]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/suporte/rotinas-fixas")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Rotinas fixas
            </Button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Workflow className="h-6 w-6 text-primary" /> Processos operacionais
              </h2>
              <p className="text-sm text-muted-foreground">
                Encadeamento entre rotinas fixas com swimlanes por departamento.
              </p>
            </div>
          </div>
        </div>

        {(!isLoading && processos.length === 0) && (
          <ProcessoOnboardingGuide persistent />
        )}


        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Processos ativos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {isLoading && <span className="text-sm text-muted-foreground">Carregando…</span>}
            {!isLoading && processos.length === 0 && (
              <span className="text-sm text-muted-foreground">
                Nenhum processo criado ainda. Vincule uma rotina a um processo em Rotinas fixas.
              </span>
            )}
            {processos.map((p) => {
              const fila = filaMap.get(p.fila_dona_id);
              const active = p.id === selecionado;
              return (
                <Button
                  key={p.id}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => setSelecionado(p.id)}
                >
                  <span
                    className="h-2 w-2 rounded-full mr-2"
                    style={{ background: fila?.cor ?? "#94a3b8" }}
                  />
                  {p.nome}
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {selecionado && proc?.processo && (
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <Badge variant="secondary">Versão {proc.processo.versao}</Badge>
            <Badge variant="outline">
              Fila dona: {filaMap.get(proc.processo.fila_dona_id)?.nome ?? "—"}
            </Badge>
            <Badge variant="outline">{proc.etapas.length} etapa(s)</Badge>
            <Badge variant="outline">{proc.ligacoes.length} ligação(ões)</Badge>
            <span className="inline-flex items-center gap-1 ml-2">
              <Info className="h-3 w-3" /> Arraste para reposicionar. Conecte etapas ligando os
              pontos das bordas. Pressione Delete sobre uma ligação para removê-la.
            </span>
          </div>
        )}

        {selecionado ? (
          <Tabs defaultValue="canvas">
            <TabsList>
              <TabsTrigger value="canvas">Canvas</TabsTrigger>
              <TabsTrigger value="execucao">Execução do dia</TabsTrigger>
            </TabsList>
            <TabsContent value="canvas" className="mt-3">
              <ProcessoCanvas processoId={selecionado} />
            </TabsContent>
            <TabsContent value="execucao" className="mt-3">
              <ProcessoExecucaoDia processoId={selecionado} />
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              Selecione um processo acima para visualizar o canvas.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
