ALTER TABLE meetings DROP CONSTRAINT meetings_status_check;
ALTER TABLE meetings ADD CONSTRAINT meetings_status_check CHECK (status = ANY (ARRAY['draft', 'recording', 'processing', 'analyzed', 'error', 'phase1_complete']));
UPDATE meetings 
SET status = 'phase1_complete', 
    progress = 92, 
    progress_detail = 'Fase 1 concluída! Iniciando extração de insights...',
    updated_at = now()
WHERE id = 'e418c499-a335-42d0-b198-f89e7d541819';