# Prompt Lovable — Aplicar integração iPaper (feed de estoque do catálogo)

> Usar DEPOIS do merge da PR `feat/ipaper-feed-estoque` na main.
> Copiar e colar o bloco abaixo no Lovable.

---

Aplique a integração do feed iPaper que acabou de chegar na main. São 3 passos: migration, secret e smoke test. Não altere nenhum outro arquivo.

**1. Aplicar a migration**

Aplique a migration `supabase/migrations/20260708120000_10489031-496f-47a8-a008-0e59e170697c.sql` no banco. Ela cria a tabela `ipaper_produtos` com RLS (leitura authenticated via check_user_access, escrita só service role) e faz o seed de 1.534 produtos do catálogo iPaper.

Depois de aplicar, valide:

```sql
SELECT count(*) AS total,
       count(*) FILTER (WHERE codhb IS NULL) AS sem_codhb,
       count(*) FILTER (WHERE preco IS NULL) AS sem_preco
FROM public.ipaper_produtos;
-- esperado: total = 1534, sem_codhb = 1, sem_preco = 0
```

E confirme o casamento com o estoque da Futura (deve casar a grande maioria):

```sql
SELECT count(DISTINCT p.codhb) AS codigos_catalogo,
       count(DISTINCT p.codhb) FILTER (
         WHERE EXISTS (
           SELECT 1 FROM public.fornecedor_estoque_futura f
           WHERE upper(trim(f.codigo_produto)) = upper(trim(p.codhb))
         )
       ) AS com_estoque_futura
FROM public.ipaper_produtos p
WHERE p.codhb IS NOT NULL;
```

Me informe os dois resultados.

**2. Configurar o secret**

Crie o secret de edge function `IPAPER_FEED_TOKEN` com um token aleatório forte (mínimo 32 caracteres, use gerador seguro). Esse token vai na URL do feed que o iPaper consome. Me devolva o token gerado para eu configurar no admin do iPaper.

**3. Deploy e smoke test da function**

Garanta que a edge function `ipaper-feed` está deployada (ela veio na main, em `supabase/functions/ipaper-feed/index.ts`, e já está registrada no config.toml com verify_jwt = false).

Smoke test — a URL abaixo (com o token do passo 2) deve responder 200 com CSV começando pelo header `ID,NAME,STOCK,DESCRIPTION,CODHB,PRICE,PACKAGE SIZE` e ~1.534 linhas:

```
https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-feed?token=<TOKEN>
```

Teste também que sem token (ou com token errado) responde 401.

---

## Depois do Lovable (manual, no admin.ipaper.io)

1. Entrar em admin.ipaper.io com o time do catálogo.
2. Configurar a Enrichment Automation apontando para a URL do feed (com o token). Se a opção não aparecer, abrir chamado com support@ipaper.io informando a URL — eles configuram o EA para o cenário (é o fluxo padrão deles).
3. Escolher geração "On request" e ativar Auto Update nos catálogos.
4. Rodar uma atualização e conferir 3–5 produtos contra o estoque real.
