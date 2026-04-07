import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

const FUNNEL_STAGES = [
  { key: "awareness", label: "Topo — Awareness", color: "bg-blue-500/10 border-blue-500/30" },
  { key: "consideration", label: "Meio — Consideration", color: "bg-yellow-500/10 border-yellow-500/30" },
  { key: "decision", label: "Fundo — Decision", color: "bg-green-500/10 border-green-500/30" },
  { key: "retention", label: "Pós-venda — Retention", color: "bg-purple-500/10 border-purple-500/30" },
];

const FORMAT_COLORS: Record<string, string> = {
  post: "default", reel: "destructive", story: "secondary", blog: "outline", email: "default", video: "destructive",
};

export function ContentFunnelPlanner() {
  const [selectedClient, setSelectedClient] = useState("");
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [etapa, setEtapa] = useState("awareness");
  const [formato, setFormato] = useState("post");
  const [dataPrevista, setDataPrevista] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ["agency-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_clients").select("*").eq("status", "ativo").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["content-funnel", selectedClient],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data, error } = await supabase.from("content_funnel_items").select("*").eq("agency_client_id", selectedClient).order("data_prevista", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      await supabase.from("content_funnel_items").insert({
        user_id: user.id,
        agency_client_id: selectedClient,
        titulo,
        descricao: descricao || null,
        etapa_funil: etapa,
        formato,
        data_prevista: dataPrevista || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-funnel", selectedClient] });
      toast.success("Conteúdo adicionado!");
      setOpen(false);
      setTitulo("");
      setDescricao("");
    },
    onError: (e) => toast.error(e.message),
  });

  const suggestContent = async () => {
    if (!selectedClient) return;
    setSuggesting(true);
    try {
      const client = clients.find((c: any) => c.id === selectedClient);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agency-strategy-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ action: "suggest_content", data: { client_name: client?.nome, segmento: client?.segmento } }),
      });
      if (!resp.ok) throw new Error("Erro ao sugerir conteúdo");
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
      toast.success("Sugestões geradas! Veja no console para copiar as ideias.");
      console.log("Sugestões de conteúdo:", result);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSuggesting(false);
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
          <>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Novo Conteúdo</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Conteúdo</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Título *</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
                  <div><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Etapa do Funil</Label>
                      <Select value={etapa} onValueChange={setEtapa}><SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{FUNNEL_STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label.split(" — ")[0]}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Formato</Label>
                      <Select value={formato} onValueChange={setFormato}><SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["post", "reel", "story", "blog", "email", "video"].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Data Prevista</Label><Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} /></div>
                  <Button onClick={() => createMutation.mutate()} disabled={!titulo || createMutation.isPending} className="w-full">
                    {createMutation.isPending ? "Criando..." : "Adicionar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={suggestContent} disabled={suggesting} className="gap-2">
              {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Sugerir com IA
            </Button>
          </>
        )}
      </div>

      {!selectedClient ? (
        <div className="text-center py-12 text-muted-foreground">Selecione um cliente para ver o funil de conteúdo</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FUNNEL_STAGES.map((stage) => {
            const stageItems = items.filter((i: any) => i.etapa_funil === stage.key);
            return (
              <div key={stage.key} className={`rounded-lg border p-4 ${stage.color} space-y-3`}>
                <h3 className="font-semibold text-sm">{stage.label} <Badge variant="outline" className="ml-2">{stageItems.length}</Badge></h3>
                {stageItems.map((item: any) => (
                  <Card key={item.id} className="bg-background">
                    <CardContent className="p-3 space-y-2">
                      <p className="font-medium text-sm">{item.titulo}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={(FORMAT_COLORS[item.formato] as any) || "default"} className="text-xs">{item.formato}</Badge>
                        <Badge variant="outline" className="text-xs">{item.status}</Badge>
                      </div>
                      {item.data_prevista && <p className="text-xs text-muted-foreground">{new Date(item.data_prevista).toLocaleDateString("pt-BR")}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
