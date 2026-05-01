# Security E2E Suite

Conjunto de testes que validam, sem mocks, comportamento de segurança contra
o backend e o site público reais.

## Scripts

### `e2e-anonymous-sensitive-columns.sh`
Garante que tabelas com colunas sensíveis (`our_products.cost`,
`our_products.margin_percentage`, `product_comparisons.*`,
`social_media_metrics_history.*`) **não respondem dados** a requisições
PostgREST anônimas — em qualquer variante (`select=*`, `select=col`,
`order=col.desc`, `col=gt.0`, `count`).

Roda 96 probes. Saída esperada: `96 passed, 0 failed`.

### `e2e-authenticated-sensitive-columns.sh`
Faz login via GoTrue com `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` e confirma
que o usuário autenticado **consegue** ler as mesmas colunas (HTTP 200).

Skipa silenciosamente (exit 0) se as credenciais não estiverem definidas.

### `e2e-clickjacking.sh`  ← novo
Verifica proteção contra clickjacking no site público:

1. Inspeciona headers HTTP da resposta (`X-Frame-Options`, `Content-Security-Policy`).
2. Inspeciona `<meta http-equiv="Content-Security-Policy">` no HTML.
3. Avalia diretiva `frame-ancestors` efetiva.
4. Testa que **origens externas** (`evil.example.com`, etc.) são bloqueadas.
5. Testa que **origens permitidas** (`*.lovable.app`, `lovable.dev`) podem
   embutir.

Uso:
```bash
# Padrão: testa bimaster.online
bash scripts/security/e2e-clickjacking.sh

# Ou aponta para outro alvo
TARGET_URL=https://china.bimaster.online bash scripts/security/e2e-clickjacking.sh
```

#### Limitação importante
O hosting gerenciado da Lovable + Cloudflare **não envia** `X-Frame-Options`
nem `Content-Security-Policy: frame-ancestors` como header HTTP. A proteção
está implementada via `<meta http-equiv="Content-Security-Policy">` em
`index.html`. **Essa meta só passa a vigorar após `Publish`** — frontend não
publica automaticamente.

Por isso, se rodar o script logo após editar `index.html` mas antes de
publicar, ele falhará — e isso é **comportamento correto**: ele está dizendo
"a versão pública ainda não tem a proteção".

#### Fixtures HTML manuais
Em `fixtures/`:
- `clickjacking-attacker.html` — abre num servidor externo (qualquer origem
  diferente de `bimaster.online`) e o iframe **deve ficar em branco**.
- `preview-allowed.html` — abre a partir de `*.lovable.app` ou
  `lovable.dev` e o iframe **deve renderizar o app normalmente**.

Use estes fixtures para validação visual em navegadores reais.

## CI

Workflow `.github/workflows/security-rls-e2e.yml`:
- Job `anonymous-lockdown`: roda `e2e-anonymous-sensitive-columns.sh` em
  todo PR e push para `main`.
- Job `authenticated-access`: roda `e2e-authenticated-sensitive-columns.sh`
  se os secrets `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` estiverem
  configurados.

> O `e2e-clickjacking.sh` ainda **não está no CI** porque depende de
> `Publish` manual do frontend. Rode-o sob demanda após cada publicação.

## Adicionar novas tabelas/colunas sensíveis

Edite o array `TABLES` no topo de cada script. O probe gera as variantes
automaticamente.
