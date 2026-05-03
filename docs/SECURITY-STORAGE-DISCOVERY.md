# Storage Discovery — Phase 3.1 / 3.2

Data: 2026-05-03. Total: **40 buckets** — 3 públicos, 37 privados.

## 3.1a — Buckets

### Públicos (3)

| Bucket | Volume | Último upload | Classificação proposta |
|---|---|---|---|
| `creative-studio` | 12 / 16 MB | 2026-04-24 | **MANTER PÚBLICO** — assets gerados por IA exibidos em galerias/share links |
| `trade-assets` | 1 / 511 kB | 2026-03-21 | **MANTER PÚBLICO** — banners de campanha embutidos em landing pages |
| `trade-banners` | 22 / 18 MB | 2026-03-21 | **MANTER PÚBLICO** — banners 3:1 servidos diretamente em páginas Trade |

### Privados (37) — top por volume

| Bucket | Objects | Size | Heurística | Classificação |
|---|---|---|---|---|
| `projeto-anexos` | 570 | 1.05 GB | anexo de projeto | **MANTER PRIVADO** (já é) — signed URL TTL ≤15min |
| `trade-photos` | 174 | 60 MB | foto de PDV | **MANTER PRIVADO** — TTL ≤15min |
| `china-documentos` | 76 | 84 MB | documento fiscal China | **MANTER PRIVADO + audit** — TTL ≤5min |
| `fabrica-custo-evidencias` | 45 | 6.7 MB | evidência de custo (NF, cotação) | **MANTER PRIVADO + audit** — TTL ≤5min |
| `meeting-recordings` | 12 | 291 MB | gravação de reunião (PII) | **MANTER PRIVADO + audit** — TTL ≤5min |
| `avatars` | 16 | 6.7 MB | foto de perfil | **MANTER PRIVADO** — RLS por owner, TTL ≤1h |
| `projeto-relatorios` | 14 | 72 kB | relatórios de copilot | **MANTER PRIVADO** — TTL ≤15min |
| `fabrica-cotacoes` | 5 | 2.6 MB | cotações de fornecedor | **MANTER PRIVADO + audit** — TTL ≤5min |
| `fabrica-produto-fotos` | 5 | 432 kB | foto de produto | **MANTER PRIVADO** — TTL ≤15min |
| `trade-expense-docs` | 4 | 594 kB | despesa de campanha | **MANTER PRIVADO + audit** — TTL ≤5min |
| `event-expense-docs` | 4 | 1.4 MB | despesa de evento | **MANTER PRIVADO + audit** — TTL ≤5min |
| `reward-banners` | 3 | 806 kB | banner de recompensa | **MANTER PRIVADO** — TTL ≤15min |
| `fabrica-revisao-docs` | 2 | 67 kB | documento de revisão | **MANTER PRIVADO + audit** — TTL ≤5min |
| `aprovacao-artes` | 1 | 78 kB | arte para aprovação | **MANTER PRIVADO** — TTL ≤15min |
| `email-assets` | 1 | 34 kB | asset de email transacional | **PRECISA DECISÃO** — pode virar público se URLs forem embutidas em emails |
| `campaign-evidence` | 1 | 62 kB | evidência de campanha | **MANTER PRIVADO + audit** — TTL ≤5min |

### Privados sem objetos (vazios — 21)

`amostras`, `attachments`, `comprovantes`, `department-expense-docs`, `documento-anexos`, `embalagem-analise`, `etiqueta-bula`, `fabrica-nfe-xmls`, `fluxo-artes`, `influencer-media`, `marketing-assets`, `narracoes-roteirista`, `pasta-digital`, `payment-chat-files`, `post-media`, `process-attachments`, `produto-brasil-imagens`, `china-pasta-digital`, `projeto-documentos`, `revisao-orcamentos`, `trade-budget-docs`.

Sem objetos = sem risco de exposição agora; classificação proposta: **MANTER PRIVADO** com policies por owner/empresa quando começarem a receber uploads.

## 3.1c — Volume agregado

19 buckets com objetos; 21 vazios. Volume total ≈ 1.5 GB. `projeto-anexos` concentra 70% do volume.

## 3.2 — Análise de risco

### Status atual vs proposto

A configuração atual é **coerente com o risco**:
- Os 3 buckets públicos têm uso público intencional (assets de marketing/IA, banners renderizados em landing pages).
- Os 37 buckets privados já estão com `public=false`. Falta validar/auditar TTL das signed URLs e RLS de `INSERT/DELETE` por bucket.

### Itens que **PRECISAM DECISÃO do usuário**

| Bucket | Pergunta |
|---|---|
| `email-assets` | URLs ficam embutidas em emails enviados externamente? Se sim → público estático faz sentido. Se não → manter privado. |
| `creative-studio` | Há expectativa de **share links externos** (não autenticados)? Se não, considerar privar com signed URL longa (24h). |
| `trade-assets` / `trade-banners` | Páginas que exibem esses banners são **autenticadas**? Se sim → privar e usar signed URL. Se renderizadas em landing **não autenticada** → manter público. |

### Recomendações independentes de decisão (podem entrar agora)

1. **Auditoria de policies de INSERT** em `creative-studio`, `trade-assets`, `trade-banners` — garantir prefixo `<uid>/` ou `<empresa_id>/` para impedir enumeração previsível e upload anônimo.
2. **TTL curto** (≤5min) em signed URLs para buckets fiscais: `china-documentos`, `fabrica-custo-evidencias`, `fabrica-cotacoes`, `fabrica-revisao-docs`, `meeting-recordings`, `*-expense-docs`, `campaign-evidence`.
3. **`file_size_limit`** está `nil` em 39 dos 40 buckets; só `marketing-assets` tem 50 MB. Recomenda-se setar limite por bucket (10–50 MB conforme uso).
4. **`allowed_mime_types`** está `nil` em 39 buckets — adicionar whitelist por uso (ex.: PDF/JPEG/PNG para fiscais; mp3/mp4 para mídia).

## 3.1b — Policies em `storage.objects`

Não inclusas neste discovery via `pg_policy` por limite de output do tooling. **Próximo passo (após classificação aprovada)**: rodar a query `3.1b` separadamente e revisar policies bucket-a-bucket antes de aplicar Etapa 3.3.

## STOP — Aguardando confirmação do usuário

**Antes de qualquer migration (Etapas 3.3/3.4), confirmar**:

1. ✅ / ❌ Manter `creative-studio`, `trade-assets`, `trade-banners` públicos? (3 perguntas individuais)
2. ✅ / ❌ Aplicar TTL ≤5min nas signed URLs dos 7 buckets fiscais listados acima?
3. ✅ / ❌ Setar `file_size_limit` + `allowed_mime_types` nos 39 buckets sem limite?
4. ✅ / ❌ `email-assets` deve ser público (URLs em emails externos) ou privado?

Sem essas respostas, **nenhuma migration de storage é executada nesta rodada**. O `SECURITY-STORAGE-AUDIT.md` reflete o estado atual; este discovery propõe os próximos passos.
