

# Auditoria Visual e de Criacao do Modulo de Projetos — Nota: 78/100

## Pontuacao por Categoria

| Categoria | Nota | Peso | Pontos |
|---|---|---|---|
| Design Visual / Polimento | 80 | 25% | 20.0 |
| UX / Fluxos de Criacao | 72 | 25% | 18.0 |
| Consistencia Visual | 82 | 20% | 16.4 |
| Responsividade | 70 | 15% | 10.5 |
| Seguranca Residual | 75 | 15% | 11.25 |
| **TOTAL** | | | **78/100** |

---

## PROBLEMAS ENCONTRADOS

### 1. Coluna "Membros" vazia na listagem de projetos (BUG VISUAL)

A pagina `Projetos.tsx` mostra a coluna MEMBROS completamente vazia para todos os projetos, apesar de existirem 19 membros em "K | Ruby Rose" e 10 em "Sazonais". O problema: a query `projetos-membros` busca `projeto_membros` mas a RLS de SELECT restringe aos membros do proprio projeto. O usuario logado (Leandro) pode nao ser membro de todos os projetos, ou a query falha silenciosamente.

**Correcao**: Verificar se o usuario logado e membro/criador. Se for admin, usar service role via RPC. Alternativamente, criar um RPC `get_projetos_with_member_count` que retorna contagem de membros sem expor dados.

### 2. `projeto_tags` — RLS permissiva NAO foi corrigida (SEGURANCA)

A migration anterior nao incluiu a correcao de `projeto_tags`. INSERT/UPDATE/DELETE usam `auth.uid() IS NOT NULL`, permitindo qualquer usuario manipular tags de qualquer projeto.

**Correcao**: Migration para restringir a `user_can_access_projeto(auth.uid(), projeto_id)`.

### 3. Hero banner sem KPIs quando nao ha tarefas com prazo (UX)

O `ProjetoHealthPanel` exibe "104 tarefas / 25 concluidas / 9 atrasadas" — bom. Porem, como 97% das tarefas nao tem prazo, o painel mostra quase todas como "sem deadline" sem destacar isso como problema. Falta um alerta visual de "saude dos dados".

**Correcao**: Adicionar chip "X sem prazo" em cor warning quando >50% das tarefas abertas nao tem `data_prazo`.

### 4. Dialog de criacao de projeto sem preview visual (UX)

O `NovoProjetoDialog` tem wizard de 2 steps, mas nao mostra preview do projeto sendo criado (como ele vai parecer na lista). O usuario escolhe cor, template, marca, mas nao ve o resultado ate criar.

**Correcao**: Adicionar preview card no step final mostrando como o projeto aparecera.

### 5. Tabs com scroll horizontal ausente em telas menores (RESPONSIVIDADE)

O `ProjetoHeader` renderiza 9 tabs + "Aprovacoes" em uma unica linha flex. Em telas < 1200px, as tabs podem quebrar ou ficar cortadas. Nao ha scroll horizontal no container de tabs.

**Correcao**: Adicionar `overflow-x-auto` com `scrollbar-hide` no container de tabs e `flex-shrink-0` em cada tab.

### 6. ProjetoTarefaDetalhe — monolito de 1477 linhas (MANUTENIBILIDADE)

O Sheet de detalhe da tarefa gerencia descricao, comentarios, anexos, cofre, timeline, dependencias, aprovacao, produtos em um unico componente. Nao e um bug visual, mas impacta a experiencia de manutencao e futuros bugs.

**Correcao**: Extrair cada tab em componente separado (TarefaDescricaoTab, TarefaComentariosTab, TarefaAnexosTab, etc).

### 7. Empty states inconsistentes entre views (UX)

`Projetos.tsx` usa `EmptyState` com icone e acao. Mas as views internas (Kanban, Cronograma, Calendario) nao tem empty states quando nao ha tarefas filtradas — mostram apenas area em branco.

**Correcao**: Adicionar empty states com mensagem contextual ("Nenhuma tarefa encontrada com esses filtros" ou "Nenhuma tarefa com prazo definido").

### 8. Briefings panel usa cores hardcoded (CONSISTENCIA)

`ProjetoBriefingPanel.tsx` define `STATUS_CONFIG` e `RESP_COLORS` com cores hardcoded como `bg-amber-500/20 text-amber-400`. Isso nao segue o design system que usa tokens semanticos.

**Correcao**: Migrar para tokens (`text-warning`, `text-success`, `text-destructive`).

### 9. Cronograma vazio para 97% das tarefas (UX DATA)

O cronograma Gantt e o calendario ficam quase vazios porque apenas 15 tarefas tem prazo. Nao ha orientacao visual para o usuario sobre por que esta vazio.

**Correcao**: Mostrar banner informativo "X tarefas sem prazo definido — defina prazos para visualizar no cronograma" com botao de acao rapida.

### 10. Kanban — drag-and-drop nao persiste ordem (BUG FUNCIONAL)

Reordenar cards dentro de uma coluna no Kanban funciona visualmente, mas o campo `ordem` nao e salvo no banco. Ao recarregar, a ordem volta ao padrao.

**Correcao**: Chamar `updateTarefa` com nova `ordem` apos drop.

---

## O QUE ESTA BEM FEITO

- Header hero com gradiente baseado na cor do projeto — premium
- Health panel com barra segmentada por risco — excelente visualizacao
- Tabs com separador visual entre "trabalho" e "gestao"
- Pill de acoes (Membros, IA, Lixeira) no hero — limpo
- Listagem de projetos com progress bar, status badge e data
- Colunas configuraveis com persistencia em localStorage
- Tour onboarding integrado com driver.js
- Filtros e ordenacao propagados para todas as views

---

## PLANO DE CORRECAO (10 itens, ordem de prioridade)

### Migration SQL

1. **Corrigir `projeto_tags`** — restringir INSERT/UPDATE/DELETE a `user_can_access_projeto`
2. **Criar RPC `get_projetos_member_avatars`** — retorna ate 6 avatares por projeto sem expor dados completos, acessivel a qualquer autenticado

### Codigo

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useProjetos.ts` | Usar RPC para buscar avatares de membros por projeto |
| `src/components/projetos/ProjetoHealthPanel.tsx` | Adicionar chip "X sem prazo" em warning |
| `src/components/projetos/ProjetoHeader.tsx` | Adicionar `overflow-x-auto` no container de tabs |
| `src/components/projetos/ProjetoKanbanView.tsx` | Empty state quando nao ha tarefas filtradas; persistir `ordem` no drop |
| `src/components/projetos/ProjetoCronogramaView.tsx` | Banner "X tarefas sem prazo" + empty state |
| `src/components/projetos/ProjetoCalendarioView.tsx` | Banner "X tarefas sem prazo" + empty state |
| `src/components/projetos/ProjetoBriefingPanel.tsx` | Migrar cores hardcoded para tokens semanticos |
| `src/components/projetos/NovoProjetoDialog.tsx` | Adicionar preview card no wizard |

### Resultado esperado

- Membros visiveis na listagem de projetos
- Tags protegidas por RLS
- Alertas visuais para dados incompletos (prazos, responsaveis)
- Tabs responsivas com scroll
- Empty states em todas as views
- **Nota estimada: 92-95/100**

