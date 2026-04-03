import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, Eye, Shield } from "lucide-react";

const statusColors: Record<string, string> = {
  open: "bg-destructive/20 text-destructive",
  investigating: "bg-warning/20 text-warning",
  mitigated: "bg-primary/20 text-primary",
  resolved: "bg-success/20 text-success",
};

export function SecurityIncidentPanel() {
  const queryClient = useQueryClient();

  const { data: incidents, isLoading } = useQuery({
    queryKey: ["security-incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_incidents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "resolved") {
        updates.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("security_incidents")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-incidents"] });
      toast.success("Status do incidente atualizado");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Incidentes de Segurança
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Severidade</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Confiança</TableHead>
              <TableHead>Detecção</TableHead>
              <TableHead>Ação Auto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : incidents && incidents.length > 0 ? (
              incidents.map((inc) => (
                <TableRow key={inc.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(inc.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {inc.incident_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      inc.severity === "critical" ? "bg-destructive text-destructive-foreground" :
                      inc.severity === "high" ? "bg-warning text-warning-foreground" :
                      "bg-muted text-muted-foreground"
                    }>
                      {inc.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {inc.title || inc.description || "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {inc.confidence_score != null ? `${Math.round(Number(inc.confidence_score) * 100)}%` : "—"}
                  </TableCell>
                  <TableCell>
                    {inc.detection_method ? (
                      <Badge variant="outline" className={
                        inc.detection_method === "anomaly" ? "border-warning text-warning text-xs" : "text-xs"
                      }>
                        {inc.detection_method}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {inc.auto_action_taken !== "none" ? (
                      <Badge className="bg-primary/20 text-primary">{inc.auto_action_taken}</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[inc.status] || ""}>{inc.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {inc.status !== "resolved" && (
                      <Select
                        value={inc.status}
                        onValueChange={(v) => updateStatus.mutate({ id: inc.id, status: v })}
                      >
                        <SelectTrigger className="h-8 w-[130px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Aberto</SelectItem>
                          <SelectItem value="investigating">Investigando</SelectItem>
                          <SelectItem value="mitigated">Mitigado</SelectItem>
                          <SelectItem value="resolved">Resolvido</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {inc.status === "resolved" && (
                      <span className="text-xs text-success flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Resolvido
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhum incidente registrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
