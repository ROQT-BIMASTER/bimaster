

# Blindar Autenticação em Todas as APIs do Portal ERP

## Diagnóstico

Auditoria identificou 4 categorias de falha em 17+ APIs:

| Problema | APIs Afetadas | Risco |
|----------|--------------|-------|
| `/status` público (antes do auth) | origens, paises, parcelas, bancos, bandeiras, cidades, cnae, empresas, clientes, contas-receber, finalidades-transferencia, dre-cadastro, categorias | Exposição de rotas internas |
| Auth customizado sem audit log | estoque-api, fiscal-iva-api | Chamadas invisíveis na auditoria |
| Cópia local de `validateAnyAuth` sem logging | movimentos-financeiros-api, pesquisar-lancamentos-api | Chamadas invisíveis na auditoria |
| Usa `validateApiKey` direto (sem logging) | categorias-api | Chamadas invisíveis na auditoria |

## Solução

### Fase 1 — Mover `/status` para depois do auth (13 APIs)

Em cada API que tem o bloco `if (path === "/status")` **antes** do `validateAnyAuth`/`validateErpAuth`, mover esse bloco para **depois** da autenticação. Assim, até o health check exige token.

APIs: `origens-api`, `paises-api`, `parcelas-api`, `bancos-api`, `bandeiras-api`, `cidades-api`, `cnae-api`, `empresas-api`, `clientes-api`, `contas-receber-api`, `finalidades-transferencia-api`, `dre-cadastro-api`, `categorias-api`

### Fase 2 — Substituir auth customizado por `validateAnyAuth` (2 APIs)

**estoque-api**: Remover bloco manual de auth (linhas 16-65) e substituir por `validateAnyAuth` importado de `_shared/auth.ts`. Isso garante logging automático.

**fiscal-iva-api**: Já usa `secureHandler` com `auth: "none"` + auth manual interno. Substituir por `validateAnyAuth` após o secureHandler, removendo validação manual de JWT.

### Fase 3 — Remover cópias locais de `validateAnyAuth` (2 APIs)

**movimentos-financeiros-api** e **pesquisar-lancamentos-api**: Ambos definem uma função local `validateAnyAuth` que chama `validateJWT`/`validateApiKey` sem logging. Substituir pela importação da função compartilhada de `_shared/auth.ts`.

### Fase 4 — Trocar `validateApiKey` por `validateAnyAuth` (1 API)

**categorias-api**: Usa `validateApiKey` diretamente, que não registra na auditoria. Trocar por `validateAnyAuth` para aceitar JWT e API Key com logging.

### Fase 5 — Deploy

Deploy de todas as 18 funções editadas em lotes.

## Detalhes Técnicos

### Padrão antes (vulnerável)
```text
if (path === "/status") return jsonResponse({...}) // ← SEM AUTH
const auth = await validateAnyAuth(req)            // ← AUTH depois
```

### Padrão depois (correto)
```text
const auth = await validateAnyAuth(req)            // ← AUTH primeiro
if (path === "/status") return jsonResponse({...}) // ← Protegido
```

### Arquivos editados

| Arquivo | Mudança |
|---------|---------|
| `origens-api/index.ts` | Mover `/status` após auth |
| `paises-api/index.ts` | Mover `/status` após auth |
| `parcelas-api/index.ts` | Mover `/status` após auth |
| `bancos-api/index.ts` | Mover `/status` após auth |
| `bandeiras-api/index.ts` | Mover `/status` após auth |
| `cidades-api/index.ts` | Mover `/status` após auth |
| `cnae-api/index.ts` | Mover `/status` após auth |
| `empresas-api/index.ts` | Mover `/status` após auth |
| `clientes-api/index.ts` | Mover `/status` após auth |
| `contas-receber-api/index.ts` | Mover `/status` após auth |
| `finalidades-transferencia-api/index.ts` | Mover `/status` após auth |
| `dre-cadastro-api/index.ts` | Mover `/status` após auth |
| `categorias-api/index.ts` | Mover `/status` + trocar `validateApiKey` → `validateAnyAuth` |
| `estoque-api/index.ts` | Substituir auth manual → `validateAnyAuth` |
| `fiscal-iva-api/index.ts` | Substituir auth manual → `validateAnyAuth` |
| `movimentos-financeiros-api/index.ts` | Remover cópia local → importar `validateAnyAuth` |
| `pesquisar-lancamentos-api/index.ts` | Remover cópia local → importar `validateAnyAuth` |

Nenhuma mudança no banco de dados. Nenhuma mudança funcional — apenas reordenação e padronização da autenticação.

