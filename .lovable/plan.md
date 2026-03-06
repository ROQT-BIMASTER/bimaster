

## Análise Consolidada de Segurança — bimaster.online

### Resumo de Todos os Scans

| Scan | Score | Vulnerabilidades |
|------|-------|-----------------|
| **SSLyze** | 1,000/1,000 ✅ | 0 |
| **Nmap UDP** | 1,000/1,000 ✅ | 0 |
| **Nmap TCP** | 5/1,000 ⚠️ | 2 Médias (portas 8080, 8443) + 2 Baixas |
| **Nuclei** | 1,000/1,000 ✅ | 0 |
| **OWASP ZAP Passiva** | — ⚠️ | 1 Média (4 instâncias) |

### Nova Vulnerabilidade: Anti-Clickjacking (ZAP)

**Severidade**: Média
**CWE**: 1021 | **WASC**: 15
**Problema**: O header `X-Frame-Options` está configurado no `vite.config.ts` (dev server), mas **não é servido em produção** pelo Lovable/Cloudflare. A resposta HTTP capturada pelo ZAP confirma que `X-Frame-Options` está **ausente**.

**Por quê?** Os headers no `vite.config.ts` só funcionam no servidor de desenvolvimento do Vite. Em produção (Lovable deploy via Cloudflare), esses headers não são injetados.

### Solução

Adicionar meta tags de Content-Security-Policy diretamente no `index.html`, que é a única forma de controlar headers quando não se tem acesso ao servidor de produção:

**Arquivo**: `index.html`
- Adicionar `<meta http-equiv="Content-Security-Policy" content="frame-ancestors 'self'">`
- Isso substitui a funcionalidade do `X-Frame-Options: SAMEORIGIN` e é suportado por todos os navegadores modernos

### O que será feito

| Ação | Arquivo | Detalhe |
|------|---------|---------|
| Editar | `index.html` | Adicionar meta CSP com `frame-ancestors 'self'` |

Isso resolve a vulnerabilidade CWE-1021 reportada pelo OWASP ZAP, impedindo que o site seja embutido em iframes de terceiros (proteção contra clickjacking).

