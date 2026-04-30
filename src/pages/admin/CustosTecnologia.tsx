import { useMemo, useState } from "react";
import { useCustosTecnologia } from "@/hooks/useCustosTecnologia";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function CustosTecnologia() {
  const { custos, isLoading, upsert, remover } = useCustosTecnologia();
  const [mes, setMes] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [fornecedor, setFornecedor] = useState("Lovable");
  const [valor, setValor] = useState<string>("");
  const [descricao, setDescricao] = useState("");

  const totalMes = useMemo(() => {
    const m = mes.length === 7 ? `${mes}-01` : mes;
    return custos.filter((c) => c.mes === m).reduce((s, c) => s + Number(c.valor || 0), 0);
  }, [custos, mes]);

  const totalGeral = useMemo(
    () => custos.reduce((s, c) => s + Number(c.valor || 0), 0),
    [custos]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(valor.replace(",", "."));
    if (!fornecedor || !v || v <= 0) return;
    upsert.mutate(
      { mes, fornecedor, valor: v, descricao },
      {
        onSuccess: () => {
          setValor("");
          setDescricao("");
        },
      }
    );
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Custos de tecnologia</h1>
        <p className="text-sm text-muted-foreground">
          Lance os gastos mensais com Lovable, IA, infraestrutura. O sistema rateia automaticamente
          entre projetos com horas registradas no mesmo mês.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total no mês selecionado</div>
          <div className="text-2xl font-bold mt-1">{formatBRL(totalMes)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total acumulado</div>
          <div className="text-2xl font-bold mt-1">{formatBRL(totalGeral)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Lançamentos</div>
          <div className="text-2xl font-bold mt-1">{custos.length}</div>
        </Card>
      </div>

      <Card className="p-4">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <Label>Mês</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
          </div>
          <div>
            <Label>Fornecedor</Label>
            <Input
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              placeholder="Lovable, OpenAI..."
              required
            />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              required
            />
          </div>
          <div className="md:col-span-1">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <Button type="submit" disabled={upsert.isPending}>
            <Plus className="h-4 w-4 mr-2" /> Lançar
          </Button>
        </form>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && custos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  Nenhum custo registrado.
                </TableCell>
              </TableRow>
            )}
            {custos.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{format(parseISO(c.mes), "MMM/yyyy", { locale: ptBR })}</TableCell>
                <TableCell className="font-medium">{c.fornecedor}</TableCell>
                <TableCell className="text-right">{formatBRL(Number(c.valor))}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.descricao || "—"}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm("Remover este lançamento?")) remover.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
