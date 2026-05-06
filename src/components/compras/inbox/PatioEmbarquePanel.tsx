import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, Container, PackageCheck, Clock } from "lucide-react";
import { usePatioProntoEmbarque, type PatioOPItem } from "@/hooks/usePatioProntoEmbarque";
import { AlocarEmContainerDialog } from "@/components/china/embarque/AlocarEmContainerDialog";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format } from "date-fns";

function diasBadge(d: number) {
  if (d <= 3) return <Badge variant="outline" className="text-[10px]">{d}d</Badge>;
  if (d <= 10) return <Badge className="bg-amber-500 text-[10px]">{d}d</Badge>;
  return <Badge className="bg-red-500 text-[10px]">{d}d</Badge>;
}

export function PatioEmbarquePanel() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: ops = [], isLoading, refetch } = usePatioProntoEmbarque();

  const filtered = useMemo(() => {
    if (!search) return ops;
    const s = search.toLowerCase();
    return ops.filter(
      (o) =>
        o.op_numero?.toLowerCase().includes(s) ||
        o.produto_codigo?.toLowerCase().includes(s) ||
        o.produto_nome?.toLowerCase().includes(s) ||
        o.lote?.toLowerCase().includes(s)
    );
  }, [ops, search]);

  const selectedItems: PatioOPItem[] = useMemo(
    () => filtered.filter((o) => selected.has(o.ordem_producao_id)),
    [filtered, selected]
  );

  const totalDisponivel = ops.reduce((s, o) => s + Number(o.qty_disponivel || 0), 0);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((f) => f.ordem_producao_id)));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-3 space-y-2">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Pátio pronto para embarque</h3>
          <Badge variant="secondary" className="ml-auto text-[10px]">{ops.length} OPs</Badge>
          <Button
            size="sm"
            disabled={selected.size === 0}
            onClick={() => setDialogOpen(true)}
            className="gap-1.5 h-7"
          >
            <Container className="h-3.5 w-3.5" />
            Alocar ({selected.size})
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-2">
            <div className="text-[10px] text-muted-foreground">OPs</div>
            <div className="text-base font-semibold">{ops.length}</div>
          </Card>
          <Card className="p-2">
            <div className="text-[10px] text-muted-foreground">Peças</div>
            <div className="text-base font-semibold">{totalDisponivel}</div>
          </Card>
          <Card className="p-2">
            <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-2.5 w-2.5" />Mais antigo</div>
            <div className="text-base font-semibold">{ops.reduce((m, o) => Math.max(m, o.dias_parado || 0), 0)}d</div>
          </Card>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="OP, produto, lote..."
            className="pl-7 h-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted-foreground">
            Nenhuma OP aguardando embarque
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="bg-muted/40 sticky top-0">
              <tr className="text-left">
                <th className="px-2 py-1.5 w-8">
                  <Checkbox
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="px-2 py-1.5">OP</th>
                <th className="px-2 py-1.5">Produto</th>
                <th className="px-2 py-1.5 text-right">Disp.</th>
                <th className="px-2 py-1.5">Lote</th>
                <th className="px-2 py-1.5 text-center">Parado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={o.ordem_producao_id}
                  className="border-t border-border hover:bg-muted/20 cursor-pointer"
                  onClick={() => toggle(o.ordem_producao_id)}
                >
                  <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(o.ordem_producao_id)}
                      onCheckedChange={() => toggle(o.ordem_producao_id)}
                    />
                  </td>
                  <td className="px-2 py-1.5 font-medium">{o.op_numero}</td>
                  <td className="px-2 py-1.5">
                    <div className="truncate max-w-[200px]">
                      <span className="text-muted-foreground">{o.produto_codigo}</span> · {o.produto_nome}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold text-emerald-500">
                    {Number(o.qty_disponivel)}
                  </td>
                  <td className="px-2 py-1.5">{o.lote || "—"}</td>
                  <td className="px-2 py-1.5 text-center">{diasBadge(o.dias_parado || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ScrollArea>

      {dialogOpen && (
        <AlocarEmContainerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          ops={selectedItems}
          onSuccess={() => {
            setSelected(new Set());
            refetch();
          }}
        />
      )}
    </div>
  );
}
