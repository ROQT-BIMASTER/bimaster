import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw,
  Camera, Mic, Music, Eye, Volume2, VolumeX,
} from "lucide-react";
import type { Cena } from "@/hooks/useRoteiristaIA";
import type { useNarracao } from "@/hooks/useNarracao";

interface StoryboardPlayerProps {
  cenas: Cena[];
  formato: "9:16" | "16:9" | "1:1";
  narracao: ReturnType<typeof useNarracao>;
}

const TIPOS_PLANO_LABEL: Record<string, string> = {
  wide: "Plano Aberto",
  medium: "Plano Médio",
  "close-up": "Close-up",
  macro: "Macro",
  drone: "Drone",
  pov: "POV",
  "over-the-shoulder": "Sobre o ombro",
};

const ASPECT_CLASSES: Record<string, string> = {
  "9:16": "aspect-[9/16] max-h-[360px]",
  "16:9": "aspect-video",
  "1:1": "aspect-square max-h-[360px]",
};

export const StoryboardPlayer = ({ cenas, formato, narracao }: StoryboardPlayerProps) => {
  const [cenaIdx, setCenaIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const [aba, setAba] = useState<"camera" | "narracao" | "ambiente">("camera");
  const tickRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const elapsedAtPauseRef = useRef<number>(0);

  const cena = cenas[cenaIdx];
  const duracaoMs = (cena?.duracao_segundos || 5) * 1000;

  const totalDuracao = useMemo(
    () => cenas.reduce((acc, c) => acc + (c.duracao_segundos || 0), 0),
    [cenas],
  );
  const tempoAcumulado = useMemo(
    () => cenas.slice(0, cenaIdx).reduce((acc, c) => acc + (c.duracao_segundos || 0), 0),
    [cenas, cenaIdx],
  );

  const cenaKey = `cena-${cenaIdx}`;
  const cached = narracao.getCache(cenaKey);

  const stopTick = () => {
    if (tickRef.current) {
      cancelAnimationFrame(tickRef.current);
      tickRef.current = null;
    }
  };

  const tick = () => {
    const elapsed = performance.now() - startRef.current + elapsedAtPauseRef.current;
    const pct = Math.min(100, (elapsed / duracaoMs) * 100);
    setProgress(pct);
    if (elapsed >= duracaoMs) {
      stopTick();
      if (cenaIdx < cenas.length - 1) {
        avancar(true);
      } else {
        setPlaying(false);
        elapsedAtPauseRef.current = 0;
        setProgress(100);
      }
    } else {
      tickRef.current = requestAnimationFrame(tick);
    }
  };

  const play = () => {
    if (!cena) return;
    setPlaying(true);
    startRef.current = performance.now();
    if (cached && !muted) {
      narracao.tocar(cenaKey, cached);
    }
    tickRef.current = requestAnimationFrame(tick);
  };

  const pause = () => {
    setPlaying(false);
    stopTick();
    elapsedAtPauseRef.current += performance.now() - startRef.current;
    narracao.parar();
  };

  const reset = () => {
    stopTick();
    setPlaying(false);
    setProgress(0);
    elapsedAtPauseRef.current = 0;
    narracao.parar();
  };

  const avancar = (autoPlay = false) => {
    stopTick();
    narracao.parar();
    elapsedAtPauseRef.current = 0;
    setProgress(0);
    setCenaIdx((i) => {
      const next = Math.min(cenas.length - 1, i + 1);
      if (autoPlay && next !== i) {
        setTimeout(() => {
          setPlaying(true);
          startRef.current = performance.now();
          const nextKey = `cena-${next}`;
          const nextCached = narracao.getCache(nextKey);
          if (nextCached && !muted) narracao.tocar(nextKey, nextCached);
          tickRef.current = requestAnimationFrame(tick);
        }, 50);
      } else {
        setPlaying(false);
      }
      return next;
    });
  };

  const voltar = () => {
    stopTick();
    narracao.parar();
    elapsedAtPauseRef.current = 0;
    setProgress(0);
    setPlaying(false);
    setCenaIdx((i) => Math.max(0, i - 1));
  };

  const irParaCena = (idx: number) => {
    stopTick();
    narracao.parar();
    elapsedAtPauseRef.current = 0;
    setProgress(0);
    setPlaying(false);
    setCenaIdx(idx);
  };

  useEffect(() => {
    return () => {
      stopTick();
      narracao.parar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cena) return null;

  return (
    <Card className="border-2 border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Player do Storyboard</h4>
            <Badge variant="outline" className="text-[10px]">
              Cena {cenaIdx + 1} de {cenas.length}
            </Badge>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {Math.round(tempoAcumulado + (progress / 100) * (cena.duracao_segundos || 0))}s
            {" / "}
            {totalDuracao}s totais
          </div>
        </div>

        {/* Stage / Frame */}
        <div className={`relative w-full bg-gradient-to-br from-muted to-muted/50 rounded-lg overflow-hidden border ${ASPECT_CLASSES[formato]} mx-auto`}>
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <Badge variant="default" className="mb-3">
              <Camera className="h-3 w-3 mr-1" />
              {TIPOS_PLANO_LABEL[cena.tipo_plano] || cena.tipo_plano}
            </Badge>
            <h5 className="font-bold text-base mb-2 text-foreground">{cena.titulo}</h5>
            <p className="text-xs text-muted-foreground line-clamp-4 max-w-md italic">
              {cena.descricao_visual}
            </p>
          </div>
          {/* Progress bar overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/50">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Cena progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{((progress / 100) * (cena.duracao_segundos || 0)).toFixed(1)}s</span>
            <span>{cena.duracao_segundos}s</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Transport controls */}
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={voltar} disabled={cenaIdx === 0}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          {playing ? (
            <Button size="sm" onClick={pause} className="px-6">
              <Pause className="h-4 w-4 mr-1" /> Pausar
            </Button>
          ) : (
            <Button size="sm" onClick={play} className="px-6">
              <Play className="h-4 w-4 mr-1" /> {progress > 0 && progress < 100 ? "Continuar" : "Reproduzir"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => avancar(false)} disabled={cenaIdx === cenas.length - 1}>
            <SkipForward className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setMuted((m) => !m)}
            title={muted ? "Ativar narração" : "Silenciar narração"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </div>

        {/* Cena timeline (chips) */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {cenas.map((c, i) => (
            <button
              key={i}
              onClick={() => irParaCena(i)}
              className={`shrink-0 px-2 py-1 rounded-md text-[10px] border transition-colors ${
                i === cenaIdx
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 hover:bg-muted border-border text-muted-foreground"
              }`}
              title={c.titulo}
            >
              {i + 1}. {c.titulo.length > 18 ? c.titulo.slice(0, 18) + "…" : c.titulo}
            </button>
          ))}
        </div>

        {/* Tabs: camera / narracao / ambiente */}
        <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
          <TabsList className="grid grid-cols-3 w-full h-8">
            <TabsTrigger value="camera" className="text-[11px]">
              <Camera className="h-3 w-3 mr-1" /> Câmera
            </TabsTrigger>
            <TabsTrigger value="narracao" className="text-[11px]">
              <Mic className="h-3 w-3 mr-1" /> Narração
              {cached && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />}
            </TabsTrigger>
            <TabsTrigger value="ambiente" className="text-[11px]">
              <Music className="h-3 w-3 mr-1" /> Ambiente
            </TabsTrigger>
          </TabsList>
          <TabsContent value="camera" className="mt-2 space-y-2">
            <div className="p-2 bg-muted/40 rounded border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Movimento</p>
              <p className="text-xs">{cena.movimento_camera}</p>
            </div>
            <div className="p-2 bg-muted/40 rounded border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Prompt visual (EN)</p>
              <p className="text-xs italic">{cena.descricao_visual}</p>
            </div>
          </TabsContent>
          <TabsContent value="narracao" className="mt-2">
            <div className="p-2 bg-muted/40 rounded border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                Texto da narração {cached ? "• áudio pronto" : "• áudio não gerado"}
              </p>
              {cena.narracao ? (
                <p className="text-xs">"{cena.narracao}"</p>
              ) : (
                <p className="text-xs text-muted-foreground italic">Esta cena não possui narração.</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="ambiente" className="mt-2">
            <div className="p-2 bg-muted/40 rounded border flex items-start gap-2">
              <Music className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-xs">
                {cena.audio_ambiente || (
                  <span className="text-muted-foreground italic">Sem indicação de áudio ambiente.</span>
                )}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
