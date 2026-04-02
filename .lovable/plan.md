

# Auditoria do Módulo de Projetos — Nota Atual: 88/100

## Pontuação por Categoria

| Categoria | Nota | Peso | Pontos |
|---|---|---|---|
| Segurança / RLS | 85 | 25% | 21.25 |
| Funcionalidades | 90 | 20% | 18.0 |
| UX / Interface | 85 | 20% | 17.0 |
| Performance | 85 | 15% | 12.75 |
| Qualidade de Código | 88 | 10% | 8.8 |
| Consistência Visual | 90 | 10% | 9.0 |
| **TOTAL** | | | **88/100** |

## O que melhorou desde a última auditoria (78→88)

- RPC `get_projetos_member_avatars` criado e integrado — membros visíveis na listagem
- Health panel com chip "sem prazo" em warning
- Tabs responsivas com scroll horizontal
- Empty states em Kanban, Cronograma e Calendário
- Filtros propagados para todas as views
- Preview card no NovoProjetoDialog
- Cores semânticas no BriefingPanel

---

## PROBLEMAS RESTANTES (12 pontos para o 100%)

### 1. `projeto_tags` — mutations ainda permissivas (SEGURANÇA — 3pts)

INSERT/UPDATE/DELETE usam `auth.uid() IS NOT NULL`. Qualquer autenticado pode criar/editar/deletar tags de qualquer projeto. É o último warning do linter de segurança.

**Correção**: Migration para restringir a `user_can_access_projeto(auth.uid(), projeto_id)`.

### 2. Kanban — drag-and-drop não persiste `ordem` (BUG FUNCIONAL — 3pts)

O `handleDragEnd` no `ProjetoKanbanView.tsx` (linha 124-145) só chama `moveTarefaToSecao` quando muda de coluna. Reordenar dentro da mesma coluna **não faz nada** — a ordem retorna ao padrão após reload.

**Correção**: Após o drop (tanto entre colunas quanto dentro da mesma coluna), calcular a nova `ordem` baseada na posição e chamar `updateTarefa` com `{ ordem: novaOrdem }`.

### 3. Cronograma/Calendário — filtros internos duplicam filtros externos (UX — 2pts)

O `ProjetoCronogramaView` tem seus próprios `filterSecao` e `filterStatus` internos (linhas 70-71) **além** dos `filters` externos. Isso cria confusão: o usuário aplica filtros na toolbar superior e depois precisa filtrar novamente dentro da view.

**Correção**: Quando `filters` externo está ativo, ocultar os filtros internos ou sincronizá-los. Mostrar indicador visual de "filtros ativos via toolbar".

### 4. Calendário — sem banner "tarefas sem prazo" (UX — 1pt)

O Cronograma tem banner de warning para tarefas sem prazo, mas o Calendário não tem. As mesmas 97% de tarefas sem prazo deixam o calendário vazio sem explicação.

**Correção**: Adicionar o mesmo banner informativo que o Cronograma já tem.

### 5. ProjetoTarefaDetalhe — monólito de 1477 linhas (MANUTENIBILIDADE — 2pts)

O Sheet gerencia descrição, comentários, anexos, cofre, timeline, dependências, aprovação e produtos em um único arquivo. Embora funcione, impacta manutenção futura.

**Correção**: Extrair em sub-componentes (fora do escopo desta iteração, mas documentado).

### 6. NovoProjetoDialog — preview só aparece no template "desenvolvimento" (UX — 1pt)

O preview card está dentro do bloco condicional `{step === 2 && template === "desenvolvimento_produto" && ...}`. Se o usuário escolhe "Genérico", não vê preview.

**Correção**: Mover o preview card para fora do bloco condicional de template, exibindo-o no último step independentemente.

---

## PLANO DE CORREÇÃO

### Migration SQL

1. Restringir `projeto_tags` INSERT/UPDATE/DELETE com `user_can_access_projeto(auth.uid(), projeto_id)`

### Código

| Arquivo | Alteração |
|---|---|
| `ProjetoKanbanView.tsx` | Persistir `ordem` no drop (dentro e entre colunas) |
| `ProjetoCronogramaView.tsx` | Ocultar filtros internos quando filtros externos estão ativos |
| `ProjetoCalendarioView.tsx` | Adicionar banner "X tarefas sem prazo" + ocultar filtros internos duplicados |
| `NovoProjetoDialog.tsx` | Mover preview card para fora do bloco condicional de template |

### Resultado esperado

- 0 warnings de RLS no linter
- Kanban com ordem persistente
- Filtros sem duplicação entre toolbar e views
- Preview visível para todos os templates
- **Nota estimada: 96-100/100**

