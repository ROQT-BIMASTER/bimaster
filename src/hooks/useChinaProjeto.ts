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

/** Fetch China submission linked to a project */
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
      const { data: sub } = await supabase
        .from("china_produto_submissoes" as any)
        .select("id, produto_codigo, produto_nome")
        .eq("id", (data as any).submissao_id)
        .single();
      return sub as { id: string; produto_codigo: string; produto_nome: string } | null;
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
            titulo: `${t.pt} ${t.cn}`,
            status: "pendente",
            prioridade: "media",
            ordem: i,
            criador_id: user.id,
          });
        });
      }

      if (tarefasToInsert.length > 0) {
        await supabase.from("projeto_tarefas" as any).insert(tarefasToInsert);
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
      toast.success("Projeto de desenvolvimento criado! 开发项目已创建！");
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar projeto: " + err.message);
    },
  });
}
