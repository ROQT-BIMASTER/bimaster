# Padronização: fotos no Kanban e aprovação em lote para todos os projetos

Dois recursos hoje restritos ao fluxo China passam a valer para qualquer projeto, reutilizando os componentes e regras já existentes.

## 1. Fotos nos cards do Kanban

Situação atual verificada: o card do Kanban de projetos já exibe imagem quando a tarefa tem produto vinculado (`produto_foto_url`, vindo da RPC `get_projeto_tarefas_v2`). Tarefas sem produto — a maioria fora do fluxo China — ficam sem imagem, mesmo tendo arquivos anexados.

Decisão adotada: a miniatura passa a vir do **primeiro anexo de imagem da tarefa**.

- O Kanban já carrega, por card, um resumo de arquivos (`useTarefasAnexos`) que reúne anexos da tarefa e documentos China vinculados, já classificados como imagem/PDF/outros, com bucket e caminho.
- O card usa esse resumo para exibir a primeira imagem, no mesmo formato visual já usado hoje (bloco superior, proporção 16:9, cantos arredondados).
- Havendo mais de uma imagem, exibe a primeira e indica a quantidade adicional (mesmo comportamento de contagem já existente no resumo de anexos).
- Sem imagem: nada é renderizado, layout inalterado.
- Carregamento preguiçoso (só ao entrar na área visível) e cache de URLs assinadas já existentes, para não gerar rajada de requisições ao rolar o quadro.

Reuso: o componente de miniatura do fluxo China (`ItemThumb`) e seu hook de URL assinada são generalizados para aceitar o bucket de origem (`projeto-anexos` ou `china-documentos`), mantendo o comportamento atual da China intacto.

## 2. Aprovação em lote pela Central de Aprovações

A aprovação em lote sai do checklist e passa a existir na Central de Aprovações (visão pessoal e visão por projeto), valendo para itens de qualquer origem.

- Modo de seleção no quadro: caixa de seleção nos cards, "selecionar todos" por coluna e contador de selecionados.
- Só ficam elegíveis os itens em andamento em que o usuário é o responsável atual — as regras de permissão continuam sendo validadas no servidor, item a item.
- Barra de ação em lote com: Aprovar, Reprovar e Devolver para revisão, campo de parecer e **confirmação de senha obrigatória** (step-up), conforme definido.
- Resultado por item: sucesso/falha individual, com resumo ao final (ex.: "8 aprovados, 1 sem permissão"). Itens que falharem permanecem selecionados para nova tentativa.
- Atualização imediata: o quadro reflete as mudanças assim que a operação retorna, e as telas relacionadas (Kanban de tarefas, listas, dashboards de aprovações, contadores da Central) são revalidadas automaticamente.
- Trilha de auditoria: cada item aprovado registra autor, decisão, parecer, data/hora e método de confirmação, igual ao padrão já usado na homologação China.

O fluxo de aprovação em lote do checklist China permanece exatamente como está, sem regressão.

## Detalhes técnicos

- **Miniaturas**: generalizar `src/components/china/inbox/ItemThumb.tsx` e `src/hooks/useChinaDocThumbnail.ts` com parâmetro `bucket` (padrão `china-documentos`); manter a assinatura atual como wrapper. Consumir `TarefaArquivosResumo` (`useTarefasAnexos`) no `TarefaCard` de `ProjetoKanbanView.tsx`, escolhendo o primeiro item com `familia === "imagem"`. Reaproveitar `thumbUrlCache` para as URLs assinadas.
- **Lote na Central**: nova RPC `rpc_avancar_itens_aprovacao_lote(p_item_ids uuid[], p_decisao, p_comentario, p_step_up_token)` — valida o token uma única vez com `validate_step_up_token`, itera reaproveitando a lógica de `rpc_avancar_item_aprovacao`, grava `aprovacao_kanban_audit` por item e devolve o resultado individual (`ok`/motivo). `SECURITY DEFINER`, com `GRANT EXECUTE` apenas para `authenticated`.
- **Frontend**: novo hook `useAvancarItensLote` em `useKanbanAprovacoes.ts` (invalidando `kanban-aprovacoes`, tarefas do projeto e contadores) e novo diálogo `AprovacaoLoteCentralDialog` em `src/components/projetos/aprovacoes/`, seguindo o layout e a ergonomia já corrigidos em `AprovacaoLoteDialog` (cabeçalho/rodapé fixos, corpo rolável, filtros por coluna/pipeline/projeto). Step-up via `requestStepUpWithPassword` com novo escopo `aprovacoes.lote`.
- **Testes**: teste de renderização da miniatura no card (com e sem anexo de imagem) e teste do fluxo em lote (seleção, senha, sucesso parcial, invalidação de cache).
- Bump de `APP_VERSION` e entrada no changelog em `ApiDocumentation.tsx`.
