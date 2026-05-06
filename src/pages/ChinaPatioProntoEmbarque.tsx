import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2, Container, PackageCheck, Clock } from "lucide-react";
import { usePatioProntoEmbarque, type PatioOPItem } from "@/hooks/usePatioProntoEmbarque";
import { AlocarEmContainerDialog } from "@/components/china/embarque/AlocarEmContainerDialog";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format } from "date-fns";

function diasBadge(d: number) {
  if (d <= 3) return <Badge variant="outline">{d}d</Badge>;
  if (d <= 10) return <Badge className="bg-amber-500">{d}d</Badge>;
  return <Badge className="bg-red-500">{d}d</Badge>;
}

export default function ChinaPatioProntoEmbarque() {
  const navigate = useNavigate();
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
    <ChinaPageShell>
      <ChinaPageHeader
        titlePt="Pátio Pronto para Embarque"
        titleCn="待发货车间"
        icon={PackageCheck}
        iconTone="primary"
        showBack
        backTo="/dashboard/fabrica-china"
        actions={
          <Button
            disabled={selected.size === 0}
            onClick={() => setDialogOpen(true)}
            className="gap-2"
          >
            <Container className="h-4 w-4" />
            Alocar em container ({selected.size})
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-3">
        <Card className="p-3 bg-card/70 backdrop-blur-sm">
          <div className="text-[11px] text-muted-foreground">OPs aguardando</div>
          <div className="text-2xl font-semibold">{ops.length}</div>
        </Card>
        <Card className="p-3 bg-card/70 backdrop-blur-sm">
          <div className="text-[11px] text-muted-foreground">Total peças disponíveis</div>
          <div className="text-2xl font-semibold">{totalDisponivel}</div>
        </Card>
        <Card className="p-3 bg-card/70 backdrop-blur-sm">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Mais antigo (dias)
          </div>
          <div className="text-2xl font-semibold">
            {ops.reduce((m, o) => Math.max(m, o.dias_parado || 0), 0)}
          </div>
        </Card>
      </div>

      <Card className="p-2 mb-3 flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground ml-2" />
        <Input
          placeholder="Buscar OP, produto, lote..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-0 focus-visible:ring-0"
        />
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhuma OP aguardando embarque
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                  <th className="px-2 py-1.5 text-right">Planejada</th>
                  <th className="px-2 py-1.5 text-right">Produzida</th>
                  <th className="px-2 py-1.5 text-right">Alocada</th>
                  <th className="px-2 py-1.5 text-right">Disponível</th>
                  <th className="px-2 py-1.5">Lote</th>
                  <th className="px-2 py-1.5">Conclusão</th>
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
                      <div className="truncate max-w-[260px]">
                        <span className="text-muted-foreground">{o.produto_codigo}</span> · {o.produto_nome}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right">{Number(o.quantidade_planejada)}</td>
                    <td className="px-2 py-1.5 text-right">{Number(o.quantidade_produzida)}</td>
                    <td className="px-2 py-1.5 text-right">{Number(o.qty_alocada)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-emerald-500">
                      {Number(o.qty_disponivel)}
                    </td>
                    <td className="px-2 py-1.5">{o.lote || "—"}</td>
                    <td className="px-2 py-1.5">
                      {o.data_fim ? format(parseLocalDate(o.data_fim.slice(0, 10))!, "dd/MM/yy") : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-center">{diasBadge(o.dias_parado || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
    </ChinaPageShell>
  );
}
