import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { ChevronDown, ChevronRight, Download, Search, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const PAGE_SIZE = 50;

type Row = {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_nome: string | null;
  actor_email: string | null;
  entity_type: string;
  action: string;
  target_user_id: string | null;
  target_user_nome: string | null;
  target_role: string | null;
  target_departamento: string | null;
  modulo_codigo: string | null;
  tela_codigo: string | null;
  componente_codigo: string | null;
  acao_descricao: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  total_count: number;
};

const ENTITY_TYPES: { value: string; label: string }[] = [
  { value: "usuario_permissoes_modulos", label: "Módulo (usuário)" },
  { value: "usuario_permissoes_telas", label: "Tela (usuário)" },
  { value: "role_permissoes_modulos", label: "Módulo (papel)" },
  { value: "role_permissoes_telas", label: "Tela (papel)" },
  { value: "departamento_permissoes_modulos", label: "Módulo (departamento)" },
  { value: "departamento_permissoes_telas", label: "Tela (departamento)" },
  { value: "ui_permissions", label: "Componente de UI" },
  { value: "user_roles", label: "Papel de usuário" },
  { value: "profiles", label: "Cadastro de usuário" },
];

const ACTION_LABEL: Record<string, { label: string; variant: "default" | "destructive" | "secondary" }> = {
  INSERT: { label: "Concedeu / Criou", variant: "default" },
  DELETE: { label: "Revogou / Removeu", variant: "destructive" },
  UPDATE: { label: "Alterou", variant: "secondary" },
};

interface Filters {
  actorId: string | null;
  targetUserId: string | null;
  entityType: string | null;
  action: string | null;
  search: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export default function AcoesAdminsTab() {
  const [filters, setFilters] = useState<Filters>({
    actorId: null,
    targetUserId: null,
    entityType: null,
    action: null,
    search: "",
  });
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPage(0);
  }, [
    filters.actorId,
    filters.targetUserId,
    filters.entityType,
    filters.action,
    filters.search,
    filters.dateFrom?.getTime(),
    filters.dateTo?.getTime(),
  ]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput }));
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data: actors } = useQuery({
    queryKey: ["security-audit-actors"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_admin_security_audit_actors");
      if (error) throw error;
      return (data || []) as { id: string; nome: string; email: string }[];
    },
  });

  const { data: targets } = useQuery({
    queryKey: ["security-audit-targets"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["security-audit-rows", filters, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_admin_security_audit", {
        p_from: filters.dateFrom ? filters.dateFrom.toISOString() : null,
        p_to: filters.dateTo
          ? new Date(filters.dateTo.getFullYear(), filters.dateTo.getMonth(), filters.dateTo.getDate(), 23, 59, 59, 999).toISOString()
          : null,
        p_actor_id: filters.actorId,
        p_target_user_id: filters.targetUserId,
        p_entity_types: filters.entityType ? [filters.entityType] : null,
        p_action: filters.action,
        p_search: filters.search || null,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      const rows = (data || []) as Row[];
      return { rows, total: rows[0]?.total_count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = Number(data?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function exportCsv() {
    const id = toast.loading("Gerando CSV...");
    try {
      const { data, error } = await supabase.rpc("rpc_admin_security_audit", {
        p_from: filters.dateFrom ? filters.dateFrom.toISOString() : null,
        p_to: filters.dateTo
          ? new Date(filters.dateTo.getFullYear(), filters.dateTo.getMonth(), filters.dateTo.getDate(), 23, 59, 59, 999).toISOString()
          : null,
        p_actor_id: filters.actorId,
        p_target_user_id: filters.targetUserId,
        p_entity_types: filters.entityType ? [filters.entityType] : null,
        p_action: filters.action,
        p_search: filters.search || null,
        p_limit: 10_000,
        p_offset: 0,
      });
      if (error) throw error;
      const allRows = (data || []) as Row[];

      const header = ["Quando", "Admin", "E-mail Admin", "Ação", "Alvo", "Papel", "Departamento", "Módulo", "Tela", "Componente", "Descrição"];
      const escape = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [header.join(";")];
      for (const r of allRows) {
        lines.push(
          [
            format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss"),
            r.actor_nome || "",
            r.actor_email || "",
            r.action,
            r.target_user_nome || "",
            r.target_role || "",
            r.target_departamento || "",
            r.modulo_codigo || "",
            r.tela_codigo || "",
            r.componente_codigo || "",
            r.acao_descricao || "",
          ].map(escape).join(";"),
        );
      }
      const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `acoes-admins-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${allRows.length} registros exportados`, { id });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao exportar", { id });
    }
  }

  const hasAnyFilter = useMemo(() =>
    Boolean(filters.actorId || filters.targetUserId || filters.entityType || filters.action || filters.search || filters.dateFrom || filters.dateTo),
    [filters],
  );

  return (
    <Card>
      <CardHeader className="pb-2 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {total.toLocaleString("pt-BR")} ações registradas
            {isFetching && <span className="ml-2 text-xs text-muted-foreground">atualizando…</span>}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <DateRangeFilter
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              onDateFromChange={(d) => setFilters((f) => ({ ...f, dateFrom: d }))}
              onDateToChange={(d) => setFilters((f) => ({ ...f, dateTo: d }))}
            />
            <Button variant="outline" size="sm" onClick={exportCsv} className="h-9 gap-1.5">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.actorId ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, actorId: v === "all" ? null : v }))}
          >
            <SelectTrigger className="w-[220px] h-9 text-sm">
              <SelectValue placeholder="Admin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os admins</SelectItem>
              {(actors ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.targetUserId ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, targetUserId: v === "all" ? null : v }))}
          >
            <SelectTrigger className="w-[220px] h-9 text-sm">
              <SelectValue placeholder="Usuário alvo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os alvos</SelectItem>
              {(targets ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.entityType ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, entityType: v === "all" ? null : v }))}
          >
            <SelectTrigger className="w-[200px] h-9 text-sm">
              <SelectValue placeholder="Tipo de mudança" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {ENTITY_TYPES.map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.action ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, action: v === "all" ? null : v }))}
          >
            <SelectTrigger className="w-[170px] h-9 text-sm">
              <SelectValue placeholder="Operação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as operações</SelectItem>
              <SelectItem value="INSERT">Concessão / criação</SelectItem>
              <SelectItem value="UPDATE">Alteração</SelectItem>
              <SelectItem value="DELETE">Revogação / exclusão</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar módulo/tela/papel..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9 w-[240px] text-sm"
            />
          </div>

          {hasAnyFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setSearchInput("");
                setFilters({
                  actorId: null,
                  targetUserId: null,
                  entityType: null,
                  action: null,
                  search: "",
                });
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="overflow-auto">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead>Quando</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma ação encontrada para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const isExpanded = expanded.has(r.id);
                  const actionMeta = ACTION_LABEL[r.action] ?? { label: r.action, variant: "secondary" as const };
                  return (
                    <>
                      <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpanded(r.id)}>
                        <TableCell className="align-top">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="align-top text-xs whitespace-nowrap">
                          {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="font-medium text-sm">{r.actor_nome || "—"}</div>
                          {r.actor_email && <div className="text-xs text-muted-foreground">{r.actor_email}</div>}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant={actionMeta.variant} className="text-xs">{actionMeta.label}</Badge>
                        </TableCell>
                        <TableCell className="align-top text-sm">{r.acao_descricao}</TableCell>
                        <TableCell className="align-top text-sm">
                          {r.target_user_nome ? (
                            <div>
                              <div className="font-medium">{r.target_user_nome}</div>
                              {r.target_role && <div className="text-xs text-muted-foreground">papel: {r.target_role}</div>}
                              {r.target_departamento && <div className="text-xs text-muted-foreground">dept: {r.target_departamento}</div>}
                            </div>
                          ) : r.target_role ? (
                            <Badge variant="outline" className="text-xs">papel: {r.target_role}</Badge>
                          ) : r.target_departamento ? (
                            <Badge variant="outline" className="text-xs">dept: {r.target_departamento}</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className="text-xs font-mono">{r.entity_type}</Badge>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={r.id + ":d"} className="bg-muted/30">
                          <TableCell />
                          <TableCell colSpan={6}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div>
                                <div className="font-medium mb-1 text-muted-foreground">Valor anterior</div>
                                <pre className="p-2 rounded bg-background border max-h-60 overflow-auto whitespace-pre-wrap break-all">
{r.old_data ? JSON.stringify(r.old_data, null, 2) : "—"}
                                </pre>
                              </div>
                              <div>
                                <div className="font-medium mb-1 text-muted-foreground">Novo valor</div>
                                <pre className="p-2 rounded bg-background border max-h-60 overflow-auto whitespace-pre-wrap break-all">
{r.new_data ? JSON.stringify(r.new_data, null, 2) : "—"}
                                </pre>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span>
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mt-3">
          Cobertura completa a partir de 29/05/2026. Registros anteriores podem não ter sido capturados em todos os tipos de evento.
        </p>
      </CardContent>
    </Card>
  );
}
