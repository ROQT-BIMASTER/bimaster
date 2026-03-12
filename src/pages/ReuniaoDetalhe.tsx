import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Brain, Clock, AlertTriangle, CheckCircle2,
  Lightbulb, ShieldAlert, Loader2, ListTodo, Clipboard, ScrollText, Search as SearchIcon, Radio, Download, Mic, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MeetingRecorder } from "@/components/meetings/MeetingRecorder";
import { MeetingMindMap } from "@/components/meetings/MeetingMindMap";
import { MeetingAta } from "@/components/meetings/MeetingAta";
import { MeetingTranscription } from "@/components/meetings/MeetingTranscription";
import { MeetingTimeline, type Highlight } from "@/components/meetings/MeetingTimeline";
import { MeetingSearch } from "@/components/meetings/MeetingSearch";
import { MeetingPrintReport } from "@/components/meetings/MeetingPrintReport";
import { MeetingAnalysisProgress } from "@/components/meetings/MeetingAnalysisProgress";
// audio-chunker no longer used — audio is fetched server-side
import { resolveStorageUrl, parseBucketAndPath } from "@/lib/utils/storage-url";

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
  const [searchResults, setSearchResults] = useState<{ timestamp_seconds: number; text: string }[]>([]);
  const [extractingPhase2, setExtractingPhase2] = useState(false);
  const timelineSeekRef = useRef<((s: number) => void) | null>(null);
  const autoRecoveryTriggeredRef = useRef(false);

  // Realtime progress from DB — works even if user navigates away and comes back
  const [liveProgress, setLiveProgress] = useState<{ progress: number; detail: string; status: string }>({ progress: 0, detail: "", status: "" });

  const triggerPhase2 = useCallback(async (meetingId: string) => {
    try {
      console.log("[ReuniaoDetalhe] Triggering Phase 2 for meeting:", meetingId);
      const { data, error } = await supabase.functions.invoke("meeting-analyze-phase2", {
        body: { meetingId },
      });
      if (error) {
        console.error("[ReuniaoDetalhe] Phase 2 error:", error);
        toast.error("Erro na extração de insights. Resultados parciais disponíveis.");
      }
      if (data?.partial) {
        toast.info("Análise parcial: ata e mapa mental OK, mas extração de insights incompleta.");
      }
    } catch (err: any) {
      console.error("[ReuniaoDetalhe] Phase 2 exception:", err);
      toast.error("Erro ao extrair insights da reunião.");
    }
  }, []);

  const handleRetryPhase2 = useCallback(async () => {
    if (!id) return;
    setExtractingPhase2(true);
    try {
      const { data, error } = await supabase.functions.invoke("meeting-analyze-phase2", {
        body: { meetingId: id },
      });
      if (error) {
        console.error("[ReuniaoDetalhe] Phase 2 retry error:", error);
        toast.error("Erro ao extrair insights. Tente novamente.");
      } else if (data?.partial) {
        toast.info("Extração parcial concluída.");
      } else {
        toast.success("Insights, tarefas e riscos extraídos com sucesso!");
      }
      queryClient.invalidateQueries({ queryKey: ["meeting-insights", id] });
      queryClient.invalidateQueries({ queryKey: ["meeting-tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["meeting-risks", id] });
      queryClient.invalidateQueries({ queryKey: ["meeting", id] });
    } catch (err: any) {
      console.error("[ReuniaoDetalhe] Phase 2 retry exception:", err);
      toast.error("Erro ao extrair insights.");
    } finally {
      setExtractingPhase2(false);
    }
  }, [id, queryClient]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`meeting-progress-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "meetings", filter: `id=eq.${id}` },
        (payload) => {
          const row = payload.new as any;
          setLiveProgress({
            progress: row.progress || 0,
            detail: row.progress_detail || "",
            status: row.status || "",
          });
          // Auto-refresh queries when analysis completes
          if (row.status === "analyzed") {
            setAnalyzing(false);
            toast.success("✅ Análise concluída!");
            queryClient.invalidateQueries({ queryKey: ["meeting", id] });
            queryClient.invalidateQueries({ queryKey: ["meeting-insights", id] });
            queryClient.invalidateQueries({ queryKey: ["meeting-tasks", id] });
            queryClient.invalidateQueries({ queryKey: ["meeting-risks", id] });
          }
          // Auto-trigger Phase 2 when Phase 1 completes
          if (row.status === "phase1_complete") {
            queryClient.invalidateQueries({ queryKey: ["meeting", id] });
            triggerPhase2(id);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  const { data: meeting, isLoading } = useQuery({
    queryKey: ["meeting", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!session,
  });

  // Recovery: reset meetings stuck in "recording" without audio
  useEffect(() => {
    if (!meeting || meeting.status !== "recording" || meeting.audio_url) return;
    const updatedAt = new Date(meeting.updated_at).getTime();
    const stuckMs = Date.now() - updatedAt;
    if (stuckMs > 60_000) {
      console.warn(`[ReuniaoDetalhe] Meeting ${id} stuck in recording for ${Math.round(stuckMs / 60000)}min — resetting to draft`);
      supabase.from("meetings").update({ status: "draft" }).eq("id", id!).then(() => {
        queryClient.invalidateQueries({ queryKey: ["meeting", id] });
        toast.info("A gravação anterior foi interrompida. Você pode gravar novamente ou enviar um arquivo.");
      });
    }
  }, [meeting, id, queryClient]);

  // Auto-recovery: only mark as partial if processing itself got stuck for too long
  useEffect(() => {
    if (!meeting || meeting.status !== "processing") return;
    const updatedAt = new Date(meeting.updated_at).getTime();
    const stuckMs = Date.now() - updatedAt;
    const TEN_MINUTES = 10 * 60 * 1000;

    if (stuckMs > TEN_MINUTES) {
      console.warn(`[ReuniaoDetalhe] Meeting ${id} stuck in ${meeting.status} for ${Math.round(stuckMs / 60000)}min — auto-recovering`);
      supabase.from("meetings").update({
        status: "analyzed",
        progress: 100,
        progress_detail: "Análise parcial (recuperação automática — alguns dados podem estar incompletos)",
      }).eq("id", id!).then(() => {
        queryClient.invalidateQueries({ queryKey: ["meeting", id] });
        toast.info("Reunião recuperada automaticamente. Alguns dados da análise podem estar incompletos.");
      });
    }
  }, [meeting, id, queryClient]);

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

  useEffect(() => {
    if (!meeting || !id || extractingPhase2 || autoRecoveryTriggeredRef.current) return;

    const hasPhase1Data = Boolean(meeting.summary || meeting.ata || meeting.mermaid_mindmap);
    const hasPhase2Data = Boolean(insights?.length || tasks?.length || risks?.length);
    const hasTranscription = Boolean(meeting.transcription);
    const updatedAt = new Date(meeting.updated_at).getTime();
    const stuckMs = Date.now() - updatedAt;
    const TEN_MINUTES = 10 * 60 * 1000;

    const shouldRetryStuckPhase2 = meeting.status === "phase1_complete" && hasTranscription && !hasPhase2Data && stuckMs > TEN_MINUTES;
    const shouldRecoverBrokenCompleted = meeting.status === "analyzed" && hasTranscription && hasPhase1Data && !hasPhase2Data;

    if (!shouldRetryStuckPhase2 && !shouldRecoverBrokenCompleted) return;

    autoRecoveryTriggeredRef.current = true;
    toast.info("Recuperando automaticamente a extração de insights da reunião...");
    void handleRetryPhase2();
  }, [meeting, id, insights?.length, tasks?.length, risks?.length, extractingPhase2, handleRetryPhase2]);

  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(null);

  // Resolve storage path to a signed URL for media playback
  useEffect(() => {
    if (!meeting?.audio_url) { setResolvedAudioUrl(null); return; }
    let cancelled = false;
    resolveStorageUrl(meeting.audio_url).then(({ signedUrl }) => {
      if (!cancelled) setResolvedAudioUrl(signedUrl || null);
    });
    return () => { cancelled = true; };
  }, [meeting?.audio_url]);

  // When user returns to a page with an in-progress analysis, sync local state from DB
  useEffect(() => {
    if (meeting) {
      const m = meeting as any;
      if (m.status === "transcribing" || m.status === "processing") {
        setAnalyzing(true);
        setLiveProgress({ progress: m.progress || 0, detail: m.progress_detail || "", status: m.status });
      }
    }
  }, [meeting]);

  const handleAnalyze = async () => {
    const existingTranscription = meeting?.transcription || manualTranscription.trim() || null;
    if (!existingTranscription && !meeting?.audio_url) {
      toast.error("Grave o áudio, envie um vídeo ou cole a transcrição antes de analisar");
      return;
    }
    setAnalyzing(true);
    try {
      let transcription = existingTranscription;

      // STEP 1: Transcribe if needed — server-side via ElevenLabs Scribe v2
      if (!transcription && meeting?.audio_url) {
        await supabase.from("meetings").update({ status: "transcribing", progress: 2, progress_detail: "⟳ Iniciando transcrição com IA..." } as any).eq("id", id);

        // Extract storage path for server-side signed URL (faster)
        const parsed = parseBucketAndPath(meeting.audio_url);
        const storagePath = parsed?.path || null;

        // Also resolve a client-side signed URL as fallback
        const { signedUrl } = await resolveStorageUrl(meeting.audio_url);

        const MAX_RETRIES = 2;
        let transcribeResult: string | null = null;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          if (attempt > 0) await new Promise(r => setTimeout(r, 5000));
          try {
            const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke("meeting-transcribe", {
              body: {
                meetingId: id,
                ...(storagePath ? { storagePath } : { audioUrl: signedUrl }),
              },
            });
            if (transcribeError) {
              console.warn(`[transcribe] attempt ${attempt + 1} failed:`, transcribeError);
              continue;
            }
            if (transcribeData?.error) {
              console.warn(`[transcribe] attempt ${attempt + 1} error:`, transcribeData.error);
              continue;
            }
            transcribeResult = transcribeData.transcription;
            break;
          } catch (err) {
            console.warn(`[transcribe] attempt ${attempt + 1} exception:`, err);
          }
        }

        if (!transcribeResult) {
          throw new Error("Não foi possível transcrever o áudio após múltiplas tentativas");
        }

        transcription = transcribeResult;
        queryClient.invalidateQueries({ queryKey: ["meeting", id] });
      }

      // STEP 2: Phase 1 analysis (ata, summary, mindmap)
      // Phase 2 (insights/tasks/risks) is automatically triggered when Phase 1 completes via realtime
      const { data, error } = await supabase.functions.invoke("meeting-analyze", {
        body: { meetingId: id, transcription, duration_seconds: meeting?.duration_seconds || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Phase 1 complete — Phase 2 will be triggered by realtime subscription detecting "phase1_complete" status
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

  const handleSeekTo = useCallback((seconds: number) => {
    // Try to find and control the audio/video element
    const media = document.querySelector("audio, video") as HTMLMediaElement | null;
    if (media) {
      media.currentTime = seconds;
      media.play().catch(() => {});
    }
  }, []);

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

  const participants = meeting.participants ? (typeof meeting.participants === "string" ? JSON.parse(meeting.participants) : meeting.participants) : null;
  const highlights: Highlight[] = meeting.highlights ? (typeof meeting.highlights === "string" ? JSON.parse(meeting.highlights) : meeting.highlights) : [];

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
          <div className="flex items-center gap-2">
            {meeting.status === "analyzed" && insights && tasks && risks && (
              <MeetingPrintReport
                meeting={meeting}
                insights={insights || []}
                tasks={tasks || []}
                risks={risks || []}
              />
            )}
            <Button onClick={handleAnalyze} disabled={analyzing} className="gap-2">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              Analisar com IA
            </Button>
          </div>
        </div>

        {/* Progress — shows during analysis OR when meeting is in-progress (realtime from DB) */}
        {(analyzing || meeting.status === "transcribing" || meeting.status === "processing") && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-5 pb-4">
              <MeetingAnalysisProgress
                progress={liveProgress.progress}
                detail={liveProgress.detail}
                status={liveProgress.status}
                durationSeconds={meeting?.duration_seconds}
              />
            </CardContent>
          </Card>
        )}

        {/* Recorder (if not analyzed) */}
        {meeting.status !== "analyzed" && (
          <MeetingRecorder
            meetingId={meeting.id}
            onRecordingComplete={() => queryClient.invalidateQueries({ queryKey: ["meeting", id] })}
            onUploadComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["meeting", id] });
              toast.success("Mídia salva! Agora clique em 'Analisar com IA'.");
            }}
          />
        )}

        {/* Download audio button */}
        {meeting.audio_url && (
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Radio className="h-4 w-4" />
                <span>Gravação disponível ({meeting.duration_seconds ? `${Math.floor(meeting.duration_seconds / 60)}min ${meeting.duration_seconds % 60}s` : 'áudio'})</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = resolvedAudioUrl || meeting.audio_url;
                    link.download = `${meeting.title || 'gravacao'}.webm`;
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  <Download className="h-4 w-4" />
                  Baixar Gravação
                </Button>
              </div>
            </CardContent>
          </Card>
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
                placeholder="Cole aqui a transcrição da reunião..."
                rows={8}
              />
              <Button variant="outline" onClick={handleSaveTranscription} disabled={!manualTranscription.trim()}>
                Salvar Transcrição
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Analysis results */}
        {meeting.status === "analyzed" && (
          <Tabs defaultValue="gravacao" className="space-y-4">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="gravacao" className="gap-1">
                <Radio className="h-3.5 w-3.5" />
                Gravação
              </TabsTrigger>
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="ata" className="gap-1">
                <ScrollText className="h-3.5 w-3.5" />
                Ata
              </TabsTrigger>
              <TabsTrigger value="mindmap">Mapa Mental</TabsTrigger>
              <TabsTrigger value="insights">Insights ({insights?.length || 0})</TabsTrigger>
              <TabsTrigger value="tarefas">Tarefas ({tasks?.length || 0})</TabsTrigger>
              <TabsTrigger value="riscos">Riscos ({risks?.length || 0})</TabsTrigger>
              <TabsTrigger value="transcricao">Transcrição</TabsTrigger>
            </TabsList>

            {/* Recording + Timeline + AI Search tab */}
            <TabsContent value="gravacao">
              <div className="space-y-4">
                {/* AI Search */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <SearchIcon className="h-4 w-4" />
                      Buscar na Reunião com IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MeetingSearch
                      meetingId={meeting.id}
                      onSeekTo={handleSeekTo}
                      onSearchResults={setSearchResults}
                    />
                  </CardContent>
                </Card>

                {/* Timeline with highlights */}
                <MeetingTimeline
                  audioUrl={resolvedAudioUrl}
                  durationSeconds={meeting.duration_seconds || 0}
                  highlights={highlights}
                  searchResults={searchResults}
                />
              </div>
            </TabsContent>

            <TabsContent value="resumo">
              <Card>
                <CardContent className="pt-6">
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {meeting.summary || "Nenhum resumo disponível."}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ata">
              <MeetingAta ata={meeting.ata} participants={participants as any} />
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
                {!insights?.length && !extractingPhase2 && meeting.transcription && (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
                      <Sparkles className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground text-center">Insights não foram extraídos. Clique para processar.</p>
                      <Button size="sm" className="gap-2" onClick={handleRetryPhase2}>
                        <Brain className="h-4 w-4" />
                        Extrair Insights, Tarefas e Riscos
                      </Button>
                    </CardContent>
                  </Card>
                )}
                {extractingPhase2 && (
                  <Card>
                    <CardContent className="flex items-center justify-center gap-3 py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Extraindo insights, tarefas e riscos...</span>
                    </CardContent>
                  </Card>
                )}
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
                {!tasks?.length && !extractingPhase2 && meeting.transcription && (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
                      <p className="text-sm text-muted-foreground">Nenhuma tarefa extraída.</p>
                      <Button size="sm" variant="outline" className="gap-2" onClick={handleRetryPhase2}>
                        <Brain className="h-4 w-4" />
                        Extrair com IA
                      </Button>
                    </CardContent>
                  </Card>
                )}
                {!tasks?.length && !meeting.transcription && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa identificada</p>}
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
                {!risks?.length && !extractingPhase2 && meeting.transcription && (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
                      <p className="text-sm text-muted-foreground">Nenhum risco extraído.</p>
                      <Button size="sm" variant="outline" className="gap-2" onClick={handleRetryPhase2}>
                        <Brain className="h-4 w-4" />
                        Extrair com IA
                      </Button>
                    </CardContent>
                  </Card>
                )}
                {!risks?.length && !meeting.transcription && <p className="text-sm text-muted-foreground text-center py-8">Nenhum risco identificado</p>}
              </div>
            </TabsContent>

            <TabsContent value="transcricao">
              <MeetingTranscription transcription={meeting.transcription} audioUrl={resolvedAudioUrl} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
