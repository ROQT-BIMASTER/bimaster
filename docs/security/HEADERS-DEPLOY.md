# Deploy de headers de segurança — Cloudflare Worker

> Procedimento para garantir que `bimaster.online`, `www.bimaster.online` e
> `china.bimaster.online` enviem `X-Frame-Options`, `Content-Security-Policy`
> (com `frame-ancestors 'none'`), `HSTS`, `Permissions-Policy`, `COOP`, `CORP`
> e demais headers definidos em `public/_headers`.

## Por que existe

O hosting do Lovable **não honra** `public/_headers` nem `vercel.json`. Sem a
worker abaixo, `https://bimaster.online/` não envia proteção contra
clickjacking — qualquer site pode embutir o app num `<iframe>` e enganar
usuários logados a clicar em ações destrutivas (aprovar pagamento, excluir
conta, conceder permissão).

A worker faz duas coisas:

1. **Strip** de qualquer header conflitante vindo do upstream (Lovable).
2. **Injeta** o conjunto canônico de headers, espelhado de `public/_headers`.

Fonte de verdade: `cloudflare/worker.js` + `cloudflare/wrangler.toml`.

## Pré-requisitos (uma vez)

- Acesso à conta Cloudflare onde a zona `bimaster.online` está cadastrada.
- Node/Bun local (qualquer versão recente).
- `wrangler` (vem via `npx`, não precisa instalar global).

## Deploy de produção

```bash
cd cloudflare

# 1. Autenticar (abre browser para OAuth Cloudflare).
npx wrangler login

# 2. Deploy. Cria a worker, faz bind das 3 rotas declaradas em wrangler.toml:
#    - bimaster.online/*
#    - www.bimaster.online/*
#    - china.bimaster.online/*
npx wrangler deploy

# 3. Validar headers em produção.
curl -sI https://bimaster.online/       | grep -iE "frame|content-security|strict-transport"
curl -sI https://www.bimaster.online/   | grep -iE "frame|content-security|strict-transport"
curl -sI https://china.bimaster.online/ | grep -iE "frame|content-security|strict-transport"

# 4. Validar via E2E (esperado: 7/7 PASS).
bash ../scripts/security/e2e-clickjacking.sh
```

## Atualizações (sempre que `worker.js` mudar)

```bash
cd cloudflare
npx wrangler deploy
bash ../scripts/security/e2e-clickjacking.sh
```

A worker é **stateless**, deploy é instantâneo (~2s). Reversível com:

```bash
npx wrangler delete    # remove a worker e libera as rotas
```

## Deploy de staging (opcional)

Aponta para o preview do Lovable em vez da publicação:

```bash
cd cloudflare
npx wrangler deploy --env staging
```

## Diagnóstico — sintomas comuns

| Sintoma | Causa provável | Correção |
|---|---|---|
| `wrangler deploy` falha com "zone not found" | A zona `bimaster.online` está em outra conta Cloudflare. | `npx wrangler login` na conta correta, ou ajustar `account_id` em `wrangler.toml`. |
| `curl` ainda não mostra `X-Frame-Options` | Cache de DNS/edge ou rota não bindada. | Aguardar 1–2 min; conferir em Cloudflare dashboard → Workers & Pages → Triggers. |
| E2E reporta `https://lovable.dev` como bloqueado | A CSP está estrita demais para o preview do Lovable. | Não é problema em produção — o teste assume `frame-ancestors 'none'` com whitelist apenas para o preview do projeto. |
| Apps que dependem de iframe (ex.: portal embed) quebram | `frame-ancestors 'none'` bloqueia todo embed. | Adicionar origem específica em `worker.js` `CSP` e re-deploy. |

## Sincronia com outras fontes de verdade

`public/_headers`, `vercel.json` e `netlify.toml` definem o mesmo conjunto de
headers. Quando `worker.js` mudar (ex.: novo host em `connect-src`), atualizar
**todos** para manter paridade caso a hospedagem migre no futuro.

Memória relacionada: `mem://infra/cloudflare-worker-deploy`.
