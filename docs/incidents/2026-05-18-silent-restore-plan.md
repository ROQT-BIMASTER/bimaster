# Plano de Restore Silencioso — Pós-incidente 2026-05-16

> Objetivo: aplicar o PITR (snapshot anterior a `2026-05-16 01:23 UTC`) e
> re-injetar tudo que foi criado/atualizado depois (capturado em
> `/mnt/documents/backup-full-20260518T161838Z`) **sem que nenhum usuário
> em produção perceba**: sem downtime, sem logout, sem perda de uploads
> recentes, sem reabertura de fluxos já fechados.

---

## 0. Pré-requisitos

- [x] Backup completo + verificação de integridade (`backup-verify.sh` → PASS).
- [x] ZIP final em `/mnt/documents/backup-full-<TS>.zip` baixado para fora do
      sandbox (cópia local + S3 externo).
- [ ] Suporte Lovable alinhado para PITR em **branch/projeto temporário**
      (NÃO sobrescrever produção ainda).
- [ ] Janela escolhida: madrugada SP (03:00–05:00 BRT), tráfego mínimo
      confirmado em `supabase--analytics_query`.
- [ ] Feature flag `READ_ONLY_BANNER=false` (será ligada só na Fase 4).

---

## 1. Estratégia geral (zero-downtime)

```text
PROD (hoje, com hole 2026-05-16)
   │
   ├─► (1) PITR em projeto TEMP  ─────────────► snapshot 2026-05-16 01:20Z
   │                                                  │
   │                                                  ├─ extract dados perdidos
   │                                                  │   (fabrica_br + china)
   │                                                  ▼
   │                                            dump-restore.sql
   │
   ├─► (2) Dry-run em projeto SHADOW (clone de PROD)
   │        aplica dump-restore.sql + backup pós-16
   │        valida contagens, RLS, smoke E2E
   │
   ├─► (3) Em PROD, janela curta (~2 min) read-only "soft"
   │        - flag global READ_ONLY no front (banner discreto: "sincronizando")
   │        - writes bloqueados por RLS temporária
   │        - leituras continuam normais
   │
   ├─► (4) Aplica em PROD na ordem:
   │        a) dump dos dados PRÉ-incidente (do PITR)   → ON CONFLICT DO NOTHING
   │        b) dump dos dados PÓS-incidente (do backup) → ON CONFLICT DO NOTHING
   │        c) re-upload de storage faltante            → upsert=false
   │
   ├─► (5) Verificação + libera writes (remove flag)
   │
   └─► (6) Auditoria 24h: diff de contagens, alertas, smoke nos módulos críticos
```

**Chave do "silencioso"**: nada é deletado, nada é sobrescrito. Só são
**inseridas** linhas/arquivos que **não existem** hoje. Sessões continuam
válidas (não tocamos em `auth.*`). A janela read-only de ~2 min cai dentro
do retry padrão do TanStack Query → usuário vê no máximo um spinner.

---

## 2. Fases detalhadas

### Fase 1 — Snapshot PITR em projeto temporário (manual, suporte)

1. Abrir ticket no suporte Lovable: "PITR para `2026-05-16 01:20:00 UTC` em
   projeto TEMP (não em produção)".
2. Receber `RESTORE_DB_URL` do projeto TEMP.
3. Rodar `scripts/recovery/fabrica-br-extract.sh` + extração análoga para
   tabelas `china_*` apagadas. Gera `/tmp/dump-pre-incidente.sql` com
   `INSERT ... ON CONFLICT DO NOTHING`.

### Fase 2 — Dry-run em projeto SHADOW

1. Clonar PROD para SHADOW (suporte Lovable, snapshot atual).
2. Aplicar em SHADOW:
   - `psql $SHADOW_DB_URL -f /tmp/dump-pre-incidente.sql`
   - `node scripts/recovery/reimport-backup.mjs $SHADOW_DB_URL <backup-dir>`
     (gera `INSERT ... ON CONFLICT DO NOTHING` por tabela a partir dos JSONs).
   - Re-upload storage com `upsert: false`.
3. Validar:
   - `count(*)` por tabela ≥ baseline pré-incidente.
   - RLS smoke: 3 usuários (admin, gerente, vendedor) — nenhuma quebra.
   - E2E Playwright crítico: `e2e/china-pipeline`, `e2e/china-timeline`,
     `e2e/aprovacoes` (verde).
   - Logs de Edge Function sem 500 novos.

### Fase 3 — Read-only soft em PROD

1. Ativar flag `READ_ONLY_MAINTENANCE=true` (env do front):
   - Banner discreto no topo: "Sincronização em andamento — leitura normal,
     novos lançamentos em ~2 min."
   - Botões de submit ficam `disabled` com tooltip.
