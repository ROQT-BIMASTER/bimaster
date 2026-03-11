UPDATE meetings 
SET status = 'analyzed', 
    progress = 100, 
    progress_detail = 'Análise parcial (ata e mapa mental OK, extração de insights incompleta)'
WHERE id = 'e418c499-a335-42d0-b198-f89e7d541819' 
  AND status = 'processing';