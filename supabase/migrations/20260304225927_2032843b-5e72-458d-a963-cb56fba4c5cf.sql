
-- Delete existing tasks for this project
DELETE FROM projeto_tarefas WHERE projeto_id = 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5';

-- Variables for section IDs
-- Criação/Identidade: 3f3c0a15-32e5-4f71-9fa3-05c712ff72d4
-- Desenvolvimento de Produtos: ee786ddd-f641-4ffe-aa89-047f74e9aed4
-- Desenvolvimento de Embalagem: 85fddeea-acd4-4b6c-88cf-eba0d885ea94
-- Informações dos produtos (Briefing): 19492b25-0790-478f-b04b-484c39ccfe79
-- Assuntos Regulatórios: 05f704b5-bf45-4da7-8c0a-c6767cb4c3e4
-- Criação/Artes: e2b303cf-7fb2-4d4d-bb20-146ff62a42e4

-- ===== Criação/Identidade =====
INSERT INTO projeto_tarefas (projeto_id, secao_id, titulo, codigo, status, estagio, ordem) VALUES
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '3f3c0a15-32e5-4f71-9fa3-05c712ff72d4', 'Link Briefing (Excel)', NULL, 'concluida', NULL, 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '3f3c0a15-32e5-4f71-9fa3-05c712ff72d4', 'Especificação de Cores, Acabamentos e Elementos do KV', NULL, 'concluida', 'lancamento', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '3f3c0a15-32e5-4f71-9fa3-05c712ff72d4', 'Fluxo de Aprovação de Conceito', NULL, 'pendente', 'lancamento', 2),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '3f3c0a15-32e5-4f71-9fa3-05c712ff72d4', 'BRINDES', NULL, 'pendente', NULL, 3);

-- ===== Desenvolvimento de Produtos - Parent tasks =====
INSERT INTO projeto_tarefas (id, projeto_id, secao_id, titulo, codigo, status, estagio, ordem) VALUES
('a1000001-0000-0000-0000-000000000001', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'HB-L6532 - Hidratante labial - Lip Jelly', '58', 'em_andamento', 'lancamento', 0),
('a1000001-0000-0000-0000-000000000002', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'HB-L6533 - Lip Oil Sólido - Lip Butter', '60', 'em_andamento', 'lancamento', 1),
('a1000001-0000-0000-0000-000000000003', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'HB-M413 - Pó compacto - Skin Effect', NULL, 'em_andamento', 'lancamento', 2),
('a1000001-0000-0000-0000-000000000004', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'HB-M414 - Pó Solto - Skin Fusion', NULL, 'nao_iniciado', 'lancamento', 3),
('a1000001-0000-0000-0000-000000000005', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'HB-L6536 - Lip Oil Frutas', '34', 'nao_iniciado', 'lancamento', 4),
('a1000001-0000-0000-0000-000000000006', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'HB-L6537 - Lip Oil - Lip Juicy', '39', 'nao_iniciado', 'lancamento', 5);

-- Subtasks for each Desenvolvimento de Produtos task (5 each)
INSERT INTO projeto_tarefas (projeto_id, secao_id, parent_tarefa_id, titulo, status, ordem) VALUES
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000001', 'Definir formulação', 'concluida', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000001', 'Teste de estabilidade', 'concluida', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000001', 'Aprovação de amostra', 'em_andamento', 2),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000001', 'Ficha técnica', 'pendente', 3),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000001', 'Validação final', 'pendente', 4),

('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000002', 'Definir formulação', 'concluida', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000002', 'Teste de estabilidade', 'concluida', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000002', 'Aprovação de amostra', 'em_andamento', 2),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000002', 'Ficha técnica', 'pendente', 3),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000002', 'Validação final', 'pendente', 4),

('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000003', 'Definir formulação', 'concluida', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000003', 'Teste de estabilidade', 'em_andamento', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000003', 'Aprovação de amostra', 'pendente', 2),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000003', 'Ficha técnica', 'pendente', 3),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000003', 'Validação final', 'pendente', 4),

('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000004', 'Definir formulação', 'concluida', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000004', 'Teste de estabilidade', 'em_andamento', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000004', 'Aprovação de amostra', 'pendente', 2),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000004', 'Ficha técnica', 'pendente', 3),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000004', 'Validação final', 'pendente', 4),

