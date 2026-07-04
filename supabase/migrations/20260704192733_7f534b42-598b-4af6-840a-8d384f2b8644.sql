ALTER TABLE public.fabrica_fornecedores
  ADD COLUMN IF NOT EXISTS prazo_pagamento_padrao integer;

COMMENT ON COLUMN public.fabrica_fornecedores.prazo_pagamento_padrao IS
  'Prazo padrão de pagamento em dias. Espelha Prazo_For do ERP Result. Banco/agência/PIX permanecem master no Huugs.';