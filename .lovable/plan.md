

# Diagnóstico e Plano de Correção

## Causa Raiz Identificada

O problema é um **loop de redirecionamento infinito**:

```text
1. Usuário entra → /dashboard
2. DashboardRedirect vê permissão módulo "fabrica" → redireciona para /dashboard/fabrica
3. FabricaModule verifica hasPermission("fabrica_dashboard") → NÃO TEM
4. FabricaModule redireciona de volta para /dashboard (linha 69-71)
5. Volta ao passo 2 → LOOP INFINITO → tela branca
```

O `FabricaModule` exige a permissão de tela `fabrica_dashboard` para renderizar. Quando o usuário tem o **módulo** `fabrica` mas **não** a **tela** `fabrica_dashboard`, ele fica preso.

Além disso, as sub-rotas da fábrica no `App.tsx` (linhas 369-386) não têm `ScreenProtectedRoute`, então qualquer usuário autenticado acessa qualquer sub-página — mas o dashboard principal bloqueia a entrada.

## Correções

### 1. FabricaModule: redirecionar para primeira tela disponível em vez de /dashboard

Alterar `FabricaModule.tsx` linhas 69-71: em vez de `<Navigate to="/dashboard">`, percorrer as telas do módulo fábrica e redirecionar para a primeira que o usuário tem permissão. Se nenhuma, aí sim mostrar `AccessDenied`.

Lista de telas a verificar em ordem:
- `fabrica_produtos` → `/dashboard/fabrica/produtos-acabados`
- `fabrica_materias_primas` → `/dashboard/fabrica/materias-primas`
- `fabrica_recebimentos` → `/dashboard/fabrica/recebimentos`
- `fabrica_formulas` → `/dashboard/fabrica/formulas`
- `fabrica_ordens` → `/dashboard/fabrica/ordens-producao`
- `fabrica_apontamentos` → `/dashboard/fabrica/apontamentos`
- `fabrica_qualidade` → `/dashboard/fabrica/qualidade`
- `fabrica_maquinas` → `/dashboard/fabrica/maquinas`
- `fabrica_operadores` → `/dashboard/fabrica/operadores`
- `fabrica_planejamento` → `/dashboard/fabrica/planejamento`
- `fabrica_fiscal` → `/dashboard/fabrica/fiscal`
- `fabrica_paradas` → `/dashboard/fabrica/paradas`
- `fabrica_lancamentos` → `/dashboard/comercial/lancamentos`

### 2. DashboardRedirect: evitar redirecionar para módulo se usuário não tem tela do dashboard

Adicionar lógica mais inteligente: quando o usuário tem permissão ao módulo `fabrica` mas **não** tem `fabrica_dashboard`, pular o redirecionamento para `/dashboard/fabrica` e ir direto para as rotas de tela (fallback de SCREEN_FALLBACK_ROUTES).

### 3. Proteger sub-rotas da fábrica com ScreenProtectedRoute no App.tsx

Adicionar `ScreenProtectedRoute` nas rotas individuais da fábrica para evitar que usuários acessem páginas sem permissão via URL direta.

### Arquivos a Modificar
- `src/pages/modules/FabricaModule.tsx` — smart redirect para primeira tela disponível
- `src/components/auth/DashboardRedirect.tsx` — verificar tela do dashboard antes de redirecionar para módulo
- `src/App.tsx` — adicionar `ScreenProtectedRoute` nas sub-rotas da fábrica