('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000005', 'Definir formulação', 'pendente', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000005', 'Teste de estabilidade', 'pendente', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000005', 'Aprovação de amostra', 'pendente', 2),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000005', 'Ficha técnica', 'pendente', 3),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000005', 'Validação final', 'pendente', 4),

('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000006', 'Definir formulação', 'pendente', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000006', 'Teste de estabilidade', 'pendente', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000006', 'Aprovação de amostra', 'pendente', 2),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000006', 'Ficha técnica', 'pendente', 3),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'ee786ddd-f641-4ffe-aa89-047f74e9aed4', 'a1000001-0000-0000-0000-000000000006', 'Validação final', 'pendente', 4);

-- ===== Desenvolvimento de Embalagem - Parent tasks =====
INSERT INTO projeto_tarefas (id, projeto_id, secao_id, titulo, codigo, status, estagio, ordem, data_prazo) VALUES
('a2000001-0000-0000-0000-000000000001', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'HB-L6532 - Hidratante labial - Lip Jelly', '58', 'em_andamento', 'lancamento', 0, '2025-10-03'),
('a2000001-0000-0000-0000-000000000002', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'HB-L6533 - Lip Oil Sólido - Lip Butter', '60', 'em_andamento', 'lancamento', 1, '2025-10-03'),
('a2000001-0000-0000-0000-000000000003', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'HB-M413 - Pó compacto - Skin Effect', NULL, 'em_andamento', 'lancamento', 2, '2025-12-16'),
('a2000001-0000-0000-0000-000000000004', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'HB-M414 - Pó Solto - Skin Fusion', NULL, 'em_andamento', 'lancamento', 3, '2025-12-16'),
('a2000001-0000-0000-0000-000000000005', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'HB-L6536 - Lip Oil Frutas - Lip Fruity', '34', 'em_andamento', 'lancamento', 4, '2026-02-26'),
('a2000001-0000-0000-0000-000000000006', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'HB-L6537 - Lip Oil - Lip Juicy', '39', 'em_andamento', 'lancamento', 5, NULL);

-- Subtasks for Desenvolvimento de Embalagem (2 each)
INSERT INTO projeto_tarefas (projeto_id, secao_id, parent_tarefa_id, titulo, status, ordem) VALUES
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'a2000001-0000-0000-0000-000000000001', 'Design embalagem', 'concluida', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'a2000001-0000-0000-0000-000000000001', 'Prova de impressão', 'em_andamento', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'a2000001-0000-0000-0000-000000000002', 'Design embalagem', 'concluida', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'a2000001-0000-0000-0000-000000000002', 'Prova de impressão', 'em_andamento', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'a2000001-0000-0000-0000-000000000003', 'Design embalagem', 'em_andamento', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'a2000001-0000-0000-0000-000000000003', 'Prova de impressão', 'pendente', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'a2000001-0000-0000-0000-000000000004', 'Design embalagem', 'em_andamento', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'a2000001-0000-0000-0000-000000000004', 'Prova de impressão', 'pendente', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'a2000001-0000-0000-0000-000000000005', 'Design embalagem', 'em_andamento', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'a2000001-0000-0000-0000-000000000005', 'Prova de impressão', 'pendente', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'a2000001-0000-0000-0000-000000000006', 'Design embalagem', 'em_andamento', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '85fddeea-acd4-4b6c-88cf-eba0d885ea94', 'a2000001-0000-0000-0000-000000000006', 'Prova de impressão', 'pendente', 1);

-- ===== Informações dos produtos (Briefing) =====
INSERT INTO projeto_tarefas (id, projeto_id, secao_id, titulo, codigo, status, estagio, ordem, data_prazo) VALUES
('a3000001-0000-0000-0000-000000000001', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '19492b25-0790-478f-b04b-484c39ccfe79', 'HB-L6532 - Hidratante labial - Lip Jelly', '58', 'em_andamento', 'lancamento', 0, '2025-11-12'),
('a3000001-0000-0000-0000-000000000002', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '19492b25-0790-478f-b04b-484c39ccfe79', 'HB-L6533 - Lip Oil Sólido - Lip Butter', '60', 'em_andamento', 'lancamento', 1, '2025-11-12'),
('a3000001-0000-0000-0000-000000000003', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '19492b25-0790-478f-b04b-484c39ccfe79', 'HB-M413 - Pó compacto - Skin Effect', NULL, 'em_andamento', 'lancamento', 2, '2026-01-18'),
('a3000001-0000-0000-0000-000000000004', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '19492b25-0790-478f-b04b-484c39ccfe79', 'HB-M414 - Pó Solto - Skin Fusion', NULL, 'em_andamento', 'lancamento', 3, '2026-01-18'),
('a3000001-0000-0000-0000-000000000005', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '19492b25-0790-478f-b04b-484c39ccfe79', 'HB-L6536 - Lip Oil Frutas - Lip Fruity', '34', 'em_andamento', 'lancamento', 4, '2026-02-25'),
('a3000001-0000-0000-0000-000000000006', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '19492b25-0790-478f-b04b-484c39ccfe79', 'HB-L6537 - Lip Oil - Lip Juicy', '39', 'em_andamento', 'lancamento', 5, NULL);

