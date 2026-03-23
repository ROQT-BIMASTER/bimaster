
# Módulo de Configurações do Portal ERP — Controle de Acesso a Endpoints

## Status: ✅ Implementado

### O que foi feito

1. **Banco de Dados**: Criadas tabelas `erp_portal_access_profiles` e `erp_portal_access_modules` com RLS admin-only. Adicionada coluna `access_profile_id` em `erp_api_keys`.

2. **Seed**: 2 perfis pré-configurados ("Financeiro" e "Acesso Completo").

3. **Interface de Configurações**: Nova aba "Configurações" no Portal ERP com CRUD completo de perfis de acesso (checkboxes hierárquicos módulo → APIs).

4. **Vinculação**: Coluna "Perfil de Acesso" na tabela de chaves de API com dropdown para vincular perfil.

5. **Filtragem**: `ApiDocumentation` aceita prop `accessProfileModules` para filtrar módulos/APIs visíveis. Sidebar, conteúdo e exportação Excel respeitam o filtro.

### Arquivos Criados/Modificados

| Arquivo | Ação |
|---|---|
| `src/hooks/useErpAccessProfiles.ts` | Novo — CRUD de perfis |
| `src/components/erp/AccessProfileForm.tsx` | Novo — Form com checkboxes |
| `src/components/erp/ErpPortalSettings.tsx` | Novo — Interface de gestão |
| `src/components/erp/ApiDocumentation.tsx` | Modificado — Filtragem por perfil |
| `src/pages/IntegracaoERP.tsx` | Modificado — Aba Configurações + Select de perfil na tabela de chaves |
