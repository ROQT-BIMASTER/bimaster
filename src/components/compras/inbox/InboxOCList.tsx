import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, AlertTriangle, AlertOctagon, Link2 } from "lucide-react";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import type { InboxOC } from "@/hooks/useCompradorInboxOCs";

interface InboxOCListProps {
  items: InboxOC[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  isLoading: boolean;
}

function fmtDate(d: string | null): string {
  const parsed = parseLocalDate(d);
  if (!parsed) return "—";
  return formatInTimeZone(parsed, "America/Sao_Paulo", "dd MMM", { locale: ptBR });
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    rascunho: "Rascunho",
    aguardando_aprovacao: "Aguardando",
    pendente_aprovacao: "Aguardando",
    aprovada: "Aprovada",
    em_producao: "Produção",
    produzindo: "Produção",
    concluida: "Concluída",
    cancelada: "Cancelada",
  };
  return map[s] || s;
}

const fmtNum = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n || 0);

export function InboxOCList({ items, selectedId, onSelect, search, onSearchChange, isLoading }: InboxOCListProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar OC, produto, SKU..."
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Nenhuma OC nesta pasta.</div>
        ) : (
          <ul className="divide-y">
            {items.map((o) => {
              const atrasada =
                o.data_entrega_prevista &&
                o.data_entrega_prevista < new Date().toISOString().slice(0, 10) &&
                o.saldo_aberto > 0;
              const isSel = selectedId === o.ordem_compra_id;
              return (
                <li key={o.ordem_compra_id}>
                  <button
                    onClick={() => onSelect(o.ordem_compra_id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors flex flex-col gap-1",
                      isSel && "bg-primary/10 hover:bg-primary/15 border-l-2 border-l-primary",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs tabular-nums">{o.numero_oc}</span>
                      <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase">
                        {statusLabel(o.oc_status)}
                      </Badge>
                      <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                        {fmtDate(o.ultima_movimentacao)}
                      </span>
                    </div>
                    <p className="text-xs font-medium truncate">{o.produto_nome}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {o.produto_codigo} · Pedido {fmtNum(o.qty_pedida)} · Saldo {fmtNum(o.saldo_aberto)}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {atrasada && (
                        <Badge variant="destructive" className="h-4 px-1 text-[9px] gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" /> Atrasada
                        </Badge>
                      )}
                      {o.has_divergencia && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5 border-amber-500 text-amber-600">
                          <AlertOctagon className="h-2.5 w-2.5" /> NC
                        </Badge>
                      )}
                      {o.has_vinculo && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5">
                          <Link2 className="h-2.5 w-2.5" /> BR
                        </Badge>
                      )}
                      {o.data_entrega_prevista && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          ETA {fmtDate(o.data_entrega_prevista)}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