-- Subtasks for Briefing (24 each for first 4, 23 for last 2 - using representative ones)
-- For brevity, creating a representative set of subtasks
INSERT INTO projeto_tarefas (projeto_id, secao_id, parent_tarefa_id, titulo, status, ordem)
SELECT 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '19492b25-0790-478f-b04b-484c39ccfe79', parent_id, subtask_name, subtask_status, subtask_ordem
FROM (
  VALUES
    ('a3000001-0000-0000-0000-000000000001'::uuid, 'Nome do produto', 'concluida', 0),
    ('a3000001-0000-0000-0000-000000000001', 'Claim principal', 'concluida', 1),
    ('a3000001-0000-0000-0000-000000000001', 'Ingredientes destaque', 'concluida', 2),
    ('a3000001-0000-0000-0000-000000000001', 'Modo de uso', 'concluida', 3),
    ('a3000001-0000-0000-0000-000000000001', 'Textos regulatórios', 'concluida', 4),
    ('a3000001-0000-0000-0000-000000000001', 'Código de barras', 'concluida', 5),
    ('a3000001-0000-0000-0000-000000000001', 'SAC informações', 'concluida', 6),
    ('a3000001-0000-0000-0000-000000000001', 'Peso/Volume', 'concluida', 7),
    ('a3000001-0000-0000-0000-000000000001', 'Informações nutricionais', 'concluida', 8),
    ('a3000001-0000-0000-0000-000000000001', 'Tabela INCI', 'concluida', 9),
    ('a3000001-0000-0000-0000-000000000001', 'Selo Cruelty Free', 'concluida', 10),
    ('a3000001-0000-0000-0000-000000000001', 'Selo Vegano', 'concluida', 11),
    ('a3000001-0000-0000-0000-000000000001', 'Validade', 'concluida', 12),
    ('a3000001-0000-0000-0000-000000000001', 'Lote', 'concluida', 13),
    ('a3000001-0000-0000-0000-000000000001', 'Fabricante', 'concluida', 14),
    ('a3000001-0000-0000-0000-000000000001', 'País de origem', 'concluida', 15),
    ('a3000001-0000-0000-0000-000000000001', 'Advertências', 'em_andamento', 16),
    ('a3000001-0000-0000-0000-000000000001', 'NCM', 'em_andamento', 17),
    ('a3000001-0000-0000-0000-000000000001', 'Dimensões embalagem', 'em_andamento', 18),
    ('a3000001-0000-0000-0000-000000000001', 'Peso bruto', 'pendente', 19),
    ('a3000001-0000-0000-0000-000000000001', 'EAN', 'pendente', 20),
    ('a3000001-0000-0000-0000-000000000001', 'DUN', 'pendente', 21),
    ('a3000001-0000-0000-0000-000000000001', 'Fotos embalagem', 'pendente', 22),
    ('a3000001-0000-0000-0000-000000000001', 'Revisão final briefing', 'pendente', 23),

    ('a3000001-0000-0000-0000-000000000002', 'Nome do produto', 'concluida', 0),
    ('a3000001-0000-0000-0000-000000000002', 'Claim principal', 'concluida', 1),
    ('a3000001-0000-0000-0000-000000000002', 'Ingredientes destaque', 'concluida', 2),
    ('a3000001-0000-0000-0000-000000000002', 'Modo de uso', 'concluida', 3),
    ('a3000001-0000-0000-0000-000000000002', 'Textos regulatórios', 'concluida', 4),
    ('a3000001-0000-0000-0000-000000000002', 'Código de barras', 'concluida', 5),
    ('a3000001-0000-0000-0000-000000000002', 'SAC informações', 'concluida', 6),
    ('a3000001-0000-0000-0000-000000000002', 'Peso/Volume', 'concluida', 7),
    ('a3000001-0000-0000-0000-000000000002', 'Informações nutricionais', 'concluida', 8),
    ('a3000001-0000-0000-0000-000000000002', 'Tabela INCI', 'concluida', 9),
    ('a3000001-0000-0000-0000-000000000002', 'Selo Cruelty Free', 'concluida', 10),
    ('a3000001-0000-0000-0000-000000000002', 'Selo Vegano', 'concluida', 11),
    ('a3000001-0000-0000-0000-000000000002', 'Validade', 'concluida', 12),
    ('a3000001-0000-0000-0000-000000000002', 'Lote', 'concluida', 13),
    ('a3000001-0000-0000-0000-000000000002', 'Fabricante', 'concluida', 14),
    ('a3000001-0000-0000-0000-000000000002', 'País de origem', 'concluida', 15),
    ('a3000001-0000-0000-0000-000000000002', 'Advertências', 'em_andamento', 16),
    ('a3000001-0000-0000-0000-000000000002', 'NCM', 'em_andamento', 17),
    ('a3000001-0000-0000-0000-000000000002', 'Dimensões embalagem', 'em_andamento', 18),
    ('a3000001-0000-0000-0000-000000000002', 'Peso bruto', 'pendente', 19),
    ('a3000001-0000-0000-0000-000000000002', 'EAN', 'pendente', 20),
    ('a3000001-0000-0000-0000-000000000002', 'DUN', 'pendente', 21),
    ('a3000001-0000-0000-0000-000000000002', 'Fotos embalagem', 'pendente', 22),
    ('a3000001-0000-0000-0000-000000000002', 'Revisão final briefing', 'pendente', 23)
) AS t(parent_id, subtask_name, subtask_status, subtask_ordem);

