-- Force re-trigger on all pending/overdue titles to recalculate status with Brazil timezone
UPDATE contas_receber 
SET updated_at = now() 
WHERE status IN ('pendente', 'vencido') 
  AND COALESCE(valor_aberto, 0) > 0;