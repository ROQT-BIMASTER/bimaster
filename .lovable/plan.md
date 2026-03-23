

# Módulo de Configurações do Portal ERP — Controle de Acesso a Endpoints

## Objetivo

Criar uma aba/seção "Configurações" dentro do Portal ERP que permita ao administrador controlar, de forma centralizada, quais módulos e APIs ficam visíveis para cada perfil de acesso (por API Key / empresa). Isso substitui a abordagem de senha fixa por um sistema persistente e escalável no banco de dados.

## Arquitetura

```text
┌─────────────────────────────────┐
│  erp_portal_access_profiles     │  ← Perfis de acesso (ex: "Equipe Financeira", "ERP Completo")
│  id, nome, descricao, created_by│
├─────────────────────────────────┤
│  erp_portal_access_modules      │  ← Módulos/APIs liberados por perfil
│  id, profile_id, module_id,     │
│  api_id (nullable), visivel     │
├─────────────────────────────────┤
│  erp_api_keys.access_profile_id │  ← Vincular perfil à API Key existente
└─────────────────────────────────┘
```

## O que será feito

### 1. Banco de Dados (2 tabelas + 1 coluna)

**Tabela `erp_portal_access_profiles`**: Perfis de acesso nomeados (ex: "Financeiro", "Completo").

**Tabela `erp_portal_access_modules`**: Relação N:N entre perfil e módulo/API. Cada registro indica se um módulo (`module_id` = "financas", "geral", etc.) ou uma API específica (`api_id` = "contas-pagar", "fornecedores-query") está visível naquele perfil.

**Coluna `erp_api_keys.access_profile_id`**: FK opcional para vincular cada chave de API a um perfil de acesso. Chaves sem perfil = acesso total (backwards compatible).

RLS: apenas admins podem ler/escrever nestas tabelas.

### 2. Interface de Configuração (nova aba no Portal ERP)

Adicionar uma aba **"Configurações"** (ícone Settings) ao lado do header do Portal, visível apenas para admins. Conteúdo:

- **Lista de Perfis**: Cards com nome, descrição, quantidade de módulos liberados
- **Criar/Editar Perfil**: Dialog com nome + checkboxes hierárquicos:
  - Nível 1: Módulo (ex: ✅ Finanças, ❌ Geral, ✅ Cadastros Auxiliares)
  - Nível 2: APIs individuais dentro do módulo (toggle granular)
  - "Selecionar Todos" / "Desmarcar Todos"
- **Vincular Perfil a API Key**: Na tabela de chaves existente, adicionar coluna "Perfil de Acesso" com select dropdown

### 3. Filtragem Dinâmica na Documentação

O `ApiDocumentation` receberá um prop opcional `accessProfileId`. Quando presente:
- Consulta `erp_portal_access_modules` para obter módulos/APIs liberados
- Filtra `API_MODULES` antes de renderizar sidebar e conteúdo
- Módulos bloqueados ficam completamente ocultos (não apenas esmaecidos)

Para visualização admin (sem perfil vinculado): tudo visível, como hoje.

### 4. Perfis Pré-configurados

Seed inicial com 2 perfis:
- **"Financeiro"**: Finanças + Cadastros Auxiliares + Complementar + Fornecedores (do módulo Geral)
- **"Acesso Completo"**: Todos os módulos liberados

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| **Migração SQL** | Criar 2 tabelas + coluna FK + RLS + seed |
| `src/components/erp/ErpPortalSettings.tsx` | **Novo** — Interface de gestão de perfis |
| `src/components/erp/AccessProfileForm.tsx` | **Novo** — Form com checkboxes de módulos/APIs |
| `src/components/erp/ApiDocumentation.tsx` | Receber prop `accessProfileId`, filtrar módulos |
| `src/pages/IntegracaoERP.tsx` | Adicionar aba/botão "Configurações", vincular perfil à API Key |
| `src/hooks/useErpAccessProfiles.ts` | **Novo** — CRUD de perfis via react-query |

## Fluxo do Admin

1. Abre Portal ERP → clica em "Configurações" (engrenagem)
2. Cria perfil "Equipe Financeira ERP" → marca Finanças, Cadastros, Complementar
3. Volta para Chaves de API → vincula perfil à chave da empresa X
4. Dev da empresa X abre portal → vê apenas módulos liberados

## Detalhes Técnicos

- Os IDs de módulos (`geral`, `financas`, `cadastros`, etc.) e APIs (`contas-pagar`, `fornecedores-query`, etc.) já existem como constantes no `API_MODULES` do `ApiDocumentation.tsx`
- A filtragem é feita no frontend após carregar as permissões do banco — sem alterar a estrutura estática dos endpoints
- Perfis são globais (não por empresa), mas cada API Key pode ter um perfil diferente, permitindo cenários como: empresa A vê tudo, empresa B vê só financeiro