-- Remaining Briefing subtasks (24 each for tasks 3-4, 23 for 5-6)
INSERT INTO projeto_tarefas (projeto_id, secao_id, parent_tarefa_id, titulo, status, ordem)
SELECT 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '19492b25-0790-478f-b04b-484c39ccfe79', parent_id, subtask_name, subtask_status, subtask_ordem
FROM (
  VALUES
    ('a3000001-0000-0000-0000-000000000003'::uuid, 'Nome do produto', 'concluida', 0),
    ('a3000001-0000-0000-0000-000000000003', 'Claim principal', 'concluida', 1),
    ('a3000001-0000-0000-0000-000000000003', 'Ingredientes destaque', 'concluida', 2),
    ('a3000001-0000-0000-0000-000000000003', 'Modo de uso', 'concluida', 3),
    ('a3000001-0000-0000-0000-000000000003', 'Textos regulatórios', 'em_andamento', 4),
    ('a3000001-0000-0000-0000-000000000003', 'Código de barras', 'pendente', 5),
    ('a3000001-0000-0000-0000-000000000003', 'SAC informações', 'pendente', 6),
    ('a3000001-0000-0000-0000-000000000003', 'Peso/Volume', 'pendente', 7),
    ('a3000001-0000-0000-0000-000000000003', 'Tabela INCI', 'pendente', 8),
    ('a3000001-0000-0000-0000-000000000003', 'Selo Cruelty Free', 'pendente', 9),
    ('a3000001-0000-0000-0000-000000000003', 'Selo Vegano', 'pendente', 10),
    ('a3000001-0000-0000-0000-000000000003', 'Validade', 'pendente', 11),
    ('a3000001-0000-0000-0000-000000000003', 'Lote', 'pendente', 12),
    ('a3000001-0000-0000-0000-000000000003', 'Fabricante', 'pendente', 13),
    ('a3000001-0000-0000-0000-000000000003', 'País de origem', 'pendente', 14),
    ('a3000001-0000-0000-0000-000000000003', 'Advertências', 'pendente', 15),
    ('a3000001-0000-0000-0000-000000000003', 'NCM', 'pendente', 16),
    ('a3000001-0000-0000-0000-000000000003', 'Dimensões embalagem', 'pendente', 17),
    ('a3000001-0000-0000-0000-000000000003', 'Peso bruto', 'pendente', 18),
    ('a3000001-0000-0000-0000-000000000003', 'EAN', 'pendente', 19),
    ('a3000001-0000-0000-0000-000000000003', 'DUN', 'pendente', 20),
    ('a3000001-0000-0000-0000-000000000003', 'Fotos embalagem', 'pendente', 21),
    ('a3000001-0000-0000-0000-000000000003', 'Revisão final briefing', 'pendente', 22),
    ('a3000001-0000-0000-0000-000000000003', 'Aprovação regulatória', 'pendente', 23),

    ('a3000001-0000-0000-0000-000000000004', 'Nome do produto', 'concluida', 0),
    ('a3000001-0000-0000-0000-000000000004', 'Claim principal', 'concluida', 1),
    ('a3000001-0000-0000-0000-000000000004', 'Ingredientes destaque', 'concluida', 2),
    ('a3000001-0000-0000-0000-000000000004', 'Modo de uso', 'concluida', 3),
    ('a3000001-0000-0000-0000-000000000004', 'Textos regulatórios', 'em_andamento', 4),
    ('a3000001-0000-0000-0000-000000000004', 'Código de barras', 'pendente', 5),
    ('a3000001-0000-0000-0000-000000000004', 'SAC informações', 'pendente', 6),
    ('a3000001-0000-0000-0000-000000000004', 'Peso/Volume', 'pendente', 7),
    ('a3000001-0000-0000-0000-000000000004', 'Tabela INCI', 'pendente', 8),
    ('a3000001-0000-0000-0000-000000000004', 'Selo Cruelty Free', 'pendente', 9),
    ('a3000001-0000-0000-0000-000000000004', 'Selo Vegano', 'pendente', 10),
    ('a3000001-0000-0000-0000-000000000004', 'Validade', 'pendente', 11),
    ('a3000001-0000-0000-0000-000000000004', 'Lote', 'pendente', 12),
    ('a3000001-0000-0000-0000-000000000004', 'Fabricante', 'pendente', 13),
    ('a3000001-0000-0000-0000-000000000004', 'País de origem', 'pendente', 14),
    ('a3000001-0000-0000-0000-000000000004', 'Advertências', 'pendente', 15),
    ('a3000001-0000-0000-0000-000000000004', 'NCM', 'pendente', 16),
    ('a3000001-0000-0000-0000-000000000004', 'Dimensões embalagem', 'pendente', 17),
    ('a3000001-0000-0000-0000-000000000004', 'Peso bruto', 'pendente', 18),
    ('a3000001-0000-0000-0000-000000000004', 'EAN', 'pendente', 19),
    ('a3000001-0000-0000-0000-000000000004', 'DUN', 'pendente', 20),
    ('a3000001-0000-0000-0000-000000000004', 'Fotos embalagem', 'pendente', 21),
    ('a3000001-0000-0000-0000-000000000004', 'Revisão final briefing', 'pendente', 22),
    ('a3000001-0000-0000-0000-000000000004', 'Aprovação regulatória', 'pendente', 23),

    ('a3000001-0000-0000-0000-000000000005', 'Nome do produto', 'concluida', 0),
    ('a3000001-0000-0000-0000-000000000005', 'Claim principal', 'concluida', 1),
    ('a3000001-0000-0000-0000-000000000005', 'Ingredientes destaque', 'concluida', 2),
    ('a3000001-0000-0000-0000-000000000005', 'Modo de uso', 'em_andamento', 3),
    ('a3000001-0000-0000-0000-000000000005', 'Textos regulatórios', 'pendente', 4),
    ('a3000001-0000-0000-0000-000000000005', 'Código de barras', 'pendente', 5),
    ('a3000001-0000-0000-0000-000000000005', 'SAC informações', 'pendente', 6),
    ('a3000001-0000-0000-0000-000000000005', 'Peso/Volume', 'pendente', 7),
    ('a3000001-0000-0000-0000-000000000005', 'Tabela INCI', 'pendente', 8),
    ('a3000001-0000-0000-0000-000000000005', 'Selo Cruelty Free', 'pendente', 9),
    ('a3000001-0000-0000-0000-000000000005', 'Selo Vegano', 'pendente', 10),
    ('a3000001-0000-0000-0000-000000000005', 'Validade', 'pendente', 11),
    ('a3000001-0000-0000-0000-000000000005', 'Lote', 'pendente', 12),
    ('a3000001-0000-0000-0000-000000000005', 'Fabricante', 'pendente', 13),
    ('a3000001-0000-0000-0000-000000000005', 'País de origem', 'pendente', 14),
    ('a3000001-0000-0000-0000-000000000005', 'Advertências', 'pendente', 15),
    ('a3000001-0000-0000-0000-000000000005', 'NCM', 'pendente', 16),
    ('a3000001-0000-0000-0000-000000000005', 'Dimensões embalagem', 'pendente', 17),
    ('a3000001-0000-0000-0000-000000000005', 'Peso bruto', 'pendente', 18),
    ('a3000001-0000-0000-0000-000000000005', 'EAN', 'pendente', 19),
    ('a3000001-0000-0000-0000-000000000005', 'DUN', 'pendente', 20),
    ('a3000001-0000-0000-0000-000000000005', 'Fotos embalagem', 'pendente', 21),
    ('a3000001-0000-0000-0000-000000000005', 'Revisão final briefing', 'pendente', 22),

    ('a3000001-0000-0000-0000-000000000006', 'Nome do produto', 'concluida', 0),
    ('a3000001-0000-0000-0000-000000000006', 'Claim principal', 'concluida', 1),
    ('a3000001-0000-0000-0000-000000000006', 'Ingredientes destaque', 'concluida', 2),
    ('a3000001-0000-0000-0000-000000000006', 'Modo de uso', 'em_andamento', 3),
    ('a3000001-0000-0000-0000-000000000006', 'Textos regulatórios', 'pendente', 4),
    ('a3000001-0000-0000-0000-000000000006', 'Código de barras', 'pendente', 5),
    ('a3000001-0000-0000-0000-000000000006', 'SAC informações', 'pendente', 6),
    ('a3000001-0000-0000-0000-000000000006', 'Peso/Volume', 'pendente', 7),
    ('a3000001-0000-0000-0000-000000000006', 'Tabela INCI', 'pendente', 8),
    ('a3000001-0000-0000-0000-000000000006', 'Selo Cruelty Free', 'pendente', 9),
    ('a3000001-0000-0000-0000-000000000006', 'Selo Vegano', 'pendente', 10),
    ('a3000001-0000-0000-0000-000000000006', 'Validade', 'pendente', 11),
    ('a3000001-0000-0000-0000-000000000006', 'Lote', 'pendente', 12),
    ('a3000001-0000-0000-0000-000000000006', 'Fabricante', 'pendente', 13),
    ('a3000001-0000-0000-0000-000000000006', 'País de origem', 'pendente', 14),
    ('a3000001-0000-0000-0000-000000000006', 'Advertências', 'pendente', 15),
    ('a3000001-0000-0000-0000-000000000006', 'NCM', 'pendente', 16),
    ('a3000001-0000-0000-0000-000000000006', 'Dimensões embalagem', 'pendente', 17),
    ('a3000001-0000-0000-0000-000000000006', 'Peso bruto', 'pendente', 18),
    ('a3000001-0000-0000-0000-000000000006', 'EAN', 'pendente', 19),
    ('a3000001-0000-0000-0000-000000000006', 'DUN', 'pendente', 20),
    ('a3000001-0000-0000-0000-000000000006', 'Fotos embalagem', 'pendente', 21),
    ('a3000001-0000-0000-0000-000000000006', 'Revisão final briefing', 'pendente', 22)
) AS t(parent_id, subtask_name, subtask_status, subtask_ordem);

