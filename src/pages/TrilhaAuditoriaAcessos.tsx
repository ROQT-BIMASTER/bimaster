import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import {
  Footprints,
  Search,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Monitor,
  ArrowLeft,
  Download,
  Users,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AcoesAdminsTab from "@/components/auditoria/AcoesAdminsTab";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface AccessLog {
  id: string;
  user_id: string | null;
  tela_codigo: string | null;
  modulo_codigo: string | null;
  action: string;
  success: boolean;
  ip_address: unknown;
  user_agent: string | null;
  created_at: string | null;
  user_name?: string;
}

interface MultiIpUser {
  user_id: string;
  user_name: string;
  ip_count: number;
  ips: { ip: string; last_seen: string; user_agent: string | null }[];
  last_access: string;
}

interface UsuarioResumo {
  user_id: string;
  user_nome: string;
  total_acessos: number;
  acessos_24h: number;
  ultimo_acesso: string;
  telas_distintas: number;
  modulos_distintos: number;
}

type AuditFilters = {
  userId: string | null;
  modulo: string | null;
  action: string | null;
  status: "all" | "ok" | "fail";
  search: string;
  dateFrom?: Date;
  dateTo?: Date;
};

const PAGE_SIZE = 50;

export default function TrilhaAuditoriaAcessos() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AuditFilters>({
    userId: null,
    modulo: null,
    action: null,
    status: "all",
    search: "",
  });
  const [tab, setTab] = useState("trilha");

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Footprints className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Trilha de Auditoria de Acessos</h1>
          <p className="text-sm text-muted-foreground">
            Rastreamento completo de acessos por usuário, módulo e tela
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="trilha">
            <Footprints className="h-4 w-4 mr-1.5" />
            Trilha Completa
          </TabsTrigger>
          <TabsTrigger value="por-usuario">
            <Users className="h-4 w-4 mr-1.5" />
            Por Usuário
          </TabsTrigger>
          <TabsTrigger value="multi-ip">
            <Monitor className="h-4 w-4 mr-1.5" />
            Múltiplos IPs
          </TabsTrigger>
          <TabsTrigger value="acoes-admins">
            <ShieldCheck className="h-4 w-4 mr-1.5" />
            Ações de Admins
          </TabsTrigger>
        </TabsList>
        <TabsContent value="trilha">
          <TrilhaCompleta filters={filters} setFilters={setFilters} />
        </TabsContent>
        <TabsContent value="por-usuario">
          <PorUsuario
            filters={filters}
            setFilters={setFilters}
            onPickUser={(userId) => {
              setFilters((f) => ({ ...f, userId }));
              setTab("trilha");
            }}
          />
        </TabsContent>
        <TabsContent value="multi-ip">
          <MultiplosIPs />
        </TabsContent>
        <TabsContent value="acoes-admins">
          <AcoesAdminsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filtros auxiliares — populados via queries leves no servidor        */
/* ------------------------------------------------------------------ */

function useFilterOptions() {
  return useQuery({
    queryKey: ["audit-filter-options"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // Amostra grande p/ extrair valores distintos de módulo/ação.
      // O dropdown de usuários vem dos profiles com ao menos 1 acesso.
      const [{ data: logs }, { data: users }] = await Promise.all([
        supabase
          .from("access_audit_log")
          .select("modulo_codigo, action")
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase.rpc("rpc_audit_usuarios_resumo", {
          p_from: null as any,
          p_to: null as any,
        }),
      ]);

      const modulos = Array.from(
        new Set((logs || []).map((l: any) => l.modulo_codigo).filter(Boolean)),
      ).sort() as string[];
      const acoes = Array.from(
        new Set((logs || []).map((l: any) => l.action).filter(Boolean)),
      ).sort() as string[];
      const usuarios = ((users || []) as UsuarioResumo[])
        .map((u) => ({ id: u.user_id, nome: u.user_nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

      return { modulos, acoes, usuarios };
    },
  });
}

/* ------------------------------------------------------------------ */
/* TRILHA COMPLETA — server-side filtering + paginação real            */
/* ------------------------------------------------------------------ */

function TrilhaCompleta({
  filters,
  setFilters,
}: {
  filters: AuditFilters;
  setFilters: (updater: (f: AuditFilters) => AuditFilters) => void;
}) {
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState(filters.search);
  const opts = useFilterOptions();

  // Reset de página quando qualquer filtro muda
  useEffect(() => {
    setPage(0);
  }, [
    filters.userId,
    filters.modulo,
    filters.action,
    filters.status,
    filters.search,
    filters.dateFrom?.getTime(),
    filters.dateTo?.getTime(),
  ]);

  // Debounce da busca textual (300ms)
  useEffect(() => {
    const t = window.setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput }));
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput, setFilters]);

  const {
    data,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["audit-trail-logs", filters, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("access_audit_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filters.userId) q = q.eq("user_id", filters.userId);
      if (filters.modulo) q = q.eq("modulo_codigo", filters.modulo);
      if (filters.action) q = q.eq("action", filters.action);
      if (filters.status === "ok") q = q.eq("success", true);
      if (filters.status === "fail") q = q.eq("success", false);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom.toISOString());
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        q = q.lte("created_at", to.toISOString());
      }
      if (filters.search.trim()) {
        const s = filters.search.trim().replace(/[%_]/g, "");
        q = q.ilike("tela_codigo", `%${s}%`);
      }

      const { data: rows, count, error } = await q;
      if (error) throw error;

      const userIds = Array.from(
        new Set((rows || []).map((r) => r.user_id).filter(Boolean)),
      );
      let profileMap: Record<string, string> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", userIds as string[]);
        profileMap = Object.fromEntries(
          (profs || []).map((p) => [p.id, p.nome || "Desconhecido"]),
        );
      }

      return {
        rows: (rows || []).map((r) => ({
          ...r,
          user_name: r.user_id ? profileMap[r.user_id] || "Desconhecido" : "—",
        })) as AccessLog[],
        total: count ?? 0,
      };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function exportCsv() {
    const id = toast.loading("Gerando CSV...");
    try {
      let q = supabase
        .from("access_audit_log")
        .select("created_at, user_id, action, modulo_codigo, tela_codigo, ip_address, user_agent, success")
        .order("created_at", { ascending: false })
        .limit(10000);
      if (filters.userId) q = q.eq("user_id", filters.userId);
      if (filters.modulo) q = q.eq("modulo_codigo", filters.modulo);
      if (filters.action) q = q.eq("action", filters.action);
      if (filters.status === "ok") q = q.eq("success", true);
      if (filters.status === "fail") q = q.eq("success", false);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom.toISOString());
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        q = q.lte("created_at", to.toISOString());
      }
      if (filters.search.trim()) {
        const s = filters.search.trim().replace(/[%_]/g, "");
        q = q.ilike("tela_codigo", `%${s}%`);
      }
      const { data: rowsAll, error } = await q;
      if (error) throw error;

      const userIds = Array.from(new Set((rowsAll || []).map((r: any) => r.user_id).filter(Boolean)));
      let nameMap: Record<string, string> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", userIds as string[]);
        nameMap = Object.fromEntries((profs || []).map((p) => [p.id, p.nome || ""]));
      }

      const header = [
        "Data/Hora",
        "Usuário",
        "Ação",
        "Módulo",
        "Tela",
        "IP",
        "User-Agent",
        "Status",
      ];
      const escape = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [header.join(";")];
      for (const r of rowsAll || []) {
        lines.push(
          [
            r.created_at,
            nameMap[r.user_id as string] || "",
            r.action,
            r.modulo_codigo || "",
            r.tela_codigo || "",
            String(r.ip_address || ""),
            r.user_agent || "",
            r.success ? "OK" : "Falha",
          ]
            .map(escape)
            .join(";"),
        );
      }

      const blob = new Blob(["\uFEFF" + lines.join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trilha-auditoria-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${(rowsAll || []).length} registros exportados`, { id });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao exportar", { id });
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">
            {total.toLocaleString("pt-BR")} registros
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
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.userId ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, userId: v === "all" ? null : v }))}
          >
            <SelectTrigger className="w-[220px] h-9 text-sm">
              <SelectValue placeholder="Usuário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              {(opts.data?.usuarios || []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.modulo ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, modulo: v === "all" ? null : v }))}
          >
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              {(opts.data?.modulos || []).map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.action ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, action: v === "all" ? null : v }))}
          >
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {(opts.data?.acoes || []).map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.status}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, status: v as AuditFilters["status"] }))
            }
          >
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="ok">Sucesso</SelectItem>
              <SelectItem value="fail">Falha</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tela..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9 w-[220px] text-sm"
            />
          </div>

          {(filters.userId ||
            filters.modulo ||
            filters.action ||
            filters.status !== "all" ||
            filters.search ||
            filters.dateFrom ||
            filters.dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setSearchInput("");
                setFilters(() => ({
                  userId: null,
                  modulo: null,
                  action: null,
                  status: "all",
                  search: "",
                }));
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="overflow-auto">
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tela</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>User-Agent</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum registro para os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm font-medium">{log.user_name}</TableCell>
                    <TableCell className="text-sm">{log.action}</TableCell>
                    <TableCell className="text-sm">{log.tela_codigo || "—"}</TableCell>
                    <TableCell className="text-sm">{log.modulo_codigo || "—"}</TableCell>
                    <TableCell className="text-sm font-mono text-xs">
                      {String(log.ip_address || "—")}
                    </TableCell>
                    <TableCell
                      className="text-sm max-w-[200px] truncate text-muted-foreground"
                      title={log.user_agent || ""}
                    >
                      {log.user_agent || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.created_at
                        ? format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={log.success ? "default" : "destructive"}
                        className="text-[10px]"
                      >
                        {log.success ? "OK" : "Falha"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* POR USUÁRIO — resumo agregado via RPC                              */
/* ------------------------------------------------------------------ */

function PorUsuario({
  filters,
  setFilters,
  onPickUser,
}: {
  filters: AuditFilters;
  setFilters: (updater: (f: AuditFilters) => AuditFilters) => void;
  onPickUser: (userId: string) => void;
}) {
  const [sort, setSort] = useState<"ultimo" | "total" | "nome">("ultimo");

  const { data: resumo = [], isLoading } = useQuery({
    queryKey: [
      "audit-usuarios-resumo",
      filters.dateFrom?.toISOString() ?? null,
      filters.dateTo?.toISOString() ?? null,
    ],
    queryFn: async () => {
      const to = filters.dateTo ? new Date(filters.dateTo) : undefined;
      if (to) to.setHours(23, 59, 59, 999);
      const { data, error } = await supabase.rpc("rpc_audit_usuarios_resumo", {
        p_from: filters.dateFrom ? filters.dateFrom.toISOString() : null,
        p_to: to ? to.toISOString() : null,
      } as any);
      if (error) throw error;
      return (data || []) as UsuarioResumo[];
    },
  });

  const sorted = useMemo(() => {
    const arr = [...resumo];
    if (sort === "total") arr.sort((a, b) => b.total_acessos - a.total_acessos);
    else if (sort === "nome") arr.sort((a, b) => a.user_nome.localeCompare(b.user_nome, "pt-BR"));
    else arr.sort((a, b) => +new Date(b.ultimo_acesso) - +new Date(a.ultimo_acesso));
    return arr;
  }, [resumo, sort]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            {resumo.length} usuários com acesso{" "}
            {filters.dateFrom || filters.dateTo ? "no período" : "registrado"}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <DateRangeFilter
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              onDateFromChange={(d) => setFilters((f) => ({ ...f, dateFrom: d }))}
              onDateToChange={(d) => setFilters((f) => ({ ...f, dateTo: d }))}
            />
            <Select value={sort} onValueChange={(v) => setSort(v as any)}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ultimo">Último acesso</SelectItem>
                <SelectItem value="total">Total de acessos</SelectItem>
                <SelectItem value="nome">Nome (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Últimas 24h</TableHead>
                <TableHead className="text-center">Telas</TableHead>
                <TableHead className="text-center">Módulos</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum acesso registrado no período.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((u) => (
                  <TableRow key={u.user_id} className="hover:bg-muted/50">
                    <TableCell className="text-sm font-medium">{u.user_nome}</TableCell>
                    <TableCell className="text-center text-sm font-mono">
                      {u.total_acessos.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-center text-sm font-mono">
                      {u.acessos_24h > 0 ? (
                        <Badge variant="default" className="text-[10px]">
                          {u.acessos_24h}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm">{u.telas_distintas}</TableCell>
                    <TableCell className="text-center text-sm">{u.modulos_distintos}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(u.ultimo_acesso), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onPickUser(u.user_id)}
                      >
                        Ver trilha
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* MÚLTIPLOS IPs — preservado (com aumento de janela)                 */
/* ------------------------------------------------------------------ */

function MultiplosIPs() {
  const [periodo, setPeriodo] = useState("30");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: multiIpUsers = [], isLoading } = useQuery({
    queryKey: ["multi-ip-users", periodo],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - Number(periodo));

      const { data: logs, error } = await supabase
        .from("access_audit_log")
        .select("user_id, ip_address, user_agent, created_at")
        .gte("created_at", since.toISOString())
        .not("user_id", "is", null)
        .not("ip_address", "is", null)
        .order("created_at", { ascending: false })
        .limit(10000);
      if (error) throw error;

      const userMap: Record<
        string,
        { ips: Map<string, { last_seen: string; user_agent: string | null }>; last_access: string }
      > = {};
      for (const l of logs || []) {
        if (!l.user_id) continue;
        const ip = String(l.ip_address);
        if (!userMap[l.user_id]) {
          userMap[l.user_id] = { ips: new Map(), last_access: l.created_at || "" };
        }
        const entry = userMap[l.user_id];
        if (!entry.ips.has(ip)) {
          entry.ips.set(ip, { last_seen: l.created_at || "", user_agent: l.user_agent });
        }
      }

      const multiIpUserIds = Object.entries(userMap).filter(([, v]) => v.ips.size > 1);
      if (multiIpUserIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome")
        .in(
          "id",
          multiIpUserIds.map(([id]) => id),
        );
      const profileMap = (profiles || []).reduce(
        (acc, p) => ({ ...acc, [p.id]: p.nome || "Desconhecido" }),
        {} as Record<string, string>,
      );

      return multiIpUserIds
        .map(([userId, data]) => ({
          user_id: userId,
          user_name: profileMap[userId] || "Desconhecido",
          ip_count: data.ips.size,
          ips: Array.from(data.ips.entries()).map(([ip, info]) => ({ ip, ...info })),
          last_access: data.last_access,
        }))
        .sort((a, b) => b.ip_count - a.ip_count) as MultiIpUser[];
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Usuários com Múltiplos IPs ({multiIpUsers.length})
          </CardTitle>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead className="text-center">IPs Distintos</TableHead>
              <TableHead>Último Acesso</TableHead>
              <TableHead className="text-center">Risco</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : multiIpUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum usuário com múltiplos IPs no período.
                </TableCell>
              </TableRow>
            ) : (
              multiIpUsers.map((user) => (
                <>
                  <TableRow
                    key={user.user_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      setExpanded(expanded === user.user_id ? null : user.user_id)
                    }
                  >
                    <TableCell>
                      {expanded === user.user_id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{user.user_name}</TableCell>
                    <TableCell className="text-center text-sm font-mono">{user.ip_count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(user.last_access), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-center">
                      {user.ip_count >= 5 ? (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Alto
                        </Badge>
                      ) : user.ip_count >= 3 ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Médio
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Baixo
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                  {expanded === user.user_id && (
                    <TableRow key={`${user.user_id}-detail`}>
                      <TableCell colSpan={5} className="bg-muted/30 p-3">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            IPs utilizados:
                          </p>
                          {user.ips.map((ipInfo, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-4 text-xs py-1 border-b border-border/50 last:border-0"
                            >
                              <span className="font-mono text-foreground min-w-[120px]">
                                {ipInfo.ip}
                              </span>
                              <span className="text-muted-foreground">
                                Último uso:{" "}
                                {format(new Date(ipInfo.last_seen), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })}
                              </span>
                              <span
                                className="text-muted-foreground truncate max-w-[300px]"
                                title={ipInfo.user_agent || ""}
                              >
                                {ipInfo.user_agent || "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
