import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { TEMPLATES } from "@/components/projetos/NovoProjetoDialog";

const TAREFAS_POR_SECAO: Record<string, { pt: string; cn: string }[]> = {
  "Criação / Identidade": [
    { pt: "Definir identidade visual do produto", cn: "定义产品视觉标识" },
    { pt: "Criar conceito de marca para o produto", cn: "创建产品品牌概念" },
  ],
  "Desenvolvimento de Produtos": [
    { pt: "Analisar ficha técnica da China", cn: "分析中国技术表" },
    { pt: "Validar fórmula e composição", cn: "验证配方和成分" },
  ],
  "Desenvolvimento de Embalagem": [
    { pt: "Aprovar desenhos técnicos (facas)", cn: "批准技术图纸（刀版）" },
    { pt: "Validar embalagem primária", cn: "验证一级包装" },
    { pt: "Definir caixa display e master", cn: "定义展示盒和主箱" },
  ],
  "Informações dos Produtos (Briefing)": [
    { pt: "Preencher briefing do produto", cn: "填写产品简报" },
    { pt: "Definir público-alvo e posicionamento", cn: "定义目标受众和定位" },
  ],
  "Assuntos Regulatórios": [
    { pt: "Validar documentação regulatória", cn: "验证监管文件" },
    { pt: "Conferir fórmula com ANVISA", cn: "与ANVISA核实配方" },
    { pt: "Solicitar registro/notificação", cn: "申请注册/通知" },
  ],
  "Criação / Artes": [
    { pt: "Criar arte final do rótulo", cn: "创建标签终稿" },
    { pt: "Criar arte da caixa display", cn: "创建展示盒设计" },
    { pt: "Criar materiais de comunicação", cn: "创建宣传材料" },
  ],
};

/** Fetch linked projects for a China submission */
export function useChinaProjetosVinculados(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["china-projetos-vinculados", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data: links } = await supabase
        .from("china_submissao_projetos" as any)
        .select("*")
        .eq("submissao_id", submissaoId);
      if (!links || links.length === 0) return [];

      const projetoIds = (links as any[]).map((l) => l.projeto_id);
      const { data: projetos } = await supabase
        .from("projetos")
        .select("id, nome, cor, status, created_at")
        .in("id", projetoIds);

      // For each project, count tasks
      const results = await Promise.all(
        (projetos || []).map(async (p) => {
          const { count: total } = await supabase
            .from("projeto_tarefas" as any)
            .select("id", { count: "exact", head: true })
            .eq("projeto_id", p.id);
          const { count: concluidas } = await supabase
            .from("projeto_tarefas" as any)
            .select("id", { count: "exact", head: true })
            .eq("projeto_id", p.id)
            .eq("status", "concluida");
          return { ...p, total_tarefas: total || 0, tarefas_concluidas: concluidas || 0 };
        })
      );
      return results;
    },
  });
}

/** Fetch China submission linked to a project (expanded with status + docs count) */
export interface ChinaVinculo {
  id: string;
  produto_codigo: string;
  produto_nome: string;
  status: string;
  total_docs: number;
  docs_aprovados: number;
  created_at: string;
}

export function useProjetoChinaVinculo(projetoId: string | undefined) {
  return useQuery({
    queryKey: ["projeto-china-vinculo", projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_submissao_projetos" as any)
        .select("submissao_id")
        .eq("projeto_id", projetoId)
        .maybeSingle();
      if (!data) return null;
      const submissaoId = (data as any).submissao_id;

      const [subRes, docsRes] = await Promise.all([
        supabase
          .from("china_produto_submissoes" as any)
          .select("id, produto_codigo, produto_nome, status, created_at")
          .eq("id", submissaoId)
          .single(),
        supabase
          .from("china_produto_documentos" as any)
          .select("id, status")
          .eq("submissao_id", submissaoId),
      ]);

      if (!subRes.data) return null;
      const docs = (docsRes.data || []) as any[];
      return {
        ...(subRes.data as any),
        total_docs: docs.length,
        docs_aprovados: docs.filter((d) => d.status === "aprovado").length,
      } as ChinaVinculo;
    },
  });
}

/** Fetch checklist progress from linked project tasks for a China submission */
export function useChinaProjetoChecklist(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["china-projeto-checklist", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      // Get linked project IDs
      const { data: links } = await supabase
        .from("china_submissao_projetos" as any)
        .select("projeto_id")
        .eq("submissao_id", submissaoId);
      if (!links || links.length === 0) return [];

      const projetoId = (links as any[])[0].projeto_id;

      // Get sections and tasks
      const [secoesRes, tarefasRes] = await Promise.all([
        supabase
          .from("projeto_secoes")
          .select("id, nome, ordem")
          .eq("projeto_id", projetoId)
          .order("ordem"),
        supabase
          .from("projeto_tarefas" as any)
          .select("id, titulo, status, secao_id, ordem")
          .eq("projeto_id", projetoId)
          .is("parent_id", null)
          .order("ordem"),
      ]);

      const secoes = (secoesRes.data || []) as any[];
      const tarefas = (tarefasRes.data || []) as any[];

      return secoes.map((s) => {
        const secTarefas = tarefas.filter((t: any) => t.secao_id === s.id);
        return {
          secao_id: s.id,
          secao_nome: s.nome,
          total: secTarefas.length,
          concluidas: secTarefas.filter((t: any) => t.status === "concluida").length,
          tarefas: secTarefas.map((t: any) => ({
            id: t.id,
            titulo: t.titulo,
            status: t.status,
          })),
        };
      });
    },
  });
}

