import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DeniedEntry {
  id: string;
  userName: string;
  action: string;
  resource: string;
  severity: string;
  createdAt: string | null;
  source: string;
}

export function SecurityAccessDeniedCard() {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["security-access-denied"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceISO = since.toISOString();

      // 1) security_audit_log
      const { data: secLogs } = await supabase
        .from("security_audit_log" as any)
        .select("id, action, severity, user_id, metadata, created_at")
        .in("action", ["project_access_denied", "project_access_denied_client", "blocked_request"])
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false })
        .limit(50);

      // 2) access_audit_log where success = false
      const { data: accessLogs } = await supabase
        .from("access_audit_log")
        .select("id, action, user_id, modulo_codigo, tela_codigo, created_at")
        .eq("success", false)
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false })
        .limit(50);

      // Resolve user names
      const allUserIds = [
        ...new Set([
          ...(secLogs || []).map((r: any) => r.user_id),
          ...(accessLogs || []).map((r: any) => r.user_id),
        ].filter(Boolean)),
      ] as string[];

      let profileMap: Record<string, string> = {};
      if (allUserIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", allUserIds);
        profiles?.forEach((p) => (profileMap[p.id] = p.nome || "Sem nome"));
      }

      const results: DeniedEntry[] = [];

      (secLogs || []).forEach((r: any) => {
        const meta = (r.metadata || {}) as Record<string, any>;
        results.push({
          id: r.id,
          userName: profileMap[r.user_id || ""] || "Desconhecido",
          action: r.action,
          resource: meta.projeto_id || meta.url || "-",
          severity: r.severity || "medium",
          createdAt: r.created_at,
          source: "security_audit",
        });
      });

      (accessLogs || []).forEach((r: any) => {
        results.push({
          id: r.id,
          userName: profileMap[r.user_id || ""] || "Desconhecido",
          action: r.action || "access_denied",
          resource: r.tela_codigo || r.modulo_codigo || "-",
          severity: "low",
          createdAt: r.created_at,
          source: "access_audit",
        });
      });

      results.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return results.slice(0, 100);
    },
  });

  // Count repeat offenders (3+ denials)
  const userCounts: Record<string, number> = {};
  entries.forEach((e) => (userCounts[e.userName] = (userCounts[e.userName] || 0) + 1));
  const repeatOffenders = Object.entries(userCounts).filter(([, c]) => c >= 3);

  const severityVariant = (s: string) => {
    if (s === "high" || s === "critical") return "destructive" as const;
    if (s === "medium") return "warning" as const;
    return "secondary" as const;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Acessos Negados
            <Badge variant="outline" className="ml-1 text-xs">{entries.length}</Badge>
          </CardTitle>
        </div>
        {repeatOffenders.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {repeatOffenders.map(([name, count]) => (
              <Badge key={name} variant="destructive" className="gap-1 text-xs">
                <AlertTriangle className="h-3 w-3" />
                {name}: {count}x
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum acesso negado nos últimos 30 dias.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-1.5 font-medium">Usuário</th>
                  <th className="text-left py-1.5 font-medium">Ação</th>
                  <th className="text-left py-1.5 font-medium">Recurso</th>
                  <th className="text-left py-1.5 font-medium">Severidade</th>
                  <th className="text-right py-1.5 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-1.5">{e.userName}</td>
                    <td className="py-1.5 font-mono text-[10px]">{e.action}</td>
                    <td className="py-1.5 max-w-[120px] truncate">{e.resource}</td>
                    <td className="py-1.5">
                      <Badge variant={severityVariant(e.severity)} className="text-[10px]">{e.severity}</Badge>
                    </td>
                    <td className="py-1.5 text-right text-muted-foreground">
                      {e.createdAt ? format(new Date(e.createdAt), "dd/MM HH:mm", { locale: ptBR }) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
