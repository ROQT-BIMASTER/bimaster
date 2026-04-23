

# Plano — Calendário do Contas a Pagar carregando só 1 mês (regressão por bundle stale)

## Diagnóstico

Investiguei os logs do edge function `contas-pagar-api` em produção (últimas requisições do usuário às 20:11 BRT):

```
✅ query {"filters":{"limit":1000,"offset":0},"results":1000,"total":6468}
✅ query {"filters":{"limit":1000,"offset":0},"results":1000,"total":6468}
✅ query {"filters":{"limit":1000,"offset":0},"results":1000,"total":6468}
... (15+ requisições, todas offset=0)
```

**Existem 6.468 títulos em 2026** (1.438 jan / 1.568 fev / 1.577 mar / 1.187 abr / 238 mai / ...) — muito acima do limite de 1.000 por página. Mas o cliente **nunca chama `offset=1000`**: o loop em `fetchAllViaApi` para após a 1ª página, então só os ~1.000 títulos do "topo" da ordenação chegam ao calendário. Os meses fora desse topo aparecem vazios/incompletos.

O código-fonte de `src/pages/ContasAPagar.tsx` (linhas 252-276) já contém o hotfix `v4.4.3` que paginar por offset incremental. O backend (`crud-handlers.ts` linhas 176-220) também já devolve `pagination.has_more` corretamente. **Mas** `APP_VERSION` em `src/lib/version.ts` continua em `3.2.2` — a mesma versão de antes do fix. O que está acontecendo:

- O changelog em `ApiDocumentation.tsx` documenta o bump para `v3.2.3`, mas o constante `APP_VERSION` ficou para trás.
- O Service Worker PWA (`vite-plugin-pwa` com `registerType: 'prompt'`, ver `vite.config.ts:13-58`) cacheia agressivamente `**/*.js`. Sem mudança de `APP_VERSION`, a função `checkAndUpdateVersion()` (`version.ts:113`) **não dispara `clearAllCaches()`** — então usuários continuam executando o bundle antigo de `ContasAPagar.tsx`, com a versão do loop baseada em cursor que aborta na 1ª página.
- Resultado: a correção existe no repositório mas nunca entrou em vigor para usuários com SW ativo. O usuário em sessão tem o SW registrado (console mostra `[OfflineDB] Banco inicializado com sucesso`).

## Fix

### Bumpar `APP_VERSION` e registrar no changelog

Único arquivo de código alterado:

**`src/lib/version.ts`** (linha 104):
```ts
export const APP_VERSION = '3.2.3';
```

Isso, no próximo carregamento, faz `checkAndUpdateVersion()` detectar drift `3.2.2 → 3.2.3`, executar `clearAllCaches()` (que invalida caches do SW + IndexedDB do react-query, conforme implementação atual) e forçar download do bundle novo — que já tem o `fetchAllViaApi` corrigido. Os 7 GETs ao backend (offset 0, 1000, 2000, ..., 6000) passam a executar e o calendário recebe os 6.468 títulos.

### Registrar no histórico de mudanças

**`src/components/erp/ApiDocumentation.tsx`**: adicionar entrada de changelog no topo do array `[...]` em `~3621-3624`, seguindo a disciplina `mem://process/release-changelog-discipline`:

```
{ version: "v4.4.3 / SDK v3.3.1 / APP v3.2.3", date: "2026-04-23", changes: [
  "PAGINATION HOTFIX (rollout) — APP_VERSION bumpada de 3.2.2 → 3.2.3 em src/lib/version.ts:104 para forçar checkAndUpdateVersion() a executar clearAllCaches() em todos os usuários com Service Worker PWA ativo (vite-plugin-pwa, registerType:'prompt'). O fix de paginação do /query (v4.4.3) já estava no código mas o bundle antigo continuava sendo servido pelo SW — Calendário de Vencimentos do Contas a Pagar exibia ~1.000 títulos do topo da ordenação (1 mês visível) em vez dos 6.468 títulos/ano. Invariante grep positivo: `grep -n \"APP_VERSION = '3.2.3'\" src/lib/version.ts` deve retornar 1 ocorrência.",
] },
```

### Invariantes verificáveis (release discipline)

- `grep -n "APP_VERSION = '3.2.3'" src/lib/version.ts` → 1 ocorrência
- `grep -n "p.cursor" supabase/functions/_shared/contas-pagar/crud-handlers.ts` → 0 ocorrências (mantém o invariante negativo do v4.4.3)
- `grep -n "v4.4.3 / SDK v3.3.1 / APP v3.2.3" src/components/erp/ApiDocumentation.tsx` → 1 ocorrência

## Detalhes técnicos

- 2 arquivos alterados: `src/lib/version.ts`, `src/components/erp/ApiDocumentation.tsx`.
- Sem mudança de schema, RLS, edge function, hooks ou componentes.
- Sem mudança de SDK público — APP_VERSION é um patch interno (rollout-only).
- Memória: aplica `mem://process/release-changelog-discipline` (changelog grep-verificável). Nenhuma nova convenção introduzida.

## Risco

Mínimo. A bump de versão é o mecanismo padrão do app para invalidar caches PWA — já foi usado em todos os releases anteriores. Único efeito colateral: usuários com SW ativo terão um carregamento adicional (re-download do bundle) na próxima visita, comportamento esperado e desejado.

## Verificação após o deploy

1. Abrir `/dashboard/financeiro/contas-a-pagar` e ir à aba **Calendário**.
2. Confirmar no DevTools → Network: 7 chamadas a `contas-pagar-api/query` com offsets 0, 1000, 2000, 3000, 4000, 5000, 6000.
3. Confirmar no console: `[ContasAPagar] fetchAllViaApi total carregado: 6468`.
4. Navegar mês a mês de Jan/2026 a Dez/2026 — todos os meses devem mostrar títulos coerentes com os contagens do banco (1.438 / 1.568 / 1.577 / 1.187 / 238 / 145 / 80 / 65 / 43 / 44 / 43 / 40).

