import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Brain, Clock, AlertTriangle, CheckCircle2,
  Lightbulb, ShieldAlert, Loader2, ListTodo, Clipboard, ScrollText, Search as SearchIcon, Radio, Download, Mic, Sparkles
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
import { chunkAudioFromUrl } from "@/lib/utils/audio-chunker";
import { resolveStorageUrl } from "@/lib/utils/storage-url";

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
  const timelineSeekRef = useRef<((s: number) => void) | null>(null);

  // Realtime progress from DB — works even if user navigates away and comes back
  const [liveProgress, setLiveProgress] = useState<{ progress: number; detail: string; status: string }>({ progress: 0, detail: "", status: "" });

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
    const existingTranscription = meeting?.transcription || manualTranscription.trim() || null;
    if (!existingTranscription && !meeting?.audio_url) {
      toast.error("Grave o áudio, envie um vídeo ou cole a transcrição antes de analisar");
      return;
    }
    setAnalyzing(true);
    try {
      let transcription = existingTranscription;

      // STEP 1: Transcribe if needed — chunked client-side to avoid memory limits
      if (!transcription && meeting?.audio_url) {
        // Update DB progress so realtime picks it up
        await supabase.from("meetings").update({ status: "transcribing", progress: 2, progress_detail: "Baixando e dividindo áudio..." } as any).eq("id", id);

        const { signedUrl, error: urlError } = await resolveStorageUrl(meeting.audio_url);
        if (urlError || !signedUrl) throw new Error(urlError || "Não foi possível acessar o áudio");

        const chunks = await chunkAudioFromUrl(signedUrl);
        await supabase.from("meetings").update({ progress: 5, progress_detail: `0/${chunks.length} trechos` } as any).eq("id", id);

        // Process chunks in parallel batches of 3 for speed
        const BATCH_SIZE = 3;
        const MAX_RETRIES = 3;
        const partialTranscriptions: (string | null)[] = new Array(chunks.length).fill(null);
        let completedChunks = 0;
        let failedChunks = 0;

        for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
          const batch = chunks.slice(batchStart, batchStart + BATCH_SIZE);
          // Progress: transcription is 5-85% of total
          const transcribePct = 5 + Math.round((completedChunks / chunks.length) * 80);
          setAnalyzeProgress({
            step: "Transcrevendo",
            percent: transcribePct,
            detail: `${completedChunks}/${chunks.length} trechos concluídos`,
          });

          const batchResults = await Promise.allSettled(
            batch.map(async (chunk) => {
              let lastError: any = null;
              for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                if (attempt > 0) {
                  await new Promise(r => setTimeout(r, 3000 * attempt)); // 3s, 6s, 9s backoff
                }
                try {
                  const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke("meeting-transcribe", {
                    body: {
                      meetingId: id,
                      audioBase64: chunk.base64,
                      mimeType: chunk.mimeType,
                      chunkIndex: chunk.chunkIndex,
                      totalChunks: chunk.totalChunks,
                    },
                  });
                  if (transcribeError) { lastError = transcribeError; continue; }
                  if (transcribeData?.error) { lastError = new Error(transcribeData.error); continue; }
                  return { index: chunk.chunkIndex, text: transcribeData.transcription };
                } catch (err) {
                  lastError = err;
                  console.warn(`[chunk ${chunk.chunkIndex}] attempt ${attempt + 1} failed:`, err);
                }
              }
              // All retries exhausted — return placeholder instead of aborting
              console.error(`[chunk ${chunk.chunkIndex}] all retries failed:`, lastError);
              return { index: chunk.chunkIndex, text: null };
            })
          );

          for (const result of batchResults) {
            if (result.status === "fulfilled" && result.value.text) {
              partialTranscriptions[result.value.index] = result.value.text;
              completedChunks++;
            } else if (result.status === "fulfilled" && !result.value.text) {
              partialTranscriptions[result.value.index] = "[... trecho inaudível ...]";
              failedChunks++;
              completedChunks++;
            } else {
              failedChunks++;
              completedChunks++;
            }
          }

          // Small delay between batches to avoid rate limiting
          if (batchStart + BATCH_SIZE < chunks.length) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }


        setAnalyzeProgress({ step: "Transcrevendo", percent: 85, detail: `${chunks.length}/${chunks.length} trechos concluídos` });

        if (failedChunks > 0) {
          toast.warning(`⚠️ ${failedChunks} trecho(s) não puderam ser transcritos`);
        }

        // If ALL chunks failed, abort
        const successfulChunks = partialTranscriptions.filter(t => t && t !== "[... trecho inaudível ...]");
        if (successfulChunks.length === 0) {
          throw new Error("Não foi possível transcrever nenhum trecho do áudio");
        }

        transcription = partialTranscriptions.filter(Boolean).join("\n\n");

        // Save the full transcription
        await supabase.from("meetings").update({
          transcription,
          status: "transcribed",
          updated_at: new Date().toISOString(),
        }).eq("id", id);

        setAnalyzeProgress({ step: "Salvando transcrição", percent: 88, detail: "" });
        queryClient.invalidateQueries({ queryKey: ["meeting", id] });
      }

      // STEP 2: Analyze transcription (text only — lightweight)
      setAnalyzeProgress({ step: "Analisando com IA", percent: 90, detail: "Extraindo insights, tarefas e riscos..." });
      const { data, error } = await supabase.functions.invoke("meeting-analyze", {
        body: { meetingId: id, transcription },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalyzeProgress({ step: "Concluído!", percent: 100, detail: `${data.insights_count} insights, ${data.tasks_count} tarefas, ${data.risks_count} riscos` });
      toast.success(`Análise concluída! ${data.insights_count} insights, ${data.tasks_count} tarefas, ${data.risks_count} riscos`);
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
          <Button onClick={handleAnalyze} disabled={analyzing} className="gap-2">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            Analisar com IA
          </Button>
        </div>

        {/* Progress bar during analysis */}
        {analyzing && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-center gap-3">
                {analyzeProgress.percent < 100 ? (
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {analyzeProgress.step === "Transcrevendo" ? (
                      <Mic className="h-4 w-4 text-primary animate-pulse" />
                    ) : analyzeProgress.step === "Analisando com IA" ? (
                      <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    ) : (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    )}
                  </div>
                ) : (
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{analyzeProgress.step}</p>
                    <span className="text-xs font-mono text-muted-foreground">{analyzeProgress.percent}%</span>
                  </div>
                  <Progress value={analyzeProgress.percent} className="h-2" />
                  {analyzeProgress.detail && (
                    <p className="text-xs text-muted-foreground mt-1.5">{analyzeProgress.detail}</p>
                  )}
                </div>
              </div>
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
                <audio controls src={meeting.audio_url} className="h-8 max-w-[300px]" preload="metadata" />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = meeting.audio_url;
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
                  audioUrl={meeting.audio_url}
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
              <MeetingTranscription transcription={meeting.transcription} audioUrl={meeting.audio_url} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
