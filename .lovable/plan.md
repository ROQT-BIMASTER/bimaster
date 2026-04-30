
# Central de Trabalho — clareza sobre "minhas tarefas"

## Diagnóstico

Hoje a aba **Tarefas** mistura, sem distinção visual, três situações diferentes:

1. Tarefas em que o usuário é **Responsável** (dono — precisa executar).
2. Tarefas em que o usuário é **Colaborador** (foi adicionado para acompanhar/contribuir).
3. Tarefas em que o usuário é **Criador** mas não é responsável (já existe a aba **Delegadas**, porém o usuário raramente percebe que ela é o lugar dessas).

O hook `useMinhasTarefas` já traz o campo `papel: "responsavel" | "colaborador"`, mas **nenhuma parte da UI usa essa informação** — nem badge, nem filtro, nem agrupamento. Resultado: o usuário olha a lista e pergunta "isso é minha tarefa mesmo, ou só estou de espectador?".

A aba **Hoje** e os KPIs herdam o mesmo problema (somam os dois papéis sem distinguir).

## Objetivo

Em uma olhada, o usuário precisa saber:
- **Quais tarefas ele precisa entregar** (responsável)
- **Quais ele só acompanha** (colaborador)
- **Quais delegou para outra pessoa** (já existe na aba Delegadas, só falta reforçar o caminho)

Sem inventar tela nova, sem mexer em dados/permissões.

## O que muda na UI

### 1. Renomear a aba "Tarefas" para "Minhas tarefas"
Reforça posse. A aba atual é genérica demais. Continua com a mesma rota e filtros.

### 2. Sub-filtro "Meu papel" dentro da aba Minhas tarefas
Novo `Select` ao lado dos filtros existentes (Prazo / Prioridade / Projeto):

- **Todas** (padrão — comportamento atual)
- **Sou responsável** (papel = responsavel)
- **Sou colaborador** (papel = colaborador)

Persiste em `default_role` nas preferências da Central (mesmo padrão de `default_filter`/`default_priority`).

### 3. Badge de papel na linha da tarefa
No `ListRow` (e equivalente no `MinhasTarefasBoard` e `MinhasTarefasCalendar`), adicionar um badge discreto à esquerda do título quando `papel === "colaborador"`:

```
[👥 Colaborando]  Título da tarefa · Seção · Projeto
```

Quando `papel === "responsavel"` **não mostra badge** (é o caso default — evita poluição visual). Tooltip no badge: "Você foi adicionado como colaborador. O responsável é {nome}".

### 4. Contador no KPI "Para hoje" e "Pendentes"
Os cards de KPI já existentes ganham uma linha secundária discreta:

```
Para hoje
12
└─ 8 suas · 4 colaborando
```

Apenas texto pequeno em `text-muted-foreground`, sem novo card. Se todos forem do mesmo papel, omite a linha.

### 5. Reforçar caminho para "Delegadas"
Quando o usuário usa o filtro "Sou colaborador" e o resultado fica vazio, o empty state de "Tudo em dia" ganha um link extra:

> "Procurando tarefas que você delegou? **Veja a aba Delegadas →**"

### 6. Banner de orientação one-time
Primeira vez que o usuário abre a aba Minhas tarefas após o deploy, mostra um banner dispensável (`localStorage` flag `central:papel-banner-dismissed`) explicando os três papéis em uma linha cada. Não é modal, é um `Card` com `X` para fechar.

## Onde mexer (técnico)

| Arquivo | Mudança |
|---|---|
| `src/pages/CentralTrabalho.tsx` | Label da `TabsTrigger` "tarefas" → "Minhas tarefas". Breadcrumb idem. |
| `src/components/projetos/central/MinhasTarefasContent.tsx` | Novo state `filterRole`, novo `Select`, aplicação no `useMemo` `filtered`, persistência em prefs, badge no `ListRow`, link extra no empty state, banner one-time. |
| `src/components/projetos/central/CentralKPIs.tsx` | Calcular split `responsavel`/`colaborador` em `metrics` e renderizar sub-linha nos cards "Para hoje" e "Pendentes". |
| `src/components/minhas-tarefas/MinhasTarefasBoard.tsx` e `MinhasTarefasCalendar.tsx` | Mesmo badge "Colaborando" no card. |
| `src/lib/centralUrlParams.ts` | Adicionar `normalizeRole` (`all` \| `responsavel` \| `colaborador`) + entrada `role` no sanitizer. |
| `src/hooks/useCentralPreferences.ts` (e tipo da row) | Novo campo `default_role` (string, default `'all'`). |
| Migration leve | `ALTER TABLE central_preferences ADD COLUMN IF NOT EXISTS default_role text NOT NULL DEFAULT 'all';` |
| `src/components/erp/ApiDocumentation.tsx` + `src/lib/version.ts` | Bump `APP_VERSION` para `3.4.50` e changelog: "Central de Trabalho: distinção visual entre tarefas onde sou Responsável vs Colaborador". |

## Fora de escopo

- Não muda RLS, não muda quem vê o quê.
- Não mexe em "Delegadas" (já está bem).
- Não mexe na lógica de notificações da Inbox.
- Não cria nova tabela nem nova aba.

## Critério de aceite

1. Abrindo a aba **Minhas tarefas**, vejo um `Select` "Meu papel" com 3 opções e o badge "Colaborando" só aparece nas tarefas onde sou colaborador.
2. Filtro "Sou responsável" esconde tarefas onde sou apenas colaborador, e vice-versa.
3. KPI "Para hoje" mostra "X suas · Y colaborando" quando há mistura.
4. Recarregando a página, o filtro escolhido é restaurado das preferências.
5. Empty state com filtro "colaborador" oferece link para a aba Delegadas.
6. Banner explicativo aparece uma vez e fica oculto após dispensa.