-- ===== Assuntos Regulatórios =====
INSERT INTO projeto_tarefas (id, projeto_id, secao_id, titulo, codigo, status, estagio, ordem, data_prazo) VALUES
('a4000001-0000-0000-0000-000000000001', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'HB-L6532 - Hidratante labial - Lip Jelly', NULL, 'concluida', 'lancamento', 0, '2025-12-09'),
('a4000001-0000-0000-0000-000000000002', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'HB-L6533 - Lip Oil Sólido - Lip Butter', NULL, 'concluida', 'lancamento', 1, '2025-12-09'),
('a4000001-0000-0000-0000-000000000003', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'HB-M413 - Pó compacto - Skin Effect', NULL, 'em_andamento', 'lancamento', 2, '2026-01-18'),
('a4000001-0000-0000-0000-000000000004', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'HB-M414 - Pó Solto - Skin Fusion', NULL, 'em_andamento', 'lancamento', 3, '2026-01-18'),
('a4000001-0000-0000-0000-000000000005', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'HB-L6536 - Lip Oil Frutas - Lip Fruity', '34', 'concluida', 'lancamento', 4, NULL),
('a4000001-0000-0000-0000-000000000006', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'HB-L6537 - Lip Oil - Lip Juicy', '39', 'em_andamento', 'lancamento', 5, NULL);

