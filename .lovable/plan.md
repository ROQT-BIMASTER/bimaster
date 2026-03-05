

## Plano: Briefing por Tarefa + Painel de Briefings

### Mudança Arquitetural

Atualmente o briefing está vinculado à **seção**. O novo modelo vincula o briefing à **tarefa** (cada tarefa que representa um produto tem seu próprio briefing). Além disso, será criada uma nova aba **"Briefings"** no projeto para análise centralizada, cumprimentos e aprovações.

---

### 1. Migração do Banco de Dados

- Adicionar coluna `tarefa_id` (nullable, FK → `projeto_tarefas`) em `projeto_briefings`
- Tornar `secao_id` nullable (manter compatibilidade)
- Adicionar colunas de aprovação em `projeto_briefings`:
  - `status` (text, default `'pendente'` — `pendente`, `em_analise`, `aprovado`, `rejeitado`)
  - `aprovado_por` (uuid, nullable)
  - `aprovado_em` (timestamptz, nullable)
  - `observacao_aprovacao` (text, nullable)
- RLS policies para as novas colunas

### 2. Refatorar `useProjetoBriefing.ts`

- Aceitar `tarefa_id` ao invés de (ou além de) `secao_id`
- `saveBriefing` recebe `tarefa_id` como parâmetro
- Novo hook `useProjetoBriefings(projetoId)` para buscar **todos** os briefings do projeto (para o painel)
  - Join com `projeto_tarefas` para pegar nome da tarefa e produto vinculado
  - Join com `fabrica_produtos` para pegar foto, código, nome do produto

### 3. Mover Briefing para a Tarefa

- **`ProjetoTarefaRow.tsx`**: Adicionar ícone de briefing (FileSpreadsheet) na linha da tarefa quando `tem_briefing = true`
- **`ProjetoTarefaDetalhe.tsx`**: Adicionar aba/seção de Briefing dentro do detalhe da tarefa:
  - Botão para importar briefing (abre `BriefingImportDialog`)
  - Visualização do briefing importado (`BriefingView`)
  - Botão "Criar Tarefas" (subtarefas) a partir do briefing
- **`BriefingImportDialog.tsx`**: Refatorar para aceitar `tarefa_id` ao invés de `secao_id`
- **`ProjetoSecao.tsx`**: Remover lógica de briefing do nível de seção

### 4. Nova Aba "Briefings" no Projeto

Criar componente `ProjetoBriefingPanel.tsx` — uma visão centralizada de todos os briefings do projeto:

**Layout**:
- **Cards/Tabela** listando todos os briefings, cada um mostrando:
  - **Produto**: foto thumbnail + nome + código (do produto vinculado à tarefa)
  - **Tarefa**: título da tarefa associada
  - **Status**: badge colorido (Pendente / Em Análise / Aprovado / Rejeitado)
  - **Data de importação**
  - **Responsabilidade**: resumo dos códigos (D, C, R, E, COMP)
  - **Ações**: Aprovar, Rejeitar, Ver detalhes

**KPIs no topo**:
- Total de briefings
- Aprovados / Pendentes / Rejeitados
- % de cumprimento

**Filtros**:
- Por status, por seção, por responsabilidade

**Detalhe expandível**: Clicar num briefing expande para ver a tabela completa de campos

### 5. Integrar no `ProjetoHeader` e `ProjetoDetalhe`

- Adicionar tab `"briefings"` com ícone `FileSpreadsheet` no `ProjetoHeader.tsx`
- Renderizar `ProjetoBriefingPanel` no `ProjetoDetalhe.tsx` quando `activeTab === "briefings"`

---

### Arquivos a Criar/Editar

| Ação | Arquivo |
|------|---------|
| Migração SQL | Alterar `projeto_briefings` (add `tarefa_id`, `status`, `aprovado_por`, `aprovado_em`, `observacao_aprovacao`) |
| Criar | `src/components/projetos/ProjetoBriefingPanel.tsx` |
| Criar | `src/hooks/useProjetoBriefings.ts` (hook para painel — lista todos do projeto) |
| Editar | `src/hooks/useProjetoBriefing.ts` — suportar `tarefa_id` |
| Editar | `src/components/projetos/BriefingImportDialog.tsx` — aceitar `tarefa_id` |
| Editar | `src/components/projetos/BriefingView.tsx` — funcionar no contexto da tarefa |
| Editar | `src/components/projetos/ProjetoTarefaDetalhe.tsx` — integrar briefing |
| Editar | `src/components/projetos/ProjetoSecao.tsx` — remover briefing do nível de seção |
| Editar | `src/components/projetos/ProjetoHeader.tsx` — adicionar tab Briefings |
| Editar | `src/pages/ProjetoDetalhe.tsx` — renderizar `ProjetoBriefingPanel` |

