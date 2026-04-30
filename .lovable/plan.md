## Objetivo
Restaurar a funcionalidade correta da Central de Trabalho sem redesenhar o frontend e mantendo o alerta/lista de tarefas sem data.

## Diagnóstico confirmado
- A RPC `get_minhas_tarefas_central` está retornando dados no navegador: resposta com `content-range: 0-325/*`.
- A preferência do usuário ficou persistida como `default_filter: "sem_data"`.
- Após isso, a Central abre filtrada em “Sem prazo” e mostra “Tudo em dia / Nenhuma tarefa encontrada”, embora existam centenas de tarefas retornadas.
- A regressão veio de mudar “sem data” para depender só de `data_prazo`, quando o comportamento esperado era alertar tarefas sem planejamento completo, especialmente sem `data_inicio_planejada`.

## Correção planejada
1. **Restaurar a regra de “sem data planejada”**
   - Centralizar a definição como: tarefa pendente sem `data_inicio_planejada` **ou** sem `data_prazo`.
   - Usar essa regra no agrupamento, KPIs, aba Hoje e filtro “Sem prazo/Sem datas”.
   - Manter tarefas com `data_prazo` aparecendo também nos grupos temporais quando aplicável, mas ainda sinalizadas se estiverem sem início planejado.

2. **Corrigir a classificação sem esconder tarefas com prazo**
   - Em `groupTarefas`, uma tarefa com prazo continua indo para Atrasadas/Hoje/Semana/Mais tarde.
   - Se faltar início planejado, ela também deve continuar sendo alertada visualmente como planejamento incompleto onde já existe badge/alerta.
   - O filtro específico “Sem prazo/Sem datas” deve listar pendentes com planejamento incompleto, não apenas `data_prazo` nulo.

3. **Sanear preferência persistida que deixou a tela “presa”**
   - Ajustar a inicialização/sincronização para que preferências antigas não façam a Central abrir em um filtro vazio sem indicar claramente o estado.
   - Preservar o filtro quando o usuário escolher manualmente, mas evitar que a tela principal pareça sem tarefas por causa de um filtro salvo automaticamente durante a regressão.

4. **Ajustar datas com `parseLocalDate` onde ainda há comparação/formatação direta**
   - Trocar `new Date(tarefa.data_prazo)` remanescente nos pontos críticos da Central por `parseLocalDate`, mantendo o padrão do projeto para timezone `America/Sao_Paulo`.

5. **Validar no navegador**
   - Abrir `/dashboard/projetos/central`.
   - Conferir aba Hoje: KPIs e “Para focar agora”.
   - Conferir aba Minhas tarefas: lista, filtro Todos, filtro Sem prazo/Sem datas, ordenação agrupada.
   - Confirmar que as tarefas voltaram a aparecer e que o alerta de “sem data” permanece visível.