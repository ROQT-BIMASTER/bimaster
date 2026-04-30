# Fix dos indicadores de tarefas concluídas (e prazos) na Central

## Causa-raiz

`projeto_tarefas.data_conclusao` e `data_prazo` são `DATE` no Postgres e chegam ao frontend como string `"2026-04-30"`.

Quando o código faz `new Date("2026-04-30")`, o JavaScript interpreta como **UTC midnight**. Em São Paulo (UTC-3), isso vira **`2026-04-29 21:00`**, ou seja, **ontem**. Resultado: `isToday(...)` retorna `false` e o KPI "Concluídas hoje" fica em 0 mesmo com 26 tarefas concluídas hoje.

Confirmado no banco: as 26 tarefas têm `status='concluida'` e `data_conclusao='2026-04-30'` corretamente. O problema é 100% no parsing de data no frontend.

Mesmo bug afeta também:
- `data_prazo` (atrasadas, hoje, semana, calendário, board, agrupamentos)
- `data_inicio_planejada`
- Qualquer comparação `< now`, `isBefore`, `isToday`, `isWithinInterval` sobre essas strings

## Solução

Criar um helper único e substituir todos os `new Date(t.data_*)` por ele. O helper trata strings `"YYYY-MM-DD"` como data **local** (sem timezone shift).

```ts
// src/lib/utils/parseLocalDate.ts
export function parseLocalDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  // "YYYY-MM-DD" → Date local (meia-noite no fuso do navegador)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s); // fallback para timestamps com hora
}
```

## Arquivos a corrigir (15 ocorrências em 13 arquivos)

**KPIs e dashboards (prioridade — é o que está visível agora):**
- `src/components/minhas-tarefas/MinhasTarefasKPIs.tsx` (l.19, 20, 24)
- `src/components/minhas-tarefas/CustomDashboardBuilder.tsx` (l.45, 48, 52)
- `src/components/projetos/central/CentralKPIs.tsx` (l.39, 43, 50)
- `src/components/projetos/central/RoleOverviewCard.tsx` (l.34, 42, 44)

**Listas e abas:**
- `src/hooks/useMinhasTarefas.ts` (l.105 — função `groupTarefas`)
- `src/components/projetos/central/HojeTab.tsx` (l.84, 85)
- `src/components/projetos/central/MinhasTarefasContent.tsx` (l.593, 601, 605)
- `src/components/projetos/central/DelegadasContent.tsx` (l.13)
- `src/components/projetos/central/ResumoSemanal.tsx` (l.112, 113, 153)

**Widgets, board e calendário:**
- `src/components/minhas-tarefas/widgets/WidgetListaProximas.tsx` (l.11)
- `src/components/minhas-tarefas/widgets/WidgetListaAtrasadas.tsx` (l.11)
- `src/components/minhas-tarefas/widgets/WidgetTimelineConclusoes.tsx` (l.49)
- `src/components/minhas-tarefas/MinhasTarefasBoard.tsx` (l.170)
- `src/components/minhas-tarefas/MinhasTarefasCalendar.tsx` (l.38, 52, 56, 67, 164)
- `src/components/minhas-tarefas/MinhasTarefaDetail.tsx` (l.63 — preencher form)

> Para `format(new Date(t.data_prazo), "dd/MM")` em widgets de listagem o impacto é cosmético (1 dia a menos), mas vou trocar por consistência.

## Validação

1. Após o fix, abrir `/dashboard/projetos/central` na aba **Hoje** e na aba **Minhas tarefas**.
2. KPI "Concluídas hoje" deve mostrar **26** (4 pais + 22 subs registradas hoje).
3. KPI "Atrasadas" deve continuar 0 (nenhuma tarefa minha vencida hoje).
4. KPI "Produtividade" continua 100% (já estava certo porque `isWithinInterval` com semana toda absorve o off-by-one).

## Memória

Adicionar regra core: **datas puras (`DATE`) do Postgres devem ser parseadas com `parseLocalDate`, nunca `new Date(string)`** — para não sofrer shift de timezone em `America/Sao_Paulo`.

## O que NÃO está incluído

- Não vou refatorar `MinhasTarefasContent.tsx` para além das 3 linhas afetadas (arquivo é grande, manter escopo cirúrgico).
- Não vou tocar em `format(new Date(...))` que renderizam datas isoladas sem comparação — a maioria já está OK porque o `format` do `date-fns` é insensível ao shift quando você só mostra dia/mês. Vou trocar somente onde aparece junto com filtros temporais.
