# Storage Buckets — Audit (Phase 3 final)

Total: 40 buckets. **2 públicos**, **38 privados** (após Phase 3.3/3.4).

## Públicos (intencional)

| Bucket | Justificativa | INSERT policy | Limites |
|---|---|---|---|
| `trade-assets` | Banners de campanha embutidos em landing pages | `trade_assets_insert_owner_prefix` (UID prefix) | 5 MB · image/png, jpeg, webp |
| `trade-banners` | Banners 3:1 servidos em páginas Trade | Admin-only INSERT (mantido) | 5 MB · image/png, jpeg, webp |

> `creative-studio` foi privatizado em 2026-05-03 — assets agora exigem signed URL (24h) gerada on-demand pelo `CreativeGallery`.

## Privados (38)

Todos exigem signed URL via `StoragePreviewDialog` + `triggerBlobDownload` (ver `mem://architecture/storage-blob-download-protocol`).

### TTL ≤5min (buckets fiscais — Phase 3.4)

`china-documentos`, `fabrica-custo-evidencias`, `fabrica-cotacoes`, `fabrica-revisao-docs`, `meeting-recordings`, `trade-expense-docs`, `event-expense-docs`, `campaign-evidence`.

Todos os call sites do frontend e edge functions foram atualizados para `createSignedUrl(path, 300)`.

### Demais privados

amostras, aprovacao-artes, attachments, avatars, china-pasta-digital, comprovantes, creative-studio, department-expense-docs, documento-anexos, embalagem-analise, etiqueta-bula, fabrica-nfe-xmls, fabrica-produto-fotos, fluxo-artes, influencer-media, marketing-assets, narracoes-roteirista, pasta-digital, payment-chat-files, post-media, process-attachments, produto-brasil-imagens, projeto-anexos, projeto-documentos, projeto-relatorios, revisao-orcamentos, reward-banners, trade-budget-docs, trade-photos, email-assets (apesar do nome, é privado e exige UID prefix no INSERT).

## file_size_limit aplicado em todos os 40 buckets

| Categoria | Limit | Buckets |
|---|---|---|
| Fiscal | 25 MB | china-documentos, fabrica-custo-evidencias, fabrica-cotacoes, fabrica-revisao-docs, fabrica-nfe-xmls, trade-expense-docs, event-expense-docs, department-expense-docs, campaign-evidence, comprovantes, trade-budget-docs, china-pasta-digital, pasta-digital, payment-chat-files, revisao-orcamentos, embalagem-analise, etiqueta-bula |
| Mídia pesada | 500 MB | meeting-recordings, narracoes-roteirista, influencer-media, post-media |
| Creative | 50 MB | creative-studio |
| Foto | 10 MB | avatars, fabrica-produto-fotos, trade-photos, produto-brasil-imagens, amostras, reward-banners, aprovacao-artes, fluxo-artes |
| Mixed projeto | 50 MB | projeto-anexos, projeto-documentos, projeto-relatorios, process-attachments, documento-anexos, attachments, marketing-assets |
| Email/banner | 5 MB | email-assets, trade-assets, trade-banners |

## allowed_mime_types aplicado em todos os 40 buckets

Whitelist baseada em (a) tipos MIME já presentes em produção (discovery em `SECURITY-STORAGE-DISCOVERY.md`) + (b) tipos funcionalmente esperados. Detalhes na migration `20260503-162845`.

## Status final Phase 3

- ✅ creative-studio privado
- ✅ Policies de INSERT com prefixo UID em creative-studio (existente), trade-assets (novo), email-assets (novo). trade-banners mantém INSERT admin-only.
- ✅ file_size_limit em 40/40 buckets
- ✅ allowed_mime_types em 40/40 buckets
- ✅ TTL ≤300s nos 7 buckets fiscais (frontend + edge)
- ✅ Frontend creative-studio gera signed URL 24h on-demand
