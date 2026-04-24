import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NarracaoVoz {
  id: string;
  nome: string;
  descricao: string;
}

// Top voices recomendadas para narração cinematográfica (PT/EN multilingue)
export const VOZES_NARRACAO: NarracaoVoz[] = [
  { id: "JBFqnCBsd6RMkjVDRZzb", nome: "George", descricao: "Masculina, calma, narração premium" },
  { id: "onwK4e9ZLuTAKqWW03F9", nome: "Daniel", descricao: "Masculina, autoritária, documental" },
  { id: "nPczCjzI2devNBz1zQrb", nome: "Brian", descricao: "Masculina, profunda, épica" },
  { id: "EXAVITQu4vr4xnSDxMaL", nome: "Sarah", descricao: "Feminina, suave, comercial" },
  { id: "FGY2WhTYpPnrIDTdsKH5", nome: "Laura", descricao: "Feminina, jovem, energética" },
  { id: "XrExE9yKIg1WjnnlVkGX", nome: "Matilda", descricao: "Feminina, calorosa, storytelling" },
  { id: "cgSgspJ2msm6clMCkdW9", nome: "Jessica", descricao: "Feminina, expressiva, UGC" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", nome: "Liam", descricao: "Masculina, casual, comercial" },
];

export interface NarracaoCache {
  audio_base64: string;
  mime_type: string;
  voice_id: string;
  texto_hash: string;
}

// Cache em memória por sessão (key = `${cenaIndex}`)
const narracoesCache = new Map<string, NarracaoCache>();

function hashTexto(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

export function useNarracao() {
  const [generatingFor, setGeneratingFor] = useState<Set<string>>(new Set());
  const [playingFor, setPlayingFor] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const isGenerating = useCallback(
    (key: string) => generatingFor.has(key),
    [generatingFor],
  );

  const isPlaying = useCallback((key: string) => playingFor === key, [playingFor]);

  const getCache = useCallback((key: string) => narracoesCache.get(key), []);

  const gerarNarracao = useCallback(
    async (
      key: string,
      texto: string,
      voiceId: string,
      contexto?: { previous_text?: string; next_text?: string },
    ): Promise<NarracaoCache | null> => {
      const trimmed = (texto || "").trim();
      if (!trimmed) {
        toast.error("Texto da narração está vazio");
        return null;
      }

      const textHash = hashTexto(`${voiceId}|${trimmed}`);
      const cached = narracoesCache.get(key);
      if (cached && cached.texto_hash === textHash) {
        return cached;
      }

      setGeneratingFor((prev) => new Set(prev).add(key));
      try {
        const { data, error } = await supabase.functions.invoke(
          "elevenlabs-narracao",
          {
            body: {
              texto: trimmed,
              voice_id: voiceId,
              ...contexto,
            },
          },
        );
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (!data?.audio_base64) throw new Error("Resposta sem áudio");

        const entry: NarracaoCache = {
          audio_base64: data.audio_base64,
          mime_type: data.mime_type || "audio/mpeg",
          voice_id: data.voice_id || voiceId,
          texto_hash: textHash,
        };
        narracoesCache.set(key, entry);
        toast.success("Narração gerada");
        return entry;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao gerar narração";
        console.error("[useNarracao] erro:", e);
        toast.error(msg);
        return null;
      } finally {
        setGeneratingFor((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [],
  );

  const tocar = useCallback((key: string, entry?: NarracaoCache) => {
    const data = entry || narracoesCache.get(key);
    if (!data) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(`data:${data.mime_type};base64,${data.audio_base64}`);
    audioRef.current = audio;
    setPlayingFor(key);
    audio.onended = () => setPlayingFor(null);
    audio.onerror = () => {
      toast.error("Falha ao reproduzir áudio");
      setPlayingFor(null);
    };
    audio.play().catch((err) => {
      console.error("[useNarracao] play error:", err);
      setPlayingFor(null);
    });
  }, []);

  const parar = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingFor(null);
  }, []);

  const baixar = useCallback((key: string, filename: string) => {
    const data = narracoesCache.get(key);
    if (!data) return;
    const link = document.createElement("a");
    link.href = `data:${data.mime_type};base64,${data.audio_base64}`;
    link.download = filename.endsWith(".mp3") ? filename : `${filename}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const gerarLote = useCallback(
    async (
      itens: Array<{ key: string; texto: string; previous?: string; next?: string }>,
      voiceId: string,
      onProgress?: (done: number, total: number) => void,
    ) => {
      let done = 0;
      for (const item of itens) {
        await gerarNarracao(item.key, item.texto, voiceId, {
          previous_text: item.previous,
          next_text: item.next,
        });
        done += 1;
        onProgress?.(done, itens.length);
      }
    },
    [gerarNarracao],
  );

  return {
    gerarNarracao,
    gerarLote,
    tocar,
    parar,
    baixar,
    isGenerating,
    isPlaying,
    getCache,
  };
}
