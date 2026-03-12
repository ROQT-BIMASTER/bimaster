import { supabase } from "@/integrations/supabase/client";

export type AuditAction = 
  | "upload" 
  | "revisao" 
  | "aprovacao" 
  | "rejeicao" 
  | "publicacao_cofre" 
  | "download"
  | "versao_oficial"
  | "status_change";

export async function logDocAudit({
  documentoId,
  versaoId,
  produtoId,
  projetoId,
  acao,
  detalhes,
}: {
  documentoId?: string;
  versaoId?: string;
  produtoId?: string;
  projetoId?: string;
  acao: AuditAction;
  detalhes?: Record<string, any>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", user.id)
    .single();

  await supabase.from("produto_doc_audit_log" as any).insert({
    documento_id: documentoId || null,
    versao_id: versaoId || null,
    produto_id: produtoId || null,
    projeto_id: projetoId || null,
    acao,
    user_id: user.id,
    user_name: profile?.nome || "Usuário",
    detalhes: detalhes || {},
  } as any);
}

export const DEV_PAPEIS = [
  { value: "gestor_produto", label: "Gestor de Produto", description: "Responsável pelo produto e condução do projeto", icon: "Crown" },
  { value: "regulatorio", label: "Regulatório", description: "Validação legal e técnica do produto", icon: "Shield" },
  { value: "design", label: "Design / Arte", description: "Desenvolvimento de materiais gráficos", icon: "Palette" },
  { value: "controle_arte", label: "Controle de Arte", description: "Revisão final dos materiais gráficos", icon: "Eye" },
  { value: "admin_cofre", label: "Admin. Cofre", description: "Publica documentos oficiais no cofre", icon: "Lock" },
  { value: "diretoria", label: "Diretoria", description: "Supervisão e acompanhamento", icon: "BarChart3" },
  { value: "coordenador", label: "Coordenador", description: "Coordenador do projeto (legado)", icon: "UserCog" },
  { value: "membro", label: "Membro", description: "Membro da equipe", icon: "User" },
] as const;

export const DEV_STATUS_OPTIONS = [
  { value: "submissao_criada", label: "Submissão criada", color: "bg-slate-500" },
  { value: "em_analise", label: "Em análise", color: "bg-blue-500" },
  { value: "ajuste_solicitado", label: "Ajuste solicitado", color: "bg-amber-500" },
  { value: "documentacao_aprovada", label: "Documentação aprovada", color: "bg-emerald-500" },
  { value: "arte_em_desenvolvimento", label: "Arte em desenvolvimento", color: "bg-purple-500" },
  { value: "arte_em_revisao", label: "Arte em revisão", color: "bg-orange-500" },
  { value: "arte_aprovada", label: "Arte aprovada", color: "bg-teal-500" },
  { value: "publicado_cofre", label: "Publicado no cofre", color: "bg-indigo-500" },
  { value: "liberado_producao", label: "Liberado para produção", color: "bg-green-600" },
] as const;

// Status transitions allowed per role
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  gestor_produto: ["submissao_criada", "em_analise", "ajuste_solicitado", "arte_em_desenvolvimento"],
  regulatorio: ["documentacao_aprovada", "ajuste_solicitado"],
  design: ["arte_em_desenvolvimento", "arte_em_revisao"],
  controle_arte: ["arte_aprovada", "ajuste_solicitado"],
  admin_cofre: ["publicado_cofre", "liberado_producao"],
  coordenador: ["submissao_criada", "em_analise", "ajuste_solicitado", "documentacao_aprovada", "arte_em_desenvolvimento", "arte_em_revisao", "arte_aprovada", "publicado_cofre", "liberado_producao"],
};
