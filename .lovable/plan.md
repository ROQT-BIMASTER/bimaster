

# Estado Atual vs 100 — O que falta

## Já implementado (v1.7.0) — Nota estimada: 97/100

Todos os 8 itens de alto impacto do plano anterior foram implementados:
- Glossários CR + Fornecedores, paginação iterativa, mapa de erros, Postman Collection, webhook payload, versionamento, rotação de chave, quotas consolidadas.

## 3 pontos restantes (pendentes na tabela de gaps)

| # | Gap | Impacto | Complexidade |
|---|---|---|---|
| 1 | **Status Page global no sidebar** — resumo consolidado (X online, Y offline, latencia media) em vez de badges individuais | +1.5 pt | Media — novo componente no sidebar que agrega dados dos ApiStatusBadge existentes |
| 2 | **Toggle EN/PT na documentacao** — internacionalização básica do portal para devs que não falam português | +1 pt | Alta — exige extrair ~200 strings para um dicionário i18n |
| 3 | **Suprimir erros de console** — os status checks ainda geram ruído no console do navegador (401/405 logados pelo platform reporter) | +0.5 pt | Baixa — usar `mode: "no-cors"` ou mover para edge function proxy |

## Recomendação de implementação

### Fase 1 — Status Page Global (+1.5 pt)

**Novo arquivo: `src/components/erp/ApiGlobalStatus.tsx`**
- Componente que recebe a lista de basePaths de todas as APIs
- Faz fetch paralelo de `/status` em cada uma (reutilizando lógica do ApiStatusBadge)
- Exibe card resumo: "12/14 online — Latência média: 145ms"
- Integrar no sidebar do ApiDocumentation como primeiro item

**Arquivo: `src/components/erp/ApiDocumentation.tsx`**
- Adicionar ApiGlobalStatus no topo do sidebar, acima dos módulos

### Fase 2 — Supressão de console noise (+0.5 pt)

**Arquivo: `src/components/erp/ApiStatusBadge.tsx`**
- Criar edge function proxy `api-status-check` que faz os health checks server-side
- Ou: usar `supabase.functions.invoke("api-health-check")` que já existe, adaptando para retornar status por API individual
- Isso elimina os fetch diretos do browser que geram 401/405 no console

### Fase 3 — Toggle EN/PT (+1 pt) — Opcional

**Novo arquivo: `src/components/erp/i18n.ts`**
- Dicionário simples `{ pt: {...}, en: {...} }` com ~200 strings
- Context provider para idioma selecionado
- Toggle no header do portal

**Recomendação**: Fase 3 tem alto custo e baixo retorno dado o público-alvo (100% BR). Implementar apenas Fases 1 e 2 já eleva para ~99/100.

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/components/erp/ApiGlobalStatus.tsx` | **Novo** — Status consolidado |
| `src/components/erp/ApiDocumentation.tsx` | Integrar ApiGlobalStatus no sidebar |
| `src/components/erp/ApiStatusBadge.tsx` | Mover checks para server-side (proxy) |

