import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

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

export interface VoiceSettingsOverride {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  speed?: number;
}

export interface NarracaoCache {
  audio_base64?: string;
  audio_url?: string;
  mime_type: string;
  voice_id: string;
  voice_nome?: string;
  texto_hash: string;
  saved_id?: string;
  storage_path?: string;
  created_at?: string;
}

// Cache em memória por sessão (key = `${cenaIndex}`)
const narracoesCache = new Map<string, NarracaoCache>();

function hashTexto(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

function vozNome(voiceId: string): string | undefined {
  return VOZES_NARRACAO.find((v) => v.id === voiceId)?.nome;
}

export function useNarracao() {
  const [generatingFor, setGeneratingFor] = useState<Set<string>>(new Set());
  const [playingFor, setPlayingFor] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
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

  /**
   * Carrega narrações já salvas do banco para um roteiro e popula o cache.
   * Chamado ao abrir/carregar um roteiro existente.
   */
  const carregarSalvas = useCallback(async (roteiroId: string | null) => {
    if (!roteiroId) {
      setSavedCount(0);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("roteirista_narracoes")
        .select("id, cena_index, voice_id, voice_nome, texto_hash, audio_url, storage_path, mime_type, created_at")
        .eq("roteiro_id", roteiroId)
        .order("cena_index", { ascending: true });
      if (error) throw error;

      // Limpa cache anterior do roteiro
      for (const k of Array.from(narracoesCache.keys())) {
        if (k.startsWith("cena-")) narracoesCache.delete(k);
      }

      let count = 0;
      for (const row of data || []) {
        const key = `cena-${row.cena_index}`;
        narracoesCache.set(key, {
          audio_url: row.audio_url || undefined,
          mime_type: row.mime_type || "audio/mpeg",
          voice_id: row.voice_id,
          voice_nome: row.voice_nome || vozNome(row.voice_id),
          texto_hash: row.texto_hash,
          saved_id: row.id,
          storage_path: row.storage_path,
          created_at: row.created_at,
        });
        count += 1;
      }
      setSavedCount(count);
    } catch (e) {
      logger.error("[useNarracao] carregarSalvas erro:", e);
    }
  }, []);

  const gerarNarracao = useCallback(
    async (
      key: string,
      texto: string,
      voiceId: string,
      contexto?: { previous_text?: string; next_text?: string },
      persist?: { roteiro_id: string; cena_index: number },
      language: "pt" | "en" | "auto" = "auto",
      voiceSettings?: VoiceSettingsOverride,
    ): Promise<NarracaoCache | null> => {
      const trimmed = (texto || "").trim();
      if (!trimmed) {
        toast.error("Texto da narração está vazio");
        return null;
      }

      const settingsHash = voiceSettings
        ? `s${voiceSettings.stability ?? ""}|sb${voiceSettings.similarity_boost ?? ""}|st${voiceSettings.style ?? ""}|sp${voiceSettings.speed ?? ""}`
        : "default";
      const textHash = hashTexto(`${voiceId}|${language}|${settingsHash}|${trimmed}`);
      const cached = narracoesCache.get(key);
      if (cached && cached.texto_hash === textHash && (cached.audio_base64 || cached.audio_url)) {
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
              voice_nome: vozNome(voiceId),
              language,
              ...(voiceSettings ? { voice_settings: voiceSettings } : {}),
              ...contexto,
              ...(persist
                ? {
                    save: true,
                    roteiro_id: persist.roteiro_id,
                    cena_index: persist.cena_index,
                    texto_hash: textHash,
                  }
                : {}),
            },
          },
        );
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (!data?.audio_base64) throw new Error("Resposta sem áudio");

        const entry: NarracaoCache = {
          audio_base64: data.audio_base64,
          audio_url: data.saved?.audio_url,
          mime_type: data.mime_type || "audio/mpeg",
          voice_id: data.voice_id || voiceId,
          voice_nome: vozNome(voiceId),
          texto_hash: textHash,
          saved_id: data.saved?.id,
          storage_path: data.saved?.storage_path,
        };
        narracoesCache.set(key, entry);
        if (data.saved?.id) {
          setSavedCount((c) => c + 1);
          toast.success(`Narração gerada (${(data.language || language).toUpperCase()}) e salva`);
        } else {
          toast.success(`Narração gerada (${(data.language || language).toUpperCase()})`);
        }
        return entry;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao gerar narração";
        logger.error("[useNarracao] erro:", e);
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

    const src = data.audio_base64
      ? `data:${data.mime_type};base64,${data.audio_base64}`
      : data.audio_url;
    if (!src) return;

    const audio = new Audio(src);
    audioRef.current = audio;
    setPlayingFor(key);
    audio.onended = () => setPlayingFor(null);
    audio.onerror = () => {
      toast.error("Falha ao reproduzir áudio");
      setPlayingFor(null);
    };
    audio.play().catch((err) => {
      logger.error("[useNarracao] play error:", err);
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
    const href = data.audio_base64
      ? `data:${data.mime_type};base64,${data.audio_base64}`
      : data.audio_url;
    if (!href) {
      toast.error("Áudio indisponível para download");
      return;
    }
    const link = document.createElement("a");
    link.href = href;
    link.download = filename.endsWith(".mp3") ? filename : `${filename}.mp3`;
    if (!data.audio_base64) link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const excluirSalva = useCallback(async (key: string) => {
    const entry = narracoesCache.get(key);
    if (!entry?.saved_id) {
      narracoesCache.delete(key);
      return;
    }
    try {
      // Remove arquivo do storage
      if (entry.storage_path) {
        await supabase.storage.from("narracoes-roteirista").remove([entry.storage_path]);
      }
      const { error } = await supabase
        .from("roteirista_narracoes")
        .delete()
        .eq("id", entry.saved_id);
      if (error) throw error;
      narracoesCache.delete(key);
      setSavedCount((c) => Math.max(0, c - 1));
      toast.success("Narração removida do histórico");
    } catch (e) {
      logger.error("[useNarracao] excluir erro:", e);
      toast.error("Erro ao remover narração");
    }
  }, []);

  const gerarLote = useCallback(
    async (
      itens: Array<{ key: string; texto: string; cena_index: number; previous?: string; next?: string }>,
      voiceId: string,
      onProgress?: (done: number, total: number) => void,
      roteiroId?: string | null,
      language: "pt" | "en" | "auto" = "auto",
      options?: { signal?: AbortSignal; settingsByKey?: Record<string, VoiceSettingsOverride | undefined> },
    ): Promise<{ completed: number; total: number; cancelled: boolean; pendingFromIndex: number | null }> => {
      const total = itens.length;
      const settingsHashFor = (key: string) => {
        const vs = options?.settingsByKey?.[key];
        return vs
          ? `s${vs.stability ?? ""}|sb${vs.similarity_boost ?? ""}|st${vs.style ?? ""}|sp${vs.speed ?? ""}`
          : "default";
      };
      let done = 0;
      // Pre-conta itens já cacheados/salvos para refletir progresso real ao retomar
      for (const item of itens) {
        const textHash = hashTexto(`${voiceId}|${language}|${settingsHashFor(item.key)}|${(item.texto || "").trim()}`);
        const cached = narracoesCache.get(item.key);
        if (cached && cached.texto_hash === textHash && (cached.audio_base64 || cached.audio_url)) {
          done += 1;
        }
      }
      onProgress?.(done, total);

      for (let i = 0; i < itens.length; i++) {
        if (options?.signal?.aborted) {
          // Próxima cena pendente é a primeira sem cache válido a partir daqui
          const pending = itens.findIndex((it) => {
            const h = hashTexto(`${voiceId}|${language}|${settingsHashFor(it.key)}|${(it.texto || "").trim()}`);
            const c = narracoesCache.get(it.key);
            return !(c && c.texto_hash === h && (c.audio_base64 || c.audio_url));
          });
          return { completed: done, total, cancelled: true, pendingFromIndex: pending === -1 ? null : pending };
        }

        const item = itens[i];
        const textHash = hashTexto(`${voiceId}|${language}|${settingsHashFor(item.key)}|${(item.texto || "").trim()}`);
        const cached = narracoesCache.get(item.key);
        if (cached && cached.texto_hash === textHash && (cached.audio_base64 || cached.audio_url)) {
          // Já gerada — pula sem recontar
          continue;
        }

        const result = await gerarNarracao(
          item.key,
          item.texto,
          voiceId,
          { previous_text: item.previous, next_text: item.next },
          roteiroId ? { roteiro_id: roteiroId, cena_index: item.cena_index } : undefined,
          language,
          options?.settingsByKey?.[item.key],
        );
        if (result) {
          done += 1;
          onProgress?.(done, total);
        }
      }
      return { completed: done, total, cancelled: false, pendingFromIndex: null };
    },
    [gerarNarracao],
  );

  return {
    gerarNarracao,
    gerarLote,
    tocar,
    parar,
    baixar,
    excluirSalva,
    carregarSalvas,
    isGenerating,
    isPlaying,
    getCache,
    savedCount,
  };
}
