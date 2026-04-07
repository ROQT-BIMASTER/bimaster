import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, FileText, Download } from "lucide-react";
import { toast } from "sonner";

export function AIBriefingGenerator() {
  const [selectedClient, setSelectedClient] = useState("");
  const [titulo, setTitulo] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [publico, setPublico] = useState("");
  const [budget, setBudget] = useState("");
  const [prazo, setPrazo] = useState("");
  const [referencias, setReferencias] = useState("");
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

  const { data: briefings = [] } = useQuery({
    queryKey: ["campaign-briefings", selectedClient],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data, error } = await supabase.from("campaign_briefings").select("*").eq("agency_client_id", selectedClient).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const generateBriefing = async () => {
    if (!selectedClient || !titulo || !objetivo) { toast.error("Preencha título e objetivo"); return; }
    setGenerating(true);
    try {
      const client = clients.find((c: any) => c.id === selectedClient);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agency-strategy-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          action: "generate_briefing",
          data: { client_name: client?.nome, segmento: client?.segmento, titulo, objetivo, publico, budget, prazo, referencias },
        }),
      });
      if (!resp.ok) throw new Error("Erro ao gerar briefing");
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
      await supabase.from("campaign_briefings").insert({
        user_id: user.id,
        agency_client_id: selectedClient,
        titulo,
        objetivo,
        publico: publico || null,
        budget: budget ? parseFloat(budget) : null,
        prazo: prazo || null,
        referencias: referencias || null,
        conteudo_gerado: result,
        status: "finalizado",
      });
      queryClient.invalidateQueries({ queryKey: ["campaign-briefings", selectedClient] });
      toast.success("Briefing gerado com sucesso!");
      setTitulo("");
      setObjetivo("");
      setPublico("");
      setBudget("");
      setPrazo("");
      setReferencias("");
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
        <div className="text-center py-12 text-muted-foreground">Selecione um cliente para gerar briefings</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Novo Briefing</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Título da Campanha *</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Lançamento Verão 2026" /></div>
              <div><Label>Objetivo *</Label><Textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="O que queremos alcançar?" /></div>
              <div><Label>Público-alvo</Label><Textarea value={publico} onChange={(e) => setPublico(e.target.value)} placeholder="Descreva o público" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Budget (R$)</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
                <div><Label>Prazo</Label><Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
              </div>
              <div><Label>Referências</Label><Textarea value={referencias} onChange={(e) => setReferencias(e.target.value)} placeholder="Links, marcas de referência, estilo visual..." /></div>
              <Button onClick={generateBriefing} disabled={generating || !titulo || !objetivo} className="w-full gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Gerando Briefing..." : "Gerar Briefing com IA"}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Histórico de Briefings</h3>
            {briefings.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum briefing gerado ainda.</p>
            ) : (
              briefings.map((b: any) => (
                <Card key={b.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> {b.titulo}</CardTitle>
                      <Badge variant={b.status === "finalizado" ? "default" : "secondary"}>{b.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString("pt-BR")}</p>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-3 rounded-lg max-h-[300px] overflow-auto">{b.conteudo_gerado || "Sem conteúdo"}</pre>
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
