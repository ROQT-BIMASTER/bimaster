import { useEffect, useState, useCallback } from "react";
import { useHuggsStudio, useVideoPolling } from "@/hooks/useHuggsStudio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Video, Languages, History, Wand2 } from "lucide-react";
import { toast } from "sonner";

interface Avatar { avatar_id: string; avatar_name: string; preview_image_url?: string; gender?: string }
interface Voice { voice_id: string; name?: string; language?: string; gender?: string }

export const HuggsStudioTab = () => {
  const { call, loading } = useHuggsStudio();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [titulo, setTitulo] = useState("");
  const [script, setScript] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [videos, setVideos] = useState<any[]>([]);
  const [translations, setTranslations] = useState<any[]>([]);
  const [langs, setLangs] = useState<string[]>([]);
  const [trTitle, setTrTitle] = useState("");
  const [trUrl, setTrUrl] = useState("");
  const [trLang, setTrLang] = useState("");

  const upsertVideo = useCallback((row: any) => {
    setVideos((prev) => prev.map((v) => v.id === row.id ? row : v));
  }, []);
  const upsertTranslation = useCallback((row: any) => {
    setTranslations((prev) => prev.map((v) => v.id === row.id ? row : v));
  }, []);

  const videoPoll = useVideoPolling(upsertVideo);
  const trPoll = useVideoPolling(upsertTranslation);

  useEffect(() => {
    (async () => {
      const a = await call<{ avatars: Avatar[]; talking_photos: any[] }>("list_avatars");
      if (a) setAvatars(a.avatars || []);
      const v = await call<{ voices: Voice[] }>("list_voices");
      if (v) setVoices(v.voices || []);
      const vids = await call<{ videos: any[] }>("list_my_videos");
      if (vids) {
        setVideos(vids.videos);
        vids.videos.forEach((row) => {
          if (row.status === "processing") videoPoll.start(row.id, "video");
        });
      }
      const trs = await call<{ translations: any[] }>("list_my_translations");
      if (trs) {
        setTranslations(trs.translations);
        trs.translations.forEach((row) => {
          if (row.status === "processing") trPoll.start(row.id, "translation");
        });
      }
      const ls = await call<{ languages: string[] }>("list_translation_languages");
      if (ls) setLangs(ls.languages || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateVideo = async () => {
    if (!titulo || !script || !avatarId || !voiceId) {
      toast.error("Preencha título, roteiro, avatar e voz");
      return;
    }
    const r = await call<{ id: string }>("create_video", {
      titulo, script, avatar_id: avatarId, voice_id: voiceId,
    });
    if (r?.id) {
      toast.success("Geração iniciada. Acompanhe em Histórico.");
      setTitulo(""); setScript("");
      const vids = await call<{ videos: any[] }>("list_my_videos");
      if (vids) setVideos(vids.videos);
      videoPoll.start(r.id, "video");
    }
  };

  const handleCreateTranslation = async () => {
    if (!trTitle || !trUrl || !trLang) {
      toast.error("Preencha título, URL e idioma");
      return;
    }
    const r = await call<{ id: string }>("create_translation", {
      title: trTitle, video_url: trUrl, output_language: trLang,
    });
    if (r?.id) {
      toast.success("Tradução iniciada.");
      setTrTitle(""); setTrUrl(""); setTrLang("");
      const trs = await call<{ translations: any[] }>("list_my_translations");
      if (trs) setTranslations(trs.translations);
      trPoll.start(r.id, "translation");
    }
  };

  const statusBadge = (s: string) => (
    <Badge variant={s === "completed" ? "default" : s === "failed" ? "destructive" : "secondary"}>
      {s === "completed" ? "Concluído" : s === "failed" ? "Falhou" : "Processando"}
    </Badge>
  );

  return (
    <Tabs defaultValue="video" className="space-y-4">
      <TabsList>
        <TabsTrigger value="video"><Video className="h-3 w-3 mr-1" />Gerar Vídeo</TabsTrigger>
        <TabsTrigger value="traducao"><Languages className="h-3 w-3 mr-1" />Tradução</TabsTrigger>
        <TabsTrigger value="historico"><History className="h-3 w-3 mr-1" />Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="video">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" />Estúdio Huggs — Vídeo com Avatar</CardTitle>
            <CardDescription>Crie vídeos profissionais com avatares e vozes da agência.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Vídeo institucional Q2" />
              </div>
              <div className="space-y-2">
                <Label>Avatar</Label>
                <Select value={avatarId} onValueChange={setAvatarId} disabled={avatars.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={loading ? "Carregando avatares..." : avatars.length === 0 ? "Nenhum avatar disponível" : "Selecione um avatar"} />
                  </SelectTrigger>
                  <SelectContent>
                    {avatars.map((a) => (
                      <SelectItem key={a.avatar_id} value={a.avatar_id}>
                        {a.avatar_name || a.avatar_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!loading && avatars.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum avatar cadastrado na conta. Cadastre em app.heygen.com e recarregue.
                  </p>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Voz</Label>
                <Select value={voiceId} onValueChange={setVoiceId} disabled={voices.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={loading ? "Carregando vozes..." : voices.length === 0 ? "Nenhuma voz disponível" : "Selecione uma voz"} />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map((v) => (
                      <SelectItem key={v.voice_id} value={v.voice_id}>
                        {v.name} — {v.language} ({v.gender})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!loading && voices.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma voz disponível para os idiomas filtrados.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Roteiro</Label>
              <Textarea rows={6} value={script} onChange={(e) => setScript(e.target.value)}
                placeholder="Olá, sou a Huggs e hoje vou apresentar..." />
            </div>
            <Button onClick={handleCreateVideo} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</> : <><Video className="h-4 w-4 mr-2" />Gerar Vídeo</>}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="traducao">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Languages className="h-5 w-5" />Tradução de Vídeo</CardTitle>
            <CardDescription>Traduza um vídeo existente preservando voz e lip-sync.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={trTitle} onChange={(e) => setTrTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>URL do vídeo</Label>
              <Input value={trUrl} onChange={(e) => setTrUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Idioma alvo</Label>
              <Select value={trLang} onValueChange={setTrLang}>
                <SelectTrigger><SelectValue placeholder="Selecione o idioma" /></SelectTrigger>
                <SelectContent>
                  {langs.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateTranslation} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</> : <><Languages className="h-4 w-4 mr-2" />Traduzir</>}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="historico" className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Vídeos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {videos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum vídeo ainda.</p>}
            {videos.map((v) => (
              <div key={v.id} className="flex items-center justify-between border rounded p-3">
                <div>
                  <div className="font-medium">{v.titulo}</div>
                  <div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString("pt-BR")}</div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(v.status)}
                  {v.video_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={v.video_url} target="_blank" rel="noreferrer">Abrir</a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Traduções</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {translations.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tradução ainda.</p>}
            {translations.map((t) => (
              <div key={t.id} className="flex items-center justify-between border rounded p-3">
                <div>
                  <div className="font-medium">{t.title} <span className="text-xs text-muted-foreground">→ {t.target_language}</span></div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("pt-BR")}</div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(t.status)}
                  {t.video_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={t.video_url} target="_blank" rel="noreferrer">Abrir</a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
