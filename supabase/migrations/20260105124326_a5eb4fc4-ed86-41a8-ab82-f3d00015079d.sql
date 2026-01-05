-- Corrigir Security Definer View - remover a view que expõe dados sensíveis do auth.users
DROP VIEW IF EXISTS public.auth_users_view;