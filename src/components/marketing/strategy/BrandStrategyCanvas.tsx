import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, User, BarChart3, Volume2, Crosshair } from "lucide-react";
import { toast } from "sonner";

const STRATEGY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agency-strategy-ai`;

async function callStrategyAI(action: string, data: any): Promise<string> {
  const resp = await fetch(STRATEGY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ action, data }),
  });
  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Rate limit excedido. Tente novamente em instantes.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados.");
    throw new Error("Erro ao gerar conteúdo com IA");
  }
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
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) result += content;
      } catch {}
    }
  }
  return result;
}

export function BrandStrategyCanvas() {
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ["agency-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_clients").select("*").eq("status", "ativo").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: strategies = [] } = useQuery({
    queryKey: ["brand-strategies", selectedClient],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data, error } = await supabase.from("brand_strategies").select("*").eq("agency_client_id", selectedClient).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const client = clients.find((c: any) => c.id === selectedClient);

  const generate = async (tipo: string, action: string) => {
    if (!selectedClient) { toast.error("Selecione um cliente primeiro"); return; }
    setGenerating(tipo);
    try {
      const result = await callStrategyAI(action, { client_name: client?.nome, segmento: client?.segmento, context });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      await supabase.from("brand_strategies").insert({
        user_id: user.id,
        agency_client_id: selectedClient,
        tipo,
        titulo: `${tipo} - ${client?.nome}`,
        content: { generated: result, generated_at: new Date().toISOString() },
      });
      queryClient.invalidateQueries({ queryKey: ["brand-strategies", selectedClient] });
      toast.success(`${tipo} gerado com sucesso!`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(null);
    }
  };

  const getStrategiesByType = (tipo: string) => strategies.filter((s: any) => s.tipo === tipo);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-[300px]"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
          <SelectContent>
            {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="Contexto adicional para a IA (opcional)..." className="flex-1 h-10 min-h-[40px]" />
      </div>

      {!selectedClient ? (
        <div className="text-center py-12 text-muted-foreground">Selecione um cliente para começar o canvas estratégico</div>
      ) : (
        <Tabs defaultValue="persona">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="persona" className="gap-2"><User className="h-4 w-4" /> Persona</TabsTrigger>
            <TabsTrigger value="swot" className="gap-2"><BarChart3 className="h-4 w-4" /> SWOT</TabsTrigger>
            <TabsTrigger value="voice" className="gap-2"><Volume2 className="h-4 w-4" /> Tom de Voz</TabsTrigger>
            <TabsTrigger value="positioning" className="gap-2"><Crosshair className="h-4 w-4" /> Posicionamento</TabsTrigger>
          </TabsList>

          {[
            { key: "persona", action: "generate_persona", label: "Persona" },
            { key: "swot", action: "generate_swot", label: "Análise SWOT" },
            { key: "voice", action: "generate_voice", label: "Tom de Voz" },
            { key: "positioning", action: "generate_swot", label: "Posicionamento" },
          ].map(({ key, action, label }) => (
            <TabsContent key={key} value={key} className="space-y-4">
              <Button onClick={() => generate(key, action)} disabled={generating === key} className="gap-2">
                {generating === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating === key ? "Gerando..." : `Gerar ${label} com IA`}
              </Button>

              {getStrategiesByType(key).length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma {label.toLowerCase()} gerada ainda. Clique no botão acima para começar.</p>
              ) : (
                getStrategiesByType(key).map((s: any) => (
                  <Card key={s.id}>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2">{s.titulo} <Badge variant="outline" className="text-xs">{new Date(s.created_at).toLocaleDateString("pt-BR")}</Badge></CardTitle></CardHeader>
                    <CardContent>
                      <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg overflow-auto max-h-[500px]">
                        {typeof s.content === "object" ? (s.content as any).generated || JSON.stringify(s.content, null, 2) : String(s.content)}
                      </pre>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
