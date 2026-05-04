import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Sparkles, AlertCircle } from "lucide-react";
import { useProjetoInvestimentoLovable } from "@/hooks/useProjetoInvestimentoLovable";
import { useLovablePlanConfig } from "@/hooks/useLovablePlanConfig";
import { useUserRole } from "@/hooks/useUserRole";
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

interface Props {
  projetoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjetoInvestimentoLovableDialog({ projetoId, open, onOpenChange }: Props) {
  const { isAdmin } = useUserRole();
  const { total, lancamentos, adicionar, remover } = useProjetoInvestimentoLovable(projetoId);
  const { planoVigente } = useLovablePlanConfig();

  const [mes, setMes] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [creditos, setCreditos] = useState<string>("");
  const [observacao, setObservacao] = useState("");

  const taxa = planoVigente?.taxa_brl_por_credito ?? 0;
  const valorPreview = useMemo(() => {
    const c = parseInt(creditos, 10);
    return Number.isFinite(c) ? c * taxa : 0;
  }, [creditos, taxa]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseInt(creditos, 10);
    if (!c || c <= 0 || !taxa) return;
    adicionar.mutate(
      {
        mes_referencia: `${mes}-01`,
        creditos: c,
        taxa_brl_por_credito: taxa,
        observacao: observacao || null,
      },
      {
        onSuccess: () => {
          setCreditos("");
          setObservacao("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            Investimento na plataforma
          </DialogTitle>
          <DialogDescription>
            Créditos consumidos no projeto e o valor aproximado em reais com base no plano vigente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Total em R$</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatCurrency(total.data?.valor_total_brl ?? 0)}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Créditos</p>
            <p className="text-xl font-semibold tabular-nums">
              {(total.data?.creditos_total ?? 0).toLocaleString("pt-BR")}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Taxa vigente</p>
            <p className="text-xl font-semibold tabular-nums">
              {taxa > 0 ? `${formatCurrency(taxa)} / créd.` : "—"}
            </p>
            {planoVigente && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Plano: {planoVigente.plano}</p>
            )}
          </Card>
        </div>

        {!planoVigente && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              Nenhum plano configurado.{" "}
              {isAdmin ? (
                <Link to="/dashboard/admin/custos-tecnologia" className="underline font-medium">
                  Configure em Custos de tecnologia
                </Link>
              ) : (
                <span>Solicite a um administrador para configurar o plano.</span>
              )}
              .
            </div>
          </div>
        )}

        {isAdmin && planoVigente && (
          <Card className="p-4">
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <Label>Mês</Label>
                <Input
                  type="month"
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Créditos</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={creditos}
                  onChange={(e) => setCreditos(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Valor aproximado</Label>
                <Input value={formatCurrency(valorPreview)} readOnly className="bg-muted" />
              </div>
              <Button type="submit" disabled={adicionar.isPending} className="gap-1">
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
              <div className="sm:col-span-4">
                <Label>Observação</Label>
                <Textarea
                  rows={2}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex.: Sprint maio — refatoração módulo X"
                />
              </div>
            </form>
          </Card>
        )}

        <div>
          <h3 className="text-sm font-semibold mb-2">Lançamentos</h3>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Créditos</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Observação</TableHead>
                  {isAdmin && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(lancamentos.data || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-sm text-muted-foreground py-6">
                      Nenhum lançamento ainda.
                    </TableCell>
                  </TableRow>
                )}
                {(lancamentos.data || []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      {format(parseLocalDate(l.mes_referencia), "MMM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.creditos.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {formatCurrency(Number(l.taxa_brl_por_credito))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(Number(l.valor_brl))}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {l.observacao || "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => remover.mutate(l.id)}
                          disabled={remover.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
