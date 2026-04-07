import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, BarChart3, FileText } from "lucide-react";
import { toast } from "sonner";

export function ClientPerformanceReport() {
  const [selectedClient, setSelectedClient] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [metricsInput, setMetricsInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ["agency-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_clients").select("*").eq("status", "ativo").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["client-reports", selectedClient],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data, error } = await supabase.from("client_reports").select("*").eq("agency_client_id", selectedClient).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const generateReport = async () => {
    if (!selectedClient || !periodo) { toast.error("Preencha o período"); return; }
    setGenerating(true);
    try {
      const client = clients.find((c: any) => c.id === selectedClient);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agency-strategy-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          action: "generate_report",
          data: { client_name: client?.nome, segmento: client?.segmento, periodo, metricas: metricsInput },
        }),
      });
      if (!resp.ok) throw new Error("Erro ao gerar relatório");
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let result = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") continue;
          try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) result += c; } catch {}
        }
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      await supabase.from("client_reports").insert({
        user_id: user.id,
        agency_client_id: selectedClient,
        periodo,
        metricas: metricsInput ? { raw: metricsInput } : {},
        ai_analysis: result,
        status: "finalizado",
      });
      queryClient.invalidateQueries({ queryKey: ["client-reports", selectedClient] });
      toast.success("Relatório gerado!");
      setPeriodo("");
      setMetricsInput("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-[300px]"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
          <SelectContent>
            {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!selectedClient ? (
        <div className="text-center py-12 text-muted-foreground">Selecione um cliente para gerar relatórios</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Gerar Relatório</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Período *</Label><Input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ex: Março 2026, Q1 2026" /></div>
              <div>
                <Label>Métricas (cole dados de performance)</Label>
                <textarea
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={metricsInput}
                  onChange={(e) => setMetricsInput(e.target.value)}
                  placeholder="Cole métricas: seguidores, alcance, engajamento, cliques, conversões, investimento..."
                />
              </div>
              <Button onClick={generateReport} disabled={generating || !periodo} className="w-full gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Gerando..." : "Gerar Relatório com IA"}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Relatórios Gerados</h3>
            {reports.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum relatório gerado ainda.</p>
            ) : (
              reports.map((r: any) => (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> {r.periodo}</CardTitle>
                      <Badge variant={r.status === "finalizado" ? "default" : "secondary"}>{r.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-3 rounded-lg max-h-[300px] overflow-auto">{r.ai_analysis || "Sem análise"}</pre>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
