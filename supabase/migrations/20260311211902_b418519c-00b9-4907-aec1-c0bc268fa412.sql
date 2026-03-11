-- Apagar documentos vinculados ao HB-M300
DELETE FROM china_produto_documentos WHERE submissao_id IN (SELECT id FROM china_produto_submissoes WHERE produto_codigo = 'HB-M300');

-- Apagar cores vinculadas ao HB-M300
DELETE FROM china_produto_cores WHERE submissao_id IN (SELECT id FROM china_produto_submissoes WHERE produto_codigo = 'HB-M300');

-- Apagar todas as submissões do HB-M300 (incluindo lixeira e ativas)
DELETE FROM china_produto_submissoes WHERE produto_codigo = 'HB-M300';