import { useMemo, useState } from "react";
import { Plus, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate, formatLocalDate } from "@/utils/dateUtils";
import { ScreenProtectedRoute } from "@/components/auth/ScreenProtectedRoute";
import { CriarPeriodoDialog } from "@/components/orcamento/CriarPeriodoDialog";
import { DistribuirVerbaPanel } from "@/components/orcamento/DistribuirVerbaPanel";
import { PlanoDepartamentoPanel } from "@/components/orcamento/PlanoDepartamentoPanel";
import { useBudgetPeriods } from "@/hooks/orcamento/useOrcamentoCorporativo";

export default function OrcamentoCorporativo() {
  const { data: periodos, isLoading } = useBudgetPeriods();
  const [periodoSelecionado, setPeriodoSelecionado] = useState<string | undefined>(undefined);
  const [criarOpen, setCriarOpen] = useState(false);

  const periodoAtivo = useMemo(
    () => periodos?.find((p) => p.id === periodoSelecionado) ?? periodos?.[0],
    [periodos, periodoSelecionado],
  );

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Orçamento Corporativo</h1>
          <p className="text-sm text-muted-foreground">
            Períodos orçamentários, distribuição de verba e plano de categorias por departamento.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={periodoAtivo?.id ?? ""}
            onValueChange={(v) => setPeriodoSelecionado(v)}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Selecionar período" />
            </SelectTrigger>
            <SelectContent>
              {periodos?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome} — {formatLocalDate(parseLocalDate(p.data_inicio), "dd/MM/yyyy")}
                  {" → "}
                  {formatLocalDate(parseLocalDate(p.data_fim), "dd/MM/yyyy")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setCriarOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo período
          </Button>
        </div>
      </header>

      <Tabs defaultValue="periodos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="periodos">Períodos</TabsTrigger>
          <TabsTrigger value="distribuicao">Distribuição</TabsTrigger>
          <TabsTrigger value="plano">Plano do Departamento</TabsTrigger>
        </TabsList>

        <TabsContent value="periodos">
          <ScreenProtectedRoute screenCode="orcamento_periodos">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Períodos cadastrados</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : !periodos?.length ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> Nenhum período cadastrado.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Fim</TableHead>
                        <TableHead className="text-right">Valor da empresa</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periodos.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.nome}</TableCell>
                          <TableCell className="capitalize">{p.tipo}</TableCell>
                          <TableCell>{formatLocalDate(parseLocalDate(p.data_inicio), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{formatLocalDate(parseLocalDate(p.data_fim), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(Number(p.valor_total_empresa ?? 0))}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{p.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 flex items-center justify-center text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> {message}
      </CardContent>
    </Card>
  );
}
