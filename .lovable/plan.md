

# Auditoria de Permissoes — Falhas Remanescentes e Melhorias

## Problemas Encontrados

### 1. Rotas com APENAS ModuleRoute (sem screen guard) — ~50 rotas vulneraveis

Estes modulos permitem que qualquer usuario com acesso ao modulo veja TODAS as sub-telas:

| Modulo | Rotas sem ScreenRoute | Risco |
|--------|----------------------|-------|
| **Marketing** | 4 rotas (index, social, whatsapp, elevenlabs) | Medio |
| **Prospects** | 6 rotas (lista, kanban, atividades, mapa, municipios) | Medio |
| **Trade** | ~20 rotas (materiais, equipe, stores, visits, photos, competitors, promotions, insights, whatsapp, import, calendar, ideal-photos, auditorias, sellout, shelf, brands, performance, rewards, solicitacoes) | **ALTO** — dados sensiveis de trade misturados |
| **Comercial** | 6 rotas (index, ibge, mineracao, inteligencia, reativacao, mapa, whitespace, importar-clientes) | Alto |
| **Precos** | 2 rotas (index, portal-cliente) | Medio |
| **Aprovacao Artes** | 3 rotas (index, detalhe, config) | Baixo |
| **Composicao/Amostras/Embalagem/Etiqueta** | 4 rotas | Baixo |
| **Processos** | 3 rotas (consulta, etapas, workflows) | Medio |
| **Reunioes** | 2 rotas | Baixo |
| **Fabrica** | 1 rota (manual) | Baixo |

**Total: ~50 rotas** que qualquer usuario do modulo acessa sem restricao de tela.

### 2. Financeiro — sub-rotas sem screen guard

Dentro do modulo financeiro, 4 rotas usam apenas `ModuleRoute`:
- `/dashboard/financeiro` (index)
- `/dashboard/financeiro/visao-departamentos`
- `/dashboard/financeiro/dre-analitico`
- `/dashboard/financeiro/trade`

### 3. Inconsistencia no ScreenRoute vs ModuleRoute+ScreenProtectedRoute

Ha dois padroes diferentes no codigo:
- `ScreenRoute` (wrapper que inclui ProtectedRoute + ScreenProtectedRoute)
- `ModuleRoute` + `ScreenProtectedRoute` (aninhado manualmente)

Rotas como `/dashboard/financeiro/contas-a-receber` usam `ScreenRoute` SEM `ModuleRoute`, significando que qualquer usuario com a tela `financeiro_contas_receber` acessa mesmo sem o modulo `financeiro`. Isso e uma falha de defesa em profundidade.

### 4. Rota `/dashboard/ranking` — usa modulo "trade" mas e funcionalidade generica

### 5. Impersonacao — admin que impersona nao-admin pode ficar bloqueado

Se um admin impersona um usuario sem permissao ao modulo atual, o `ScreenProtectedRoute` mostra "Acesso Negado" corretamente. Mas nao ha botao visivel para sair da impersonacao nessa tela de bloqueio, potencialmente travando o admin.

### 6. Race condition no safety timeout

O `PermissionsContext` tem timeout de 5s. Se a rede demorar mais, o usuario ve a tela sem permissoes (tudo bloqueado), e so apos o fetch completar as permissoes aparecem — mas a rota ja renderizou `AccessDenied`.

## Plano de Correcao

### Fase 1 — Adicionar screen guards nas ~50 rotas desprotegidas

Registrar screen codes novos no banco e adicionar `ScreenProtectedRoute` em todas as rotas que hoje usam apenas `ModuleRoute`.

**Trade (20 rotas):** `trade_materiais`, `trade_equipe`, `trade_stores`, `trade_visits`, `trade_photos`, `trade_competitors`, `trade_promotions`, `trade_insights`, `trade_whatsapp`, `trade_import`, `trade_calendar`, `trade_ideal_photos`, `trade_auditorias`, `trade_sellout`, `trade_shelf`, `trade_brands`, `trade_performance`, `trade_rewards`, `trade_solicitacoes`

**Comercial (7 rotas):** `comercial_index`, `comercial_ibge`, `comercial_mineracao`, `comercial_inteligencia`, `comercial_reativacao`, `comercial_mapa`, `comercial_whitespace`

**Marketing (3 rotas):** `marketing_social`, `marketing_whatsapp`, `marketing_elevenlabs`

**Prospects (5 rotas):** `prospects_lista`, `prospects_kanban`, `prospects_atividades`, `prospects_mapa`, `prospects_municipios`

**Processos (3 rotas):** `processos_consulta`, `processos_etapas`, `processos_workflows`

**Precos (1 rota):** `precos_portal_cliente`

**Financeiro (3 rotas):** `financeiro_visao_dept`, `financeiro_dre`, `financeiro_trade`

**Reunioes (2 rotas):** `reunioes_lista`, `reunioes_detalhe`

### Fase 2 — Padronizar guard pattern

Criar helper `ModuleScreenRoute` que combina ambos os guards em um unico componente, eliminando a inconsistencia entre `ScreenRoute` (sem modulo) e `ModuleRoute+ScreenProtectedRoute`:

```tsx
const ModuleScreenRoute = ({ moduleCode, screenCode, children }) => (
  <ProtectedRoute>
    <ModuleProtectedRoute moduleCode={moduleCode}>
      <ScreenProtectedRoute screenCode={screenCode}>
        {children}
      </ScreenProtectedRoute>
    </ModuleProtectedRoute>
  </ProtectedRoute>
);
```

Migrar todas as rotas do financeiro que usam `ScreenRoute` para usar `ModuleScreenRoute`.

### Fase 3 — Corrigir UX de impersonacao bloqueada

Adicionar botao "Sair da Impersonacao" no componente `AccessDenied` quando `isImpersonating === true`.

### Fase 4 — Corrigir race condition do safety timeout

Quando o timeout dispara e permissoes estao vazias, mostrar tela de "Carregando permissoes..." em vez de renderizar rotas com `AccessDenied`. Adicionar estado `permissionsReady` que so fica `true` apos o primeiro fetch real completar (distinguindo "sem permissoes" de "ainda nao carregou").

### Fase 5 — Migration de telas no banco

INSERT ~45 novos screen codes em `telas_sistema` + vincular em `modulo_telas`. Conceder permissoes aos usuarios ativos que ja tem o modulo.

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| `src/App.tsx` | Adicionar ScreenProtectedRoute em ~50 rotas; criar helper `ModuleScreenRoute` |
| Migration SQL | INSERT ~45 telas em telas_sistema + modulo_telas + permissoes |
| `src/config/module-screens-map.ts` | Registrar novos screen codes |
| `src/components/common/AccessDenied.tsx` | Botao "Sair da Impersonacao" |
| `src/contexts/PermissionsContext.tsx` | Adicionar estado `permissionsReady` |
| `src/components/auth/ScreenProtectedRoute.tsx` | Checar `permissionsReady` antes de negar |
| `src/components/auth/ModuleProtectedRoute.tsx` | Idem |

