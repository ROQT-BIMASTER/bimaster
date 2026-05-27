import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { useLovablePlanConfig } from "@/hooks/useLovablePlanConfig";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { formatCurrency } from "@/lib/formatters";
import { useConfirm } from "@/hooks/useConfirm";

export function PlanoLovableSection() {
  const confirm = useConfirm();
  const { data, planoVigente, upsert, remover, isLoading } = useLovablePlanConfig();

  const [plano, setPlano] = useState("Pro");
  const [creditos, setCreditos] = useState("");
  const [custo, setCusto] = useState("");
  const [vigenteDesde, setVigenteDesde] = useState(() => new Date().toISOString().slice(0, 10));
  const [vigenteAte, setVigenteAte] = useState("");
  const [observacao, setObservacao] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseInt(creditos, 10);
    const v = parseFloat(custo.replace(",", "."));
    if (!plano || !c || !v) return;
    upsert.mutate(
      {
        plano,
        creditos_mensais: c,
        custo_mensal_brl: v,
        vigente_desde: vigenteDesde,
        vigente_ate: vigenteAte || null,
        observacao: observacao || null,
      },
      {
        onSuccess: () => {
          setCreditos("");
          setCusto("");
          setObservacao("");
        },
      }
    );
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-600" />
        <h2 className="text-lg font-semibold">Plano da plataforma (Lovable)</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure o plano vigente. A taxa R$/crédito é usada para calcular o investimento por projeto.
      </p>

      {planoVigente && (
        <div className="rounded-md border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Plano vigente</p>
            <p className="font-medium">{planoVigente.plano}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Créditos/mês</p>
            <p className="font-medium tabular-nums">{planoVigente.creditos_mensais.toLocaleString("pt-BR")}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Custo/mês</p>
            <p className="font-medium tabular-nums">{formatCurrency(planoVigente.custo_mensal_brl)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">R$ por crédito</p>
            <p className="font-medium tabular-nums">{formatCurrency(planoVigente.taxa_brl_por_credito)}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-1">
          <Label>Plano</Label>
          <Input value={plano} onChange={(e) => setPlano(e.target.value)} placeholder="Pro" required />
        </div>
        <div>
          <Label>Créditos/mês</Label>
          <Input type="number" min={1} value={creditos} onChange={(e) => setCreditos(e.target.value)} required />
        </div>
        <div>
          <Label>Custo/mês (R$)</Label>
          <Input value={custo} onChange={(e) => setCusto(e.target.value)} inputMode="decimal" placeholder="0,00" required />
        </div>
        <div>
          <Label>Vigente desde</Label>
          <Input type="date" value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} required />
        </div>
        <div>
          <Label>Vigente até</Label>
          <Input type="date" value={vigenteAte} onChange={(e) => setVigenteAte(e.target.value)} />
        </div>
        <Button type="submit" disabled={upsert.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Salvar
        </Button>
        <div className="md:col-span-6">
          <Label>Observação</Label>
          <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" />
        </div>
      </form>

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Créditos/mês</TableHead>
              <TableHead className="text-right">Custo/mês</TableHead>
              <TableHead className="text-right">R$/créd.</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            )}
            {!isLoading && (data || []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">Nenhum plano configurado.</TableCell>
              </TableRow>
            )}
            {(data || []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.plano}</TableCell>
                <TableCell className="text-right tabular-nums">{p.creditos_mensais.toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(p.custo_mensal_brl)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(p.taxa_brl_por_credito)}</TableCell>
                <TableCell className="text-xs">
                  {format(parseLocalDate(p.vigente_desde), "dd/MM/yyyy", { locale: ptBR })}
                  {p.vigente_ate ? ` → ${format(parseLocalDate(p.vigente_ate), "dd/MM/yyyy", { locale: ptBR })}` : " → atual"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => { if ((await confirm({ title: "Remover este plano?", destructive: true }))) remover.mutate(p.id); }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
