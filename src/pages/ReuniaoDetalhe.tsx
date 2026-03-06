import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Brain, Mic, Clock, AlertTriangle, CheckCircle2,
  Lightbulb, ShieldAlert, Target, Loader2, FileText, ListTodo, Clipboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MeetingRecorder } from "@/components/meetings/MeetingRecorder";
import { MeetingMindMap } from "@/components/meetings/MeetingMindMap";

const riskColors: Record<string, string> = {
  low: "bg-green-100 text-green-700 border-green-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const insightIcons: Record<string, any> = {
  risco: AlertTriangle,
  oportunidade: Lightbulb,
  decisao: CheckCircle2,
  bloqueio: ShieldAlert,
  problema: AlertTriangle,
};

export default function ReuniaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [analyzing, setAnalyzing] = useState(false);
  const [manualTranscription, setManualTranscription] = useState("");

  const { data: meeting, isLoading } = useQuery({
    queryKey: ["meeting", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!session,
  });

  const { data: insights } = useQuery({
    queryKey: ["meeting-insights", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_insights").select("*").eq("meeting_id", id).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!session,
  });

  const { data: tasks } = useQuery({
    queryKey: ["meeting-tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_tasks").select("*").eq("meeting_id", id).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!session,
  });

  const { data: risks } = useQuery({
    queryKey: ["meeting-risks", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_risks").select("*").eq("meeting_id", id).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!session,
  });

  const handleAnalyze = async () => {
    const transcription = meeting?.transcription || manualTranscription.trim() || null;
    
    if (!transcription && !meeting?.audio_url) {
      toast.error("Grave o áudio ou cole a transcrição antes de analisar");
      return;
    }

    setAnalyzing(true);
    try {
      if (!transcription && meeting?.audio_url) {
        toast.info("Transcrevendo áudio com IA... isso pode levar alguns segundos");
      }

      const { data, error } = await supabase.functions.invoke("meeting-analyze", {
        body: { meetingId: id, transcription },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const msg = data.transcribed
        ? `Áudio transcrito e analisado! ${data.insights_count} insights, ${data.tasks_count} tarefas, ${data.risks_count} riscos`
        : `Análise concluída! ${data.insights_count} insights, ${data.tasks_count} tarefas, ${data.risks_count} riscos`;
      toast.success(msg);

      queryClient.invalidateQueries({ queryKey: ["meeting", id] });
      queryClient.invalidateQueries({ queryKey: ["meeting-insights", id] });
      queryClient.invalidateQueries({ queryKey: ["meeting-tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["meeting-risks", id] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao analisar reunião");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveTranscription = async () => {
    if (!manualTranscription.trim()) return;
    try {
      await supabase.from("meetings").update({
        transcription: manualTranscription.trim(),
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["meeting", id] });
      toast.success("Transcrição salva!");
    } catch {
      toast.error("Erro ao salvar transcrição");
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!meeting) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <p className="text-muted-foreground">Reunião não encontrada</p>
          <Button onClick={() => navigate("/dashboard/reunioes")} className="mt-4">Voltar</Button>
        </div>
      </DashboardLayout>
    );
  }

  const priorityColors: Record<string, string> = {
    low: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/reunioes")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{meeting.title}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(meeting.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              {meeting.duration_seconds && ` • ${Math.floor(meeting.duration_seconds / 60)}min`}
            </p>
          </div>
          <Button onClick={handleAnalyze} disabled={analyzing || meeting.status === "processing"} className="gap-2">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            Analisar com IA
          </Button>
        </div>

        {/* Recorder (if not analyzed) */}
        {meeting.status !== "analyzed" && (
          <MeetingRecorder
            meetingId={meeting.id}
            onRecordingComplete={(audioUrl: string, durationSeconds: number) => {
              queryClient.invalidateQueries({ queryKey: ["meeting", id] });
            }}
            onUploadComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["meeting", id] });
              toast.success("Áudio salvo! Agora clique em 'Analisar com IA' ou cole a transcrição.");
            }}
          />
        )}

        {/* Manual transcription input */}
        {!meeting.transcription && meeting.status !== "analyzed" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clipboard className="h-4 w-4" />
                Transcrição Manual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={manualTranscription}
                onChange={(e) => setManualTranscription(e.target.value)}
                placeholder="Cole aqui a transcrição da reunião ou grave o áudio acima..."
                rows={8}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSaveTranscription} disabled={!manualTranscription.trim()}>
                  Salvar Transcrição
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analysis results */}
        {meeting.status === "analyzed" && (
          <Tabs defaultValue="resumo" className="space-y-4">
            <TabsList>
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="mindmap">Mapa Mental</TabsTrigger>
              <TabsTrigger value="insights">Insights ({insights?.length || 0})</TabsTrigger>
              <TabsTrigger value="tarefas">Tarefas ({tasks?.length || 0})</TabsTrigger>
              <TabsTrigger value="riscos">Riscos ({risks?.length || 0})</TabsTrigger>
              <TabsTrigger value="transcricao">Transcrição</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo">
              <Card>
                <CardContent className="pt-6">
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {meeting.summary || "Nenhum resumo disponível."}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mindmap">
              <Card>
                <CardContent className="pt-6">
                  <MeetingMindMap mermaidCode={meeting.mermaid_mindmap} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights">
              <div className="space-y-3">
                {insights?.map((insight: any) => {
                  const Icon = insightIcons[insight.insight_type] || Lightbulb;
                  return (
                    <Card key={insight.id}>
                      <CardContent className="flex items-start gap-4 py-4">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm">{insight.title}</h4>
                            <Badge variant="outline" className="text-xs capitalize">{insight.insight_type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{insight.description}</p>
                          <div className="flex gap-2 mt-2">
                            {insight.department && <Badge variant="secondary" className="text-xs">{insight.department}</Badge>}
                            {insight.impact_level && <Badge variant="outline" className="text-xs">Impacto: {insight.impact_level}</Badge>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {!insights?.length && <p className="text-sm text-muted-foreground text-center py-8">Nenhum insight identificado</p>}
              </div>
            </TabsContent>

            <TabsContent value="tarefas">
              <div className="space-y-3">
                {tasks?.map((task: any) => (
                  <Card key={task.id}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <ListTodo className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{task.task}</p>
                        <div className="flex gap-2 mt-1.5">
                          {task.department && <Badge variant="secondary" className="text-xs">{task.department}</Badge>}
                          <Badge className={`text-xs ${priorityColors[task.priority] || ""}`}>{task.priority}</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{task.status}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {!tasks?.length && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa identificada</p>}
              </div>
            </TabsContent>

            <TabsContent value="riscos">
              <div className="space-y-3">
                {risks?.map((risk: any) => (
                  <Card key={risk.id} className="border-l-4" style={{ borderLeftColor: risk.risk_level === "critical" ? "#ef4444" : risk.risk_level === "high" ? "#f97316" : risk.risk_level === "medium" ? "#eab308" : "#22c55e" }}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm">{risk.title}</h4>
                            <Badge className={`text-xs ${riskColors[risk.risk_level] || ""}`}>
                              {risk.risk_level}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{risk.description}</p>
                          {risk.recommended_action && (
                            <div className="mt-2 p-2 rounded bg-muted text-xs">
                              <strong>Ação recomendada:</strong> {risk.recommended_action}
                            </div>
                          )}
                          <div className="flex gap-2 mt-2">
                            {risk.department && <Badge variant="secondary" className="text-xs">{risk.department}</Badge>}
                            <Badge variant="outline" className="text-xs capitalize">{risk.status}</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {!risks?.length && <p className="text-sm text-muted-foreground text-center py-8">Nenhum risco identificado</p>}
              </div>
            </TabsContent>

            <TabsContent value="transcricao">
              <Card>
                <CardContent className="pt-6">
                  <pre className="text-sm whitespace-pre-wrap text-foreground font-sans">
                    {meeting.transcription || "Nenhuma transcrição disponível."}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
