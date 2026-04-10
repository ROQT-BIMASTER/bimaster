import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getAuthHeaders } from "@/lib/utils/auth-headers";
import {
  Loader2, Video, Upload, FileText, Play, Download, X, Sparkles, Image as ImageIcon, Trash2
} from "lucide-react";

interface VideoModel {
  id: string;
  name: string;
  description: string;
  supportsImage: boolean;
}

const VIDEO_MODELS: VideoModel[] = [
  { id: "google-veo-3", name: "Google Veo 3", description: "Modelo mais avançado, com áudio nativo", supportsImage: false },
  { id: "kling-2.0", name: "Kling 2.0 Master", description: "Alta fidelidade, image-to-video", supportsImage: true },
  { id: "minimax-text", name: "MiniMax (Hailuo)", description: "Text-to-video rápido", supportsImage: false },
  { id: "minimax-image", name: "MiniMax I2V", description: "Image-to-video com MiniMax", supportsImage: true },
  { id: "luma", name: "Luma Dream Machine", description: "Transformações criativas", supportsImage: true },
];

interface GeneratedVideo {
  id: string;
  prompt: string | null;
  model_used: string;
  input_type: string;
  video_url: string | null;
  status: string;
  created_at: string;
  aspect_ratio: string | null;
}

export const AdvancedVideoGenerator = () => {
  const [inputTab, setInputTab] = useState("prompt");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("google-veo-3");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);

  // Image upload
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Document upload
  const [documentText, setDocumentText] = useState("");
  const [documentName, setDocumentName] = useState("");
  const docInputRef = useRef<HTMLInputElement>(null);

  // Polling ref
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadVideos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("generated_videos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setVideos((data as GeneratedVideo[]) || []);
    } catch (err) {
      console.error("Error loading videos:", err);
    } finally {
      setLoadingVideos(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadVideos]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocumentName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setDocumentText(reader.result as string);
    };
    reader.readAsText(file);
  };

  const startPolling = (requestId: string, videoId: string, modelId: string) => {
    let attempts = 0;
    const maxAttempts = 120; // 10 min max

    pollingRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        setGenerating(false);
        setStatusText("Timeout — tente novamente");
        toast.error("Geração demorou demais. Tente novamente.");
        return;
      }

      try {
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-video-status`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ requestId, videoId, model: modelId }),
          }
        );
        const data = await res.json();

        if (data.status === "completed" && data.videoUrl) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setProgress(100);
          setStatusText("Vídeo pronto!");
          setCurrentVideoUrl(data.videoUrl);
          setGenerating(false);
          toast.success("Vídeo gerado com sucesso!");
          loadVideos();
        } else if (data.status === "failed") {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setGenerating(false);
          setStatusText("Falha na geração");
          toast.error("Falha na geração do vídeo.");
          loadVideos();
        } else {
          setProgress(data.progress || Math.min(attempts * 2, 90));
          setStatusText(
            data.rawStatus === "IN_QUEUE" ? "Na fila..." :
            data.rawStatus === "IN_PROGRESS" ? "Gerando vídeo..." : "Processando..."
          );
        }
      } catch {
        // Ignore polling errors, keep trying
      }
    }, 5000);
  };

  const handleGenerate = async () => {
    const effectivePrompt = inputTab === "document" ? (documentText ? "doc" : "") : prompt;
    const effectiveImage = inputTab === "image" ? imageBase64 : null;

    if (!effectivePrompt && !effectiveImage && inputTab !== "document") {
      toast.error("Insira um prompt ou envie uma imagem.");
      return;
    }
    if (inputTab === "document" && !documentText) {
      toast.error("Envie um documento primeiro.");
      return;
    }

    setGenerating(true);
    setProgress(5);
    setStatusText("Enviando para geração...");
    setCurrentVideoUrl(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fal-video-generate`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            prompt: inputTab === "document" ? "" : prompt,
            model,
            input_type: inputTab,
            image_url: effectiveImage || undefined,
            document_text: inputTab === "document" ? documentText : undefined,
            aspect_ratio: aspectRatio,
            duration,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro na geração");
      }

      const data = await res.json();
      setProgress(15);
      setStatusText("Job enviado — aguardando processamento...");
      toast.info(`Geração iniciada com ${data.model}`);

      startPolling(data.requestId, data.videoId, model);
    } catch (err) {
      setGenerating(false);
      setProgress(0);
      setStatusText("");
      toast.error(err instanceof Error ? err.message : "Erro ao gerar vídeo");
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("generated_videos").delete().eq("id", id);
    if (error) toast.error("Erro ao deletar");
    else {
      toast.success("Vídeo removido");
      loadVideos();
    }
  };

  const modelInfo = VIDEO_MODELS.find((m) => m.id === model);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" /> Gerador de Vídeo com IA
          </CardTitle>
          <CardDescription>
            Crie vídeos com os modelos mais avançados: Google Veo 3, Kling 2.0, MiniMax e Luma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Model & Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Modelo de IA</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VIDEO_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex flex-col">
                        <span className="font-medium">{m.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {modelInfo && (
                <p className="text-xs text-muted-foreground">{modelInfo.description}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
                  <SelectItem value="9:16">9:16 (Stories/Reels)</SelectItem>
                  <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
                  <SelectItem value="4:3">4:3 (Clássico)</SelectItem>
                  <SelectItem value="3:4">3:4 (Retrato)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 segundos</SelectItem>
                  <SelectItem value="10">10 segundos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Input Tabs */}
          <Tabs value={inputTab} onValueChange={setInputTab}>
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="prompt"><Sparkles className="h-3 w-3 mr-1" /> Prompt</TabsTrigger>
              <TabsTrigger value="image"><ImageIcon className="h-3 w-3 mr-1" /> Imagem</TabsTrigger>
              <TabsTrigger value="document"><FileText className="h-3 w-3 mr-1" /> Documento</TabsTrigger>
            </TabsList>

            <TabsContent value="prompt" className="space-y-3 mt-3">
              <Textarea
                placeholder="Descreva o vídeo que deseja gerar... Ex: 'Uma paisagem de montanhas ao pôr do sol com nuvens dramáticas'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                disabled={generating}
              />
            </TabsContent>

            <TabsContent value="image" className="space-y-3 mt-3">
              <div className="space-y-2">
                <Label>Upload de imagem para animar</Label>
                <div className="flex items-center gap-3">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={generating}
                  >
                    <Upload className="h-3 w-3 mr-1" /> Enviar Imagem
                  </Button>
                  {imagePreview && (
                    <div className="relative">
                      <img src={imagePreview} alt="Preview" className="h-20 w-20 object-cover rounded border" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full bg-destructive text-destructive-foreground"
                        onClick={() => { setImagePreview(null); setImageBase64(null); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <Textarea
                  placeholder="Descreva como a imagem deve ser animada... (opcional)"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={2}
                  disabled={generating}
                />
                {!modelInfo?.supportsImage && (
                  <p className="text-xs text-destructive">⚠️ O modelo {modelInfo?.name} não suporta image-to-video. Será usado Kling 2.0 automaticamente.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="document" className="space-y-3 mt-3">
              <div className="space-y-2">
                <Label>Upload de documento (PDF, TXT, DOCX)</Label>
                <div className="flex items-center gap-3">
                  <input
                    ref={docInputRef}
                    type="file"
                    accept=".txt,.pdf,.docx,.doc,.md"
                    className="hidden"
                    onChange={handleDocUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => docInputRef.current?.click()}
                    disabled={generating}
                  >
                    <FileText className="h-3 w-3 mr-1" /> Enviar Documento
                  </Button>
                  {documentName && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" /> {documentName}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => { setDocumentText(""); setDocumentName(""); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  A IA analisará o documento e criará automaticamente um prompt criativo para o vídeo.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generating}
            variant="gradient"
            size="lg"
            className="w-full"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" /> Gerar Vídeo</>
            )}
          </Button>

          {/* Progress */}
          {generating && (
            <div className="space-y-2">
              <Progress value={progress} gradient className="h-3" />
              <p className="text-sm text-muted-foreground text-center">{statusText}</p>
            </div>
          )}

          {/* Current Video */}
          {currentVideoUrl && (
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <h3 className="font-medium flex items-center gap-2">
                <Video className="h-4 w-4" /> Vídeo Gerado
              </h3>
              <video
                src={currentVideoUrl}
                controls
                className="w-full max-h-[400px] rounded-lg"
                autoPlay
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={currentVideoUrl} download target="_blank" rel="noopener noreferrer">
                    <Download className="h-3 w-3 mr-1" /> Download
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gallery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Galeria de Vídeos</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingVideos ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : videos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum vídeo gerado ainda.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((v) => (
                <div key={v.id} className="border rounded-lg overflow-hidden bg-card">
                  {v.status === "completed" && v.video_url ? (
                    <video
                      src={v.video_url}
                      controls
                      className="w-full h-48 object-cover"
                      preload="metadata"
                    />
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center bg-muted">
                      {v.status === "processing" || v.status === "pending" ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      ) : (
                        <span className="text-sm text-muted-foreground">Falhou</span>
                      )}
                    </div>
                  )}
                  <div className="p-3 space-y-1">
                    <p className="text-xs text-muted-foreground line-clamp-2">{v.prompt || "Sem prompt"}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{v.model_used}</span>
                      <div className="flex gap-1">
                        {v.video_url && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                            <a href={v.video_url} download target="_blank" rel="noopener noreferrer">
                              <Download className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => handleDelete(v.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
