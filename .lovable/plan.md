

# Auditoria de Permissoes de Telas — Falhas e Melhorias

## Diagnostico

Analisei todas as ~130 rotas do sistema e identifiquei falhas de consistencia no controle de acesso.

### Falha 1: Rotas sem controle de modulo/tela (4 rotas)

Estas rotas usam apenas `ProtectedRoute` — qualquer usuario autenticado acessa:

| Rota | Risco |
|------|-------|
| `/dashboard/tarefas` | Baixo (funcionalidade generica) |
| `/dashboard/chat` | Baixo |
| `/dashboard/configuracoes` | **ALTO** — pagina de configuracoes acessivel a todos |
| `/dashboard/instalar-app` | Baixo |

**`/dashboard/configuracoes` e critico**: contem links para gestao de menu, permissoes, LGPD. Embora sub-rotas como `/configuracoes/menu` tenham `screenCode="admin"`, a pagina index pode expor informacao.

### Falha 2: Modulos sem granularidade de tela (7 modulos, ~45 rotas)

Estes modulos protegem apenas no nivel de modulo — quem tem acesso ao modulo ve TODAS as sub-telas:

| Modulo | Rotas sem ScreenRoute | Impacto |
|--------|----------------------|---------|
| **OMS** | 3 rotas | Medio — nao separa painel de condicoes de pagamento |
| **China** | 8 rotas | Alto — submissao, recebimentos, ordens sem separacao |
| **Estoque** | 5 rotas | Medio — distribuidoras, saldos, vinculacoes juntos |
| **Projetos** | 8 rotas | Alto — inbox, aprovacoes, vincular-china sem separacao |
| **Central Inteligencia** | 7 rotas | Medio — dashboards executivos sem granularidade |
| **Eventos** | 4 rotas | Baixo |
| **Departamentos** | 5 rotas | Baixo |

**Contraste**: Fabrica e Financeiro ja tem screen-level guards corretos em todas as sub-rotas.

### Falha 3: Telas registradas no banco vs rotas no codigo

O `module-screens-map.ts` define os screenCodes por modulo, mas varios modulos novos (OMS, processos) podem nao ter todas as telas registradas nas tabelas `telas_sistema` e `usuario_permissoes_telas`.

### Falha 4: Inconsistencia no hook useUIPermissions

O hook `useUIPermissions` faz queries independentes para buscar `role` e `departamento_id` a cada tela, ignorando o cache centralizado do `PermissionsContext`. Em escala, isso gera queries redundantes.

### Falha 5: Escalabilidade do cache de permissoes

O `PermissionsContext` usa cache de 30s em memoria + 5min em localStorage. Com 2K pedidos/dia no OMS e muitos usuarios simultaneos, o cache curto gera re-fetches excessivos. O `permissions-optimizer.ts` duplica logica com cache proprio de 10min — dois sistemas de cache concorrentes.

## Plano de Correcao

### Fase 1 — Corrigir rotas desprotegidas

- `/dashboard/configuracoes`: trocar `ProtectedRoute` por `ScreenRoute screenCode="admin"`
- Manter `ProtectedRoute` para tarefas/chat/instalar-app (funcionalidades genericas)

### Fase 2 — Adicionar screen guards nos 7 modulos

Registrar telas no banco e adicionar `ScreenRoute` nas rotas:

**OMS:**
- `oms_painel` — Painel de Pedidos
- `oms_detalhe` — Detalhe do Pedido  
- `oms_condicoes` — Condicoes de Pagamento

**China:**
- `china_submissoes`, `china_recebimentos`, `china_ordens`, `china_produtos`

**Estoque:**
- `estoque_distribuidoras`, `estoque_saldos`, `estoque_consolidado`, `estoque_vinculacoes`, `estoque_produtos`

**Projetos:**
- `projetos_inbox`, `projetos_aprovacoes`, `projetos_equipe`, `projetos_vincular_china`, `projetos_produtos_brasil`

**Central Inteligencia:**
- `ci_executivo`, `ci_performance`, `ci_clientes`, `ci_geografico`, `ci_produtos`, `ci_metas`, `ci_consolidado`

**Eventos:**
- `eventos_lista`, `eventos_aprovacoes`, `eventos_dashboard`

**Departamentos:**
- `dept_hub`, `dept_detalhe`, `dept_dashboard`, `dept_aprovacoes`

### Fase 3 — Unificar cache de permissoes

- Remover `permissions-optimizer.ts` (duplica logica do PermissionsContext)
- Fazer `useUIPermissions` reutilizar `role` do PermissionsContext em vez de query separada
- Aumentar CACHE_DURATION de 30s para 2min (reduz re-fetches em ~75%)

### Fase 4 — Migration de telas no banco

Inserir todas as novas telas em `telas_sistema` e vincular aos modulos em `modulo_telas` para que o sistema de permissoes as reconheca.

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| `src/App.tsx` | Trocar ProtectedRoute por ScreenRoute em configuracoes; adicionar ScreenRoute nos 7 modulos |
| Migration SQL | INSERT ~30 telas novas em telas_sistema + modulo_telas |
| `src/config/module-screens-map.ts` | Adicionar screenCodes dos 7 modulos |
| `src/hooks/useUIPermissions.ts` | Reutilizar role do PermissionsContext |
| `src/contexts/PermissionsContext.tsx` | Aumentar CACHE_DURATION para 120s |
| `src/lib/utils/permissions-optimizer.ts` | Remover (codigo duplicado) |

