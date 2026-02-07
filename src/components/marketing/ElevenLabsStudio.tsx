import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { 
  Loader2, Play, Pause, Download, Copy, Volume2, Mic, 
  FileText, Music, Sparkles, RefreshCw, StopCircle,
  Upload, Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { getAuthHeaders } from "@/lib/utils/auth-headers";

// Vozes disponíveis do ElevenLabs
const VOICES = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Voz masculina profissional' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Voz feminina clara e natural' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Voz masculina jovem e dinâmica' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', description: 'Voz feminina calorosa' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Voz masculina suave' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Voz feminina expressiva' },
];

const MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2', description: 'Alta qualidade, 29 idiomas' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', description: 'Baixa latência, alta qualidade' },
];

export function ElevenLabsStudio() {
  // TTS State
  const [ttsText, setTtsText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0.5);
  const [speed, setSpeed] = useState(1.0);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // SFX State
  const [sfxPrompt, setSfxPrompt] = useState("");
  const [sfxDuration, setSfxDuration] = useState(5);
  const [sfxLoading, setSfxLoading] = useState(false);
  const [sfxAudioUrl, setSfxAudioUrl] = useState<string | null>(null);

  // Music State
  const [musicPrompt, setMusicPrompt] = useState("");
  const [musicDuration, setMusicDuration] = useState(30);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicAudioUrl, setMusicAudioUrl] = useState<string | null>(null);

  // Generate TTS
  const generateTTS = async () => {
    if (!ttsText.trim()) {
      toast.error("Digite o texto para converter em áudio");
      return;
    }

    setTtsLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            text: ttsText,
            voiceId: selectedVoice,
            modelId: selectedModel,
            voiceSettings: {
              stability,
              similarity_boost: similarityBoost,
              style,
              speed,
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Erro: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      setGeneratedAudioUrl(audioUrl);
      toast.success("Áudio gerado com sucesso!");
    } catch (error: any) {
      console.error('Erro ao gerar TTS:', error);
      toast.error(error.message || "Erro ao gerar áudio");
    } finally {
      setTtsLoading(false);
    }
  };

  // Generate SFX
  const generateSFX = async () => {
    if (!sfxPrompt.trim()) {
      toast.error("Descreva o efeito sonoro desejado");
      return;
    }

    setSfxLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-sfx`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            prompt: sfxPrompt,
            duration: sfxDuration,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Erro: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      setSfxAudioUrl(audioUrl);
      toast.success("Efeito sonoro gerado!");
    } catch (error: any) {
      console.error('Erro ao gerar SFX:', error);
      toast.error(error.message || "Erro ao gerar efeito sonoro");
    } finally {
      setSfxLoading(false);
    }
  };

  // Generate Music
  const generateMusic = async () => {
    if (!musicPrompt.trim()) {
      toast.error("Descreva a música desejada");
      return;
    }

    setMusicLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            prompt: musicPrompt,
            duration: musicDuration,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Erro: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      setMusicAudioUrl(audioUrl);
      toast.success("Música gerada!");
    } catch (error: any) {
      console.error('Erro ao gerar música:', error);
      toast.error(error.message || "Erro ao gerar música");
    } finally {
      setMusicLoading(false);
    }
  };

  // Audio Player Controls
  const togglePlay = (audioUrl: string | null) => {
    if (!audioUrl) return;
    
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const downloadAudio = (url: string | null, filename: string) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Download iniciado!");
  };

  return (
    <div className="space-y-6">
      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(false)} 
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            ElevenLabs Studio
          </h2>
          <p className="text-muted-foreground">
            Geração de áudio, efeitos sonoros e música com IA
          </p>
        </div>
      </div>

      <Tabs defaultValue="tts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tts" className="gap-2">
            <Volume2 className="h-4 w-4" />
            Text-to-Speech
          </TabsTrigger>
          <TabsTrigger value="sfx" className="gap-2">
            <Mic className="h-4 w-4" />
            Efeitos Sonoros
          </TabsTrigger>
          <TabsTrigger value="music" className="gap-2">
            <Music className="h-4 w-4" />
            Música
          </TabsTrigger>
        </TabsList>

        {/* Text-to-Speech Tab */}
        <TabsContent value="tts" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Texto para Áudio</CardTitle>
                <CardDescription>Converta texto em voz natural</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Texto</Label>
                  <Textarea
                    placeholder="Digite o texto que deseja converter em áudio..."
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    className="min-h-[120px]"
                    disabled={ttsLoading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {ttsText.length}/5000 caracteres
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Voz</Label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={ttsLoading}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Modelo</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel} disabled={ttsLoading}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODELS.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <Label>Estabilidade</Label>
                      <span className="text-sm text-muted-foreground">{stability.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[stability]}
                      onValueChange={(v) => setStability(v[0])}
                      min={0}
                      max={1}
                      step={0.05}
                      disabled={ttsLoading}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Menor = mais expressivo, Maior = mais consistente
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <Label>Similaridade</Label>
                      <span className="text-sm text-muted-foreground">{similarityBoost.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[similarityBoost]}
                      onValueChange={(v) => setSimilarityBoost(v[0])}
                      min={0}
                      max={1}
                      step={0.05}
                      disabled={ttsLoading}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <Label>Velocidade</Label>
                      <span className="text-sm text-muted-foreground">{speed.toFixed(1)}x</span>
                    </div>
                    <Slider
                      value={[speed]}
                      onValueChange={(v) => setSpeed(v[0])}
                      min={0.7}
                      max={1.2}
                      step={0.1}
                      disabled={ttsLoading}
                    />
                  </div>
                </div>

                <Button 
                  onClick={generateTTS} 
                  disabled={ttsLoading || !ttsText.trim()}
                  className="w-full"
                >
                  {ttsLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Gerar Áudio
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* TTS Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatedAudioUrl ? (
                  <div className="space-y-4">
                    <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Volume2 className="h-16 w-16 mx-auto text-primary mb-4" />
                        <p className="text-sm text-muted-foreground">Áudio gerado com sucesso</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => togglePlay(generatedAudioUrl)}
                        className="flex-1"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Pausar
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Reproduzir
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => downloadAudio(generatedAudioUrl, `tts-${Date.now()}.mp3`)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 border-2 border-dashed rounded-lg text-center">
                    <Volume2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      O áudio gerado aparecerá aqui
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sound Effects Tab */}
        <TabsContent value="sfx" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Efeitos Sonoros</CardTitle>
                <CardDescription>Gere efeitos sonoros a partir de descrições</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Descrição do Efeito</Label>
                  <Textarea
                    placeholder="Ex: Porta de madeira rangendo lentamente em uma casa assombrada..."
                    value={sfxPrompt}
                    onChange={(e) => setSfxPrompt(e.target.value)}
                    className="min-h-[100px]"
                    disabled={sfxLoading}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Duração</Label>
                    <span className="text-sm text-muted-foreground">{sfxDuration}s</span>
                  </div>
                  <Slider
                    value={[sfxDuration]}
                    onValueChange={(v) => setSfxDuration(v[0])}
                    min={1}
                    max={22}
                    step={1}
                    disabled={sfxLoading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Máximo: 22 segundos
                  </p>
                </div>

                <Button 
                  onClick={generateSFX} 
                  disabled={sfxLoading || !sfxPrompt.trim()}
                  className="w-full"
                >
                  {sfxLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-4 w-4" />
                      Gerar Efeito Sonoro
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {sfxAudioUrl ? (
                  <div className="space-y-4">
                    <div className="p-6 bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Mic className="h-16 w-16 mx-auto text-orange-500 mb-4" />
                        <p className="text-sm text-muted-foreground">Efeito sonoro gerado</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => togglePlay(sfxAudioUrl)}
                        className="flex-1"
                      >
                        {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                        {isPlaying ? 'Pausar' : 'Reproduzir'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => downloadAudio(sfxAudioUrl, `sfx-${Date.now()}.mp3`)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 border-2 border-dashed rounded-lg text-center">
                    <Mic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      O efeito sonoro aparecerá aqui
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Music Tab */}
        <TabsContent value="music" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Gerador de Música</CardTitle>
                <CardDescription>Crie músicas originais com IA</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Descrição da Música</Label>
                  <Textarea
                    placeholder="Ex: Música lofi relaxante para estudo, com piano suave e batidas calmas..."
                    value={musicPrompt}
                    onChange={(e) => setMusicPrompt(e.target.value)}
                    className="min-h-[100px]"
                    disabled={musicLoading}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Duração</Label>
                    <span className="text-sm text-muted-foreground">{musicDuration}s</span>
                  </div>
                  <Slider
                    value={[musicDuration]}
                    onValueChange={(v) => setMusicDuration(v[0])}
                    min={15}
                    max={120}
                    step={5}
                    disabled={musicLoading}
                  />
                </div>

                <Button 
                  onClick={generateMusic} 
                  disabled={musicLoading || !musicPrompt.trim()}
                  className="w-full"
                >
                  {musicLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Music className="mr-2 h-4 w-4" />
                      Gerar Música
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {musicAudioUrl ? (
                  <div className="space-y-4">
                    <div className="p-6 bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Music className="h-16 w-16 mx-auto text-purple-500 mb-4" />
                        <p className="text-sm text-muted-foreground">Música gerada</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => togglePlay(musicAudioUrl)}
                        className="flex-1"
                      >
                        {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                        {isPlaying ? 'Pausar' : 'Reproduzir'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => downloadAudio(musicAudioUrl, `music-${Date.now()}.mp3`)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 border-2 border-dashed rounded-lg text-center">
                    <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      A música aparecerá aqui
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
