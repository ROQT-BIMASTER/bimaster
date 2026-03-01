import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Monitor, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatLocalDate } from "@/utils/dateUtils";

interface AccessRecord {
  user_id: string;
  tela_codigo: string;
  access_count: number;
  last_access: string;
  user_name: string;
}

export const MonitoramentoAcessos = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedUser, setSelectedUser] = useState<string>("all");

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // Fetch access logs for the selected date
  const { data: rawLogs, isLoading } = useSupabaseQuery(
    ["access-monitoring", dateStr],
    async () => {
      const startOfDay = `${dateStr}T00:00:00.000Z`;
      const endOfDay = `${dateStr}T23:59:59.999Z`;

      const { data, error } = await supabase
        .from("access_audit_log")
        .select("user_id, tela_codigo, created_at")
        .eq("action", "page_view")
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    { staleTime: 30_000 }
  );

  // Fetch profiles for user names
  const { data: profiles } = useSupabaseQuery(
    ["profiles-for-monitoring"],
    async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email");
      if (error) throw error;
      return data || [];
    },
    { staleTime: 5 * 60_000 }
  );

  // Aggregate: group by user_id + tela_codigo
  const aggregatedData = useMemo<AccessRecord[]>(() => {
    if (!rawLogs || !profiles) return [];

    const profileMap = new Map(profiles.map((p) => [p.id, p.nome || p.email || "Desconhecido"]));

    const grouped = new Map<string, { count: number; lastAccess: string; userId: string; tela: string }>();

    for (const log of rawLogs) {
      const key = `${log.user_id}__${log.tela_codigo}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
        if (log.created_at && log.created_at > existing.lastAccess) {
          existing.lastAccess = log.created_at;
        }
      } else {
        grouped.set(key, {
          count: 1,
          lastAccess: log.created_at || "",
          userId: log.user_id || "",
          tela: log.tela_codigo || "",
        });
      }
    }

    return Array.from(grouped.values())
      .map((g) => ({
        user_id: g.userId,
        tela_codigo: g.tela,
        access_count: g.count,
        last_access: g.lastAccess,
        user_name: profileMap.get(g.userId) || "Desconhecido",
      }))
      .sort((a, b) => b.access_count - a.access_count);
  }, [rawLogs, profiles]);

  // Filter by selected user
  const filteredData = useMemo(() => {
    if (selectedUser === "all") return aggregatedData;
    return aggregatedData.filter((r) => r.user_id === selectedUser);
  }, [aggregatedData, selectedUser]);

  // Unique users for the filter dropdown
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of aggregatedData) {
      if (!map.has(r.user_id)) {
        map.set(r.user_id, r.user_name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [aggregatedData]);

  const totalAccesses = filteredData.reduce((sum, r) => sum + r.access_count, 0);

  // Format tela name for display
  const formatTela = (tela: string) => {
    return tela
      .replace(/^\/dashboard\//, "")
      .replace(/\//g, " → ")
      .replace(/^\//, "")
      || "Dashboard";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Monitoramento de Acessos por Tela
        </CardTitle>
        <CardDescription>
          Acompanhe quais telas cada usuário acessa e a frequência diária
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Data</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[200px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Usuário</label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todos os usuários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                {uniqueUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{totalAccesses}</span>
            <span className="text-muted-foreground">acessos no dia</span>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum acesso registrado para esta data.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tela</TableHead>
                  <TableHead className="text-center">Acessos</TableHead>
                  <TableHead>Último Acesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row, i) => (
                  <TableRow key={`${row.user_id}-${row.tela_codigo}-${i}`}>
                    <TableCell className="font-medium">{row.user_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatTela(row.tela_codigo)}
                    </TableCell>
                    <TableCell className="text-center font-semibold">{row.access_count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.last_access
                        ? formatLocalDate(row.last_access, "HH:mm:ss")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
