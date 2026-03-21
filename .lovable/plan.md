

## Plano: Enriquecer tabela `clientes` com dados de vendedor/supervisor

### Descobertas

- A tabela `clientes` usa `codigo` (varchar) como identificador do cliente, não `cod_cliente`.
- Na `vendas_union`, o campo é `cod_cliente` (integer).
- O JOIN funciona: `CAST(c.codigo AS INTEGER) = v.cod_cliente` (36.797 clientes têm código numérico).
- A tabela `clientes` **já tem RLS habilitado** com 5 policies existentes (admin, supervisor, insert, delete, select por módulo).
- Não existe `cod_vend`, `vendedor`, `cod_equipe`, `nome_equipe`, `supervisor`, nem `id_empresa` na tabela ainda.

### O que será feito

**Migração única com 2 partes:**

1. **Adicionar 6 colunas** à tabela `clientes`: `cod_vend`, `vendedor`, `cod_equipe`, `nome_equipe`, `supervisor`, `id_empresa`.

2. **Popular via UPDATE** com o vendedor mais recente de cada cliente, usando JOIN adaptado:
   ```sql
   WHERE c.codigo ~ '^\d+$' AND CAST(c.codigo AS INTEGER) = v.cod_cliente
   ```

3. **Adicionar 3 novas RLS policies** (sem remover as existentes):
   - `vendedor_clientes_own` — vendedor vê seus clientes via `dim_vendedor.user_id`
   - `supervisor_clientes_team` — supervisor vê clientes da equipe via `dim_supervisor.user_id`
   - `empresa_clientes_access` — acesso por empresa via `user_empresa_access`

   A policy de admin já existe, não será duplicada.

### Detalhe técnico

- O UPDATE usará `DISTINCT ON (cod_cliente) ... ORDER BY cod_cliente, data DESC` para pegar o vendedor mais recente.
- As novas policies usam `FOR SELECT` e complementam as policies existentes (OR entre policies).
- Índice em `cod_vend` será criado para performance das queries RLS.

