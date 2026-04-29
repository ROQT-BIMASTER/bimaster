import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export interface BriefingTemplate {
  id: string;
  nome: string;
  tema: string;
  objetivo: string | null;
  publico_alvo: string | null;
  tom: string;
  duracao_total: number;
  numero_cenas: number;
  formato: "9:16" | "16:9" | "1:1";
  paleta_cores: string[];
  created_at: string;
  updated_at: string;
}

export type BriefingTemplateInput = Omit<
  BriefingTemplate,
  "id" | "created_at" | "updated_at"
>;

export function useBriefingTemplates() {
  const [templates, setTemplates] = useState<BriefingTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("roteirista_briefing_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTemplates((data as unknown as BriefingTemplate[]) || []);
    } catch (e) {
      logger.error("[useBriefingTemplates] erro:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = useCallback(
    async (input: BriefingTemplateInput) => {
      if (!input.nome.trim()) {
        toast.error("Informe um nome para o template");
        return null;
      }
      setSaving(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          toast.error("Sessão expirada");
          return null;
        }
        const { data, error } = await supabase
          .from("roteirista_briefing_templates")
          .insert({
            user_id: userData.user.id,
            nome: input.nome.trim(),
            tema: input.tema,
            objetivo: input.objetivo,
            publico_alvo: input.publico_alvo,
            tom: input.tom,
            duracao_total: input.duracao_total,
            numero_cenas: input.numero_cenas,
            formato: input.formato,
            paleta_cores: input.paleta_cores,
          })
          .select()
          .single();
        if (error) throw error;
        toast.success(`Template "${input.nome}" salvo`);
        await carregar();
        return data as unknown as BriefingTemplate;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao salvar template";
        toast.error(msg);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [carregar],
  );

  const excluir = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from("roteirista_briefing_templates")
          .delete()
          .eq("id", id);
        if (error) throw error;
        toast.success("Template excluído");
        await carregar();
      } catch (e) {
        toast.error("Erro ao excluir template");
      }
    },
    [carregar],
  );

  return { templates, loading, saving, salvar, excluir, carregar };
}
