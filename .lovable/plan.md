## Phase 3.3 / 3.4 — Storage hardening final

### 1. Discovery preliminar (sem migration)
Rodar `supabase--read_query` para coletar MIME types já presentes em produção nos 39 buckets que receberão `allowed_mime_types`:
```sql
SELECT bucket_id, metadata->>'mimetype' AS mime, count(*)
FROM storage.objects
WHERE bucket_id NOT IN ('trade-assets','trade-banners')  -- esses ficam sem MIME enforcement por agora
GROUP BY 1,2 ORDER BY 1,3 DESC;
```
Resultado consolidado vai para `docs/SECURITY-STORAGE-DISCOVERY.md` § "MIME baseline" e define a whitelist por bucket (união de MIMEs já presentes + MIMEs funcionalmente esperados).

### 2. Migration única (`supabase--migration`)

**(a) Privatizar `creative-studio`:**
```sql
UPDATE storage.buckets SET public = false WHERE id = 'creative-studio';
```

**(b) Policies de INSERT com prefixo UID nos 4 buckets relevantes** (`creative-studio`, `trade-assets`, `trade-banners`, `email-assets`):
```sql
DROP POLICY IF EXISTS "<bucket>_insert_owner_prefix" ON storage.objects;
CREATE POLICY "<bucket>_insert_owner_prefix" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = '<bucket>'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);
```
Mantém policies de SELECT/UPDATE/DELETE existentes (não tocar).

**(c) `file_size_limit` por uso** nos 39 buckets sem limite, conforme heurística:

| Categoria | Buckets | Limit |
|---|---|---|
| Fiscais | china-documentos, fabrica-custo-evidencias, fabrica-cotacoes, fabrica-revisao-docs, fabrica-nfe-xmls, trade-expense-docs, event-expense-docs, department-expense-docs, campaign-evidence, comprovantes, trade-budget-docs, china-pasta-digital, pasta-digital, payment-chat-files, revisao-orcamentos, embalagem-analise, etiqueta-bula | 25 MB |
| Mídia pesada | meeting-recordings, creative-studio, narracoes-roteirista, influencer-media, post-media | 500 MB |
| Foto | avatars, fabrica-produto-fotos, trade-photos, produto-brasil-imagens, amostras, attachments, marketing-assets, fabrica-revisao-docs (já fiscal — sobrepor não), reward-banners, aprovacao-artes, fluxo-artes, projeto-anexos (override 100 MB), projeto-documentos, projeto-relatorios, process-attachments, documento-anexos | 10 MB (50 MB para projeto-anexos/process-attachments/documentos) |
| Email/banner | email-assets, trade-assets, trade-banners | 5 MB |

(Lista exata será derivada da auditoria de 40 buckets do discovery.)

**(d) `allowed_mime_types` por uso**, sempre incluindo MIMEs já presentes (passo 1) + funcionais:
- Fiscais: `application/pdf`, `image/png`, `image/jpeg`, `image/webp`, `application/xml`, `text/xml`
- Foto: `image/png`, `image/jpeg`, `image/webp`, `image/heic`
- Mídia: `audio/*` + `video/*` + `image/*` (ou lista explícita)
- Email/banner: `image/png`, `image/jpeg`, `image/webp`

### 3. Frontend — ajustar TTLs e signed URLs

| Arquivo | Mudança |
|---|---|
| `supabase/functions/ai-creative-studio/index.ts` (l.133) | Trocar `getPublicUrl` por `createSignedUrl(fileName, 86400)` (24h). Persistir o `path` no DB (não a URL) e gerar signed URL on-demand no frontend. |
| `src/components/marketing/studio/CreativeImageGenerator.tsx` | Consumir `path` retornado e gerar signed URL via SDK ao exibir. |
| `src/components/fabrica/CofreFullscreenModal.tsx` (l.171, 182) | `fabrica-revisao-docs`: `3600` → `300`. |
| `src/components/fabrica/DocumentosTab.tsx` (l.134) | `fabrica-revisao-docs`: `3600` → `300`. |
| `src/components/fabrica/CotacoesInsumoPanel.tsx` (l.121) | `fabrica-cotacoes` (assumido): `31536000` → `300`. Validar bucket. |
| `src/components/events/ExpenseAttachments.tsx` (l.67) | `event-expense-docs`: `31536000` → `300`. |
| `src/contexts/MeetingRecordingContext.tsx` (l.159, 206) | `meeting-recordings`: `31536000` → `300`. |
| `supabase/functions/meeting-transcribe/index.ts` (l.65) | Já usa 600 — reduzir para 300. |
| Buscar e ajustar demais call sites que toquem em `china-documentos`, `fabrica-custo-evidencias`, `trade-expense-docs`, `campaign-evidence` (rg final antes do PR). |

### 4. Smoke tests (manual + scripts)
- `scripts/security/storage-cross-tenant.sh` (novo): autenticar como user A, tentar baixar arquivo de path `<uid_B>/...` de cada bucket privado → esperar 403.
- Tentativa de upload em `creative-studio` com path sem prefixo `<uid>/` → esperar 403 da policy.
- Login normal: gerar imagem em creative-studio e verificar que aparece via signed URL 24h.

### 5. Documentação
- `docs/SECURITY-STORAGE-AUDIT.md`: atualizar tabelas — `creative-studio` agora privado; novos limites/MIMEs; policy INSERT prefixada.
- `docs/SECURITY-STORAGE-DISCOVERY.md`: marcar STOP como respondido (Q1–Q4) e adicionar seção "Aplicado em 2026-05-03" com diff resumido.
- `docs/SECURITY-HARDENING-COMPLETE.md`: § Phase 3 → `✅ Concluído` (não mais "Discovery + Audit"); zerar backlog Phase 3.

### 6. Critério de aceitação (8 itens)
Conforme prompt do usuário — verificar e reportar cada um.

### 7. Rollback
Documentado no `SECURITY-HARDENING-COMPLETE.md`:
```sql
UPDATE storage.buckets SET public = true WHERE id = 'creative-studio';
DROP POLICY "<bucket>_insert_owner_prefix" ON storage.objects;
UPDATE storage.buckets SET file_size_limit = NULL, allowed_mime_types = NULL WHERE id IN (...);
```
Frontend: reverter TTLs via git.

### Pontos de atenção
- **`creative-studio` privado quebra URLs antigas** já persistidas no DB como public URLs. Verificar se há tabela com URLs gravadas (ex.: `creative_assets`, `marketing_creatives`); se sim, adicionar passo de migração para extrair `path` e/ou re-emitir signed URL on-demand. Vou auditar antes de aplicar.
- `allowed_mime_types` só tem efeito em uploads novos — não rejeita objetos já existentes, mas pode bloquear re-upload. Por isso o discovery de MIMEs do passo 1 é obrigatório.
- Limites por categoria são propostas; ajusto a lista final após bater com o discovery (alguns buckets vazios podem receber default 10 MB conservador).
