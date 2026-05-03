# Storage Buckets — Audit (Phase 3)

Total: 40 buckets. **3 públicos**, **37 privados**.

## Públicos (intencional)

| Bucket | Justificativa |
|---|---|
| `creative-studio` | Assets gerados por IA exibidos em galerias públicas / share links |
| `trade-assets` | Banners e materiais de campanha embutidos em landing pages |
| `trade-banners` | Banners 3:1 servidos diretamente em páginas públicas (Trade Marketing) |

> Recomendação: manter público; mitigação via path-prefix com UID/empresa para evitar enumeração previsível. Verificar policies RLS de `storage.objects` para INSERT/DELETE.

## Privados (37)

Todos exigem signed URL via `StoragePreviewDialog` + `triggerBlobDownload` (ver `mem://architecture/storage-blob-download-protocol`).

amostras, aprovacao-artes, attachments, avatars, campaign-evidence, china-documentos, china-pasta-digital, comprovantes, department-expense-docs, documento-anexos, email-assets, embalagem-analise, etiqueta-bula, event-expense-docs, fabrica-cotacoes, fabrica-custo-evidencias, fabrica-nfe-xmls, fabrica-produto-fotos, fabrica-revisao-docs, fluxo-artes, influencer-media, marketing-assets, meeting-recordings, narracoes-roteirista, pasta-digital, payment-chat-files, post-media, process-attachments, produto-brasil-imagens, projeto-anexos, projeto-documentos, projeto-relatorios, revisao-orcamentos, reward-banners, trade-budget-docs, trade-expense-docs, trade-photos.

## Conclusão Phase 3

Posture atual está coerente. Nenhuma migração necessária — os 3 buckets públicos têm uso público intencional. Recomenda-se revisão periódica de policies de INSERT em buckets públicos para garantir prefixo `<uid>/`.
