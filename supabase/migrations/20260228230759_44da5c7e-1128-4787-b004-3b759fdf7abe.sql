ALTER TABLE fabrica_revisao_documentos 
  ADD COLUMN materia_prima_id uuid REFERENCES fabrica_materias_primas(id);