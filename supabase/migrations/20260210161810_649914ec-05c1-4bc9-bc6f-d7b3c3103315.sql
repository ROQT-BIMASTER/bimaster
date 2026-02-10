
-- Armazenar o token em texto plano para poder exibir o link posteriormente
-- (não é dado sensível - é um código de acesso compartilhado com 280 pessoas)
ALTER TABLE public.team_form_tokens ADD COLUMN token_plain text;
