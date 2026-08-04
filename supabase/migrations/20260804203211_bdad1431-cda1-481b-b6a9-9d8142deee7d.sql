-- Alinhar regra do produto TONICO (HB451) com a linha BAUNILHA
UPDATE fabrica_markup_overrides
SET tipo_markup='percentual', valor_markup=300, tabela_base_id=NULL, updated_at=now()
WHERE produto_id='1a389106-9866-4af0-ac3f-bc4dba7a9817' AND tabela_id='dc8534bc-1191-4c26-85eb-fcc38f7712f3';

UPDATE fabrica_markup_overrides
SET tipo_markup='multiplicador', valor_markup=1.7, tabela_base_id=NULL, updated_at=now()
WHERE produto_id='1a389106-9866-4af0-ac3f-bc4dba7a9817' AND tabela_id='2339bcd5-058c-4a8b-8a2a-bd312d97256f';

UPDATE fabrica_markup_overrides
SET tipo_markup='percentual', valor_markup=30, tabela_base_id='4f131fd4-b24f-413a-a955-d0bc52f02cce', updated_at=now()
WHERE produto_id='1a389106-9866-4af0-ac3f-bc4dba7a9817' AND tabela_id='65a352da-05b5-4c09-bf4a-9f099f92470c';
