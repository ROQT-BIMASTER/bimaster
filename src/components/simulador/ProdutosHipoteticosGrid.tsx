import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Beaker } from "lucide-react";
import type { ProdutoHipotetico, TabelaNode } from "@/lib/fabrica/perfilSimulacao";

interface Props {
  produtos: ProdutoHipotetico[];
  tabelas: TabelaNode[];
  onChange: (produtos: ProdutoHipotetico[]) => void;
}

const RAIZ = "__raiz__";

export function ProdutosHipoteticosGrid({ produtos, tabelas, onChange }: Props) {
  const update = (id: string, patch: Partial<ProdutoHipotetico>) =>
    onChange(produtos.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const add = () =>
    onChange([
      ...produtos,
      {
        id: crypto.randomUUID(),
        descricao: "",
        valor: 0,
        nivel_id: produtos[0]?.nivel_id ?? null,
      },
    ]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Beaker className="h-4 w-4 text-primary" />
          Produtos hipotéticos
        </CardTitle>
        <CardDescription>
          Nada é gravado no catálogo. Informe o valor e em qual nível ele já está — o simulador
          reverte até o custo de fábrica e projeta as demais linhas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground">
          <div className="col-span-5">Descrição</div>
          <div className="col-span-3">Valor (R$)</div>
          <div className="col-span-3">Valor está em</div>
          <div className="col-span-1" />
        </div>

        {produtos.map((p) => (
          <div key={p.id} className="grid grid-cols-12 gap-2 items-center">
            <Input
              className="col-span-5 h-9"
              placeholder="Ex.: Corretivo"
              value={p.descricao}
              onChange={(e) => update(p.id, { descricao: e.target.value })}
            />
            <Input
              className="col-span-3 h-9 font-mono text-right"
              type="number"
              step="0.01"
              value={p.valor || ""}
              onChange={(e) => update(p.id, { valor: parseFloat(e.target.value) || 0 })}
            />
            <div className="col-span-3">
              <Select
                value={p.nivel_id ?? RAIZ}
                onValueChange={(v) => update(p.id, { nivel_id: v === RAIZ ? null : v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={RAIZ}>Custo de fábrica</SelectItem>
                  {tabelas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="col-span-1"
              onClick={() => onChange(produtos.filter((x) => x.id !== p.id))}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar produto
        </Button>
      </CardContent>
    </Card>
  );
}
