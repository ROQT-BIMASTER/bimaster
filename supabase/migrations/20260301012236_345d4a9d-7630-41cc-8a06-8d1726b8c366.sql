-- Privatizar buckets que expõem documentos financeiros
UPDATE storage.buckets SET public = false 
WHERE id IN ('event-expense-docs', 'department-expense-docs', 'attachments')
AND public = true;