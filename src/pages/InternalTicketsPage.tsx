import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Ticket, Link2, Search, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InternalTicket {
  id: string;
  titulo: string;
  descricao: string | null;
  prospect_id: string | null;
  prioridade: string;
  status: string;
  responsavel_id: string | null;
  criado_por: string | null;
  created_at: string;
  prospects?: { nome_empresa: string } | null;
}

const prioridadeConfig: Record<string, { label: string; color: string; glow?: boolean }> = {
  baixa: { label: "Baixa", color: "bg-muted text-muted-foreground" },
  media: { label: "Média", color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  alta: { label: "Alta", color: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
  urgente: { label: "Urgente", color: "bg-red-500/10 text-red-700 border-red-500/20", glow: true },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  aberto: { label: "Aberto", color: "bg-blue-500" },
  em_andamento: { label: "Em Andamento", color: "bg-yellow-500" },
  concluido: { label: "Concluído", color: "bg-green-500" },
};

const InternalTicketsPage = () => {
  const [tickets, setTickets] = useState<InternalTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ titulo: "", descricao: "", prioridade: "media" });
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const kpis = {
    total: tickets.length,
    abertos: tickets.filter(t => t.status === "aberto").length,
    emAndamento: tickets.filter(t => t.status === "em_andamento").length,
    urgentes: tickets.filter(t => t.prioridade === "urgente" && t.status !== "concluido").length,
  };

  useEffect(() => {
    fetchTickets();

    const channel = supabase
      .channel("internal-tickets-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_tickets" }, () => fetchTickets())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchTickets = async () => {
    const { data } = await supabase
      .from("internal_tickets")
      .select("*, prospects(nome_empresa)")
      .order("created_at", { ascending: false });
    setTickets((data as unknown as InternalTicket[]) || []);
    setLoading(false);
  };

  const createTicket = async () => {
    if (!newTicket.titulo.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("internal_tickets").insert({
      titulo: newTicket.titulo.trim(),
      descricao: newTicket.descricao.trim() || null,
      prioridade: newTicket.prioridade,
      criado_por: user?.id,
    });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível criar o ticket", variant: "destructive" });
    } else {
      setDialogOpen(false);
      setNewTicket({ titulo: "", descricao: "", prioridade: "media" });
      toast({ title: "Ticket criado", description: "Demanda interna registrada com sucesso" });
    }
    setCreating(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("internal_tickets").update({ status }).eq("id", id);
    fetchTickets();
  };

  const filtered = (filterStatus === "todos" ? tickets : tickets.filter(t => t.status === filterStatus))
    .filter(t => !searchTerm.trim() || t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || t.descricao?.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Central de Demandas</h2>
            <p className="text-muted-foreground">{tickets.length} tickets registrados</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Ticket
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <p className="text-2xl font-bold mt-1">{kpis.total}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Abertos</span>
              </div>
              <p className="text-2xl font-bold mt-1">{kpis.abertos}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Em Andamento</span>
              </div>
              <p className="text-2xl font-bold mt-1">{kpis.emAndamento}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Urgentes</span>
              </div>
              <p className="text-2xl font-bold mt-1">{kpis.urgentes}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="aberto">Abertos</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluídos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {filtered.map((ticket) => {
            const prio = prioridadeConfig[ticket.prioridade] || prioridadeConfig.media;
            const stat = statusConfig[ticket.status] || statusConfig.aberto;

            return (
              <Card
                key={ticket.id}
                className={`transition-all ${
                  prio.glow ? "ring-2 ring-red-500/40 animate-pulse" : ""
                }`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Ticket className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{ticket.titulo}</p>
                        {ticket.descricao && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ticket.descricao}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className={prio.color}>{prio.label}</Badge>
                          <Badge className={`${stat.color} text-white text-[10px]`}>{stat.label}</Badge>
                          {ticket.prospects && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Link2 className="h-3 w-3" />
                              {ticket.prospects.nome_empresa}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Select value={ticket.status} onValueChange={(v) => updateStatus(ticket.id, v)}>
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aberto">Aberto</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="concluido">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhum ticket encontrado.</p>
          )}
        </div>
      </div>

      {/* Novo Ticket Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={newTicket.titulo}
                onChange={(e) => setNewTicket({ ...newTicket, titulo: e.target.value })}
                placeholder="Descreva a demanda..."
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={newTicket.descricao}
                onChange={(e) => setNewTicket({ ...newTicket, descricao: e.target.value })}
                placeholder="Detalhes adicionais..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={newTicket.prioridade} onValueChange={(v) => setNewTicket({ ...newTicket, prioridade: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createTicket} disabled={creating || !newTicket.titulo.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default InternalTicketsPage;
