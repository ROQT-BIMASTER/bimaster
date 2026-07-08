# Prompt Lovable — iPaper fase 2: filtro de filiais + push automático via Backend API

> Usar DEPOIS do merge da PR `feat/ipaper-push` na main.
> Copiar e colar o bloco abaixo no Lovable.

---

Aplique a fase 2 da integração iPaper que chegou na main. Não altere nenhum outro arquivo.

**Contexto do que veio na main:**
- Migration `20260708190000_b7e4d2f1-…` — recria `erp_estoque_live` com dimensão de filial (PK erp_id = empresa-cod_produto) e agenda 2 crons (`sync-estoque-live-horario` e `ipaper-push-horario`).
- `erp-sync-engine` — rota `sync-estoque-live` agora calcula o disponível POR FILIAL (empresas 6, 9, 10, 11 por padrão; configurável via env `IPAPER_EMPRESAS`).
- Edge function nova `ipaper-push` — gera o XLSX do catálogo e sobe via Backend API do iPaper (Media.UploadFile, sobrescreve por nome).
- `_shared/ipaper-data.ts` — lógica de dados compartilhada entre feed e push.

**Passos:**

1. Aplique a migration `20260708190000_b7e4d2f1-8c3a-4e5b-9d6f-2a1b3c4d5e6f.sql`. Ela dá DROP/CREATE na `erp_estoque_live` (tabela-espelho descartável) e cria os crons. Se a policy falhar por assinatura de `check_user_access`, use `public.check_user_access(auth.uid(), 'estoque')` como nas demais.

2. Secret `IPAPER_API_KEY`: peça para eu colar via add_secret (UI segura) — a chave da Backend API do iPaper que o usuário gerou no admin (Username=APIKey na chamada).

3. Garanta deploy de `ipaper-push`, `ipaper-feed` e `erp-sync-engine`.

4. Dispare a recarga do estoque por filial:
   ```
   POST /erp-sync-engine  body: {"path":"sync-estoque-live"}
   ```
   Esperado: success, ~2.700 linhas (4 filiais), campo `empresas: [6,9,10,11]`.

5. Valide:
   ```sql
   SELECT empresa, count(*) AS produtos, sum(estoque_disponivel) AS saldo
   FROM public.erp_estoque_live GROUP BY empresa ORDER BY empresa;
   -- esperado: 4 linhas (empresas 6, 9, 10, 11)
   ```

6. Dispare o push do arquivo para o iPaper:
   ```
   POST /ipaper-push  body: {}
   ```
   Esperado: `success: true`, `arquivo: ESTOQUE-CATALOGOS-HUUGS-AUTO.xlsx`, `linhas: ~1534`, `fileId` numérico.

7. Me reporte: counts do passo 5, resposta completa do passo 6, e status dos crons (`SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%estoque-live%' OR jobname LIKE '%ipaper%';`).

---

## Depois do Lovable (manual, no admin.ipaper.io — 1 minuto)

1. Flipbook "Catálogo interativo Ruby Rose" → ⋯ → Update enrichments → lápis da "Automação de Enriquecimento" → **Select Excel file** → escolher `ESTOQUE-CATALOGOS-HUUGS-AUTO.xlsx` (pasta Data) → Save → Update enrichments.
2. Pronto: o Auto Update passa a re-executar sempre com esse arquivo, que os crons sobrescrevem de hora em hora.
3. A partir daí ninguém sobe mais planilha — para mudar as filiais do catálogo, basta ajustar a env `IPAPER_EMPRESAS` (ex.: "6,10,11") e rodar o sync.
