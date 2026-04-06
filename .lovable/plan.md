

# Criar Múltiplos Planos de Redução

## Objetivo

Permitir criar e gerenciar vários planos de redução (ex: "TI", "Marketing", "Logística"), cada um com suas despesas monitoradas. O usuário seleciona o plano ativo e vê apenas os itens vinculados a ele.

## Alterações

### 1. Migração SQL — Nova tabela `planos_reducao`

```sql
CREATE TABLE planos_reducao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  status text DEFAULT 'ativo',  -- ativo, arquivado
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE planos_reducao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso público planos_reducao" ON planos_reducao FOR ALL USING (true) WITH CHECK (true);

-- Vincular revisões a um plano
ALTER TABLE contas_pagar_revisao ADD COLUMN plano_id uuid REFERENCES planos_reducao(id);

-- Criar o primeiro plano e vincular registros existentes
INSERT INTO planos_reducao (id, nome, descricao) 
VALUES (gen_random_uuid(), 'Redução Departamento de TI', 'Plano de redução de gastos do departamento de Tecnologia da Informação');

UPDATE contas_pagar_revisao SET plano_id = (SELECT id FROM planos_reducao LIMIT 1) WHERE plano_id IS NULL;
```

### 2. `src/components/financeiro/PlanoReducaoGastos.tsx`

- **Seletor de plano**: Dropdown no topo da página listando todos os planos. Ao selecionar, filtra `contas_pagar_revisao` por `plano_id`.
- **Botão "Novo Plano"**: Abre dialog simples com campos Nome e Descrição. Insere na tabela `planos_reducao`.
- **Query ajustada**: Adicionar `.eq('plano_id', selectedPlanoId)` na query de revisões.
- **Header dinâmico**: Exibir nome do plano selecionado como título/subtítulo da seção.

### 3. Fluxo do usuário

1. Abre a tela → vê dropdown com planos existentes (ex: "Redução Departamento de TI")
2. Pode criar novo plano clicando "Novo Plano"
3. Seleciona um plano → tabela mostra apenas as despesas daquele plano
4. Ao adicionar novas despesas para análise, elas ficam vinculadas ao plano ativo

## Arquivos

| Arquivo | Alteração |
|---|---|
| 1 migração SQL | Criar tabela `planos_reducao` + coluna `plano_id` em `contas_pagar_revisao` |
| `src/components/financeiro/PlanoReducaoGastos.tsx` | Seletor de plano, botão novo plano, filtro por `plano_id` |

