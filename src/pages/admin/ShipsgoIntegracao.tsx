import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, RefreshCw, Ship } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ShipsgoKpiCards } from "@/components/admin/shipsgo/ShipsgoKpiCards";
import { ShipsgoDiffTable } from "@/components/admin/shipsgo/ShipsgoDiffTable";
import { ShipsgoIaAnalysisPanel } from "@/components/admin/shipsgo/ShipsgoIaAnalysisPanel";
import { ShipsgoLogsTable } from "@/components/admin/shipsgo/ShipsgoLogsTable";
import { ShipsgoAutofixDialog } from "@/components/admin/shipsgo/ShipsgoAutofixDialog";
import { useShipsgoIntegration, type DiffKpis, type DiffRow, type IaAnalise } from "@/hooks/useShipsgoIntegration";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function ShipsgoIntegracao() {
  const navigate = useNavigate();
  const { loading, iaLoading, runDiff, runIa, applyAutofix } = useShipsgoIntegration();
  const [kpis, setKpis] = useState<DiffKpis | null>(null);
  const [rows, setRows] = useState<DiffRow[]>([]);
  const [analise, setAnalise] = useState<IaAnalise | null>(null);
  const [autofixOpen, setAutofixOpen] = useState(false);

  useEffect(() => { document.title = "Integração ShipsGo | Administração"; refresh(); }, []);

  async function refresh() {
    const r = await runDiff();
    if (r) { setKpis(r.kpis); setRows(r.divergencias); }
  }

  async function gerarIa() {
    if (!kpis) return;
    const a = await runIa(kpis, rows);
    if (a) setAnalise(a);
  }

  async function aplicar(password: string) {
    if (!analise) return;
    const r = await applyAutofix(analise.analise_id, password);
    if (r) { setAutofixOpen(false); refresh(); }
  }

  async function corrigirSelecionados(selecionadas: DiffRow[]) {
    if (selecionadas.length === 0) return;
    toast.info(`Selecione "Gerar análise" e use o plano de auto-fix da IA para corrigir ${selecionadas.length} divergências em lote.`);
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Ship className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Integração ShipsGo</h1>
          <p className="text-sm text-muted-foreground">
            Tracking de containers via API v2 — auditoria operacional e técnica com IA
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <ShipsgoKpiCards kpis={kpis} />

      <Tabs defaultValue="diff" className="w-full">
        <TabsList>
          <TabsTrigger value="diff">Divergências ({rows.length})</TabsTrigger>
          <TabsTrigger value="ia">Análise IA</TabsTrigger>
          <TabsTrigger value="logs">Logs &amp; Webhooks</TabsTrigger>
          <TabsTrigger value="overview">Cobertura</TabsTrigger>
        </TabsList>

        <TabsContent value="diff" className="mt-4">
          <ShipsgoDiffTable rows={rows} onSync={corrigirSelecionados} />
        </TabsContent>

        <TabsContent value="ia" className="mt-4">
          <ShipsgoIaAnalysisPanel
            loading={iaLoading}
            analise={analise}
            onGerar={gerarIa}
            onAplicar={() => setAutofixOpen(true)}
            divergenciasDisponiveis={rows.length}
          />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <ShipsgoLogsTable />
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-6 space-y-3">
              <h3 className="font-semibold">Cobertura por tipo de divergência</h3>
              {kpis && Object.keys(kpis.por_tipo ?? {}).length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {Object.entries(kpis.por_tipo).map(([k, v]) => (
                    <li key={k} className="flex justify-between border-b py-1">
                      <span>{k}</span><span className="font-mono">{v}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma divergência detectada.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ShipsgoAutofixDialog
        open={autofixOpen}
        onOpenChange={setAutofixOpen}
        onConfirm={aplicar}
        totalAcoes={analise?.plano_autofix?.length ?? 0}
      />
    </div>
  );
}
