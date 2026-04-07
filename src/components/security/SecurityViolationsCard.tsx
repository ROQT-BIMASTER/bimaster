import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldBan, Globe, AlertOctagon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ViolationEntry {
  id: string;
  type: string;
  ip: string;
  user: string;
  action: string;
  severity: string;
  createdAt: string | null;
}

export function SecurityViolationsCard() {
  const { data: violations = [], isLoading } = useQuery({
    queryKey: ["security-violations"],
    queryFn: async () => {
      const results: ViolationEntry[] = [];

      // 1) Open/investigating incidents
      const { data: incidents } = await supabase
        .from("security_incidents" as any)
        .select("*")
        .in("status", ["open", "investigating"])
        .order("created_at", { ascending: false })
        .limit(50);

      (incidents || []).forEach((inc: any) => {
        results.push({
          id: inc.id,
          type: inc.incident_type || inc.type || "incident",
          ip: inc.source_ip || "-",
          user: inc.user_id || "-",
          action: inc.status || "open",
          severity: inc.severity || "medium",
          createdAt: inc.created_at,
        });
      });

      // 2) Active blocked IPs
      const { data: blocked } = await supabase
        .from("security_ip_blocklist" as any)
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(30);

      (blocked || []).forEach((b: any) => {
        results.push({
          id: b.id,
          type: "ip_blocked",
          ip: b.ip_address || "-",
          user: "-",
          action: b.block_type || "hard",
          severity: "high",
          createdAt: b.created_at,
        });
      });

      results.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return results;
    },
  });

  const severityColor = (s: string) => {
    if (s === "critical") return "destructive" as const;
    if (s === "high") return "destructive" as const;
    if (s === "medium") return "warning" as const;
    return "secondary" as const;
  };

  const typeIcon = (t: string) => {
    if (t === "ip_blocked") return <Globe className="h-3.5 w-3.5 text-destructive" />;
    return <AlertOctagon className="h-3.5 w-3.5 text-warning" />;
  };

  const openCount = violations.filter((v) => v.type !== "ip_blocked").length;
  const blockedCount = violations.filter((v) => v.type === "ip_blocked").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldBan className="h-5 w-5 text-destructive" />
            Violações Ativas
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="destructive" className="text-xs">{openCount} incidentes</Badge>
            <Badge variant="outline" className="text-xs">{blockedCount} IPs bloqueados</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : violations.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">✅ Nenhuma violação ativa.</p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-1.5 font-medium">Tipo</th>
                  <th className="text-left py-1.5 font-medium">IP</th>
                  <th className="text-left py-1.5 font-medium">Ação</th>
                  <th className="text-left py-1.5 font-medium">Severidade</th>
                  <th className="text-right py-1.5 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((v) => (
                  <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-1.5 flex items-center gap-1">{typeIcon(v.type)} {v.type}</td>
                    <td className="py-1.5 font-mono text-[10px]">{v.ip}</td>
                    <td className="py-1.5">{v.action}</td>
                    <td className="py-1.5">
                      <Badge variant={severityColor(v.severity)} className="text-[10px]">{v.severity}</Badge>
                    </td>
                    <td className="py-1.5 text-right text-muted-foreground">
                      {v.createdAt ? format(new Date(v.createdAt), "dd/MM HH:mm", { locale: ptBR }) : "-"}
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
