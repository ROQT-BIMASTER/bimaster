## Objetivo
Eliminar o acompanhamento semanal que ainda ficou visível na Central de Trabalho, mantendo os cards sem repetição e preservando o visual já ajustado.

## O que será ajustado
1. Central de Trabalho: faixa de KPIs
- Remover o card `Produtividade semanal` da aba `Tarefas` em `CentralKPIs.tsx`.
- Reorganizar a grade para manter equilíbrio visual com os demais cards sem criar espaços estranhos.

2. Central de Trabalho: conteúdo da aba Tarefas
- Remover o painel `ResumoSemanal` que hoje aparece acima da lista em `MinhasTarefasContent.tsx`.
- Limpar imports não usados ligados ao resumo semanal e ao ícone/gráfico, evitando sobras de código.

3. Dashboard personalizado de tarefas
- Revisar `CustomDashboardBuilder.tsx` para retirar o KPI/widget de produtividade semanal do ambiente de dashboard, se ele ainda estiver disponível para seleção.
- Manter apenas KPIs não repetitivos e focados em operação imediata.

4. Higienização visual e release
- Validar que a Central continue coerente com o padrão do módulo Projetos: largura total, alta densidade e sem duplicação de informação.
- Atualizar a versão do app e registrar a mudança no changelog obrigatório.

## Resultado esperado
- A Central de Trabalho deixa de mostrar métricas semanais repetidas.
- O foco volta para execução imediata: hoje, atrasadas, pendentes, concluídas hoje e notificações.
- O layout permanece alinhado com o padrão visual já aprovado.

## Detalhes técnicos
Arquivos prováveis:
- `src/components/projetos/central/CentralKPIs.tsx`
- `src/components/projetos/central/MinhasTarefasContent.tsx`
- `src/components/minhas-tarefas/CustomDashboardBuilder.tsx`
- `src/lib/version.ts`
- `src/components/erp/ApiDocumentation.tsx` (se o fluxo atual exigir registro visual de release)

Observações:
- Não vou mexer na estrutura visual aprovada; o foco é retirar apenas os blocos semanais residuais.
- Se houver qualquer outra ocorrência textual de `semana`, faço uma varredura final no módulo para evitar regressão visual.