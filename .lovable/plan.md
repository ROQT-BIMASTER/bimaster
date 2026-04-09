

# Tratamento dos Riscos de Segurança Detectados pelos Scanners

## Riscos Identificados (imagem)

| # | Scanner | Risco | Causa |
|---|---------|-------|-------|
| 1 | OpenVAS | TCP Timestamps Information Disclosure | Configuração de servidor/rede — fora do controle do app |
| 2 | ZAP | HSTS definido via META (não-compliant) | `<meta http-equiv="Strict-Transport-Security">` — inválido por spec, deve ser HTTP header |
| 3 | ZAP | X-Frame-Options definido via META (não-compliant) | `<meta http-equiv="X-Frame-Options">` — inválido por spec, deve ser HTTP header |
| 4 | ZAP | CSP: style-src unsafe-inline | CSP permite `'unsafe-inline'` em styles |
| 5 | ZAP | CSP: script-src unsafe-inline | CSP permite `'unsafe-inline'` em scripts |

## Solução

### 1. Remover meta tags inválidas do `index.html`

HSTS e X-Frame-Options **não funcionam como meta tags** — os browsers ignoram. Removê-las elimina os alertas do ZAP e reduz confusão.

Remover linhas 7, 8, 10, 11, 12 (os meta http-equiv de segurança) do `index.html`.

### 2. Adicionar `public/_headers` para headers HTTP reais

Criar arquivo `public/_headers` que configura os headers corretos no nível HTTP:

```
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(self)
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob: https://storage.googleapis.com https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests
```

### 3. CSP sem `unsafe-inline` — usar hash/nonce

Remover `'unsafe-inline'` do CSP para scripts e styles. O Vite com `react-swc` e `injectRegister: false` não injeta scripts inline, então é seguro. Para styles inline do Tailwind/Radix, usar `'unsafe-hashes'` com os hashes específicos ou, se necessário, manter temporariamente para styles e documentar como finding aceito.

**Abordagem pragmática**: Remover `'unsafe-inline'` de `script-src` (crítico). Para `style-src`, manter por enquanto pois Tailwind/Radix geram estilos inline — criar finding informativo.

### 4. Atualizar CSP no Edge Functions (`_shared/security-headers.ts`)

Alinhar o CSP retornado pelas Edge Functions com o mesmo padrão endurecido (sem `unsafe-inline` em script-src).

### 5. TCP Timestamps — Registrar como finding informativo

Este risco é de nível de rede/servidor e não pode ser corrigido no código da aplicação. Será documentado como finding ignorado com justificativa.

## Arquivos

| Arquivo | Tipo |
|---------|------|
| `index.html` | Edição — remover meta tags inválidas |
| `public/_headers` | Novo — headers HTTP reais |
| `supabase/functions/_shared/security-headers.ts` | Edição — CSP endurecido |

