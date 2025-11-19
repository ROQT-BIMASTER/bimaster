-- Limpar regras existentes e inserir conjunto completo padronizado
DELETE FROM fabrica_regras_fiscais;

-- ============================================
-- 1. OPERAÇÕES NACIONAIS (5.xxx → 1.xxx)
-- ============================================

INSERT INTO fabrica_regras_fiscais (nome, tipo_imposto, cfop, cst, aliquota, base_calculo_reduzida, observacoes, ativo)
VALUES 
  ('Compra Nacional para Industrialização', 'ICMS', '5101→1101', '00', 18.00, NULL, 
   'Gera crédito de ICMS. Matérias-primas, insumos e embalagens para produção.', true),
  
  ('Compra Nacional para Comercialização', 'ICMS', '5102→1102', '00', 18.00, NULL, 
   'Gera crédito de ICMS. Avaliar substituição tributária se aplicável.', true),
  
  ('Compra Nacional para Uso/Consumo', 'ICMS', '5103→1103', '00', 18.00, NULL, 
   'SEM crédito de ICMS. Pós-reforma, verificar legislação estadual.', true),
  
  ('Compra Nacional Ativo Imobilizado', 'ICMS', '5104→1104', '00', 18.00, NULL, 
   'SEM crédito de ICMS. Alguns estados permitem diferimento.', true),
  
  ('Compra Nacional Ativo por Transferência', 'ICMS', '5109→1109', '00', 0.00, NULL, 
   'SEM crédito. Operação sem incidência entre filiais.', true),
  
  ('Compra Nacional com Substituição Tributária', 'ICMS', '5110→1110', '60', 18.00, NULL, 
   'SEM crédito de ICMS. ICMS-ST substitui crédito normal. Validar campos ST no XML.', true),
  
  ('Compra Nacional com ST (Anterior)', 'ICMS', '5401→1401', '60', 18.00, NULL, 
   'SEM crédito. Operação sujeita a substituição tributária. Verificar base ST.', true),
  
  ('Compra Nacional com Retenção de ICMS', 'ICMS', '5405→1403', '60', 18.00, NULL, 
   'SEM crédito. ICMS retido destacado na nota fiscal.', true),
  
  ('Outras Entradas Nacionais', 'ICMS', '5949→1949', '00', 18.00, NULL, 
   'Crédito depende do caso. Classificação manual necessária.', true);

-- ============================================
-- 2. OPERAÇÕES INTERESTADUAIS (6.xxx → 2.xxx)
-- ============================================

INSERT INTO fabrica_regras_fiscais (nome, tipo_imposto, cfop, cst, aliquota, base_calculo_reduzida, observacoes, ativo)
VALUES 
  ('Compra Interestadual para Industrialização', 'ICMS', '6101→2101', '00', 12.00, NULL, 
   'Gera crédito de ICMS. Entrada de MP para industrialização.', true),
  
  ('Compra Interestadual para Comercialização', 'ICMS', '6102→2102', '00', 12.00, NULL, 
   'Gera crédito de ICMS. Operação de comercialização.', true),
  
  ('Compra Interestadual Uso/Consumo', 'ICMS', '6103→2103', '00', 12.00, NULL, 
   'SEM crédito de ICMS. Material de uso e consumo.', true),
  
  ('Compra Interestadual Ativo Imobilizado', 'ICMS', '6104→2104', '00', 12.00, NULL, 
   'SEM crédito de ICMS. Bens do ativo imobilizado.', true),
  
  ('Compra Interestadual com ST', 'ICMS', '6110→2110', '60', 12.00, NULL, 
   'SEM crédito. Operação com substituição tributária.', true),
  
  ('Compra Interestadual ST (Anterior)', 'ICMS', '6401→2401', '60', 12.00, NULL, 
   'SEM crédito. ST e antecipações tributárias.', true),
  
  ('Compra Interestadual ST (Retenção)', 'ICMS', '6403→2403', '60', 12.00, NULL, 
   'SEM crédito. Operação com retenção de ICMS-ST.', true);

