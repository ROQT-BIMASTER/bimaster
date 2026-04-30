# Revisão de produção – datas em tarefas/projetos

## Contexto

A correção de hoje aplicou `parseLocalDate` em 11 arquivos do módulo Central de Trabalho/Projetos. Uma varredura adicional encontrou **3 pontos críticos próximos** que ainda usam `new Date(string)` direto sobre colunas Postgres `DATE`. No fuso `America/Sao_Paulo` (UTC-3), isso desloca a data para o dia anterior e quebra os indicadores. Confirmei via banco que `projeto_tarefas.data_conclusao`, `data_prazo`, `data_inicio` e `data_inicio_planejada` são todos `DATE`.

## Pontos a corrigir

### 1. `src/components/projetos/home/ProjetoHomeKPIs.tsx`
KPIs do dashboard de projeto individual (Pendentes/Atrasadas/Concluídas hoje/Produtividade semanal). Tem o mesmo bug que `CentralKPIs.tsx`.

- Linha 14: `new Date(t.data_prazo) < now` → atrasadas erradas.
- Linha 16: `new Date(t.data_conclusao).toDateString() === now.toDateString()` → "Concluídas hoje" zera.
- Linha 24: `new Date(t.data_conclusao)` / `new Date(t.data_prazo)` no cálculo de produtividade semanal.

### 2. `src/components/minhas-tarefas/widgets/WidgetTimelineConclusoes.tsx`
Gráfico de timeline de conclusões (widget customizável).

- Linha 49: `new Date(t.data_conclusao)` desloca pontos do gráfico um dia para trás.
- Linha 51 (`updated_at`) permanece com `new Date()` pois é `timestamptz`.

### 3. `src/components/projetos/ProjetoEquipeDashboard.tsx`
Linha 112: `format(new Date(t.data_conclusao), "dd/MM/yyyy")` em export/exibição da equipe.

## Pontos verificados e OK (sem correção)

- `useProjetoTarefas.ts` (linhas 288, 303): já grava `.split("T")[0]`.
- `HojeTab.tsx:99`, `MinhasTarefasContent.tsx:533/725/749`, `MinhasTarefaDetail.tsx:88`: gravam `new Date().toISOString()` em coluna DATE; Postgres trunca o timestamp, então o dia salvo é o **dia UTC corrente**. Em SP às 21h–23h59 isso pode salvar o dia seguinte, mas é o comportamento atual de produção e está fora do escopo "tarefas + pontos próximos" desta revisão. Marcado como follow-up futuro.

## Mudanças (todas frontend, sem migração)

```text
ProjetoHomeKPIs.tsx
  - import parseLocalDate
  - atrasadas: parseLocalDate(t.data_prazo)! < now
  - concluidasHoje: isSameDay(parseLocalDate(t.data_conclusao)!, now)
  - semana: ref = parseLocalDate(t.data_conclusao ?? t.data_prazo)

WidgetTimelineConclusoes.tsx
  - import parseLocalDate
  - linha 49: referenceDate = parseLocalDate(t.data_conclusao)

ProjetoEquipeDashboard.tsx
  - import parseLocalDate
  - linha 112: format(parseLocalDate(t.data_conclusao)!, "dd/MM/yyyy")
```

## Validação

1. **Build/typecheck** automático após edição.
2. **Browser nas telas-chave** com viewport 1366x768:
   - `/dashboard/projetos/central` (aba Hoje + KPIs gerais) – confirmar "Concluídas hoje" exibindo as 26 tarefas.
   - `/dashboard/projetos/central` aba Resumo Semanal.
   - Abrir um projeto ativo e validar `ProjetoHomeKPIs` mostrando concluídas hoje > 0.
   - Adicionar widget Timeline de Conclusões em dashboard customizável e conferir o pico no dia de hoje.
   - Aba Equipe de um projeto – conferir formato de data de conclusão correto.
3. **Screenshot** de cada tela para registro.

## Não-objetivos

- Não tocar em Financeiro, Fluxo de Caixa, Trade, Marketing, DRE, Cobrança nesta passada (existem ~50 ocorrências adicionais; ficam para auditoria completa em outra rodada se solicitado).
- Não alterar o comportamento de gravação (`new Date().toISOString()` em colunas DATE) — comportamento de produção atual preservado.
