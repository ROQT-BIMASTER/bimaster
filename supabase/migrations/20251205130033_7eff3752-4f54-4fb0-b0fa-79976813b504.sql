-- Fix conflicting RLS policies on departamentos table
-- Drop old permissive policies that override the restrictive admin-only policies
DROP POLICY IF EXISTS "Usuários autenticados podem ver departamentos" ON departamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem criar departamentos" ON departamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar departamentos" ON departamentos;

-- Also fix the stores table overly permissive SELECT policy
DROP POLICY IF EXISTS "Usuarios autenticados podem ver lojas" ON stores;