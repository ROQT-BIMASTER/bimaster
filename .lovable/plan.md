

## Plano: Categorização de Documentos no Cofre + Fluxo de Validação Final

### Contexto
O sistema de Projetos é uma etapa **pré-fábrica**. Quando uma tarefa tem um produto vinculado e documentos são enviados ao Cofre, eles devem ser categorizados. Ao finalizar uma tarefa, o usuário poderá "Enviar para Validação Final" — um fluxo de conferência dos documentos oficiais. Somente após aprovação final, a Fábrica visualiza esses documentos.

---

### 1. Migração de Banco de Dados

**Tabela `projeto_tarefa_validacoes`** (novo):
- `id`, `tarefa_id`, `produto_id`, `status` (pendente, aprovada, rejeitada), `solicitado_por`, `aprovado_por`, `aprovado_em`, `observacoes`, `created_at`
- Registra cada solicitação de validação final

**Coluna em `fabrica_revisao_documentos`**:
- Adicionar `origem_projeto_tarefa_id` (uuid, nullable, FK para `projeto_tarefas`) — rastreia de qual tarefa o documento veio
- Adicionar `visivel_fabrica` (boolean, default false) — só fica `true` após aprovação final

**Coluna em `projeto_tarefas`**:
- Adicionar `validacao_status` (text, nullable) — valores: `null`, `pendente_validacao`, `validada`, `rejeitada`

---

### 2. Categorização Automática ao Enviar ao Cofre

Quando um produto está vinculado à tarefa, o dialog "Enviar ao Cofre" já tem categorias (`COFRE_CATEGORIAS`). Melhorias:

- Expandir as categorias para incluir tipos mais relevantes ao contexto pré-fábrica: `briefing`, `arte_final`, `rotulo`, `ficha_tecnica`, `laudo`, `certificado`, `orcamento`, `outro`
- Tornar a seleção de categoria **obrigatória** (por anexo, não global)
- Mostrar um resumo visual dos documentos já no Cofre para aquele produto, agrupados por categoria
- Marcar cada documento inserido com `origem_projeto_tarefa_id` e `visivel_fabrica = false`

**Arquivo**: `src/components/projetos/ProjetoTarefaDetalhe.tsx` — refatorar o dialog do Cofre
**Arquivo**: `src/hooks/useProjetoTarefaDetalhe.ts` — atualizar `sendToCofre` para incluir os novos campos

---

### 3. Botão "Enviar para Validação Final" na Tarefa

Na barra superior do `ProjetoTarefaDetalhe`, ao lado de "Marcar como concluída":

- Botão **"Enviar para Artes Final"** (verde, como na imagem de referência)
- Só aparece quando: tarefa tem `produto_id` vinculado E `status === 'concluida'` ou ao marcar como concluída
- Ao clicar, abre um Dialog de confirmação mostrando:
  - Lista dos documentos no Cofre vinculados a essa tarefa (agrupados por categoria)
  - Checklist de conferência (todos os documentos obrigatórios estão presentes?)
  - Campo de observações
- Ao confirmar: cria registro em `projeto_tarefa_validacoes`, atualiza `validacao_status` da tarefa para `pendente_validacao`

**Arquivo**: `src/components/projetos/ProjetoTarefaDetalhe.tsx` — adicionar botão e dialog
**Arquivo**: novo `src/components/projetos/ValidacaoFinalDialog.tsx`

---

### 4. Painel de Aprovação Final

- Na tarefa, mostrar badge com status da validação (`Aguardando Validação`, `Validada`, `Rejeitada`)
- Quem tem permissão pode aprovar/rejeitar:
  - **Aprovar**: marca `visivel_fabrica = true` em todos os documentos do cofre vinculados àquela tarefa → Fábrica passa a enxergar
  - **Rejeitar**: volta status para `rejeitada` com observação, documentos permanecem invisíveis

**Arquivo**: `src/components/projetos/ProjetoTarefaDetalhe.tsx`

---

### 5. Filtro de Visibilidade na Fábrica

Atualizar as queries da Fábrica que consultam `fabrica_revisao_documentos` para filtrar apenas `visivel_fabrica = true`:

- `DocumentosTab.tsx`
- `CofreFullscreenModal.tsx`
- `DocumentosCofre.tsx`

---

### Resumo de Arquivos

| Ação | Arquivo |
|------|---------|
| Migração SQL | Nova migration (3 alterações) |
| Novo componente | `ValidacaoFinalDialog.tsx` |
| Editar | `ProjetoTarefaDetalhe.tsx` (botão + badges + dialog cofre) |
| Editar | `useProjetoTarefaDetalhe.ts` (campos novos no sendToCofre) |
| Editar | `useProjetoTarefas.ts` (interface com `validacao_status`) |
| Editar | `DocumentosTab.tsx`, `CofreFullscreenModal.tsx`, `DocumentosCofre.tsx` (filtro `visivel_fabrica`) |

