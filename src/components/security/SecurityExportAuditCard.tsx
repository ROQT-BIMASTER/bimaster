import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet, FileText, File } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type PeriodDays = 7 | 30 | 90;

export function SecurityExportAuditCard() {
  const [days, setDays] = useState<PeriodDays>(30);

  const { data: exports = [], isLoading } = useQuery({
    queryKey: ["security-exports", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, entity_type, metadata, created_at, user_id")
        .ilike("action", "EXPORT:%")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // fetch unique user ids for names
      const userIds = [...new Set((data || []).map((r) => r.user_id).filter(Boolean))] as string[];
      let profileMap: Record<string, string> = {};
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", userIds);
        profiles?.forEach((p) => (profileMap[p.id] = p.nome || "Sem nome"));
      }

      return (data || []).map((r) => {
        const meta = (r.metadata || {}) as Record<string, any>;
        return {
          id: r.id,
          userName: profileMap[r.user_id || ""] || "Desconhecido",
          exportType: (meta.export_type as string) || r.action?.split(":")[1] || "?",
          entityType: r.entity_type || "-",
          recordCount: (meta.record_count as number) || 0,
          createdAt: r.created_at,
        };
      });
    },
  });

  const totals = exports.reduce(
    (acc, e) => {
      const key = e.exportType.toLowerCase();
      if (key.includes("excel") || key.includes("xlsx")) acc.excel++;
      else if (key.includes("csv")) acc.csv++;
      else if (key.includes("pdf")) acc.pdf++;
      else acc.other++;
      return acc;
    },
    { excel: 0, csv: 0, pdf: 0, other: 0 }
  );

  const iconFor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("excel") || t.includes("xlsx")) return <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />;
    if (t.includes("csv")) return <FileText className="h-3.5 w-3.5 text-blue-600" />;
    if (t.includes("pdf")) return <FileDown className="h-3.5 w-3.5 text-red-600" />;
    return <File className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Exportações por Usuário
          </CardTitle>
          <div className="flex gap-1">
            {([7, 30, 90] as PeriodDays[]).map((d) => (
              <Button key={d} size="sm" variant={days === d ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => setDays(d)}>
                {d}d
              </Button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 mt-2">
          <Badge variant="secondary" className="gap-1"><FileSpreadsheet className="h-3 w-3" /> Excel: {totals.excel}</Badge>
          <Badge variant="secondary" className="gap-1"><FileText className="h-3 w-3" /> CSV: {totals.csv}</Badge>
          <Badge variant="secondary" className="gap-1"><FileDown className="h-3 w-3" /> PDF: {totals.pdf}</Badge>
          {totals.other > 0 && <Badge variant="secondary">Outros: {totals.other}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : exports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma exportação no período.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-1.5 font-medium">Usuário</th>
                  <th className="text-left py-1.5 font-medium">Tipo</th>
                  <th className="text-left py-1.5 font-medium">Entidade</th>
                  <th className="text-right py-1.5 font-medium">Registros</th>
                  <th className="text-right py-1.5 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {exports.map((e) => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-1.5">{e.userName}</td>
                    <td className="py-1.5 flex items-center gap-1">{iconFor(e.exportType)} {e.exportType}</td>
                    <td className="py-1.5">{e.entityType}</td>
                    <td className="py-1.5 text-right">{e.recordCount.toLocaleString("pt-BR")}</td>
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
