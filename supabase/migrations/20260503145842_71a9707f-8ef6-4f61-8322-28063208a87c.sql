INSERT INTO public.step_up_scopes (scope, ttl_seconds, description, enabled) VALUES
  ('user.password.bulk',     60,  'Reset de senhas em lote',                 true),
  ('user.password.reset',    300, 'Reset de senha individual',               true),
  ('user.password.self',     600, 'Troca da própria senha',                  true),
  ('user.delete',            60,  'Exclusão de usuário',                     true),
  ('user.create.admin',      300, 'Criação de admin',                        true),
  ('security.admin.config',  60,  'Modificação de configuração de segurança',true),
  ('cofre.share',            300, 'Compartilhamento de cofre',               true),
  ('data.export.bulk',       60,  'Exportação massiva de dados',             true)
ON CONFLICT (scope) DO UPDATE SET
  ttl_seconds = EXCLUDED.ttl_seconds,
  description = EXCLUDED.description,
  enabled     = EXCLUDED.enabled;