import { useMemo, useState } from "react";
import { useSecurityDefinerAudit } from "@/hooks/admin/useSecurityDefinerAudit";
import { SecurityDefinerHeader } from "@/components/admin/security/SecurityDefinerHeader";
import {
  SecurityDefinerFilters,
  DEFAULT_FILTERS,
  type SecurityDefinerFiltersValue,
} from "@/components/admin/security/SecurityDefinerFilters";
import { SecurityDefinerDrawer } from "@/components/admin/security/SecurityDefinerDrawer";
import { SecurityDefinerExportButton } from "@/components/admin/security/SecurityDefinerExportButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  type SecurityDefinerFunctionEnriched,
} from "@/lib/security/securityDefinerStatus";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";

const PAGE_SIZE = 100;

export default function SecurityDefinerAudit() {
  const { snapshotMeta, functions, reviewedCount, isLoading } = useSecurityDefinerAudit();
  const [filters, setFilters] = useState<SecurityDefinerFiltersValue>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<SecurityDefinerFunctionEnriched | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);

  const schemas = useMemo(
    () => Array.from(new Set(functions.map((f) => f.schema_name))).sort(),
    [functions],
  );

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return functions.filter((f) => {
      if (q && !f.function_name.toLowerCase().includes(q) && !f.schema_name.toLowerCase().includes(q)) return false;
      if (filters.status !== "all" && f.status_final !== filters.status) return false;
      if (filters.usage === "used" && !f.used_in_frontend) return false;
      if (filters.usage === "unused" && f.used_in_frontend) return false;
      if (filters.schema !== "all" && f.schema_name !== filters.schema) return false;
      if (filters.reviewed === "yes" && !f.override) return false;
      if (filters.reviewed === "no" && !!f.override) return false;
      return true;
    });
  }, [functions, filters]);

  const paged = useMemo(
    () => filtered.slice(0, page * PAGE_SIZE),
    [filtered, page],
  );

  const open = (fn: SecurityDefinerFunctionEnriched) => {
    setSelected(fn);
    setDrawerOpen(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-[1400px]">
      <SecurityDefinerHeader meta={snapshotMeta} reviewedCount={reviewedCount} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SecurityDefinerFilters value={filters} onChange={(v) => { setFilters(v); setPage(1); }} schemas={schemas} />
        <SecurityDefinerExportButton rows={filtered} />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhuma função encontrada para os filtros atuais.
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Função</TableHead>
                <TableHead className="w-[120px]">Schema</TableHead>
                <TableHead className="w-[100px] text-center">Frontend</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[100px] text-center">Grants</TableHead>
                <TableHead className="w-[80px] text-center">Revisão</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((f) => (
                <TableRow
                  key={`${f.schema_name}.${f.function_name}.${f.function_signature}`}
                  className="cursor-pointer"
                  onClick={() => open(f)}
                >
                  <TableCell>
                    <div className="font-mono text-xs break-all">{f.function_name}</div>
                    {f.function_args && (
                      <div className="font-mono text-[10px] text-muted-foreground truncate max-w-[480px]">
                        ({f.function_args})
                      </div>
                    )}
                  </TableCell>
                  <TableCell><span className="font-mono text-xs">{f.schema_name}</span></TableCell>
                  <TableCell className="text-center">
                    {f.used_in_frontend ? (
                      <Badge variant="secondary" className="text-[10px]">{f.callers_count} chamada{f.callers_count > 1 ? "s" : ""}</Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE_CLASS[f.status_final]}>
                      {STATUS_LABELS[f.status_final]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex gap-0.5 justify-center font-mono text-[10px]">
                      <span className={f.granted_to_anon ? "text-amber-600" : "text-muted-foreground"}>a</span>
                      <span className={f.granted_to_authenticated ? "text-amber-600" : "text-muted-foreground"}>u</span>
                      <span className={f.granted_to_service_role ? "text-emerald-600" : "text-muted-foreground"}>s</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {f.override ? (
                      <Badge variant="outline" className="text-[10px]">Revisada</Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">pendente</span>
                    )}
                  </TableCell>
                  <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {paged.length < filtered.length && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
                Carregar mais ({filtered.length - paged.length} restantes)
              </Button>
            </div>
          )}
          <div className="text-xs text-muted-foreground text-center">
            Exibindo {paged.length} de {filtered.length} (total no banco: {snapshotMeta.total}).
            Legenda grants: <span className="font-mono">a</span>=anon, <span className="font-mono">u</span>=authenticated, <span className="font-mono">s</span>=service_role. Âmbar = EXECUTE concedido.
          </div>
        </>
      )}

      <SecurityDefinerDrawer fn={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
