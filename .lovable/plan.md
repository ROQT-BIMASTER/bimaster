
# Migracao Segura: Storage Buckets Publicos para Privados

## Status: Fases 1 e 2 CONCLUÍDAS ✅

Fases 1 (uploads com signed URLs) e 2 (exibição com resolveStorageUrl) estão implementadas.

**Próximo passo:** Publicar em produção e então executar Fase 3.

---

## Fase 3 - Tornar Buckets Privados (SQL) — PENDENTE

**Executar SOMENTE após as Fases 1 e 2 estarem publicadas em produção.**

```sql
UPDATE storage.buckets 
SET public = false 
WHERE id IN (
  'event-expense-docs', 
  'department-expense-docs', 
  'trade-expense-docs', 
  'trade-budget-docs',
  'campaign-evidence', 
  'fabrica-custo-evidencias', 
  'fabrica-cotacoes', 
  'marketing-assets', 
  'attachments', 
  'email-assets'
);
```

O bucket `avatars` permanece público.

