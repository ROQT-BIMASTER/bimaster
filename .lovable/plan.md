

# Planos de Redução com Propriedade e Compartilhamento

## Objetivo

Cada plano de redução pertence ao usuário que o criou. Outros usuários só veem planos compartilhados com eles. O dono pode liberar acesso a outros usuários.

## Alterações

### 1. Migração SQL

**Tabela `planos_reducao`** — adicionar coluna de proprietário:
```sql
ALTER TABLE planos_reducao ADD COLUMN criado_por uuid REFERENCES auth.users(id);
-- Atribuir planos existentes ao primeiro admin
UPDATE planos_reducao SET criado_por = (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1);
ALTER TABLE planos_reducao ALTER COLUMN criado_por SET NOT NULL;
```

**Nova tabela `planos_reducao_compartilhados`** — controla quem tem acesso:
```sql
CREATE TABLE planos_reducao_compartilhados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid REFERENCES planos_reducao(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plano_id, user_id)
);
```

**RLS em ambas as tabelas:**
- `planos_reducao`: SELECT/UPDATE/DELETE se `criado_por = auth.uid()` OU existe em `planos_reducao_compartilhados` OU `is_admin_or_supervisor`. INSERT para authenticated.
- `planos_reducao_compartilhados`: Apenas o dono do plano pode INSERT/DELETE. SELECT para envolvidos.

### 2. `PlanoReducaoGastos.tsx`

- A query de planos já será filtrada pelo RLS (só retorna planos do usuário ou compartilhados)
- Ao criar plano, enviar `criado_por: user.id`
- Adicionar botão **"Compartilhar"** ao lado do seletor de plano (ícone Users)
- Dialog de compartilhamento: lista profiles, permite adicionar/remover usuários com acesso
- Badge indicando se o plano é "Meu" ou "Compartilhado comigo"

### 3. `MarcarRevisaoDialog.tsx`

- Já tenta enviar `criado_por` — garantir consistência com a nova coluna

### 4. Dialog de Compartilhamento (inline no PlanoReducaoGastos)

- Busca profiles (nome, email) para seleção
- Lista usuários já compartilhados com botão remover
- Botão adicionar novo usuário

## Arquivos

| Arquivo | Alteração |
|---|---|
| 1 migração SQL | `criado_por` em planos_reducao + tabela compartilhados + RLS |
| `PlanoReducaoGastos.tsx` | `criado_por` no insert, botão compartilhar, dialog de gestão de acesso |
| `MarcarRevisaoDialog.tsx` | Ajuste menor para consistência |

