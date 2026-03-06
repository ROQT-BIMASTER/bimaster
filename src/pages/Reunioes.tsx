import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mic, Plus, Clock, Brain, AlertTriangle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MeetingRecorder } from "@/components/meetings/MeetingRecorder";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  draft: { label: "Rascunho", variant: "secondary", icon: FileText },
  recording: { label: "Gravando", variant: "destructive", icon: Mic },
  processing: { label: "Processando", variant: "outline", icon: Loader2 },
  analyzed: { label: "Analisado", variant: "default", icon: Brain },
  error: { label: "Erro", variant: "destructive", icon: AlertTriangle },
};

export default function Reunioes() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: meetings, isLoading, refetch } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*, meeting_risks(count), meeting_tasks(count), meeting_insights(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!session,
  });

  const handleCreate = async () => {
    if (!newTitle.trim()) { toast.error("Informe o título da reunião"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.from("meetings").insert({
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        created_by: session!.user.id,
      }).select().single();
      if (error) throw error;
      toast.success("Reunião criada!");
      setShowNew(false);
      setNewTitle("");
      setNewDescription("");
      navigate(`/dashboard/reunioes/${data.id}`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar reunião");
    } finally {
      setCreating(false);
    }
  };

  const stats = {
    total: meetings?.length || 0,
    analyzed: meetings?.filter((m: any) => m.status === "analyzed").length || 0,
    risks: meetings?.reduce((acc: number, m: any) => acc + (m.meeting_risks?.[0]?.count || 0), 0) || 0,
    tasks: meetings?.reduce((acc: number, m: any) => acc + (m.meeting_tasks?.[0]?.count || 0), 0) || 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reuniões</h1>
            <p className="text-muted-foreground text-sm">Grave, transcreva e analise reuniões com inteligência artificial</p>
          </div>
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Reunião
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Reunião</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Alinhamento semanal de vendas" />
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Pauta da reunião..." rows={3} />
                </div>
                <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                  Criar e Gravar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mic className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Reuniões</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.analyzed}</p>
                  <p className="text-xs text-muted-foreground">Analisadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.risks}</p>
                  <p className="text-xs text-muted-foreground">Riscos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.tasks}</p>
                  <p className="text-xs text-muted-foreground">Tarefas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !meetings?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Mic className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">Nenhuma reunião registrada</h3>
              <p className="text-sm text-muted-foreground mb-4">Crie sua primeira reunião para começar a gravar e analisar com IA</p>
              <Button onClick={() => setShowNew(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Nova Reunião
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {meetings.map((meeting: any) => {
              const sc = statusConfig[meeting.status] || statusConfig.draft;
              const StatusIcon = sc.icon;
              return (
                <Card
                  key={meeting.id}
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => navigate(`/dashboard/reunioes/${meeting.id}`)}
                >
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Mic className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{meeting.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(meeting.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                        {meeting.duration_seconds && (
                          <span className="text-xs text-muted-foreground">
                            {Math.floor(meeting.duration_seconds / 60)}min
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(meeting.meeting_risks?.[0]?.count || 0) > 0 && (
                        <Badge variant="outline" className="text-orange-600 border-orange-200 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {meeting.meeting_risks[0].count}
                        </Badge>
                      )}
                      {(meeting.meeting_tasks?.[0]?.count || 0) > 0 && (
                        <Badge variant="outline" className="text-blue-600 border-blue-200 text-xs">
                          {meeting.meeting_tasks[0].count} tarefas
                        </Badge>
                      )}
                      <Badge variant={sc.variant} className="text-xs gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {sc.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
