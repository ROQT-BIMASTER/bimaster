# Top 10 Oportunidades sem dados — investigação e correção

## O que já foi verificado

- Existem **2.171 municípios virgens** (sem clientes, sem prospects, sem leads), sendo **2.170 com PIB > 0** — ou seja, o card deveria listar 10 itens. O dado existe.
- O card só é alimentado pela consulta de oportunidades; se essa consulta falhar, a tela mostra exatamente a mesma mensagem de "nenhuma oportunidade encontrada" que mostraria se o resultado fosse vazio. Hoje não há como distinguir erro de vazio.
- A causa exata da falha **ainda não está confirmada** (a consulta usada pelo card não pôde ser executada com o papel de leitura do editor). As hipóteses são: tempo de resposta acima do limite (a rotina é pesada: cruza os 42 mil clientes, prospects e leads a cada chamada) ou erro silencioso na chamada.

## Plano

### 1. Confirmar a causa (primeiro passo)
Medir o tempo e o retorno da consulta de oportunidades diretamente no banco, com os mesmos parâmetros que a tela usa (status "virgem", 10 itens). Isso define se é estouro de tempo ou erro de chamada.

### 2. Consulta dedicada e leve para o card
Criar uma rotina exclusiva de oportunidades que:
- retorna apenas municípios sem clientes, sem prospects e sem leads;
- ordena por **PIB total** (numérico), alinhando com o texto do card ("municípios com maior PIB");
- devolve só os campos que o card usa (nome, UF, microrregião, população, PIB, PIB per capita);
- não calcula vendedores, receita, ticket nem contagem total — que é o que hoje pesa na rotina completa.

O card passa a consumir essa rotina, mantendo os filtros de UF, região, microrregião e busca. O filtro de vendedor deixa de ser aplicado aqui (município virgem, por definição, não tem vendedor — aplicá-lo zera o resultado).

### 3. Estado de erro visível
- O card passa a diferenciar três estados: carregando, erro (com mensagem e botão "Tentar novamente") e vazio real.
- Remover a refiltragem no navegador (hoje o card refiltra o que já veio filtrado), evitando esconder linhas válidas.

### 4. Validação
- Conferir que o card lista 10 municípios com os filtros limpos.
- Conferir que ao filtrar por UF o card acompanha o filtro.
- Conferir que uma falha de rede/backend exibe a mensagem de erro em vez de "nenhuma oportunidade".

## Detalhes técnicos

- Nova função `public.fn_get_municipios_oportunidades(p_uf, p_regiao, p_microrregiao_id, p_search, p_limit)`, `SECURITY DEFINER`, `search_path` vazio, `GRANT EXECUTE` para `authenticated` e `service_role`, sem exposição a `anon`.
- Ordenação por `pib_mil_reais DESC` numérico (a rotina atual ordena por texto com `LPAD`, o que é frágil).
- `src/hooks/useMunicipiosIntelligence.ts`: a query `municipios-top-opportunities` passa a chamar a nova função e expõe `topOpportunitiesError` / `refetchTopOpportunities`.
- `src/components/comercial/municipios/MunicipiosOpportunityCard.tsx`: novos estados de erro/vazio, sem `filter` local.
- `APP_VERSION` bump + entrada no changelog em `src/pages/admin/ApiDocumentation.tsx`.