-- ============================================
-- 3. IMPORTAÇÕES (3.xxx → 3.xxx)
-- ============================================

INSERT INTO fabrica_regras_fiscais (nome, tipo_imposto, cfop, cst, aliquota, base_calculo_reduzida, observacoes, ativo)
VALUES 
  ('Importação para Industrialização', 'ICMS', '3101→3101', '00', 18.00, NULL, 
   'Gera crédito de ICMS. MP importada para produção industrial.', true),
  
  ('Importação para Comercialização', 'ICMS', '3102→3102', '00', 18.00, NULL, 
   'Gera crédito de ICMS. Produto importado para revenda.', true),
  
  ('Importação Uso/Consumo', 'ICMS', '3103→3103', '00', 18.00, NULL, 
   'SEM crédito de ICMS. Material importado para uso e consumo.', true),
  
  ('Importação Ativo Imobilizado', 'ICMS', '3104→3104', '00', 18.00, NULL, 
   'SEM crédito de ICMS. Bens do ativo importados.', true),
  
  ('Importação via Comércio', 'ICMS', '3201→3201', '00', 18.00, NULL, 
   'SEM crédito. Importações realizadas através de terceiros.', true);

-- ============================================
-- 4. REGRAS PIS/COFINS
-- ============================================

INSERT INTO fabrica_regras_fiscais (nome, tipo_imposto, cfop, cst, aliquota, base_calculo_reduzida, observacoes, ativo)
VALUES 
  ('PIS - Operação Tributável com Crédito', 'PIS', 'GERAL', '50-56', 1.65, NULL, 
   'Crédito PIS permitido. CST 50 a 56 e códigos compostos.', true),
  
  ('PIS - Operação Tributável Mista', 'PIS', 'GERAL', '01-09', 1.65, NULL, 
   'Permite débito e crédito. CST 01 a 09.', true),
  
  ('PIS - Substituição Tributária', 'PIS', 'GERAL', '60', 0.00, NULL, 
   'SEM crédito. Regime de substituição tributária.', true),
  
  ('PIS - Sem Crédito', 'PIS', 'GERAL', '70,73,74', 0.00, NULL, 
   'SEM crédito. CST 70, 73, 74.', true),
  
  ('COFINS - Operação Tributável com Crédito', 'COFINS', 'GERAL', '50-56', 7.60, NULL, 
   'Crédito COFINS permitido. CST 50 a 56 e códigos compostos.', true),
  
  ('COFINS - Operação Tributável Mista', 'COFINS', 'GERAL', '01-09', 7.60, NULL, 
   'Permite débito e crédito. CST 01 a 09.', true),
  
  ('COFINS - Substituição Tributária', 'COFINS', 'GERAL', '60', 0.00, NULL, 
   'SEM crédito. Regime de substituição tributária.', true),
  
  ('COFINS - Sem Crédito', 'COFINS', 'GERAL', '70,73,74', 0.00, NULL, 
   'SEM crédito. CST 70, 73, 74.', true);

-- ============================================
-- 5. REGRAS IPI
-- ============================================

INSERT INTO fabrica_regras_fiscais (nome, tipo_imposto, cfop, cst, aliquota, base_calculo_reduzida, observacoes, ativo)
VALUES 
  ('IPI - Entrada com Crédito', 'IPI', 'GERAL', '00-49', 0.00, NULL, 
   'Gera crédito de IPI quando aplicável. Alíquota varia por NCM.', true),
  
  ('IPI - Entrada Isenta', 'IPI', 'GERAL', '53', 0.00, NULL, 
   'Operação isenta de IPI. Sem crédito.', true),
  
  ('IPI - Entrada Suspensão', 'IPI', 'GERAL', '52', 0.00, NULL, 
   'Operação com suspensão de IPI. Sem crédito.', true);