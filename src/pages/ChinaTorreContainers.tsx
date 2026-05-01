import { useMemo, useState } from "react";
import { Ship, AlertTriangle, Clock, CheckCircle2, Search, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/components/ui/kpi-card";
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
  try { return format(parseLocalDate(d), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return d; }
}

export default function ChinaTorreContainers() {
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
        if (eta >= today && eta <= in7 && !isFinal) chegando7++;
      }
      if (s.ata) {
        const ata = parseLocalDate(s.ata);
        if (ata.getMonth() === today.getMonth() && ata.getFullYear() === today.getFullYear()) {
          entreguesMes++;
        }
      }
    }
    return { emTransito, atrasados, chegando7, entreguesMes };
  }, [shipments]);

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ship className="h-6 w-6" />
            Torre de Containers <span className="text-base font-normal text-muted-foreground">集装箱控制塔</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento em tempo real dos containers em trânsito da China.
          </p>
        </div>
        <NovoTrackingDialog />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Em trânsito" value={kpis.emTransito} icon={Ship} variant="info" loading={isLoading} />
        <KpiCard title="Atrasados" value={kpis.atrasados} icon={AlertTriangle} variant="warning" loading={isLoading} />
        <KpiCard title="Chegando em 7 dias" value={kpis.chegando7} icon={Clock} variant="accent" loading={isLoading} />
        <KpiCard title="Entregues no mês" value={kpis.entreguesMes} icon={CheckCircle2} variant="success" loading={isLoading} />
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Container, BL ou Booking…"
              value={filters.search ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <Select
            value={filters.status ?? "_ALL"}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "_ALL" ? undefined : v }))}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="h-3.5 w-3.5 mr-1" />
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
          <Select
            value={String(filters.atraso_min ?? "_ANY")}
            onValueChange={(v) => setFilters((f) => ({ ...f, atraso_min: v === "_ANY" ? undefined : Number(v) }))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Atraso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_ANY">Qualquer atraso</SelectItem>
              <SelectItem value="1">Atrasados (≥ 1 dia)</SelectItem>
              <SelectItem value="3">Atrasados (≥ 3 dias)</SelectItem>
              <SelectItem value="7">Atrasados (≥ 7 dias)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Container / BL</TableHead>
                <TableHead>Armador</TableHead>
                <TableHead>Origem → Destino</TableHead>
                <TableHead>ETA atual</TableHead>
                <TableHead>Atraso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último evento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : shipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Nenhum container rastreado. Clique em "Rastrear container" para iniciar.
                  </TableCell>
                </TableRow>
              ) : (
                shipments.map((s) => (
                  <TableRow key={s.id} onClick={() => setSelected(s.id)} className="cursor-pointer">
                    <TableCell>
                      <div className="font-mono text-sm font-medium">{s.container_number || s.bl_number || s.booking_number}</div>
                      {s.bl_number && s.container_number && (
                        <div className="text-xs text-muted-foreground font-mono">BL: {s.bl_number}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{s.carrier_name || s.carrier_code || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {s.pol_name ?? "—"} → {s.pod_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(s.eta_atual)}</TableCell>
                    <TableCell>
                      {(s.dias_atraso ?? 0) > 0 ? (
                        <span className="text-amber-700 font-medium text-sm">+{s.dias_atraso}d</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell><ContainerStatusBadge status={s.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                      {s.last_event_description ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ContainerDetailSheet
        shipmentId={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}