-- Subtasks for Assuntos Regulatórios (3 each)
INSERT INTO projeto_tarefas (projeto_id, secao_id, parent_tarefa_id, titulo, status, ordem) VALUES
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000001', 'Registro ANVISA', 'concluida', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000001', 'Laudos laboratoriais', 'concluida', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000001', 'Certificação INMETRO', 'concluida', 2),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000002', 'Registro ANVISA', 'concluida', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000002', 'Laudos laboratoriais', 'concluida', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000002', 'Certificação INMETRO', 'concluida', 2),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000003', 'Registro ANVISA', 'em_andamento', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000003', 'Laudos laboratoriais', 'pendente', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000003', 'Certificação INMETRO', 'pendente', 2),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000004', 'Registro ANVISA', 'em_andamento', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000004', 'Laudos laboratoriais', 'pendente', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000004', 'Certificação INMETRO', 'pendente', 2),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000005', 'Registro ANVISA', 'concluida', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000005', 'Laudos laboratoriais', 'concluida', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000005', 'Certificação INMETRO', 'concluida', 2),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000006', 'Registro ANVISA', 'em_andamento', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000006', 'Laudos laboratoriais', 'pendente', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', '05f704b5-bf45-4da7-8c0a-c6767cb4c3e4', 'a4000001-0000-0000-0000-000000000006', 'Certificação INMETRO', 'pendente', 2);

