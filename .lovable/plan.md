
# Plano: Multi-vendedor para PDVs + Visualização Filtrada

## ✅ IMPLEMENTADO
1. Permitir que uma loja (PDV) seja vinculada a **múltiplos vendedores**
2. Garantir que usuários não-admins/supervisores visualizem **apenas os PDVs vinculados a eles**

---

## Situação Atual

### Estrutura Existente
- A tabela `stores` possui `vendedor_id` (UUID único) - suporta apenas 1 vendedor
- Já existe uma tabela `store_sellers` com a estrutura correta para múltiplos vendedores:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | Chave primária |
| store_id | uuid | FK para stores |
| vendedor_id | uuid | FK para profiles |
| is_principal | boolean | Indica vendedor principal |
| created_at | timestamp | Data de criação |
| created_by | uuid | Quem criou o vínculo |

- A tabela `store_sellers` já possui **73 registros**, mas não está sendo usada na interface

### Problema
- Os formulários de criação e edição de loja usam apenas o campo `vendedor_id` (seleção única)
- A listagem de lojas (`TradeStores.tsx`) mostra todos os PDVs para todos os usuários
- Não há filtro por vendedor vinculado

---

## Solução Proposta

### Parte 1: Seleção Multi-vendedor

**Arquivos a modificar:**
- `src/components/trade/NovaLojaDialog.tsx`
- `src/components/trade/EditarLojaDialog.tsx`
- `src/components/trade/StoreDetailDialog.tsx`

**Implementação:**
1. Trocar o `<Select>` único por um componente de seleção múltipla com checkboxes
2. Ao salvar a loja:
   - Manter o `vendedor_id` principal na tabela `stores` (compatibilidade)
   - Sincronizar os vendedores selecionados na tabela `store_sellers`
3. Exibir lista de vendedores no dialog de detalhes com indicação de "Principal"

### Parte 2: Visualização Filtrada por Vendedor

**Arquivo a modificar:**
- `src/pages/TradeStores.tsx`

**Implementação:**
1. Detectar role do usuário com `useUserRole`
2. Para não-admins/supervisores:
   - Buscar os `store_id` da tabela `store_sellers` onde `vendedor_id = currentUserId`
   - Filtrar a listagem de lojas para mostrar apenas esses IDs
3. Admins e supervisores continuam visualizando todos os PDVs

---

## Detalhes Técnicos

### 1. Componente Multi-Select de Vendedores

Criar um novo componente `VendedorMultiSelect.tsx`:

```text
┌─────────────────────────────────────────────┐
│ Vendedores Responsáveis *                   │
├─────────────────────────────────────────────┤
│ ☑ João Silva - Vendedor (Principal)         │
│ ☑ Maria Santos - Vendedor                   │
│ ☐ Carlos Lima - Promotor                    │
│ ☐ Ana Costa - Vendedor                      │
└─────────────────────────────────────────────┘
```

### 2. Lógica de Salvamento

```text
Ao salvar loja:
1. INSERT/UPDATE na tabela stores (com vendedor_id do primeiro selecionado)
2. DELETE FROM store_sellers WHERE store_id = ?
3. INSERT INTO store_sellers (store_id, vendedor_id, is_principal)
   VALUES (?, ?, true/false) -- primeiro é principal
```

### 3. Filtro de Visualização

```text
fetchStores():
  SE isAdminOrSupervisor:
    SELECT * FROM stores
  SENÃO:
    SELECT store_id FROM store_sellers WHERE vendedor_id = currentUserId
    SELECT * FROM stores WHERE id IN (store_ids) OR vendedor_id = currentUserId
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/trade/VendedorMultiSelect.tsx` | Criar | Componente de seleção múltipla de vendedores |
| `src/components/trade/NovaLojaDialog.tsx` | Modificar | Usar multi-select e salvar em store_sellers |
| `src/components/trade/EditarLojaDialog.tsx` | Modificar | Carregar e salvar múltiplos vendedores |
| `src/components/trade/StoreDetailDialog.tsx` | Modificar | Exibir lista de vendedores vinculados |
| `src/pages/TradeStores.tsx` | Modificar | Filtrar PDVs por vendedor para não-admins |

---

## Considerações

1. **Compatibilidade**: Manter o campo `vendedor_id` na tabela `stores` para não quebrar funcionalidades existentes
2. **Migração de dados**: Os 73 registros em `store_sellers` já existem, então lojas que já têm vínculo funcionarão automaticamente
3. **Performance**: Usar JOINs eficientes ao invés de múltiplas queries
4. **Segurança**: O filtro no frontend complementa as políticas RLS existentes
