/**
 * Catálogo de componentes/ações configuráveis no painel de Detalhe de Tarefa.
 *
 * Usado por:
 *  - `useUIPermissions("tarefa_detalhe").canView(codigo)` no `ProjetoTarefaDetalhe.tsx`
 *  - tela ADM `/dashboard/admin/visibilidade-detalhe-tarefa`
 *
 * Default = visível. Só vira invisível quando o ADM grava uma regra em
 * `ui_permissions` (role e/ou departamento) com `visivel = false`.
 */

export const TAREFA_DETALHE_TELA = "tarefa_detalhe" as const;

export interface ComponenteCatalogo {
  codigo: string;
  label: string;
  descricao?: string;
}

export interface CatalogoGrupo {
  titulo: string;
  itens: ComponenteCatalogo[];
}

export const TAREFA_DETALHE_CATALOGO: CatalogoGrupo[] = [
  {
    titulo: "Ações do cabeçalho",
    itens: [
      { codigo: "acao_marcar_concluida", label: "Marcar como concluída" },
      { codigo: "acao_chat", label: "Botão Chat" },
      { codigo: "acao_copiar_link", label: "Copiar link" },
      { codigo: "acao_foco", label: "Botão Foco (Focus Mode)" },
      { codigo: "acao_numero_processo", label: "Número do processo (PAD-XXXX)" },
    ],
  },
  {
    titulo: "Campos do corpo",
    itens: [
      { codigo: "campo_status", label: "Status" },
      { codigo: "campo_prioridade", label: "Prioridade" },
      { codigo: "campo_estagio", label: "Estágio" },
      { codigo: "campo_data_prazo", label: "Data prazo" },
      { codigo: "campo_inicio_planejado", label: "Início planejado" },
      { codigo: "campo_alertar_antes", label: "Alertar antes" },
      { codigo: "campo_risco", label: "Risco" },
      { codigo: "campo_responsavel_seguidores", label: "Responsável e Seguidores" },
      { codigo: "campo_produto", label: "Produto vinculado" },
      { codigo: "campo_processo", label: "Processo (vincular processo)" },
      { codigo: "campo_china", label: "Produto China" },
      { codigo: "campo_modulos_vinculados", label: "Módulos vinculados" },
      { codigo: "campo_mover_para", label: "Mover para seção" },
    ],
  },
  {
    titulo: "Seções",
    itens: [
      { codigo: "secao_retrabalho", label: "Retrabalho" },
      { codigo: "secao_dependencias", label: "Dependências" },
      { codigo: "secao_workflow_aprovacao", label: "Workflow de Aprovação (alçadas)" },
      { codigo: "secao_metas", label: "Marcos / Metas" },
      { codigo: "secao_anexos", label: "Anexos da tarefa" },
      { codigo: "secao_chat", label: "Chat da tarefa" },
      { codigo: "campo_observacoes", label: "Observações (Minhas Tarefas)" },
      { codigo: "acao_abrir_no_projeto", label: "Abrir no projeto (Minhas Tarefas)" },
    ],
  },
];

export const TAREFA_DETALHE_COMPONENTES: ComponenteCatalogo[] =
  TAREFA_DETALHE_CATALOGO.flatMap((g) => g.itens);
