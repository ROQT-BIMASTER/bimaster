import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Users, DollarSign, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export function AgencyClientsHub() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [segmento, setSegmento] = useState("");
  const [budget, setBudget] = useState("");
  const [status, setStatus] = useState("ativo");
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["agency-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agency_clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("agency_clients").insert({
        user_id: user.id,
        nome,
        segmento: segmento || null,
        budget_mensal: budget ? parseFloat(budget) : null,
        status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-clients"] });
      toast.success("Cliente criado com sucesso!");
      setOpen(false);
      setNome("");
      setSegmento("");
      setBudget("");
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = clients.filter((c: any) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    (c.segmento || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar clientes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" /></div>
              <div><Label>Segmento</Label><Input value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Ex: Moda, Tech, Alimentação" /></div>
              <div><Label>Budget Mensal (R$)</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0.00" /></div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!nome || createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Criando..." : "Criar Cliente"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando clientes...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum cliente encontrado. Crie o primeiro!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client: any) => (
            <Card key={client.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: client.cor || "#6366f1" }}>
                      {client.nome.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{client.nome}</CardTitle>
                      {client.segmento && <p className="text-sm text-muted-foreground">{client.segmento}</p>}
                    </div>
                  </div>
                  <Badge variant={client.status === "ativo" ? "default" : "secondary"}>{client.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span>Budget: {client.budget_mensal ? `R$ ${Number(client.budget_mensal).toLocaleString("pt-BR")}` : "Não definido"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Desde {format(new Date(client.created_at), "dd/MM/yyyy")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
