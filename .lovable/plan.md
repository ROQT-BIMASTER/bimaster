# Aplicar clientes: gravar apenas o delta

A rotina que aplica os clientes na base mestre continua estourando o tempo limite quando chamada pela rotina de recepção do conector (teto de ~8s), porque a etapa de atualização regrava as ~42 mil linhas a cada execução — inclusive as idênticas, já que os carimbos de sincronização são sempre reescritos.

Confirmado na definição atual da rotina: o bloco de atualização não tem nenhuma condição, então toda linha vira escrita de tabela e de todos os índices.

## Mudança

Recriar `public.aplicar_clientes_rp_no_master()` idêntica à atual (mesma montagem de origem, mesmas colunas, mesmos preenchimentos padrão), acrescentando apenas uma condição no final do bloco de atualização: só grava quando algum campo de dados realmente mudou.

- Comparação por tupla `IS DISTINCT FROM` entre a linha atual e a linha vinda da carga, cobrindo: documento, nome, nome abreviado, e-mail, telefone, celular, endereço, bairro, cidade, UF, CEP, datas/valores de última e maior compra, vendedor, equipe, supervisor, classificação, limite de crédito, status de bloqueio, município e código IBGE.
- Os carimbos `sincronizado_em`/`updated_at` ficam fora da comparação (senão a condição nunca filtraria nada), mas continuam sendo atualizados nas linhas que mudam.
- Condição extra para `data_cadastro`, respeitando o preenchimento padrão atual.

Efeito colateral esperado e correto: o contador de "atualizados" passa a refletir só as linhas realmente alteradas. O frescor exibido no selo da tela Inteligência Municipal vem da visão de status (baseada na área de staging), que continua sendo atualizada a cada carga.

Segurança inalterada: `SECURITY DEFINER`, `search_path` fixo, revogação para o público e permissão de execução apenas para o papel de serviço.

## Validação

- Executar a rotina e confirmar retorno em poucos segundos com contagens baixas.
- Conferir que o total de clientes e o total com município resolvido não mudaram.

## Detalhes técnicos

- Migration única: `CREATE OR REPLACE FUNCTION public.aplicar_clientes_rp_no_master()` com o `ON CONFLICT (codigo) DO UPDATE SET ... WHERE (c....) IS DISTINCT FROM (EXCLUDED....) OR c.data_cadastro IS DISTINCT FROM COALESCE(EXCLUDED.data_cadastro, c.data_cadastro)`, seguida de `REVOKE ALL ON FUNCTION ... FROM PUBLIC` e `GRANT EXECUTE ... TO service_role`.
- Nenhuma alteração em rotinas de borda ou no frontend.
