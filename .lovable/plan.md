## Escopo real (após auditoria)

A maior parte do prompt V3 já foi executada em rodadas anteriores. Aplicar o prompt cegamente **quebraria** trabalho consolidado (ex.: sobrescrever `docs/security/README.md` apontaria para paths antigos `docs/SECURITY-*.md` que já foram movidos para `docs/security/`).

### Já existe — não tocar
- `LICENSE`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`
- `.github/CODEOWNERS`, `PULL_REQUEST_TEMPLATE.md`, `ISSUE_TEMPLATE/{bug,feature}.md`
- `docs/security/README.md` (índice já correto, aponta para os 14 arquivos consolidados em `docs/security/`)
- 12 `docs/PROMPT-LOVABLE-*.md` já apagados

### Pendências reais — duas edições mínimas

**1. `SECURITY.md` (raiz, linha 25) — atualizar escopo**

Trocar a seção "Escopo" para usar `bimaster.online` como domínio canônico:

```markdown
## Escopo

Aplicações em produção:

- `https://bimaster.online` e subdomínios (`app.bimaster.online`,
  `api.bimaster.online`, `china.bimaster.online`)
- Edge Functions hospedadas no backend gerenciado do projeto
- Endpoints de integração ERP (`/api/*`)

Fora de escopo: serviços de terceiros (Cloudflare, backend gerenciado, OAuth
providers), ataques de engenharia social, DoS volumétrico.
```

**2. `docs/INFRASTRUCTURE.md` (linha 9) — adicionar canônico, manter origem técnica**

Reescrever a linha 9 para algo como:

```markdown
- **Domínio canônico**: `bimaster.online` (e subdomínios `app.`, `api.`,
  `china.`). Origem real do hosting: `bimaster.lovable.app` (proxiada via
  Cloudflare Worker — ver `cloudflare/worker.js`).
```

### NÃO mexer (regras invioláveis confirmadas)
- `cloudflare/worker.js` e `cloudflare/wrangler.toml` — `bimaster.lovable.app` é a origem real do proxy
- `_headers`, `package.json`, `_shared/ai-gateway-call.ts`
- `AI_CONTEXT.md` — mantido (system prompt portátil referenciado por `AGENTS.md`)
- `docs/security/README.md` — já correto, sobrescrever quebraria links

### Validação pós-edição

```bash
grep -n "bimaster.online" SECURITY.md docs/INFRASTRUCTURE.md
grep -q "bimaster.lovable.app" cloudflare/worker.js && echo "ORIGIN preservado OK"
grep -rn "bimaster.lovable.app" SECURITY.md docs/onboarding/ \
  && echo "FALHA" || echo "URL canônica OK em docs públicos"
```

Build/lint/tests rodam pelo harness automaticamente.

### Resumo do impacto

- 2 arquivos editados (apenas docs)
- 0 arquivos criados
- 0 arquivos apagados
- 0 mudança de código de produção
- Risco: nenhum — só strings em markdown
