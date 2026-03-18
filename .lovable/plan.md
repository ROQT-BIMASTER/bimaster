

## Análise: Estado Atual vs. Objetivo

### O que JÁ existe (funcional)

| Camada | Implementação | Status |
|---|---|---|
| Roles (user_roles) | admin, gerente, supervisor, vendedor, promotor, cliente | ✅ |
| Módulos (permissão) | `usuario_permissoes_modulos`, `role_permissoes_modulos`, `departamento_permissoes_modulos` | ✅ |
| Telas (permissão) | `usuario_permissoes_telas`, `role_permissoes_telas`, `departamento_permissoes_telas` | ✅ |
| Visibilidade de campos | `departamento_campo_visibilidade` + hook `useFieldVisibility` | ⚠️ Existe mas **NÃO integrado** em nenhuma tela real |
| Painel admin módulos | `GerenciamentoPermissoesModulos` (por role + por usuário) | ✅ |
| Painel admin telas | `GerenciamentoPermissoesTelas` (por usuário) | ✅ |
| Painel visibilidade campos | `DeptVisibilityControlPanel` (Projetos → China) | ✅ |
| Sidebar protection | `showModule()` + `hasModulePermission` | ✅ |
| Route protection | `ModuleRoute` + `ScreenRoute` wrappers | ✅ |
| RLS backend | Policies em 367+ tabelas | ✅ |
| Audit | `permission-audit.ts`, `departamento_visibilidade_audit` | ✅ |

### O que FALTA para o modelo completo (RBAC + ABAC + UI Control)

| Gap | Descrição |
|---|---|
| **1. Controle de componentes/ações** | Não existe `ui_permissions` — controle granular de botões, ações (criar, editar, excluir, exportar) por tela |
| **2. Hook `useFieldVisibility` sem uso real** | O hook existe mas ZERO componentes o consomem — campos não são condicionados |
| **3. Painel unificado de gestão** | Permissões de módulos, telas, campos e ações estão em painéis separados sem visão consolidada |
| **4. Feature Flags** | Não existe mecanismo para ativar/desativar módulos inteiros por toggle |

---

## Plano de Implementação

### Fase 1 — Tabela `ui_permissions` (controle de componentes/ações)

Criar tabela para controle granular por role + departamento:

```text
ui_permissions
├── id (uuid PK)
├── role (text, nullable) — se null, aplica por departamento
├── departamento_id (uuid FK, nullable) — se null, aplica por role
├── tela_codigo (text) — código da tela
├── componente_codigo (text) — ex: "botao_editar", "botao_excluir", "botao_exportar"
├── visivel (boolean default true)
├── editavel (boolean default true)
├── configurado_por (uuid FK)
├── created_at / updated_at
└── UNIQUE(role, departamento_id, tela_codigo, componente_codigo)
```

RLS: admin-only para gestão, SELECT para authenticated (cada user lê suas regras).

Função `SECURITY DEFINER`:
```sql
componente_permitido(p_tela text, p_componente text) → boolean
```
Verifica role do usuário + departamento e retorna se componente é visível.

### Fase 2 — Hook `useUIPermissions`

```typescript
const { canView, canEdit, canDelete, canExport, isComponentVisible } = useUIPermissions("china_submissoes");

// Uso nos componentes:
{canView("botao_editar") && <Button disabled={!canEdit("botao_editar")}>Editar</Button>}
{canExport && <ExportButton />}
```

O hook combina:
- `ui_permissions` (componentes/ações)
- `departamento_campo_visibilidade` (campos — já existente)
- Cache via React Query com staleTime

### Fase 3 — Integrar `useFieldVisibility` nas telas reais

Integrar o hook já existente nos componentes das telas China e Projetos que manipulam dados sensíveis. Exemplo:

```typescript
// Em china_submissoes
const { isFieldVisible, isFieldEditable } = useFieldVisibility("china_submissoes");

{isFieldVisible("precos_custos") && (
  <PrecosSection readOnly={!isFieldEditable("precos_custos")} />
)}
```

Telas a integrar: submissões, fichas de produto, ordens de compra, produtos Brasil.

### Fase 4 — Painel Admin Unificado de Permissões

Criar componente `GestaoPermissoesUnificada` com:

- **Tab 1 — Por Usuário**: seleciona usuário → mostra módulos, telas, componentes com toggles
- **Tab 2 — Por Role**: seleciona role → mostra módulos e telas padrão do role
- **Tab 3 — Por Departamento**: seleciona dept → mostra módulos, telas e campos/componentes
- **Tab 4 — Ações por Tela**: matriz tela × ação (visualizar, criar, editar, excluir, exportar)

Cada alteração grava audit log automaticamente.

### Fase 5 — Feature Flags (tabela simples)

```text
feature_flags
├── id (uuid PK)  
├── codigo (text UNIQUE) — ex: "modulo_reunioes", "exportar_excel"
├── nome (text)
├── ativo (boolean default false)
├── roles_permitidos (text[]) — roles que podem usar quando ativo
├── created_at / updated_at
```

Hook `useFeatureFlag("modulo_reunioes")` → retorna `boolean`.

### Resumo de arquivos

| Arquivo | Ação |
|---|---|
| 1 migration SQL | Tabelas `ui_permissions`, `feature_flags` + RLS + função `componente_permitido` |
| `src/hooks/useUIPermissions.ts` | Novo hook unificado |
| `src/hooks/useFeatureFlags.ts` | Novo hook feature flags |
| `src/components/admin/GestaoPermissoesUnificada.tsx` | Novo painel admin |
| `src/pages/Configuracoes.tsx` | Integrar novo painel |
| ~6 componentes China/Projetos | Integrar `useFieldVisibility` + `useUIPermissions` |

