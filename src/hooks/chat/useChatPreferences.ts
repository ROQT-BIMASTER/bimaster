/**
 * useChatPreferences — preferências do usuário para sons e horário silencioso.
 *
 * Linha em `user_chat_preferences` é criada sob demanda (defaults: tudo ON).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ChatPreferences {
  user_id: string;
  som_mensagens: boolean;
  som_mencoes: boolean;
  som_urgentes: boolean;
  horario_silencioso_inicio: string | null; // "HH:MM:SS"
  horario_silencioso_fim: string | null;
}

const DEFAULTS: Omit<ChatPreferences, "user_id"> = {
  som_mensagens: true,
  som_mencoes: true,
  som_urgentes: true,
  horario_silencioso_inicio: null,
  horario_silencioso_fim: null,
};

export function useChatPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["chat-preferences", user?.id];

  const query = useQuery<ChatPreferences | null>({
    queryKey,
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_chat_preferences" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data as unknown as ChatPreferences) ?? { user_id: user!.id, ...DEFAULTS };
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<Omit<ChatPreferences, "user_id">>) => {
      if (!user?.id) throw new Error("não autenticado");
      const current = query.data ?? { user_id: user.id, ...DEFAULTS };
      const next = { ...current, ...patch, user_id: user.id };
      const { error } = await supabase
        .from("user_chat_preferences" as any)
        .upsert(next as any, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Preferências atualizadas");
    },
    onError: (e: any) => toast.error("Erro: " + (e?.message ?? "")),
  });

  return { preferences: query.data, isLoading: query.isLoading, save };
}

/** Retorna true se agora está dentro do horário silencioso configurado. */
export function isInQuietHours(prefs: ChatPreferences | null | undefined): boolean {
  if (!prefs?.horario_silencioso_inicio || !prefs?.horario_silencioso_fim) return false;
  const now = new Date();
  // Avalia em America/Sao_Paulo
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = fmt.format(now).split(":").map(Number);
  const cur = h * 60 + m;
  const [ih, im] = prefs.horario_silencioso_inicio.split(":").map(Number);
  const [fh, fm] = prefs.horario_silencioso_fim.split(":").map(Number);
  const ini = ih * 60 + im;
  const fim = fh * 60 + fm;
  if (ini === fim) return false;
  if (ini < fim) return cur >= ini && cur < fim;
  // janela atravessa meia-noite
  return cur >= ini || cur < fim;
}
