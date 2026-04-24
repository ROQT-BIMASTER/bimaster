
# v3.4.29 (PR-64) — Restaurar gráfico semanal com toggle no Central de Trabalho

## Problema identificado

O componente `ResumoSemanal` (card com KPIs **Concluídas / Produtividade / Planejadas** e o gráfico **"Conclusões por dia — semana atual vs anterior"**) está implementado em `src/components/projetos/central/ResumoSemanal.tsx`, mas **não é importado em nenhum container ativo**. O grep `rg "ResumoSemanal"` confirma que o único arquivo que menciona o nome é o próprio componente. Resultado: na tela `/dashboard/projetos/central` o card simplesmente não é montado, e o gráfico que aparecia na screenshot enviada pelo usuário corresponde a uma versão anterior.

## Solução

1. Remontar o `ResumoSemanal` no topo da aba **Lista** do `MinhasTarefasContent`, alimentando-o com a mesma lista `tarefas` já carregada via `useMinhasTarefas` (sem nova requisição).
2. Adicionar um **botão de toggle** "Ocultar resumo" / "Mostrar resumo" na barra de ações, ao lado do seletor de visualização (Lista/Quadro/Calendário/Dashboard).
3. Persistir a preferência por usuário via `user_central_preferences` (nova coluna `show_weekly_summary boolean default true`), seguindo o mesmo padrão dos demais filtros (autosave debounced + realtime sync). Isso garante que a escolha permanece após F5 e entre dispositivos.
4. Renderização condicional: o card só monta quando `show_weekly_summary = true` **e** a view atual é `list` (no Quadro/Calendário/Dashboard ele continua oculto, como já é hoje, para não competir com a visualização principal).

## Mudanças técnicas

### 1. Banco de dados — migração

Adicionar coluna `show_weekly_summary` na tabela `user_central_preferences`:

```sql
ALTER TABLE public.user_central_preferences
  ADD COLUMN IF NOT EXISTS show_weekly_summary boolean NOT NULL DEFAULT true;
```

Sem alteração de RLS (a política existente cobre todas as colunas via `user_id = auth.uid()`).

### 2. `src/hooks/useCentralPreferences.ts`

- Adicionar `show_weekly_summary: boolean` à interface `CentralPreferences` e ao objeto `DEFAULTS` (default `true`, mantendo compatibilidade — usuários existentes continuam vendo o card).
- Incluir o novo campo no `select` da query, no payload do `save` e no `saveNow`.
- Sem mudança de comportamento de cache / realtime.

### 3. `src/components/projetos/central/MinhasTarefasContent.tsx`

- Importar `ResumoSemanal`.
- Adicionar estado local `showWeeklySummary` inicializado a partir de `preferences.show_weekly_summary` (com mesmo padrão de re-hidratação dos demais filtros já existente no `useEffect` baseado em `preferences.updated_at`).
- Adicionar botão `Eye` / `EyeOff` na barra de ações (antes do `Tabs` de view), com tooltip "Ocultar resumo semanal" / "Mostrar resumo semanal" e variant `ghost` size `sm`.
- Adicionar persistência: incluir `show_weekly_summary` no `useEffect` debounced que chama `savePrefs` (segue o mesmo padrão atual de detecção de mudança).
- Renderizar `<ResumoSemanal tarefas={filtered} loading={isLoading} />` logo após a barra de filtros e antes do bloco `<div>{isLoading ? ... : view === "list" ? ...}</div>`, **somente quando**:
  - `view === "list"` (no Quadro/Calendário/Dashboard fica oculto)
  - `showWeeklySummary === true`

### 4. `src/components/projetos/central/ResumoSemanal.tsx`

- Adicionar prop opcional `onHide?: () => void`.
- Quando definida, renderizar um botão pequeno (`X` ou `EyeOff`, `h-7 w-7 ghost`) no canto superior direito do card, alinhado com o título "Resumo da semana", com tooltip "Ocultar".
- Sem mudança de cálculo, layout ou animação. O `useMemo` existente continua intocado.
- Isso dá ao usuário **dois** caminhos para esconder: o botão na action bar (toggle global) e o botão "X" dentro do próprio card (atalho contextual). Ambos disparam o mesmo handler.

### 5. `src/lib/version.ts`

- Bump `APP_VERSION` para `'3.4.29'`.
- Adicionar entrada no changelog: `v3.4.29 — Restaura gráfico "Resumo da semana" no Central de Trabalho com toggle de visibilidade persistente por usuário (PR-64).`

### 6. `src/integrations/supabase/types.ts`

- Será regenerado automaticamente pela migração para refletir a nova coluna.

## Arquivos a modificar

- `supabase/migrations/<timestamp>_add_show_weekly_summary_to_central_prefs.sql` (novo)
- `src/hooks/useCentralPreferences.ts`
- `src/components/projetos/central/MinhasTarefasContent.tsx`
- `src/components/projetos/central/ResumoSemanal.tsx`
- `src/lib/version.ts`
- `src/integrations/supabase/types.ts` (auto)

## Validação esperada

1. Ao abrir `/dashboard/projetos/central` na aba **Lista**, o card "Resumo da semana" volta a aparecer no topo, com o gráfico "Conclusões por dia" alimentado pelas tarefas reais do usuário.
2. Clicar no botão `EyeOff` na barra de ações esconde o card; clicar de novo (vira `Eye`) traz de volta.
3. Recarregar a página (F5) preserva a escolha — a preferência foi gravada em `user_central_preferences.show_weekly_summary`.
4. Trocar para Quadro/Calendário/Dashboard mantém o card oculto independentemente do toggle (comportamento intencional, sem regressão das demais views).
5. O fix anterior de flicker (v3.4.28) permanece — não há novo `invalidateQueries` introduzido pelo toggle (o `setQueryData` no `onSuccess` do `save` continua sendo o caminho usado).