/** Fetch unified timeline merging China submission events and project activities */
export function useChinaTimeline(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["china-timeline", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      // Get linked project
      const { data: links } = await supabase
        .from("china_submissao_projetos" as any)
        .select("projeto_id")
        .eq("submissao_id", submissaoId);

      const projetoId = links && links.length > 0 ? (links as any[])[0].projeto_id : null;

      // Fetch submission details for timeline
      const { data: sub } = await supabase
        .from("china_produto_submissoes" as any)
        .select("created_at, status, updated_at, arte_final_enviada_em")
        .eq("id", submissaoId)
        .single();

      // Fetch docs timeline
      const { data: docs } = await supabase
        .from("china_produto_documentos" as any)
        .select("id, tipo_documento, status, created_at, nome_arquivo")
        .eq("submissao_id", submissaoId)
        .order("created_at", { ascending: false });

      // Fetch project activities if linked
      let projectActivities: any[] = [];
      if (projetoId) {
        const { data: atividades } = await supabase
          .from("projeto_atividades")
          .select("id, tipo, descricao, created_at, metadata")
          .eq("projeto_id", projetoId)
          .order("created_at", { ascending: false })
          .limit(30);
        projectActivities = (atividades || []).map((a) => ({
          id: a.id,
          type: "projeto" as const,
          description: a.descricao || a.tipo,
          timestamp: a.created_at,
          metadata: a.metadata,
        }));
      }

      // Build timeline entries
      const entries: Array<{
        id: string;
        type: "china" | "projeto" | "documento";
        description: string;
        timestamp: string;
        metadata?: any;
      }> = [];

      // Submission creation
      if (sub) {
        entries.push({
          id: `sub-created-${submissaoId}`,
          type: "china",
          description: "Submissão criada 提交已创建",
          timestamp: (sub as any).created_at,
        });
        if ((sub as any).arte_final_enviada_em) {
          entries.push({
            id: `sub-arte-${submissaoId}`,
            type: "china",
            description: "Arte final enviada 终稿已发送",
            timestamp: (sub as any).arte_final_enviada_em,
          });
        }
      }

      // Documents
      (docs || []).forEach((d: any) => {
        entries.push({
          id: `doc-${d.id}`,
          type: "documento",
          description: `${d.nome_arquivo || d.tipo_documento}: ${d.status}`,
          timestamp: d.created_at,
        });
      });

      // Project activities
      entries.push(...projectActivities);

      // Sort by timestamp descending
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return entries.slice(0, 50);
    },
  });
}

/** Create a development project from a China submission */
export function useCriarProjetoChina() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissao: { id: string; produto_codigo: string; produto_nome: string }) => {
      if (!user) throw new Error("Não autenticado");

      const nome = `${submissao.produto_codigo} - ${submissao.produto_nome}`;
      const cor = "#6366f1";

      // 1. Create project
      const { data: projeto, error: projError } = await supabase
        .from("projetos")
        .insert({ nome, descricao: `Projeto de desenvolvimento do produto China: ${submissao.produto_codigo}`, cor, icone: "📦", criador_id: user.id })
        .select()
        .single();
      if (projError) throw projError;

      // 2. Add creator as coordinator
      await supabase
        .from("projeto_membros")
        .insert({ projeto_id: projeto.id, user_id: user.id, papel: "coordenador" });

      // 3. Create sections from template
      const sections = TEMPLATES.desenvolvimento_produto.secoes;
      const { data: secoesCriadas, error: secError } = await supabase
        .from("projeto_secoes")
        .insert(sections.map((nome, i) => ({ projeto_id: projeto.id, nome, ordem: i })))
        .select();
      if (secError) throw secError;

      // 4. Create auto tasks per section
      const secoesMap = new Map((secoesCriadas as any[]).map((s) => [s.nome, s.id]));

      const tarefasToInsert: any[] = [];
      for (const [secaoNome, tarefas] of Object.entries(TAREFAS_POR_SECAO)) {
        const secaoId = secoesMap.get(secaoNome);
        if (!secaoId) continue;
        tarefas.forEach((t, i) => {
          tarefasToInsert.push({
            projeto_id: projeto.id,
            secao_id: secaoId,
            titulo: t.pt,
            status: "pendente",
            prioridade: "media",
            ordem: i,
            criador_id: user.id,
          });
        });
      }

      if (tarefasToInsert.length > 0) {
        const { data: tarefasCriadas } = await supabase
          .from("projeto_tarefas" as any)
          .insert(tarefasToInsert)
          .select("id");

        // 4b. Link all tasks to the China product (produto_id = submissao.id for traceability)
        if (tarefasCriadas && tarefasCriadas.length > 0) {
          const links = (tarefasCriadas as any[]).map((t) => ({
            tarefa_id: t.id,
            produto_id: submissao.id,
            created_by: user.id,
          }));
          await supabase.from("projeto_tarefa_produtos" as any).insert(links);
        }
      }

      // 5. Create link
      await supabase
        .from("china_submissao_projetos" as any)
        .insert({ submissao_id: submissao.id, projeto_id: projeto.id, created_by: user.id } as any);

      return projeto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["china-projetos-vinculados"] });
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      toast.success("Projeto de desenvolvimento criado!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar projeto: " + err.message);
    },
  });
}
