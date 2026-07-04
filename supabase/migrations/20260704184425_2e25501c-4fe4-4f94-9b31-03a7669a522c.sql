
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS cnpj_digits text
  GENERATED ALWAYS AS (regexp_replace(coalesce(cnpj::text, ''), '[^0-9]', '', 'g')) STORED;

ALTER TABLE public.fabrica_fornecedores
  ADD COLUMN IF NOT EXISTS cnpj_digits text
  GENERATED ALWAYS AS (regexp_replace(coalesce(cnpj::text, ''), '[^0-9]', '', 'g')) STORED;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cnpj_digits text
  GENERATED ALWAYS AS (regexp_replace(coalesce(cnpj::text, ''), '[^0-9]', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_empresas_cnpj_digits             ON public.empresas (cnpj_digits);
CREATE INDEX IF NOT EXISTS idx_fabrica_fornecedores_cnpj_digits ON public.fabrica_fornecedores (cnpj_digits);
CREATE INDEX IF NOT EXISTS idx_clientes_cnpj_digits             ON public.clientes (cnpj_digits);

WITH result_map (empresa_par, cnpj_digits) AS (
  VALUES
    ('1',  '34547433000183'),
    ('2',  '46274342000109'),
    ('3',  '45143429000176'),
    ('4',  '43111402000176'),
    ('5',  '34744207000192'),
    ('6',  '34547433000264'),
    ('7',  '25000257000174'),
    ('8',  '55715202000101'),
    ('9',  '56006392000150'),
    ('10', '56044883000196'),
    ('11', '56062642000170')
)
UPDATE public.empresas e
   SET codigo_erp = m.empresa_par,
       updated_at = now()
  FROM result_map m
 WHERE e.cnpj_digits = m.cnpj_digits
   AND (e.codigo_erp IS DISTINCT FROM m.empresa_par);
