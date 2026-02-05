

# Correção: Isolamento de Dados por Hierarquia (photos, visits, stores)

## Status: ✅ APLICADO

## Problemas Corrigidos

### 1. Parâmetros invertidos em `is_supervisor_of` (photos, visits)
- **Antes**: `is_supervisor_of(vendedor_id, auth.uid())` → vendedores viam dados do chefe
- **Depois**: `is_supervisor_of(auth.uid(), vendedor_id)` → supervisores veem apenas subordinados

### 2. Políticas permissivas usando `is_admin_or_supervisor` (photos, visits)  
- **Antes**: Qualquer supervisor via TODAS as fotos e visitas do sistema
- **Depois**: Políticas granulares separando admin, supervisor (hierarquia) e vendedor (próprios)

### 3. Stores (PDVs) sem isolamento por hierarquia
- **Antes**: `is_admin_or_supervisor(auth.uid())` → supervisores viam TODOS os 73 PDVs
- **Depois**: Supervisor vê apenas PDVs onde é supervisor direto ou vinculados a seus subordinados via store_sellers

## Políticas Finais

### photos (SELECT)
- `photos_select_admin`: `is_admin()`
- `photos_select_supervisor`: `is_supervisor_of(auth.uid(), vendedor_id)`
- `photos_select_own`: `vendedor_id = auth.uid()`
- `photos_select_via_visit`: via visita acessível com `is_supervisor_of(auth.uid(), v.user_id)`

### visits (SELECT)
- `visits_select_admin`: `is_admin()`
- `visits_select_supervisor`: `has_role('supervisor') AND (own OR get_subordinados OR store.supervisor_id)`
- `visits_select_own`: `user_id = auth.uid()`

### stores (SELECT)
- `stores_select_admin`: `is_admin()`
- `stores_select_supervisor`: `has_role('supervisor') AND (supervisor_id OR subordinados via store_sellers)`
- `stores_select_own`: `created_by OR via store_sellers`

## Versão do app
- `APP_VERSION` incrementada para `1.1.2` para forçar limpeza de cache
