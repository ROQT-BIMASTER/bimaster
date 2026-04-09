

# Revisão Completa do Painel de APIs ERP — Avaliação e Melhorias

## Avaliação como Empresa de ERP (Nota: 8.5/10)

### Pontos Fortes (o que já existe e é excelente)
- **Documentação estruturada** com 2242 linhas, 5 módulos, 30+ APIs, ~150 endpoints
- **Hello World em 4 linguagens** (cURL, JS, Python, PHP) — raro em portais ERP
- **Ordem de integração sugerida** — evita erros de referência para devs iniciantes
- **API Tester integrado** com Sandbox separado de produção
- **Postman Collection + OpenAPI 3.0 + Excel** para exportação
- **SDKs prontos** (TypeScript + Python) com interfaces tipadas
- **Chatbot IA** inline por endpoint
- **Onboarding Wizard** de 4 passos com teste real
- **Health check live** com badges de status
- **Changelog versionado** detalhado
- **FAQ + Troubleshooting** com 8 problemas comuns
- **Glossários de campos** para CP, CR e Fornecedores
- **Catálogo de 25 eventos webhook** com payload de exemplo
- **Guia HMAC, Retry/Backoff, Rotação de Key**
- **Erros específicos por endpoint** (CP, CR, Boletos, CC, Lançamentos)

### Gaps Identificados (-1.5 pontos)

| Gap | Impacto | Nota |
|-----|---------|------|
| Falta seção "Ambientes" (Base URL Sandbox vs Prod) claramente separada | Dev Jr confunde URLs | -0.3 |
| Exemplos de response em texto inline, não JSON formatado/parseado | Difícil copiar/ler | -0.2 |
| Falta tabela de "Status Codes por API" consolidada (qual API retorna 409 vs 422) | Dev Jr trata erros errado | -0.2 |
| Glossário FAQ mistura 2 seções (no Getting Started + no Glossary) — duplicação | Confusão de navegação | -0.1 |
| Contas a Receber tem menos endpoints documentados que CP (falta /listar completo com filtros, /parcelas, /estornar) | Assimetria na documentação | -0.3 |
| SDK Python não tem classes tipadas (é texto puro) | Dev Python tem menos suporte | -0.2 |
| Falta seção "Changelog de Breaking Changes" separada | Dev não sabe o que quebra | -0.1 |
| Falta badge "Deprecated" para endpoints legados | Dev usa endpoint errado | -0.1 |

### Sugestões de Melhoria

1. **Contas a Receber — Paridade com CP**: Adicionar endpoints faltantes na documentação (parcelas, pagamentos/recebimentos, anexos, estorno)
2. **Response Examples em JSON válido**: Formatar todos os `response` como JSON parseável (muitos têm `...` que quebra parse)
3. **Seção "Ambientes" dedicada**: Card no topo com Base URL de Produção e como ativar Sandbox
4. **Tabela de Compatibilidade de Erros**: Consolidar quais códigos cada API retorna
5. **SDK Python tipado**: Gerar classes dataclass ao invés de texto genérico
6. **Status Code 409 documentado**: Na seção de erros genéricos, o 409 (Conflict/Duplicidade) está faltando
7. **Mapa visual de dependências entre APIs**: Diagrama mostrando quais APIs dependem de quais cadastros
8. **Tempo estimado de integração por módulo**: "Cadastros Base: ~2h | Financeiro: ~4h | Webhooks: ~1h"

---

## Plano de Implementação

### Fase 1: Corrigir Gaps de Documentação no ApiDocumentation.tsx

**1.1 — Adicionar seção "Ambientes" no Getting Started**
- Card dedicado com Base URL de Produção e explicação do Sandbox
- Diferenciar visualmente Sandbox (laranja) vs Produção (verde)

**1.2 — Adicionar Status Code 409 na tabela de erros genéricos**
- Linha faltante: `409 | Conflict | Recurso duplicado | Use /upsert`

**1.3 — Expandir Contas a Receber**
- Adicionar endpoints: `/parcelas`, `/pagamentos` (recebimentos), `/anexos`, `/estornar`
- Adicionar filtros completos no `/listar` CR (espelhar os 15 filtros do CP)
- Adicionar glossário de campos completo para CR `/listar`

**1.4 — Adicionar badge "Deprecated" suporte**
- Nova prop `tag: "deprecated"` nos endpoints legados
- Badge visual vermelho "LEGADO" ao lado do endpoint

**1.5 — Mapa de Dependências visual**
- Diagrama ASCII/visual mostrando: Empresas → Clientes/Fornecedores → Categorias → CP/CR
- Adicionado na seção Getting Started

**1.6 — Tempo estimado de integração**
- Cards com estimativa: "Cadastros Base: ~2h | Financeiro Completo: ~4h | Webhooks: ~1h"

**1.7 — Remover duplicação FAQ**
- Unificar as 2 seções de FAQ (Getting Started FAQ + Glossary FAQ) em uma única seção

### Fase 2: Melhorar SDK Python (SdkDownloadButtons.tsx)

- Gerar classes Python com `dataclass` e type hints
- Adicionar tratamento de erro com exceções tipadas
- Adicionar suporte a paginação automática no SDK

### Fase 3: Garantir Criptografia Avançada em Todos os Ambientes

**3.1 — Verificar e documentar criptografia existente**
- OAuth tokens: AES via Vault (encrypt_token/decrypt_token) — OK
- Offline storage: AES-GCM 256-bit via Web Crypto API — OK
- API Keys: SHA-256 hash + timing-safe comparison — OK
- HMAC webhooks: SHA-256 — OK

**3.2 — Adicionar seção "Segurança" na documentação do Portal**
- Explicar ao integrador como os dados são protegidos
- Documentar que tokens nunca trafegam em plaintext
- Documentar TLS 1.3, HSTS, CSP headers

**3.3 — Validar que todos os edge functions do ERP usam security headers**
- Verificar `getSecurityHeaders()` / `withSecurityHeaders()` em todas as EFs do portal

---

## Arquivos Modificados

| Arquivo | Ação |
|---|---|
| `src/components/erp/ApiDocumentation.tsx` | Expandir CR, adicionar Ambientes, 409, dependências, tempos, unificar FAQ, badge deprecated |
| `src/components/erp/SdkDownloadButtons.tsx` | Melhorar SDK Python com dataclasses tipadas |
| `src/components/erp/ApiTester.tsx` | Adicionar presets para novos endpoints CR |

