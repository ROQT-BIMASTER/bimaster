import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Factory, Loader2, Plus, FileSpreadsheet, AlertTriangle,
  CheckCircle2, ListChecks, Package, ChevronDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { ManualFabricaDrawer } from "@/components/fabrica/ManualFabricaDrawer";
import { NovaOPChinaDialog } from "@/components/china/op/NovaOPChinaDialog";
import { ChinaOPDrawer } from "@/components/china/op/ChinaOPDrawer";
import { useChinaOrdensProducao, type ChinaOPRow } from "@/hooks/useChinaOrdensProducao";
import { getOPStatusInfo } from "@/lib/china/opStatus";
import {
  exportChinaOrdensProducao,
  type ExportChinaOPsOptions,
} from "@/lib/china/exportConferencia";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

type TabKey = "todas" | "sem_oc" | "atrasadas" | "pendentes" | "concluidas";

function isAtrasada(r: ChinaOPRow): boolean {
  if (!r.data_prevista) return false;
  if (r.status === "concluida" || r.status === "cancelada") return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return parseLocalDate(r.data_prevista)! < hoje;
}

export default function ChinaOrdensProducao() {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useChinaOrdensProducao();
  const [tab, setTab] = useState<TabKey>("todas");
  const [search, setSearch] = useState("");
  const [novaOPOpen, setNovaOPOpen] = useState(false);
  const [drawerOP, setDrawerOP] = useState<ChinaOPRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const kpis = useMemo(() => {
    const total = rows.length;
    const emProducao = rows.filter((r) => r.status === "em_andamento").length;
    const atrasadas = rows.filter(isAtrasada).length;
    const semOc = rows.filter((r) => !r.oc_id).length;
    const concluidas = rows.filter((r) => r.status === "concluida").length;
    return { total, emProducao, atrasadas, semOc, concluidas };
  }, [rows]);

  const filtradas = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "sem_oc" && r.oc_id) return false;
      if (tab === "atrasadas" && !isAtrasada(r)) return false;
      if (tab === "pendentes" && r.status !== "pendente") return false;
      if (tab === "concluidas" && r.status !== "concluida") return false;
      if (term) {
        const hay = [
          r.numero, r.oc_numero, r.submissao_numero,
          r.produto_codigo, r.produto_nome, r.lote,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, tab, search]);

  const handleExport = async (modo: ExportChinaOPsOptions["modo"]) => {
    setExporting(true);
    try {
      await exportChinaOrdensProducao(rows, { modo });
      toast.success("Planilha exportada");
    } catch (err: any) {
      logger.error(err);
      toast.error(err?.message || "Falha ao exportar");
    } finally {
      setExporting(false);
    }
  };

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        titlePt="Ordens de Produção"
        titleCn="生产订单"
        icon={Factory}
        iconTone="primary"
        showBack
        backTo="/dashboard/fabrica-china"
        actions={
          <>
            <Button size="sm" onClick={() => setNovaOPOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden md:inline">Nova OP / 新生产单</span>
              <span className="md:hidden">Nova</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting} className="gap-2">
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  <span className="hidden md:inline">Exportar planilha</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("todas")}>
                  Conferência completa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("sem_oc")}>
                  Somente OPs sem OC
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("atrasadas")}>
                  Somente atrasadas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ManualFabricaDrawer screen="china-ordens" />
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <KpiCard icon={ListChecks} label="Total" value={kpis.total} tone="default" />
        <KpiCard icon={Factory} label="Em Produção" value={kpis.emProducao} tone="warning" />
        <KpiCard icon={AlertTriangle} label="Atrasadas" value={kpis.atrasadas} tone="destructive" />
        <KpiCard icon={Package} label="Sem OC" value={kpis.semOc} tone="warning" />
        <KpiCard icon={CheckCircle2} label="Concluídas" value={kpis.concluidas} tone="success" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mb-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <TabsList>
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="sem_oc">
              Sem OC
              {kpis.semOc > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">
                  {kpis.semOc}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="atrasadas">
              Atrasadas
              {kpis.atrasadas > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-4 text-[10px] px-1">
                  {kpis.atrasadas}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
            <TabsTrigger value="concluidas">Concluídas</TabsTrigger>
          </TabsList>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar OP, OC, submissão, produto…"
            className="h-9 w-full md:w-72"
          />
        </div>

        <TabsContent value={tab} className="mt-3">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtradas.length === 0 ? (
            <Card className="p-0">
              <EmptyState
                icon={Factory}
                title="Nenhuma Ordem de Produção"
                description="没有生产订单 — clique em Nova OP para criar a partir de uma submissão."
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <Th>OP</Th>
                      <Th>Submissão</Th>
                      <Th>OC</Th>
                      <Th>Produto</Th>
                      <Th>Lote</Th>
                      <Th className="text-right">Qty Plan.</Th>
                      <Th className="text-right">Qty Prod.</Th>
                      <Th className="text-right">%</Th>
                      <Th>Início</Th>
                      <Th>Prevista</Th>
                      <Th>Status</Th>
                      <Th>Alerta</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((r) => {
                      const planejada = Number(r.quantidade_planejada || 0);
                      const produzida = Number(r.quantidade_produzida || 0);
                      const pct = planejada > 0 ? Math.round((produzida / planejada) * 100) : 0;
                      const info = getOPStatusInfo(r.status);
                      const atrasada = isAtrasada(r);
                      const semOc = !r.oc_id;
                      return (
                        <tr
                          key={r.id}
                          className={`border-t border-border hover:bg-accent/40 cursor-pointer border-l-[3px] ${info.bar}`}
                          onClick={() => setDrawerOP(r)}
                        >
                          <Td className="font-mono font-semibold">{r.numero}</Td>
                          <Td className="font-mono">{r.submissao_numero || "—"}</Td>
                          <Td className="font-mono">{r.oc_numero || <span className="text-muted-foreground">—</span>}</Td>
                          <Td>
                            <div className="font-mono text-foreground">{r.produto_codigo || "—"}</div>
                            <div className="text-muted-foreground truncate max-w-[200px]">{r.produto_nome}</div>
                          </Td>
                          <Td>{r.lote || "—"}</Td>
                          <Td className="text-right tabular-nums">{planejada.toLocaleString()}</Td>
                          <Td className="text-right tabular-nums">{produzida.toLocaleString()}</Td>
                          <Td className="text-right tabular-nums w-24">
                            <div className="flex items-center gap-1 justify-end">
                              <span className="text-foreground font-medium">{pct}%</span>
                              <Progress value={pct} className="h-1.5 w-12" />
                            </div>
                          </Td>
                          <Td>{r.data_inicio ? parseLocalDate(r.data_inicio)?.toLocaleDateString("pt-BR") : "—"}</Td>
                          <Td>{r.data_prevista ? parseLocalDate(r.data_prevista)?.toLocaleDateString("pt-BR") : "—"}</Td>
                          <Td>
                            <Badge variant={info.variant} className="text-[10px]">
                              {info.pt}
                            </Badge>
                          </Td>
                          <Td>
                            {atrasada ? (
                              <Badge variant="destructive" className="text-[10px]">Atrasada</Badge>
                            ) : semOc ? (
                              <Badge variant="warning" className="text-[10px]">Sem OC</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <NovaOPChinaDialog open={novaOPOpen} onOpenChange={setNovaOPOpen} />
    </ChinaPageShell>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-2 py-1.5 text-left font-medium uppercase tracking-wide text-[10px] ${className || ""}`}>
      {children}
    </th>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-1.5 align-middle ${className || ""}`}>{children}</td>;
}

function KpiCard({
  icon: Icon, label, value, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "default" | "success" | "warning" | "destructive";
}) {
  const toneCls =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "destructive" ? "text-destructive" :
    "text-primary";
  return (
    <Card className="p-3 flex items-center gap-3 bg-card/70 backdrop-blur-sm">
      <Icon className={`h-5 w-5 ${toneCls}`} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-xl font-bold ${toneCls}`}>{value.toLocaleString()}</div>
      </div>
    </Card>
  );
}
