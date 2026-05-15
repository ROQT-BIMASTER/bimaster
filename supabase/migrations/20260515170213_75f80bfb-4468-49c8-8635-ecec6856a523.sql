ALTER TABLE public.fabrica_precos_produtos
  DROP CONSTRAINT IF EXISTS custo_base_origem_valido;

ALTER TABLE public.fabrica_precos_produtos
  ADD CONSTRAINT custo_base_origem_valido
  CHECK (
    custo_base_origem IS NULL OR custo_base_origem IN (
      'ordem_producao',
      'manual',
      'tabela_anterior',
      'custo_medio',
      'custo_origem',
      'ficha_custo'
    )
  );