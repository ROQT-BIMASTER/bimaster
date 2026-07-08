# Prompt Lovable — Aplicar integração iPaper (feed de estoque do catálogo)

> Usar DEPOIS do merge da PR `feat/ipaper-feed-estoque` na main.
> Copiar e colar o bloco abaixo no Lovable.

---

Aplique a integração do feed iPaper que acabou de chegar na main. São 4 passos: migrations, secret, deploy/sync e smoke test. Não altere nenhum outro arquivo.

**1. Aplicar as 2 migrations**

- `supabase/migrations/20260708120000_10489031-496f-47a8-a008-0e59e170697c.sql` — cria `ipaper_produtos` (de-para do catálogo iPaper) com seed de 1.534 produtos.
- `supabase/migrations/20260708130000_a3f2c1d8-5b6e-4f7a-9c0d-1e2f3a4b5c6d.sql` — cria `erp_estoque_live` (saldo disponível do força de vendas do Result).

Valide:

```sql
SELECT count(*) AS total,
       count(*) FILTER (WHERE codhb IS NULL) AS sem_codhb
FROM public.ipaper_produtos;
-- esperado: total = 1534, sem_codhb = 1
```

**2. Configurar o secret**

Crie o secret de edge function `IPAPER_FEED_TOKEN` com um token aleatório forte (mínimo 32 caracteres, gerador seguro). Me devolva o token para eu configurar no admin do iPaper.

**3. Deploy + primeira carga do estoque live**

Garanta o deploy das functions `ipaper-feed` (nova) e `erp-sync-engine` (ganhou a rota `sync-estoque-live`). Depois dispare a primeira carga:

```
POST https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine
Body: { "path": "sync-estoque-live" }
(com Authorization: Bearer <service role key>)
```

Esperado: `success: true`, ~5.900 linhas. Valide o casamento com o catálogo:

```sql
SELECT count(*) AS produtos_catalogo,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM public.erp_estoque_live e
         WHERE e.cod_fabricante = upper(trim(p.codhb))
       )) AS com_saldo_live,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM public.erp_estoque_live e
         WHERE e.cod_fabricante = upper(trim(p.codhb)) AND e.preco_venda > 0
       )) AS com_preco_live
FROM public.ipaper_produtos p
WHERE p.codhb IS NOT NULL;
-- esperado: ~1480 de 1533 com saldo e preço live
```

**4. Smoke test do feed**

A URL abaixo (com o token do passo 2) deve responder 200 com CSV começando por `ID,NAME,STOCK,DESCRIPTION,CODHB,PRICE,PACKAGE SIZE` e ~1.534 linhas:

```
https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-feed?token=<TOKEN>
```

Sem token ou com token errado deve responder 401.

Me informe: os counts do passo 1 e 3, e o resultado do smoke test.

---

## Depois do Lovable (manual, no admin.ipaper.io)

1. Entrar em admin.ipaper.io com o time do catálogo.
2. Configurar a Enrichment Automation apontando para a URL do feed (com o token). Se a opção não aparecer no admin, abrir chamado com support@ipaper.io informando a URL — eles montam o EA para o cenário (fluxo padrão deles; as colunas do feed são idênticas à planilha que já era importada).
3. Escolher geração "On request" e ativar Auto Update nos catálogos.
4. Rodar uma atualização e conferir 3–5 produtos contra o app do força de vendas.
