import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeChat } from "@/lib/ai/invokeChat";
import { toast } from "sonner";

export interface BriefingMsg {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  sources?: Array<{ tipo: string; id: string; label: string }>;
  proposals?: Array<{ campos: Record<string, string>; titulo?: string }>;
  created_at: string;
}

export interface Briefing {
  id: string;
  tipo: "marketing" | "criativo" | "produto" | "trade";
  titulo: string;
  status: string;
  payload: Record<string, string>;
  completude: number;
  template_id: string | null;
  projeto_id: string | null;
}

export interface TemplateSection {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
}

export function useBriefingChat(briefingId: string | undefined) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [messages, setMessages] = useState<BriefingMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const carregar = useCallback(async () => {
    if (!briefingId) return;
    setLoading(true);
    try {
      const { data: b, error } = await supabase
        .from("briefings")
        .select("*, briefing_templates(secoes)")
        .eq("id", briefingId)
        .maybeSingle();
      if (error) throw error;
      if (!b) {
        toast.error("Briefing não encontrado");
        return;
      }
      setBriefing({
        id: b.id,
        tipo: b.tipo as Briefing["tipo"],
        titulo: b.titulo,
        status: b.status,
        payload: (b.payload as Record<string, string>) ?? {},
        completude: b.completude ?? 0,
        template_id: b.template_id,
        projeto_id: b.projeto_id,
      });
      setSections(((b as any).briefing_templates?.secoes ?? []) as TemplateSection[]);

      const { data: msgs } = await supabase
        .from("briefing_mensagens")
        .select("*")
        .eq("briefing_id", briefingId)
        .order("created_at", { ascending: true });
      setMessages((msgs ?? []) as unknown as BriefingMsg[]);
    } finally {
      setLoading(false);
    }
  }, [briefingId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const enviar = useCallback(
    async (texto: string) => {
      if (!briefingId || !texto.trim()) return;
      setSending(true);
      // otimista
      const optimistic: BriefingMsg = {
        id: `tmp-${Date.now()}`,
        role: "user",
        content: texto,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      const { data, error } = await invokeChat<{
        reply: string;
        sources: BriefingMsg["sources"];
        patches: BriefingMsg["proposals"];
        briefing: { id: string; titulo: string; payload: Record<string, string> };
      }>("briefing-agent", { briefing_id: briefingId, user_message: texto });

      setSending(false);

      if (error || !data) {
        toast.error(error?.userMessage ?? "Erro ao enviar mensagem");
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        return;
      }

      // Atualiza canvas se a edge devolveu novo payload
      if (data.briefing) {
        setBriefing((prev) =>
          prev
            ? { ...prev, titulo: data.briefing.titulo, payload: data.briefing.payload }
            : prev,
        );
      }
      // Recarrega histórico do banco (verdade)
      await carregar();
    },
    [briefingId, carregar],
  );

  return { briefing, sections, messages, loading, sending, enviar, recarregar: carregar };
}
