
# Implementação de Vínculo Multi-Filial para Despesas

## Objetivo
Garantir que cada funcionário/filial visualize apenas suas despesas, mantendo vínculo com suas respectivas empresas. Gestores e Financeiro Central terão visão global.

## Estrutura Atual

### Tabelas Existentes
- `profiles` - possui `departamento_id` mas não possui vínculo com empresa/filial
- `departamentos` - não possui vínculo com empresa/filial
- `department_expenses` - não possui `empresa_id`
- `financial_payment_queue` - não possui `empresa_id`
- Dados de empresas existem apenas em `contas_pagar` e `contas_receber` (vindos do ERP)

### Empresas Identificadas no Sistema
| ID | Nome |
|----|------|
| 1 | RUBY ROSE-SP |
| 2 | RUBY ROSE - GYN |
| 3 | UNION MEDIC MG LTDA |
| 4 | RUBY ROSE - PR |
| 5 | PARTY COSMETICOS |
| 6 | RUBY ROSE [FILIAL] - (GLASS) |
| 8 | RUBY ROSE-PE |
| 9 | NEW COSMIC (M MARIA) |
| 10 | MIDDAY COSMIC (MELU) |
| 11 | A GENTE COSMETICS (RR) |

## Alterações Planejadas

### 1. Criar Tabela de Empresas Centralizada

Criar tabela `empresas` para centralizar dados de filiais:

```sql
CREATE TABLE empresas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18),
  uf VARCHAR(2),
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Popular com dados existentes de `contas_pagar`:
```sql
INSERT INTO empresas (id, nome)
SELECT DISTINCT empresa_id, empresa_nome 
FROM contas_pagar 
WHERE empresa_id IS NOT NULL;
```

### 2. Criar Tabela de Vínculo Usuário-Empresa (N:N)

Permitir que um usuário esteja vinculado a múltiplas filiais:

```sql
CREATE TABLE user_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  is_primary BOOLEAN DEFAULT false, -- Filial principal do usuário
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, empresa_id)
);
```

### 3. Adicionar Coluna empresa_id nas Tabelas de Despesas

**Tabela `department_expenses`:**
```sql
ALTER TABLE department_expenses 
ADD COLUMN empresa_id INTEGER REFERENCES empresas(id);

CREATE INDEX idx_department_expenses_empresa_id 
ON department_expenses(empresa_id);
```

**Tabela `financial_payment_queue`:**
```sql
ALTER TABLE financial_payment_queue 
ADD COLUMN empresa_id INTEGER REFERENCES empresas(id);
ADD COLUMN empresa_nome VARCHAR(255);

