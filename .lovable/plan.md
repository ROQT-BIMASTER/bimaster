## Problema

Tarefas em que o usuário é responsável **não aparecem na Central de Trabalho > Hoje** quando não têm `data_prazo` definida. O hook `useMinhasTarefas` traz essas tarefas corretamente, mas o `HojeTab` filtra só `atrasadas + hoje` (`data_prazo` no passado ou hoje), descartando tudo que está sem data.

## Mudanças

### 1. `src/components/projetos/central/HojeTab.tsx` — incluir bloco "Sem prazo"

- Adicionar um terceiro grupo `semData = pendentes.filter(t => !t.data_prazo)`.
- Renderizar uma seção **"Sem prazo definido · N"** abaixo de Atrasadas/Hoje, sempre visível quando houver itens, mesmo se Atrasadas e Hoje estiverem vazios (a tela não pode mais mostrar "Tudo em dia!" se existir tarefa sem prazo).
- Ajustar a lógica do `EmptyState`: só mostra "Tudo em dia!" quando `atrasadas + hoje + semData === 0`.
- Ajustar o limite `MAX_ITEMS` para distribuir entre os três blocos (atrasadas → hoje → sem prazo) e o botão "Ver mais X tarefas" considerar o total dos três.

### 2. Indicador visual piscando para "sem prazo"

- Em `TarefaRow`, quando `!tarefa.data_prazo` e a tarefa estiver pendente, exibir um badge `Sem prazo` com:
  - Ícone `CalendarOff` (ou `AlertCircle`) em cor `amber/warning`
  - Animação `animate-pulse` (Tailwind nativo) no badge
  - Tooltip "Defina datas de início e/ou prazo para priorizar esta tarefa"
- Substitui o atual `tarefa.data_prazo && <span>...` por um ramo com o badge piscando para o caso sem data.

### 3. `CentralKPIs.tsx` — novo KPI "Sem prazo"

- Adicionar contador `semPrazo = pendentes.filter(t => !t.data_prazo).length` no `useMemo`.
- Na aba `hoje`, substituir o KPI "Concluídas hoje" pelo KPI **"Sem prazo"** (variant `warning`, ícone `CalendarOff`, animação `animate-pulse` no card quando > 0), com `onClick` que leva para `tarefas` com filtro `sem_data`.
  - Mover "Concluídas hoje" para a posição final apenas na aba `tarefas` (já existe lá).
- Na aba `tarefas`, adicionar o mesmo KPI "Sem prazo" (substituindo "Pendentes" que já é redundante com a soma dos outros).

### 4. `MinhasTarefasContent.tsx` — garantir que o filtro `sem_data` da URL funcione

- Verificar e, se necessário, adicionar suporte ao filtro `?filter=sem_data` para o `onClick` do novo KPI cair direto no grupo correto. (`groupTarefas` já produz a chave `sem_data`.)

### 5. Visual do badge piscando

```tsx
// dentro de TarefaRow, branch sem data
<Badge variant="outline" className="border-amber-500/60 text-amber-600 dark:text-amber-400 gap-1 animate-pulse text-[10px] h-5 px-1.5">
  <CalendarOff className="h-3 w-3" />
  Sem prazo
</Badge>
```

## Não faz parte

- Não alteramos RLS nem o hook `useMinhasTarefas` (já está correto: traz todas as tarefas onde o usuário é responsável **ou** colaborador, com ou sem prazo).
- Não mexemos em outros módulos da Central (Inbox, Resumo Semanal).