

# Tela de Configuração: Departamentos por Projeto (Checkboxes)

## Contexto

Hoje cada projeto tem apenas um `departamento_id` (relação 1:1). Para permitir que o admin defina **múltiplos departamentos** com acesso a cada projeto, é necessário criar uma tabela de junção e uma nova aba na tela de Configurações de Acesso.

## Implementação

### 1. Migração SQL — Tabela de junção + RLS

Criar tabela `projeto_departamentos` (many-to-many):

```sql
CREATE TABLE projeto_departamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  departamento_id UUID NOT NULL REFERENCES departamentos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(projeto_id, departamento_id)
);

ALTER TABLE projeto_departamentos ENABLE ROW LEVEL SECURITY;

-- Apenas admin pode gerenciar
CREATE POLICY "admin_manage_projeto_departamentos" ON projeto_departamentos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

Atualizar `user_can_access_projeto` para consultar a nova tabela ao invés da coluna `departamento_id`:

```sql
-- Na cláusula de "mesmo departamento":
OR EXISTS (
  SELECT 1 FROM projeto_departamentos pd
  JOIN profiles pr ON pr.departamento_id = pd.departamento_id
  WHERE pd.projeto_id = _projeto_id AND pr.id = _user_id
)
```

### 2. Nova Aba "Projetos" em Configurações de Acesso

Adicionar uma 6ª aba na página `ConfiguracoesAcesso.tsx` com ícone `FolderKanban`.

### 3. Componente `AcessoProjetoDepartamento.tsx`

Interface visual com:
- Lista de todos os projetos (coluna esquerda ou cards)
- Para cada projeto, grid de checkboxes com todos os departamentos ativos
- Checkbox marcado = departamento tem acesso ao projeto
- Mudanças salvam automaticamente via mutations (insert/delete na tabela `projeto_departamentos`)
- Busca/filtro por nome do projeto no topo

Layout proposto:
```text
┌─────────────────────────────────────────────────┐
│ 🔍 Buscar projeto...                           │
├─────────────────────────────────────────────────┤
│ Projeto: Módulo Financeiro                      │
│ ☑ Financeiro  ☑ Administrativo  ☐ Comercial ... │
├─────────────────────────────────────────────────┤
│ Projeto: Módulo Trade Marketing                 │
│ ☐ Financeiro  ☑ Comercial/Trade  ☐ Fábrica ... │
└─────────────────────────────────────────────────┘
```

### 4. Atualizar `NovoProjetoDialog` 

Substituir o select único de departamento por checkboxes múltiplos, usando a nova tabela `projeto_departamentos` (insert após criação do projeto).

## Arquivos

| Arquivo | Alteração |
|---|---|
| Migração SQL | Criar `projeto_departamentos`, RLS, atualizar `user_can_access_projeto` |
| `src/components/configuracoes-acesso/AcessoProjetoDepartamento.tsx` | Novo componente — tela de checkboxes |
| `src/pages/dashboard/configuracoes/ConfiguracoesAcesso.tsx` | Adicionar aba "Projetos" |
| `src/components/projetos/NovoProjetoDialog.tsx` | Adaptar seleção de departamento para múltiplos |
| `src/hooks/useProjetos.ts` | Ajustar mutation de criação para inserir na nova tabela |