CREATE INDEX idx_financial_payment_queue_empresa_id 
ON financial_payment_queue(empresa_id);
```

### 4. Criar Funções de Segurança

**Função para verificar acesso à empresa:**
```sql
CREATE OR REPLACE FUNCTION user_has_empresa_access(_user_id UUID, _empresa_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admin vê tudo
    public.has_role(_user_id, 'admin') OR
    -- Supervisor vê tudo
    public.has_role(_user_id, 'supervisor') OR
    -- Usuário tem vínculo com a empresa
    EXISTS (
      SELECT 1 FROM user_empresas 
      WHERE user_id = _user_id AND empresa_id = _empresa_id
    )
$$;
```

**Função para obter empresas do usuário:**
```sql
CREATE OR REPLACE FUNCTION get_user_empresa_ids(_user_id UUID)
RETURNS INTEGER[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT empresa_id FROM user_empresas WHERE user_id = _user_id
  )
$$;
```

### 5. Atualizar Políticas RLS

**Despesas de Departamento:**
```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Allow users to view department expenses" ON department_expenses;

-- New policy with empresa filter
CREATE POLICY "Allow users to view department expenses" ON department_expenses
FOR SELECT USING (
  -- Criador vê suas despesas
  created_by = auth.uid() OR
  -- Gestor do departamento vê despesas do departamento
  EXISTS (
    SELECT 1 FROM departamentos d
    WHERE d.id = department_expenses.department_id 
    AND d.responsavel_id = auth.uid()
  ) OR
  -- Financeiro vê tudo
  can_access_payment_queue(auth.uid()) OR
  -- Admin/Supervisor vê tudo
  is_admin_or_supervisor(auth.uid()) OR
  -- Usuário com acesso à empresa vê despesas da empresa
  user_has_empresa_access(auth.uid(), empresa_id)
);
```

**Fila de Pagamentos:**
```sql
DROP POLICY IF EXISTS "fpq_select_policy" ON financial_payment_queue;

CREATE POLICY "fpq_select_policy" ON financial_payment_queue
FOR SELECT USING (
  -- Financeiro/Tesouraria/Controladoria veem tudo
  can_access_payment_queue(auth.uid()) OR
  -- Solicitante vê suas solicitações
  requested_by = auth.uid() OR
  -- Admin/Supervisor vê tudo
  is_admin_or_supervisor(auth.uid()) OR
  -- Usuário com acesso à empresa vê solicitações da empresa
  user_has_empresa_access(auth.uid(), empresa_id)
);
```

### 6. Atualizar Hooks do Frontend

**Novo hook `useUserEmpresas`:**
```typescript
// src/hooks/useUserEmpresas.ts
export function useUserEmpresas() {
  return useQuery({
    queryKey: ["user-empresas"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_empresas")
        .select(`
          empresa_id,
          is_primary,
          empresa:empresas(id, nome)
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      return data;
    },
  });
}
```

**Atualizar `useDepartmentExpenses`:**
- Adicionar `empresa_id` ao criar despesa
- Filtrar por empresas do usuário quando não for gestor

**Atualizar `useFinancialPaymentQueue`:**
- Adicionar filtro por empresa na interface
- Propagar `empresa_id` ao enviar para financeiro

### 7. Atualizar Interface

**Nova coluna na tabela de despesas:**
- Exibir nome da empresa/filial em cada linha

**Novo filtro na Central de Pagamentos:**
- Adicionar select de empresas no filtro de origens
- Exibir coluna "Filial" na tabela

**Formulário de nova despesa:**
- Adicionar seletor de empresa/filial
- Pre-selecionar filial principal do usuário

**Gestão de Usuários (Admin):**
- Adicionar seção para vincular usuários a empresas
- Permitir definir filial principal

## Arquivos a Serem Modificados

### Banco de Dados (Migrações)
1. Criar tabela `empresas`
2. Criar tabela `user_empresas`
3. Adicionar colunas `empresa_id` em `department_expenses` e `financial_payment_queue`
4. Criar funções de segurança
5. Atualizar políticas RLS

### Frontend
| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useUserEmpresas.ts` | Novo - Hook para empresas do usuário |
| `src/hooks/useDepartmentExpenses.ts` | Adicionar filtro e propagação de empresa_id |
| `src/hooks/useFinancialPaymentQueue.ts` | Adicionar filtro e interface para empresa |
| `src/components/departments/NovaDespesaDepartamentoDialog.tsx` | Adicionar seletor de filial |
| `src/components/departments/DepartmentExpensesTable.tsx` | Exibir coluna de filial |
| `src/components/financeiro/payments/PaymentQueueTable.tsx` | Adicionar filtro e coluna de filial |
| `src/pages/FinancialPaymentCentral.tsx` | Integrar filtro de empresas |

## Fluxo de Visibilidade

```text
┌─────────────────────────────────────────────────────────────────┐
│                      VISIBILIDADE DE DESPESAS                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FUNCIONÁRIO (vinculado à filial SP e GYN)                      │
│  └─ Vê: Despesas da SP + Despesas da GYN                        │
│                                                                 │
│  GESTOR DE DEPARTAMENTO                                         │
│  └─ Vê: Todas despesas do seu departamento (todas filiais)      │
│                                                                 │
│  SUPERVISOR / ADMIN                                             │
│  └─ Vê: Todas despesas de todas filiais                         │
│                                                                 │
│  FINANCEIRO CENTRAL                                             │
│  └─ Vê: Todas solicitações de pagamento de todas filiais        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Benefícios
- Isolamento de dados por filial mantendo colaboração entre equipes
- Gestores mantêm visão completa do departamento
- Financeiro Central consolida todas as filiais
- Flexibilidade para usuários multi-filial
- Auditoria clara de qual filial gerou cada despesa
