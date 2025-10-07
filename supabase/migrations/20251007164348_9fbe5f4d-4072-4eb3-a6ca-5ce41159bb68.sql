-- Adicionar tela de importação de lojas ao sistema
INSERT INTO telas_sistema (codigo, nome, rota, icone, ordem, ativo, descricao)
VALUES 
  ('trade_import_stores', 'Importar Lojas', '/dashboard/trade-marketing/import-stores', 'Upload', 57, true, 'Importação de Lojas e PDVs')
ON CONFLICT (codigo) DO NOTHING;