2. Aplicar migration temporária:
   ```sql
   -- bloqueia writes sem afetar reads
   ALTER TABLE public.<core_tables> ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "_maint_block_writes" ON public.<t>
     FOR INSERT WITH CHECK (false);
   CREATE POLICY "_maint_block_updates" ON public.<t>
     FOR UPDATE USING (false);
   ```
   (Aplicar só em tabelas que serão tocadas pelo merge; lista em
   `scripts/recovery/_tables-merge.txt`.)

### Fase 4 — Merge em PROD (idempotente)

Ordem **obrigatória** (FK):

1. Cadastros base (empresas, profiles, user_roles) — só `ON CONFLICT DO NOTHING`.
2. Domínio China (`china_submissoes`, `china_anexos`, `china_chat_*`, …).
3. Domínio Fábrica BR (lista completa em `docs/incidents/2026-05-16-...md`).
4. Projetos, Trade, Marketing, Vendas.
5. Storage: `china-documentos`, `china-chat-anexos`, `pasta-digital`,
   `fabrica-*`, `projeto-anexos`, `meeting-recordings`, `trade-photos`,
   etc. — `upsert: false` para preservar versão restaurada.

Comando único:
```bash
RESTORE_DB_URL="$PROD_DB_URL" \
BACKUP_DIR=/mnt/documents/backup-full-20260518T161838Z \
bash scripts/recovery/silent-merge.sh
```

`silent-merge.sh` (a criar):
- Lê `_tables-merge.txt` em ordem topológica.
- Para cada tabela, carrega JSON em `_tmp_<t>`, faz
  `INSERT INTO public."<t>" SELECT * FROM _tmp_<t> ON CONFLICT (id) DO NOTHING`.
- Para storage, lê `_manifest.tsv` e re-uploada apenas os `path`s ausentes
  hoje (`HEAD` no bucket → 404 → upload).
- Loga TUDO em `/tmp/silent-merge-<TS>.log` com sha256 verificação por amostra.

### Fase 5 — Liberação + verificação

1. Remover policies `_maint_block_*`.
2. Desativar flag `READ_ONLY_MAINTENANCE`.
3. Forçar refetch global: bump em `APP_VERSION` (TanStack Query invalida cache).
4. Rodar `scripts/recovery/post-merge-verify.sh`:
   - count(*) PROD ≥ count(*) do backup, por tabela.
   - 10 amostras aleatórias por bucket → sha256 bate.
   - `select count(*) from china_submissoes where created_at > '2026-05-16'`
     ≥ valor capturado no backup.

### Fase 6 — Janela de observação (24h)

- Dashboard de alertas: 5xx por Edge Function, taxa de erro front, RLS denied.
- Canal #incidents-2026-05-16 com on-call.
- Rollback: se algo der errado **antes** da Fase 5, basta remover as
  policies de bloqueio — nenhum dado foi destruído. Se der errado **depois**,
  o merge é idempotente: re-rodar com novo dump não duplica.

---

## 3. Por que usuários não percebem

| Risco | Mitigação |
|---|---|
| Logout em massa | Não tocamos em `auth.users` / `auth.sessions`. |
| Perda de uploads pós-16 | Backup capturou 100% dos buckets (verify PASS). |
| Sobrescrita de correção manual | `ON CONFLICT DO NOTHING` + `upsert: false`. |
| Downtime visível | Janela read-only de ~2 min, dentro do retry do TanStack. |
| Duplicação de registros | Idempotência por PK (`id` uuid) em todas as tabelas. |
| FK violation no merge | Ordem topológica em `_tables-merge.txt`. |
| Cache stale no front | Bump de `APP_VERSION` força refetch. |
| Realtime fora de sincronia | Canais Supabase reconectam automaticamente. |

---

## 4. Checklist operacional (D-1)

- [ ] Backup verificado (`_verify-summary.md` = PASS).
- [ ] ZIP copiado para 2 locais externos.
- [ ] `silent-merge.sh` revisado e dry-run em SHADOW.
- [ ] `post-merge-verify.sh` revisado.
- [ ] Suporte Lovable em standby para PITR.
- [ ] On-call escalado, runbook deste arquivo aberto.
- [ ] Flag `READ_ONLY_MAINTENANCE` testada em staging.
- [ ] Comunicação interna preparada (não pública).

---

## 5. Pós-mortem

Atualizar `docs/incidents/2026-05-16-fabrica-br-data-loss.md` com:
- Timestamp de cada fase.
- Linhas reinseridas por tabela.
- Arquivos re-uploadados por bucket.
- Anomalias encontradas e tratamento.
