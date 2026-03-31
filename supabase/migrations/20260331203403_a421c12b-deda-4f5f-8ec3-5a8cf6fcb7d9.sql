INSERT INTO telas_sistema (codigo, nome, descricao, modulo_codigo, rota, ordem, ativo)
VALUES ('projetos_minhas_tarefas', 'Minhas Tarefas', 'Página pessoal com tarefas atribuídas ao usuário', 'projetos', '/dashboard/projetos/minhas-tarefas', 15, true)
ON CONFLICT (codigo) DO NOTHING;