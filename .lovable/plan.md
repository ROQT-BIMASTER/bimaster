

# Dashboard Administrativo — Produtos Acabados

## O que muda
Adicionar uma seção de **dashboard administrativo** no topo da página de Produtos Acabados, entre o header e os KPIs existentes. Inspirado no estilo da imagem de referência (cards com indicadores e listas rápidas), com foco em **revisões solicitadas pela Diretoria** e visão gerencial.

## Estrutura do Dashboard Admin

### Linha 1: KPIs de Revisão (4 cards compactos)
- **Revisões Pendentes** — contagem de fichas com `status = 'revisao_solicitada'` ou `'pendente'`
- **Em Análise** — fichas com `status = 'em_revisao'`
- **Aprovadas** — fichas aprovadas
- **Reprovadas/Devolvidas** — fichas reprovadas

Cada card com ícone, número grande e cor temática (vermelho para pendentes, amarelo para análise, verde para aprovadas).

### Linha 2: Painel de Revisões Solicitadas (gatilho rápido)
Card com lista das **últimas revisões solicitadas pela Diretoria**, mostrando:
- Nome do produto, código
- Data da solicitação
- Status atual (badge)
- Botão de ação rápida → abre direto a ficha de custos do produto

Máximo 5 itens visíveis, com link "Ver todas" → `/dashboard/fabrica/revisao-fichas`.

### Linha 3: Alertas Rápidos (card lateral)
Card compacto com:
- Produtos com **aumento de custo** nos últimos 30 dias
- Produtos **sem ficha de custos** configurada

## Implementação

### Arquivos a modificar
- `src/pages/FabricaProdutosAcabados.tsx` — adicionar seção do dashboard admin entre header e KPIs existentes, usando dados já carregados (`revisoes`, `fichasConfig`, `alertasAumento`) + nova query para revisões recentes com nome do produto

### Queries adicionais
- Buscar revisões pendentes/solicitadas com join no nome do produto para exibir na lista de gatilho rápido

### Sem alteração de banco
- Todos os dados necessários já existem nas tabelas `fabrica_ficha_custo_revisoes` e `fabrica_produto_custos_config`

