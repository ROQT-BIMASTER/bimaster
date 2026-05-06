import { useMemo, useState } from "react";
import { Ship, AlertTriangle, Clock, CheckCircle2, Search, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useShipsgoShipments, type ShipsgoFilters } from "@/hooks/useShipsgoShipments";
import { ContainerStatusBadge } from "@/components/china/ContainerStatusBadge";
import { ContainerDetailSheet } from "@/components/china/ContainerDetailSheet";
import { NovoTrackingDialog } from "@/components/china/NovoTrackingDialog";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const FINAL_STATUSES = new Set(["DELIVERED", "GATE_OUT"]);

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(parseLocalDate(d)!, "dd/MM/yyyy", { locale: ptBR }); }
  catch { return d; }
}

export function TorreContainersPanel() {
  const [filters, setFilters] = useState<ShipsgoFilters>({});
  const [selected, setSelected] = useState<string | null>(null);
  const { data: shipments = [], isLoading } = useShipsgoShipments(filters);

  const kpis = useMemo(() => {
    const today = new Date();
    const in7 = new Date(today.getTime() + 7 * 86_400_000);
    let emTransito = 0, atrasados = 0, chegando7 = 0, entreguesMes = 0;
    for (const s of shipments) {
      const isFinal = FINAL_STATUSES.has(s.status);
      if (!isFinal && s.status !== "PENDING") emTransito++;
      if ((s.dias_atraso ?? 0) > 0 && !isFinal) atrasados++;
      if (s.eta_atual) {
        const eta = parseLocalDate(s.eta_atual);
        if (eta && eta >= today && eta <= in7 && !isFinal) chegando7++;
      }
      if (s.ata) {
        const ata = parseLocalDate(s.ata);
        if (ata && ata.getMonth() === today.getMonth() && ata.getFullYear() === today.getFullYear()) {
          entreguesMes++;
        }
      }
    }
    return { emTransito, atrasados, chegando7, entreguesMes };
  }, [shipments]);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Ship className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Torre de containers</h3>
          <Badge variant="secondary" className="ml-auto text-[10px]">{shipments.length}</Badge>
          <NovoTrackingDialog />
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Card className="p-2">
            <div className="text-[10px] text-muted-foreground">Em trânsito</div>
            <div className="text-base font-semibold">{kpis.emTransito}</div>
          </Card>
          <Card className="p-2">
            <div className="text-[10px] text-muted-foreground">Atrasados</div>
            <div className="text-base font-semibold text-amber-600">{kpis.atrasados}</div>
          </Card>
          <Card className="p-2">
            <div className="text-[10px] text-muted-foreground">≤ 7 dias</div>
            <div className="text-base font-semibold">{kpis.chegando7}</div>
          </Card>
          <Card className="p-2">
            <div className="text-[10px] text-muted-foreground">Mês</div>
            <div className="text-base font-semibold text-emerald-600">{kpis.entreguesMes}</div>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-7 h-8 text-sm"
              placeholder="Container, BL ou Booking…"
              value={filters.search ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <Select
            value={filters.status ?? "_ALL"}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "_ALL" ? undefined : v }))}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_ALL">Todos status</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="BOOKING_CONFIRMED">Booking</SelectItem>
              <SelectItem value="LOADED">Embarcado</SelectItem>
              <SelectItem value="EN_ROUTE">Em trânsito</SelectItem>
              <SelectItem value="TRANSSHIPMENT">Transbordo</SelectItem>
              <SelectItem value="DISCHARGED">Descarregado</SelectItem>
              <SelectItem value="GATE_OUT">Liberado porto</SelectItem>
              <SelectItem value="DELIVERED">Entregue</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <table className="w-full text-[11px]">
          <thead className="bg-muted/40 sticky top-0">
            <tr className="text-left">
              <th className="px-2 py-1.5">Container / BL</th>
              <th className="px-2 py-1.5">Origem → Destino</th>
              <th className="px-2 py-1.5">ETA</th>
              <th className="px-2 py-1.5">Atraso</th>
              <th className="px-2 py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="p-2"><Skeleton className="h-5 w-full" /></td></tr>
              ))
            ) : shipments.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-xs text-muted-foreground">
                  Nenhum container rastreado.
                </td>
              </tr>
            ) : (
              shipments.map((s) => (
                <tr key={s.id} onClick={() => setSelected(s.id)} className="border-t border-border cursor-pointer hover:bg-muted/20">
                  <td className="px-2 py-1.5">
                    <div className="font-mono font-medium">{s.container_number || s.bl_number || s.booking_number}</div>
                    {s.bl_number && s.container_number && (
                      <div className="text-[10px] text-muted-foreground font-mono">BL: {s.bl_number}</div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 truncate max-w-[180px]">{s.pol_name ?? "—"} → {s.pod_name ?? "—"}</td>
                  <td className="px-2 py-1.5">{fmtDate(s.eta_atual)}</td>
                  <td className="px-2 py-1.5">
                    {(s.dias_atraso ?? 0) > 0 ? (
                      <span className="text-amber-700 font-medium">+{s.dias_atraso}d</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5"><ContainerStatusBadge status={s.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollArea>

      <ContainerDetailSheet
        shipmentId={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}