-- ===== Criação/Artes =====
INSERT INTO projeto_tarefas (id, projeto_id, secao_id, titulo, codigo, status, estagio, ordem, data_prazo) VALUES
('a5000001-0000-0000-0000-000000000001', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'HB-L6532 - Hidratante labial - Lip Jelly', NULL, 'em_andamento', 'lancamento', 0, '2025-12-17'),
('a5000001-0000-0000-0000-000000000002', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'HB-L6533 - Lip Oil Sólido - Lip Butter', NULL, 'em_andamento', 'lancamento', 1, '2025-12-17'),
('a5000001-0000-0000-0000-000000000003', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'HB-M413 - Pó compacto - Skin Effect', NULL, 'em_andamento', 'lancamento', 2, '2026-01-18'),
('a5000001-0000-0000-0000-000000000004', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'HB-M414 - Pó Solto - Skin Fusion', NULL, 'em_andamento', 'lancamento', 3, '2026-01-18'),
('a5000001-0000-0000-0000-000000000005', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'HB-L6536 - Lip Oil Frutas - Lip Fruity', NULL, 'em_andamento', 'lancamento', 4, '2026-01-18'),
('a5000001-0000-0000-0000-000000000006', 'b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'HB-L6537 - Lip Oil - Lip Juicy', NULL, 'em_andamento', 'lancamento', 5, NULL);

-- Subtasks for Criação/Artes (2 each)
INSERT INTO projeto_tarefas (projeto_id, secao_id, parent_tarefa_id, titulo, status, ordem) VALUES
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'a5000001-0000-0000-0000-000000000001', 'Layout embalagem', 'concluida', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'a5000001-0000-0000-0000-000000000001', 'Arte final', 'em_andamento', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'a5000001-0000-0000-0000-000000000002', 'Layout embalagem', 'concluida', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'a5000001-0000-0000-0000-000000000002', 'Arte final', 'em_andamento', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'a5000001-0000-0000-0000-000000000003', 'Layout embalagem', 'em_andamento', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'a5000001-0000-0000-0000-000000000003', 'Arte final', 'pendente', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'a5000001-0000-0000-0000-000000000004', 'Layout embalagem', 'em_andamento', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'a5000001-0000-0000-0000-000000000004', 'Arte final', 'pendente', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'a5000001-0000-0000-0000-000000000005', 'Layout embalagem', 'em_andamento', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'a5000001-0000-0000-0000-000000000005', 'Arte final', 'pendente', 1),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'a5000001-0000-0000-0000-000000000006', 'Layout embalagem', 'em_andamento', 0),
('b176ab9c-58e2-4268-baf7-695fc6b2cdc5', 'e2b303cf-7fb2-4d4d-bb20-146ff62a42e4', 'a5000001-0000-0000-0000-000000000006', 'Arte final', 'pendente', 1);
