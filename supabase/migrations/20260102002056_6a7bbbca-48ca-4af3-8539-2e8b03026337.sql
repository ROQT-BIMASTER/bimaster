
-- Criar política que permite inserções para sincronização via service role ou anon
-- O N8N usando Service Role Key bypassa RLS, mas se estiver usando anon key precisamos permitir

-- Primeiro, verificar políticas existentes e criar novas para permitir sync
CREATE POLICY "Allow sync inserts for contas_receber" 
ON public.contas_receber 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow sync updates for contas_receber" 
ON public.contas_receber 
FOR UPDATE 
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Permitir select para todos
CREATE POLICY "Allow read access for contas_receber" 
ON public.contas_receber 
FOR SELECT 
TO anon, authenticated
USING (true);
