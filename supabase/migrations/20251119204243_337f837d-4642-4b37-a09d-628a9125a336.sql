-- Permitir INSERT em fabrica_materias_primas para usuários autenticados
-- Apenas admins e supervisores podem criar matérias-primas

CREATE POLICY "Admins e supervisores podem criar matérias-primas"
ON fabrica_materias_primas
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_or_supervisor(auth.uid())
);

-- Permitir UPDATE em fabrica_materias_primas
CREATE POLICY "Admins e supervisores podem atualizar matérias-primas"
ON fabrica_materias_primas
FOR UPDATE
TO authenticated
USING (
  public.is_admin_or_supervisor(auth.uid())
)
WITH CHECK (
  public.is_admin_or_supervisor(auth.uid())
);

-- Permitir DELETE em fabrica_materias_primas
CREATE POLICY "Admins e supervisores podem deletar matérias-primas"
ON fabrica_materias_primas
FOR DELETE
TO authenticated
USING (
  public.is_admin_or_supervisor(auth.uid())
);