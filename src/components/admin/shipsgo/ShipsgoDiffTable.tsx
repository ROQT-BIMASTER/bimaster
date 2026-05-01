import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import type { DiffRow } from "@/hooks/useShipsgoIntegration";

const TIPO_LABEL: Record<string, { label: string; tone: string }> = {
  ORFAO_LOCAL: { label: "Órfão local", tone: "bg-amber-500/10 text-amber-700 border-amber-300" },
  ORFAO_SHIPSGO: { label: "Órfão ShipsGo", tone: "bg-purple-500/10 text-purple-700 border-purple-300" },
  ETA_DIVERGENTE: { label: "ETA divergente", tone: "bg-orange-500/10 text-orange-700 border-orange-300" },
  STATUS_DIVERGENTE: { label: "Status divergente", tone: "bg-blue-500/10 text-blue-700 border-blue-300" },
  STALE: { label: "Sem atualização", tone: "bg-muted text-foreground border-border" },
  WEBHOOK_FALHO: { label: "Webhook falho", tone: "bg-destructive/10 text-destructive border-destructive/30" },
};

interface Props {
  rows: DiffRow[];
  onSync: (rows: DiffRow[]) => void;
}

export function ShipsgoDiffTable({ rows, onSync }: Props) {
  const [filtro, setFiltro] = useState<string>("ALL");
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => rows.filter((r) => {
    if (filtro !== "ALL" && r.tipo !== filtro) return false;
    if (busca) {
      const q = busca.toLowerCase();
      return (r.container ?? "").toLowerCase().includes(q) || (r.bl ?? "").toLowerCase().includes(q);
    }
    return true;
  }), [rows, filtro, busca]);

  const allSelected = filtered.length > 0 && filtered.every((_, i) => selected.has(rows.indexOf(filtered[i])));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => rows.indexOf(r))));
  }
  function toggle(idx: number) {
    setSelected((p) => { const n = new Set(p); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  }
  function fmtDate(s?: string | null) {
    if (!s) return "—";
    try { return format(parseLocalDate(s) ?? new Date(s), "dd/MM/yyyy"); } catch { return s; }
  }
  function fmtDateTime(s?: string | null) {
    if (!s) return "—";
    try { return format(new Date(s), "dd/MM/yyyy HH:mm"); } catch { return s; }
  }

  const selectedRows = Array.from(selected).map((i) => rows[i]).filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar container ou BL..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as divergências</SelectItem>
            {Object.entries(TIPO_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{filtered.length} linhas · {selected.size} selecionadas</span>
          <Button size="sm" disabled={selected.size === 0} onClick={() => onSync(selectedRows)}>
            Corrigir selecionados
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[520px] border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Container / BL</TableHead>
              <TableHead>Status local</TableHead>
              <TableHead>Status ShipsGo</TableHead>
              <TableHead>ETA local</TableHead>
              <TableHead>ETA ShipsGo</TableHead>
              <TableHead>Última atualização</TableHead>
              <TableHead>Detalhe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sem divergências.</TableCell></TableRow>
            ) : filtered.map((r) => {
              const idx = rows.indexOf(r);
              const t = TIPO_LABEL[r.tipo];
              return (
                <TableRow key={idx}>
                  <TableCell><Checkbox checked={selected.has(idx)} onCheckedChange={() => toggle(idx)} /></TableCell>
                  <TableCell><Badge variant="outline" className={t?.tone}>{t?.label ?? r.tipo}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">
                    <div>{r.container ?? "—"}</div>
                    <div className="text-muted-foreground">{r.bl ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-xs">{r.status_local ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.status_shipsgo ?? "—"}</TableCell>
                  <TableCell className="text-xs">{fmtDate(r.eta_local)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(r.eta_shipsgo)}</TableCell>
                  <TableCell className="text-xs">{fmtDateTime(r.ultima_atualizacao)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[260px]">{r.detalhe}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
