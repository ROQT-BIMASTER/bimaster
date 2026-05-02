## Objetivo

Destravar o CI `e2e-clickjacking.sh` (4 testes vermelhos hoje em `bimaster.online`) **sem regressão de segurança** e sem quebrar Stripe/Turnstile/Lovable script. A CSP atual do repo já é mais estrita e mais completa que a proposta inicial; só faltam 3 origens de integrações reais (Phyllo, ShipsGo, Pluggy).

A causa real da falha do CI **não é o conteúdo** dos arquivos — é que `cloudflare/worker.js` ainda não foi deployado. Você roda o `wrangler deploy` ao final.

## Decisões tomadas (já confirmadas com você)

1. **CSP**: manter a versão atual do repo (`X-Frame-Options: DENY`, `frame-ancestors 'none'`) e **só** adicionar Phyllo/ShipsGo/Pluggy em `connect-src`.
2. **Branch/PR**: commit direto em `main` (Lovable não suporta criar branch separada do agent).
3. **Deploy em produção**: você roda `npx wrangler deploy` manualmente após eu atualizar os arquivos. Documentação já existe em `docs/SECURITY-HEADERS-DEPLOY.md`.

## Mudanças

### 1. `cloudflare/worker.js` (fonte de verdade real)
Adicionar à linha 39 (array `connectSrc`):
```
"https://*.phyllo.com",
"https://*.shipsgo.com",
"https://api.pluggy.ai",
```

### 2. `public/_headers` (paridade com o worker, mesmo sendo decorativo no Lovable hosting)
Adicionar `https://*.phyllo.com https://*.shipsgo.com https://api.pluggy.ai` ao final do `connect-src` na linha 31.

### 3. `vercel.json` (paridade caso o hosting mude)
Mesma adição em `connect-src` na linha 20.

### 4. `docs/security/HEADERS.md` (novo)
Documento canônico curto com:
- Hosting real: Lovable atrás do CF da própria Lovable. `bimaster.online` exige Cloudflare Worker próprio (`cloudflare/worker.js`) deployado em zone separada para receber headers.
- `public/_headers` e `vercel.json` ficam por **paridade defensiva** (caso troquemos hosting) — não são aplicados em produção hoje.
- Lista das origens permitidas em cada diretiva da CSP, agrupadas por integração (Supabase, Mapbox, Google, Stripe, ElevenLabs, OpenAI, Asana, Lovable, **Phyllo**, **ShipsGo**, **Pluggy**, Turnstile).
- Como validar localmente:
  ```bash
  bash scripts/security/e2e-clickjacking.sh
  ```
  Depois do `wrangler deploy`, esperado 7/7 verdes.
- Como adicionar nova origem no futuro: editar **os 3 arquivos** + redeploy do worker.
- Link cruzado para `docs/SECURITY-HEADERS-DEPLOY.md` (runbook do deploy).

## Validação

Após as edições, no agent:
- Eu rodo `curl -sI https://bimaster.online/` para mostrar que **ainda não tem headers** (esperado — falta o deploy).
- Eu rodo `bash scripts/security/e2e-clickjacking.sh` localmente apontando para `https://bimaster.online/` → continuará 4/7 vermelho (esperado, prova que o gap está no edge, não no código).

Após **você** rodar `cd cloudflare && npx wrangler deploy`:
- `curl -sI https://bimaster.online/` deve mostrar `x-frame-options: DENY` e a CSP completa.
- `bash scripts/security/e2e-clickjacking.sh` deve dar 7/7 verde.
- O job `security-rls-e2e.yml` no próximo push de qualquer commit fica verde sozinho.

## Arquivos tocados (4 arquivos, 4 commits-equivalentes)

```text
cloudflare/worker.js          ← +3 origens em connectSrc
public/_headers               ← +3 origens em connect-src (paridade)
vercel.json                   ← +3 origens em connect-src (paridade)
docs/security/HEADERS.md      ← novo doc (~120 linhas)
```

Nenhum CSS, nenhum componente, nenhuma edge function, nenhuma migration tocada.

## Itens do seu pedido original que **não** vou executar (e por quê)

- **Branch `fix/security-headers-production`** + **PR draft**: inviável pelo agent Lovable (sync auto com `main`). Você confirmou OK em `main`.
- **CSP que você colou literalmente**: causaria regressão (XFO `DENY → SAMEORIGIN`, frame-ancestors `'none' → 'self' lovable.dev *.lovable.app`, perda de Stripe/Turnstile/cdn.gpteng.co em script-src). Você confirmou manter a CSP atual estrita.
- **Auditar todas as origens externas em src/**: já feito anteriormente — a CSP atual cobre tudo exceto Phyllo/ShipsGo/Pluggy, que esta PR resolve.
- **Não duplicar XFO/frame-ancestors em meta**: já está garantido — `index.html` não tem essas metas hoje.
