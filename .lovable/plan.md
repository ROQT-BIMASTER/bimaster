## Objetivo

Na lista de "Minhas tarefas" da Central de Trabalho, hoje cada linha só mostra o **nome do projeto** (ex.: "Institucional | Ruby Rose"). O usuário não consegue saber a qual **seção** dentro do projeto aquela tarefa pertence (Briefing, Desenvolvimento, Aprovação, etc.). Vamos adicionar essa informação para orientar melhor.

## O que muda visualmente

Em cada linha da tabela, a coluna da direita passa a exibir o caminho:

```text
Seção · Projeto
Ex.: Briefing · Institucional | Ruby Rose
```

- A **seção** aparece em destaque sutil (cor mais forte que o projeto), funcionando como uma "trilha de navegação" curta.
- O **projeto** continua aparecendo logo após, separado por um ponto médio (`·`), como hoje.
- Se a tarefa não tiver seção (raro, mas possível em projetos antigos), mostramos apenas o projeto, como já é hoje — sem quebrar nada.
- Em telas estreitas (mobile/tablet), continuamos escondendo essa coluna como já fazemos hoje. Em telas largas, a largura máxima cresce um pouco para caber o caminho `Seção · Projeto` sem cortar demais.

## Onde aplicar

A mesma melhoria entra em **todos os lugares** da Central de Trabalho que listam minhas tarefas com esse padrão de linha compacta:

- Lista principal de "Minhas tarefas" (Atrasadas, A fazer esta semana, A fazer mais tarde, Concluídas).
- Qualquer agrupamento secundário renderizado pelo mesmo componente de linha.

## O que NÃO muda

- Nada na lógica de filtro, ordenação, agrupamento ou permissão.
- Nada no banco de dados — o campo `secao_nome` já vem carregado pelo hook `useMinhasTarefas`.
- Nada nas demais views (Kanban, Cronograma, Calendário) — pedido é só na tabela da Central.

## Detalhes técnicos

- Arquivo: `src/components/projetos/central/MinhasTarefasContent.tsx` (componente `TarefaRow`, linhas ~70–105).
- Substituir o `<span>` que renderiza apenas `{tarefa.projeto_nome}` por um bloco que mostra `tarefa.secao_nome · tarefa.projeto_nome`, com tooltip no nome completo caso seja truncado.
- O dado já existe: o hook `useMinhasTarefas` (`src/hooks/useMinhasTarefas.ts`, linhas 20/95) já retorna `secao_nome` em cada tarefa via join `secao:secao_id(nome)`.
