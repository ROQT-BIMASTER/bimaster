import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ChevronRight,
  Target,
  Calendar,
  PieChart,
  Layers,
  Building2,
  DollarSign,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { formatLocalDate } from "@/utils/dateUtils";
import { ScreenProtectedRoute } from "@/components/auth/ScreenProtectedRoute";
import { CriarPeriodoDialog } from "@/components/orcamento/CriarPeriodoDialog";
import { DistribuirVerbaPanel } from "@/components/orcamento/DistribuirVerbaPanel";
import { PlanoDepartamentoPanel } from "@/components/orcamento/PlanoDepartamentoPanel";
import { useBudgetPeriods } from "@/hooks/orcamento/useOrcamentoCorporativo";

function statusBadgeVariant(status?: string | null): "default" | "outline" | "secondary" {
  const s = (status ?? "").toLowerCase();
  if (s === "ativo" || s === "aprovado") return "default";
  if (s === "encerrado" || s === "arquivado") return "secondary";
  return "outline";
}

export default function OrcamentoCorporativo() {
  const navigate = useNavigate();
  const { data: periodos, isLoading } = useBudgetPeriods();
  const [periodoSelecionado, setPeriodoSelecionado] = useState<string | undefined>(undefined);
  const [criarOpen, setCriarOpen] = useState(false);

  const periodoAtivo = useMemo(
    () => periodos?.find((p) => p.id === periodoSelecionado) ?? periodos?.[0],
    [periodos, periodoSelecionado],
  );

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
      {/* Breadcrumb + back */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 -ml-2 gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Button>
        <ChevronRight className="h-3 w-3 opacity-60" />
        <button
          type="button"
          className="hover:text-foreground transition-colors"
          onClick={() => navigate("/dashboard/financeiro")}
        >
          Financeiro
        </button>
        <ChevronRight className="h-3 w-3 opacity-60" />
        <span className="text-foreground font-medium">Orçamento Corporativo</span>
      </div>

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Orçamento Corporativo
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Períodos orçamentários, distribuição de verba e plano de categorias por departamento.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={periodoAtivo?.id ?? ""}
            onValueChange={(v) => setPeriodoSelecionado(v)}
          >
            <SelectTrigger className="w-[280px] bg-card">
              <SelectValue placeholder="Selecionar período" />
            </SelectTrigger>
            <SelectContent>
              {periodos?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome} — {formatLocalDate(p.data_inicio, "dd/MM/yyyy")}
                  {" → "}
                  {formatLocalDate(p.data_fim, "dd/MM/yyyy")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setCriarOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo período
          </Button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Calendar className="h-4 w-4" />}
          label="Período ativo"
          value={periodoAtivo?.nome ?? "—"}
          hint={
            periodoAtivo
              ? `${formatLocalDate(periodoAtivo.data_inicio, "dd/MM/yy")} → ${formatLocalDate(periodoAtivo.data_fim, "dd/MM/yy")}`
              : "Nenhum período selecionado"
          }
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Valor da empresa"
          value={formatCurrency(Number(periodoAtivo?.valor_total_empresa ?? 0))}
          hint={periodoAtivo ? `Tipo: ${periodoAtivo.tipo}` : "—"}
          emphasize
        />
        <KpiCard
          icon={<Layers className="h-4 w-4" />}
          label="Períodos cadastrados"
          value={String(periodos?.length ?? 0)}
          hint="Total no histórico"
        />
        <KpiCard
          icon={<Building2 className="h-4 w-4" />}
          label="Status"
          value={periodoAtivo?.status ?? "—"}
          hint="Situação do período ativo"
          capitalize
        />
      </div>

      <Tabs defaultValue="periodos" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 h-auto">
          <TabsTrigger
            value="periodos"
            className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Calendar className="h-3.5 w-3.5" /> Períodos
          </TabsTrigger>
          <TabsTrigger
            value="distribuicao"
            className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <PieChart className="h-3.5 w-3.5" /> Distribuição
          </TabsTrigger>
          <TabsTrigger
            value="plano"
            className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Layers className="h-3.5 w-3.5" /> Plano do Departamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="periodos">
          <ScreenProtectedRoute screenCode="orcamento_periodos">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold">Períodos cadastrados</CardTitle>
                <Badge variant="secondary" className="font-normal">
                  {periodos?.length ?? 0} {periodos?.length === 1 ? "período" : "períodos"}
                </Badge>
              </CardHeader>
              <CardContent className="pt-0">
                {isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : !periodos?.length ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2 py-8 justify-center">
                    <AlertCircle className="h-4 w-4" /> Nenhum período cadastrado.
                  </div>
                ) : (
                  <div className="rounded-md border border-border/60 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Nome</TableHead>
                          <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Tipo</TableHead>
                          <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Início</TableHead>
                          <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Fim</TableHead>
                          <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium text-right">Valor da empresa</TableHead>
                          <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {periodos.map((p) => {
                          const isActive = p.id === periodoAtivo?.id;
                          return (
                            <TableRow
                              key={p.id}
                              onClick={() => setPeriodoSelecionado(p.id)}
                              className={cn(
                                "cursor-pointer transition-colors",
                                isActive
                                  ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary"
                                  : "hover:bg-muted/40",
                              )}
                            >
                              <TableCell className="font-medium">{p.nome}</TableCell>
                              <TableCell className="capitalize text-muted-foreground">{p.tipo}</TableCell>
                              <TableCell className="text-muted-foreground">{formatLocalDate(p.data_inicio, "dd/MM/yyyy")}</TableCell>
                              <TableCell className="text-muted-foreground">{formatLocalDate(p.data_fim, "dd/MM/yyyy")}</TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                {formatCurrency(Number(p.valor_total_empresa ?? 0))}
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusBadgeVariant(p.status)} className="capitalize font-normal">
                                  {p.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </ScreenProtectedRoute>
        </TabsContent>

        <TabsContent value="distribuicao">
          <ScreenProtectedRoute screenCode="orcamento_distribuicao">
            {periodoAtivo ? (
              <DistribuirVerbaPanel periodo={periodoAtivo} />
            ) : (
              <EmptyState message="Selecione um período para distribuir a verba." />
            )}
          </ScreenProtectedRoute>
        </TabsContent>

        <TabsContent value="plano">
          <ScreenProtectedRoute screenCode="orcamento_plano">
            {periodoAtivo ? (
              <PlanoDepartamentoPanel periodId={periodoAtivo.id} />
            ) : (
              <EmptyState message="Selecione um período para montar o plano." />
            )}
          </ScreenProtectedRoute>
        </TabsContent>
      </Tabs>

      <CriarPeriodoDialog
        open={criarOpen}
        onOpenChange={setCriarOpen}
        onCreated={(id) => {
          setPeriodoSelecionado(id);
          toast.success("Período criado");
        }}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  emphasize,
  capitalize,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  emphasize?: boolean;
  capitalize?: boolean;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">
          <span className="text-primary">{icon}</span>
          {label}
        </div>
        <div
          className={cn(
            "mt-2 font-semibold text-foreground truncate",
            emphasize ? "text-xl tabular-nums" : "text-lg",
            capitalize && "capitalize",
          )}
          title={value}
        >
          {value}
        </div>
        {hint && (
          <div className="mt-1 text-xs text-muted-foreground truncate" title={hint}>
            {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="py-12 flex items-center justify-center text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> {message}
      </CardContent>
    </Card>
  );
}
