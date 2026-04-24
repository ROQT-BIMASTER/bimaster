import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RotateCcw, Clock } from "lucide-react";
import type { NarracaoCache } from "@/hooks/useNarracao";

interface NarracaoTimelineProps {
  texto: string;
  cache: NarracaoCache;
}

interface Segmento {
  texto: string;
  palavras: number;
  inicio: number; // segundos
  fim: number;    // segundos
}

/** Quebra o texto em segmentos por sentenças (.,!?…) preservando a pontuação. */
function segmentarTexto(texto: string): string[] {
  const limpo = (texto || "").trim();
  if (!limpo) return [];
  // Divide em frases preservando o delimitador
  const partes = limpo
    .split(/(?<=[\.!\?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Se uma "frase" for muito longa (>140 chars), subdivide por vírgulas/ponto-e-vírgula
  const out: string[] = [];
  for (const frase of partes) {
    if (frase.length <= 140) {
      out.push(frase);
      continue;
    }
    const sub = frase.split(/(?<=[,;:])\s+/).map((s) => s.trim()).filter(Boolean);
    for (const s of sub) out.push(s);
  }
  return out.length > 0 ? out : [limpo];
}

function contarPalavras(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length || 1;
}

function formatarTempo(seg: number): string {
  if (!isFinite(seg) || seg < 0) seg = 0;
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  const ms = Math.floor((seg - Math.floor(seg)) * 10);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`;
}

export function NarracaoTimeline({ texto, cache }: NarracaoTimelineProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duracao, setDuracao] = useState(0);
  const [tempoAtual, setTempoAtual] = useState(0);
  const [tocando, setTocando] = useState(false);

  const src = useMemo(() => {
    if (cache.audio_base64) return `data:${cache.mime_type};base64,${cache.audio_base64}`;
    return cache.audio_url || "";
  }, [cache]);

  const sentencas = useMemo(() => segmentarTexto(texto), [texto]);

  /** Distribui o tempo total proporcionalmente à contagem de palavras de cada segmento. */
  const segmentos = useMemo<Segmento[]>(() => {
    if (sentencas.length === 0 || duracao <= 0) {
      return sentencas.map((s) => ({
        texto: s,
        palavras: contarPalavras(s),
        inicio: 0,
        fim: 0,
      }));
    }
    const pesos = sentencas.map((s) => contarPalavras(s));
    const total = pesos.reduce((a, b) => a + b, 0);
    let acumulado = 0;
    return sentencas.map((s, i) => {
      const fracao = pesos[i] / total;
      const dur = duracao * fracao;
      const inicio = acumulado;
      const fim = i === sentencas.length - 1 ? duracao : acumulado + dur;
      acumulado = fim;
      return { texto: s, palavras: pesos[i], inicio, fim };
    });
  }, [sentencas, duracao]);

  const indiceAtivo = useMemo(() => {
    if (!tocando && tempoAtual === 0) return -1;
    return segmentos.findIndex((seg) => tempoAtual >= seg.inicio && tempoAtual < seg.fim);
  }, [segmentos, tempoAtual, tocando]);

  // Configuração do audio element
  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;
    const onMeta = () => setDuracao(audio.duration || 0);
    const onTime = () => setTempoAtual(audio.currentTime || 0);
    const onEnd = () => {
      setTocando(false);
      setTempoAtual(0);
    };
    const onPlay = () => setTocando(true);
    const onPause = () => setTocando(false);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audioRef.current = null;
    };
  }, [src]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setTocando(false));
    else a.pause();
  };

  const reiniciar = () => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    setTempoAtual(0);
  };

  const seekTo = (segundos: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(segundos, duracao || segundos));
    if (a.paused) a.play().catch(() => {});
  };

  const seekPorBarra = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duracao) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(ratio * duracao);
  };

  const progresso = duracao > 0 ? (tempoAtual / duracao) * 100 : 0;

  return (
    <div className="space-y-2 mt-2 p-2 rounded-md border bg-muted/20">
      {/* Controles + barra */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          onClick={togglePlay}
          title={tocando ? "Pausar" : "Tocar"}
        >
          {tocando ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={reiniciar}
          title="Reiniciar"
          disabled={tempoAtual === 0 && !tocando}
        >
          <RotateCcw className="h-3 w-3" />
        </Button>

        <div
          className="relative flex-1 h-2 rounded-full bg-muted cursor-pointer overflow-hidden"
          onClick={seekPorBarra}
          title="Clique para saltar"
        >
          <div
            className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-75"
            style={{ width: `${progresso}%` }}
          />
          {/* Marcações dos segmentos na barra */}
          {duracao > 0 && segmentos.slice(1).map((seg, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-background/70"
              style={{ left: `${(seg.inicio / duracao) * 100}%` }}
            />
          ))}
        </div>

        <span className="text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
          {formatarTempo(tempoAtual)} / {formatarTempo(duracao)}
        </span>
      </div>

      {/* Lista de segmentos com timestamps clicáveis */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            Marcações de tempo ({segmentos.length})
          </p>
          {duracao === 0 && (
            <span className="text-[9px] text-muted-foreground italic">carregando duração…</span>
          )}
        </div>
        <ul className="space-y-0.5">
          {segmentos.map((seg, i) => {
            const ativo = i === indiceAtivo;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => seekTo(seg.inicio)}
                  className={`w-full text-left flex gap-2 items-start p-1.5 rounded text-xs transition-colors ${
                    ativo
                      ? "bg-primary/15 border border-primary/40"
                      : "hover:bg-muted/60 border border-transparent"
                  }`}
                  title={`Saltar para ${formatarTempo(seg.inicio)}`}
                >
                  <Badge
                    variant={ativo ? "default" : "outline"}
                    className="h-5 px-1.5 text-[10px] tabular-nums shrink-0 font-mono"
                  >
                    {formatarTempo(seg.inicio)}
                  </Badge>
                  <span className={`flex-1 leading-snug ${ativo ? "font-medium" : ""}`}>
                    {seg.texto}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-[9px] text-muted-foreground italic">
          Tempos aproximados — calculados pela proporção de palavras na duração real do áudio.
        </p>
      </div>
    </div>
  );
}
