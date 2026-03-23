

# Elevar Nota de Conectividade: de 72 para 90+

## Diagnóstico Atual

O portal tem uma base sólida (40+ endpoints documentados, curl generator, fluxogramas, Excel export, chat de suporte). Mas um programador junior ainda enfrenta fricção por falta de exemplos completos, guias de troubleshooting e ferramentas de validação.

## O que falta (por impacto)

### 1. Exemplos de código completos em múltiplas linguagens
Hoje existe apenas o snippet de retry em Node.js e HMAC em Node/Python. Falta um exemplo end-to-end "Hello World" que mostre: autenticação, chamada, tratamento de erro e paginação. Linguagens: JavaScript/Node, Python, PHP e cURL.

### 2. Glossário de campos por endpoint
Os responses mostram apenas JSON de exemplo. Falta uma tabela campo-a-campo com tipo, obrigatoriedade e descrição (ex: `valor_documento: decimal, obrigatório — Valor do título em BRL`).

### 3. Guia de Troubleshooting / FAQ
Erros comuns que um dev junior enfrenta: "401 mas minha key está certa" (key expirada), "campo X obrigatório" (esqueceu empresa_id no upsert), "dados não aparecem" (falta sync de cadastros base). Um FAQ interativo resolve isso.

### 4. Ambiente de teste (Sandbox)
O `ApiTester` existe mas não está conectado visualmente à documentação. Cada endpoint deveria ter um botão "Testar" que preenche automaticamente o ApiTester com URL, method e body de exemplo.

### 5. BASE_URL dinâmica
A URL real do Supabase está hardcoded na linha 19. Deve ser substituída por `import.meta.env.VITE_SUPABASE_URL + "/functions/v1"` para segurança e portabilidade.

### 6. Indicador visual de padrão de paginação por API
Hoje existem 3 padrões listados genericamente. Cada API deveria ter um badge indicando qual padrão usa (Huggs / Legado / REST).

### 7. Status de disponibilidade das APIs (live badges)
Mostrar se cada API está online/offline via chamada ao `/status` endpoint, dando confiança ao dev antes de começar a integrar.

---

## Plano de Implementação

### Fase 1 — Exemplos e Glossário (maior impacto)

**Arquivo: `src/components/erp/ApiDocumentation.tsx`**

1. **Seção "Início Rápido" expandida** com exemplo completo em 4 linguagens (JS, Python, PHP, cURL) mostrando o fluxo: gerar key → health check → listar fornecedores → criar CP
2. **Tabela de campos** nos endpoints principais (CP /incluir, CR /incluir, Fornecedores /incluir) com colunas: Campo | Tipo | Obrigatório | Descrição
3. **Badge de paginação** em cada API card indicando o padrão usado
4. **BASE_URL dinâmica** via `import.meta.env.VITE_SUPABASE_URL`

### Fase 2 — Troubleshooting e Sandbox

**Arquivo: `src/components/erp/ApiDocumentation.tsx`**

5. **Seção FAQ/Troubleshooting** na sidebar com problemas comuns e soluções
6. **Botão "Testar este endpoint"** em cada `EndpointCard` que abre o ApiTester pré-preenchido

**Arquivo: `src/components/erp/ApiTester.tsx`**

7. Aceitar props de pré-preenchimento (URL, method, body, headers)

### Fase 3 — Status Live

**Arquivo: `src/components/erp/ApiStatusBadge.tsx`** (novo)

8. Componente que faz `GET /status` em cada API e mostra badge verde/vermelho
9. Integrar no header de cada API card

---

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `src/components/erp/ApiDocumentation.tsx` | Exemplos multilíngua, glossário de campos, FAQ, badge paginação, BASE_URL dinâmica, botão testar |
| `src/components/erp/ApiTester.tsx` | Aceitar props de pré-preenchimento |
| `src/components/erp/ApiStatusBadge.tsx` | **Novo** — Badge de status live |

## Estimativa de Impacto na Nota

| Melhoria | Pontos ganhos |
|---|---|
| Exemplos multilíngua completos | +6 |
| Glossário de campos | +4 |
| FAQ / Troubleshooting | +3 |
| Botão testar integrado | +2 |
| BASE_URL dinâmica | +1 |
| Badge de paginação | +1 |
| Status live | +1 |
| **Total estimado** | **+18 → Nota: 90/100** |

