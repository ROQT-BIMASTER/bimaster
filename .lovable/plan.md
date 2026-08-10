# Filtro por Vendedor: aplicar em toda a tela de Inteligência Municipal

## O que está acontecendo

Ao selecionar um vendedor, apenas a tabela de municípios responde. O restante da tela continua mostrando os números de todos os 5.571 municípios, o que dá a impressão de que o filtro não funcionou.

Verificado na base:
- A consulta da tabela (`fn_get_municipios_intelligence`) já recebe e aplica o parâmetro de vendedor.
- A consulta dos indicadores/gráfico de cobertura (`fn_get_municipios_kpis`) **não possui** parâmetro de vendedor — por isso "Total de municípios", "Municípios atendidos", "Taxa de penetração", "Densidade média", "PIB total filtrado" e a rosca "Cobertura Comercial Municipal" não mudam.
- A consulta do card Top 10 Oportunidades também não recebe vendedor (por definição são municípios sem clientes, então nenhum vendedor pode ser atribuído).

## O que será feito

1. **Indicadores e gráfico de cobertura passam a respeitar o vendedor**
   Adicionar o parâmetro de vendedor à consulta de indicadores, com a mesma regra usada na tabela: considerar apenas municípios que possuem ao menos um cliente daquele vendedor. Todos os KPIs, o gráfico de rosca e o bloco "Potencial Inexplorado" passam a refletir a seleção.

2. **Indicação visual do escopo**
   Quando um vendedor estiver selecionado, o cabeçalho dos indicadores mostra que os números estão restritos à carteira daquele vendedor.

3. **Top 10 Oportunidades**
   Mantido sem o filtro de vendedor (municípios sem clientes não têm vendedor), já sinalizado no próprio card com a nota explicativa existente. Não haverá mudança de comportamento aqui.

4. **Validação**
   Conferir, para um vendedor com carteira grande e outro pequeno, que o total de municípios dos indicadores bate com o total de linhas da tabela filtrada, e que a soma dos status da rosca fecha com esse total.

## Detalhes técnicos

- Migration recriando `public.fn_get_municipios_kpis` com o novo parâmetro `p_vendedor text DEFAULT NULL`, aplicando o mesmo predicado `EXISTS` sobre clientes agrupados por município e vendedor (comparação com `TRIM(vendedor)`, idêntico ao usado em `fn_get_municipios_intelligence` e na lista do combobox `fn_get_municipios_vendedores`). Assinatura mantida compatível (parâmetro opcional no fim), `SECURITY DEFINER` e grants preservados.
- `src/hooks/useMunicipiosIntelligence.ts`: a query de KPIs passa a usar `rpcParamsVend` e a incluir `filters.vendedor` na chave de cache.
- `src/components/comercial/municipios/MunicipiosKPICards.tsx` (e o card de cobertura correspondente): receber o vendedor selecionado apenas para exibir o rótulo de escopo.
- Bump de `APP_VERSION` com entrada no changelog.
