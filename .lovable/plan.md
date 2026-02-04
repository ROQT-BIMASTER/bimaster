
# Plano: Sistema de Permissões para Módulo de Departamentos

## Contexto
Os departamentos que criamos (TI, RH, Financeiro, etc.) estão aparecendo automaticamente para todos os usuários em produção que tenham `departamento_id` preenchido ou sejam responsáveis. Isso acontece porque o módulo não segue o padrão de permissões centralizado do sistema.

## Objetivo
Integrar os departamentos ao sistema de permissões existente, garantindo que apareçam apenas para usuários explicitamente autorizados pelo administrador.

---

## Alterações no Banco de Dados

### 1. Criar Módulo "Departamentos"
Inserir na tabela `modulos_sistema`:
- **código**: `departamentos`
- **nome**: Gestão de Departamentos
- **descrição**: Gestão de despesas, verbas e aprovações por departamento
- **ícone**: Building2
- **ordem**: 75 (após Eventos)

### 2. Criar Telas do Módulo
Inserir na tabela `telas_sistema`:
- `departamentos_hub` - Hub de Departamentos (lista)
- `departamentos_detail` - Detalhes do Departamento
- `departamentos_dashboard` - Dashboard Financeiro
- `departamentos_aprovacoes` - Central de Aprovações

---

## Alterações no Frontend

### 3. Atualizar AppSidebar.tsx
**Antes:**
```tsx
{userDepartments.length > 0 && userDepartments.map((dept) => ...)}
```

**Depois:**
```tsx
{hasModulePermission("departamentos") && userDepartments.length > 0 && 
  userDepartments.map((dept) => ...)}
```

Isso garante que:
- Apenas usuários com permissão no módulo "departamentos" veem o menu
- Mesmo com permissão, só vê os departamentos aos quais está vinculado

### 4. Atualizar Páginas com Proteção de Tela (Opcional)

Adicionar verificação de permissão de tela nas rotas:
- `DepartmentHub` → verificar `departamentos_hub`
- `DepartmentDetail` → verificar `departamentos_detail`
- `DepartmentDashboard` → verificar `departamentos_dashboard`
- `DepartmentApprovalHub` → verificar `departamentos_aprovacoes`

---

## Fluxo de Configuração pelo Admin

1. Admin acessa **Configurações → Permissões de Módulos**
2. Seleciona o usuário desejado
3. Ativa o módulo "Gestão de Departamentos"
4. O usuário passa a ver seus departamentos no sidebar

```text
┌─────────────────────────────────────────┐
│        Tela de Permissões               │
├─────────────────────────────────────────┤
│                                         │
│  Usuário: João Silva                    │
│                                         │
│  ☐ Prospects                            │
│  ☐ Financeiro                           │
│  ☐ Trade Marketing                      │
│  ☐ Eventos Corporativos                 │
│  ☑ Gestão de Departamentos  ← NOVO      │
│  ☐ Tabelas de Preços                    │
│                                         │
└─────────────────────────────────────────┘
```

---

## Hierarquia de Visibilidade

Após implementação:

1. **Admin**: Vê todos os departamentos (se tiver o módulo ativo)
2. **Supervisor**: Vê departamentos conforme configuração de permissão
3. **Outros usuários**: Só vê se:
   - Tiver permissão no módulo "departamentos" E
   - For membro ou responsável do departamento

---

## Impacto em Produção

- Usuários atuais **perdem acesso** imediato aos departamentos
- Admin precisa ativar o módulo para os usuários desejados
- Nenhum dado é perdido, apenas a visibilidade é controlada

---

## Seção Técnica

### Migration SQL:
```sql
-- Criar módulo departamentos
INSERT INTO modulos_sistema (codigo, nome, descricao, icone, ordem, ativo)
VALUES ('departamentos', 'Gestão de Departamentos', 
        'Gestão de despesas, verbas e aprovações por departamento', 
        'Building2', 75, true);

-- Criar telas
INSERT INTO telas_sistema (codigo, nome, descricao, modulo_codigo, rota, icone, ordem, ativo)
VALUES 
  ('departamentos_hub', 'Hub de Departamentos', 'Lista de departamentos', 
   'departamentos', '/dashboard/departamentos', 'Building2', 10, true),
  ('departamentos_detail', 'Detalhes do Departamento', 'Visão geral e despesas', 
   'departamentos', '/dashboard/departamentos/:id', 'FileText', 20, true),
  ('departamentos_dashboard', 'Dashboard Financeiro', 'Métricas e gráficos', 
   'departamentos', '/dashboard/departamentos/:id/dashboard', 'BarChart3', 30, true),
  ('departamentos_aprovacoes', 'Central de Aprovações', 'Aprovação de despesas', 
   'departamentos', '/dashboard/departamentos/:id/aprovacoes', 'CheckCircle', 40, true);
```

### Arquivos a Modificar:
- `src/components/dashboard/AppSidebar.tsx` (linha ~728)
- `src/App.tsx` (opcional: adicionar ScreenProtectedRoute)

### Política de Segurança:
Seguindo o padrão "deny-by-default" já estabelecido, o módulo não será atribuído automaticamente a nenhum role.
