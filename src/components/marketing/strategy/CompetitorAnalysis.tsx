import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Sparkles, Loader2, Target } from "lucide-react";
import { toast } from "sonner";

export function CompetitorAnalysis() {
  const [selectedClient, setSelectedClient] = useState("");
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [plataforma, setPlataforma] = useState("instagram");
  const [username, setUsername] = useState("");
  const [followers, setFollowers] = useState("");
  const [engagementRate, setEngagementRate] = useState("");
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ["agency-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_clients").select("*").eq("status", "ativo").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: competitors = [] } = useQuery({
    queryKey: ["competitors", selectedClient],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data, error } = await supabase.from("competitor_profiles").select("*").eq("agency_client_id", selectedClient).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      await supabase.from("competitor_profiles").insert({
        user_id: user.id,
        agency_client_id: selectedClient,
        nome,
        plataforma,
        username: username || null,
        followers: followers ? parseInt(followers) : null,
        engagement_rate: engagementRate ? parseFloat(engagementRate) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors", selectedClient] });
      toast.success("Concorrente adicionado!");
      setOpen(false);
      setNome("");
      setUsername("");
      setFollowers("");
      setEngagementRate("");
    },
    onError: (e) => toast.error(e.message),
  });

  const analyzeCompetitor = async (comp: any) => {
    setAnalyzing(comp.id);
    try {
      const client = clients.find((c: any) => c.id === selectedClient);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agency-strategy-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ action: "analyze_competitor", data: { competitor: comp, client_name: client?.nome, segmento: client?.segmento } }),
      });
      if (!resp.ok) throw new Error("Erro na análise");
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
      await supabase.from("competitor_profiles").update({
        ai_analysis: { analysis: result, analyzed_at: new Date().toISOString() },
        last_analyzed_at: new Date().toISOString(),
      }).eq("id", comp.id);
      queryClient.invalidateQueries({ queryKey: ["competitors", selectedClient] });
      toast.success("Análise concluída!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAnalyzing(null);
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
        {selectedClient && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Adicionar Concorrente</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Concorrente</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                <div><Label>Plataforma</Label>
                  <Select value={plataforma} onValueChange={setPlataforma}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["instagram", "tiktok", "youtube", "facebook", "linkedin"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@usuario" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Seguidores</Label><Input type="number" value={followers} onChange={(e) => setFollowers(e.target.value)} /></div>
                  <div><Label>Taxa Engajamento (%)</Label><Input type="number" step="0.01" value={engagementRate} onChange={(e) => setEngagementRate(e.target.value)} /></div>
                </div>
                <Button onClick={() => createMutation.mutate()} disabled={!nome || createMutation.isPending} className="w-full">Adicionar</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!selectedClient ? (
        <div className="text-center py-12 text-muted-foreground">Selecione um cliente para ver seus concorrentes</div>
      ) : competitors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum concorrente cadastrado ainda.</div>
      ) : (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Seguidores</TableHead>
                <TableHead>Engajamento</TableHead>
                <TableHead>Última Análise</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitors.map((comp: any) => (
                <TableRow key={comp.id}>
                  <TableCell className="font-medium">{comp.nome}</TableCell>
                  <TableCell><Badge variant="outline">{comp.plataforma}</Badge></TableCell>
                  <TableCell>{comp.username || "—"}</TableCell>
                  <TableCell>{comp.followers?.toLocaleString("pt-BR") || "—"}</TableCell>
                  <TableCell>{comp.engagement_rate ? `${comp.engagement_rate}%` : "—"}</TableCell>
                  <TableCell>{comp.last_analyzed_at ? new Date(comp.last_analyzed_at).toLocaleDateString("pt-BR") : "Nunca"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => analyzeCompetitor(comp)} disabled={analyzing === comp.id} className="gap-1">
                      {analyzing === comp.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      Analisar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {competitors.filter((c: any) => c.ai_analysis).map((comp: any) => (
            <Card key={comp.id}>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Target className="h-5 w-5" /> Análise: {comp.nome}</CardTitle></CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg max-h-[400px] overflow-auto">
                  {typeof comp.ai_analysis === "object" ? (comp.ai_analysis as any).analysis || JSON.stringify(comp.ai_analysis, null, 2) : String(comp.ai_analysis)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
