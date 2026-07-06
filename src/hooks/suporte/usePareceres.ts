import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SuportePareceRow {
  id: string;
  ticket_id: string;
  autor_id: string;
  fila_id: string | null;
  visibilidade: "interno" | "externo";
  tipo: "parecer" | "orientacao" | "analise_tecnica" | "encaminhamento" | "conclusao";
  titulo: string | null;
  conteudo: string;
  acao_tomada: string | null;
  plano_correcao: string | null;
  prazo_estimado: string | null;
  status_departamento: "em_analise" | "concluido" | "encaminhado";
  encaminhado_para_fila_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuporteParecerAnexo {
  id: string;
  parecer_id: string;
  ticket_id: string;
  storage_path: string;
  nome: string;
  mime: string | null;
  tamanho: number | null;
  uploaded_by: string;
  created_at: string;
}

export interface SuporteTicketDeptoRow {
  id: string;
  ticket_id: string;
  fila_id: string | null;
  entrou_em: string;
  saiu_em: string | null;
  status: "ativo" | "concluido" | "transferido";
  ultimo_parecer_id: string | null;
  acao_resumo: string | null;
}

export function useTicketPareceres(ticketId: string | null | undefined) {
  return useQuery({
    queryKey: ["suporte-pareceres", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("suporte_pareceres")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SuportePareceRow[];
    },
  });
}

export function useTicketParecerAnexos(ticketId: string | null | undefined) {
  return useQuery({
    queryKey: ["suporte-parecer-anexos", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("suporte_parecer_anexos")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SuporteParecerAnexo[];
    },
  });
}

export function useTicketTrilhaDepartamentos(ticketId: string | null | undefined) {
  return useQuery({
    queryKey: ["suporte-ticket-departamentos", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("suporte_ticket_departamentos")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("entrou_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SuporteTicketDeptoRow[];
    },
  });
}

export interface CriarParecerInput {
  ticket_id: string;
  visibilidade: "interno" | "externo";
  tipo: SuportePareceRow["tipo"];
  titulo?: string | null;
  conteudo: string;
  acao_tomada?: string | null;
  plano_correcao?: string | null;
  prazo_estimado?: string | null;
  encaminhar_para_fila_id?: string | null;
  anexos?: File[];
}

async function uploadAnexos(
  parecerId: string,
  ticketId: string,
  files: File[],
  userId: string,
) {
  const rows: Omit<SuporteParecerAnexo, "id" | "created_at">[] = [];
  for (const file of files) {
    if (file.size > 20 * 1024 * 1024) {
      throw new Error(`Arquivo "${file.name}" excede 20 MB`);
    }
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${userId}/${ticketId}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("suporte-pareceres")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) throw upErr;
    rows.push({
      parecer_id: parecerId,
      ticket_id: ticketId,
      storage_path: path,
      nome: file.name,
      mime: file.type || null,
      tamanho: file.size,
      uploaded_by: userId,
    });
  }
  if (rows.length) {
    const { error } = await (supabase as any)
      .from("suporte_parecer_anexos")
      .insert(rows);
    if (error) throw error;
  }
}

export function useCriarParecer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarParecerInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Não autenticado");

      const { data, error } = await (supabase as any).rpc(
        "rpc_suporte_criar_parecer",
        {
          p_ticket_id: input.ticket_id,
          p_visibilidade: input.visibilidade,
          p_tipo: input.tipo,
          p_titulo: input.titulo ?? null,
          p_conteudo: input.conteudo,
          p_acao_tomada: input.acao_tomada ?? null,
          p_plano_correcao: input.plano_correcao ?? null,
          p_prazo_estimado: input.prazo_estimado ?? null,
          p_encaminhar_para_fila_id: input.encaminhar_para_fila_id ?? null,
        },
      );
      if (error) throw error;
      const parecerId = data as string;

      if (input.anexos && input.anexos.length > 0) {
        await uploadAnexos(parecerId, input.ticket_id, input.anexos, uid);
      }
      return parecerId;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["suporte-pareceres", vars.ticket_id] });
      qc.invalidateQueries({ queryKey: ["suporte-parecer-anexos", vars.ticket_id] });
      qc.invalidateQueries({ queryKey: ["suporte-ticket-departamentos", vars.ticket_id] });
      qc.invalidateQueries({ queryKey: ["suporte-chamados"] });
      toast.success("Parecer registrado");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Erro ao registrar parecer");
    },
  });
}

export async function baixarAnexoParecer(anexo: SuporteParecerAnexo) {
  const { data, error } = await supabase.storage
    .from("suporte-pareceres")
    .download(anexo.storage_path);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = anexo.nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
