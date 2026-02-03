
# Plano de Correção: Campanhas não aparecem na Central de Aprovações

## Diagnóstico

Identifiquei a causa raiz do problema:

1. **O botão mostra "1" corretamente** - A página `TradeCampaigns` busca todas as campanhas e filtra localmente as que têm `status === "pending_approval"`

2. **A Central de Aprovações não mostra a campanha** - O hook `usePendingCampaigns()` está retornando **erro 400** porque tenta fazer um join inexistente:
   ```
   responsible:profiles!responsible_user_id(id, nome, email)
   ```

3. **Erro do PostgREST**: 
   ```
   PGRST200: Could not find a relationship between 'trade_campaigns' and 'profiles' 
   using the hint 'responsible_user_id'
   ```

4. **Causa técnica**: A coluna `responsible_user_id` não possui foreign key para a tabela `profiles`, então o PostgREST não consegue resolver o relacionamento automaticamente

---

## Solução

Corrigir o hook `usePendingCampaigns` em `src/hooks/useTradeData.ts`:

### Alteração

Remover o join problemático `responsible:profiles!responsible_user_id` e buscar os dados do responsável em uma query separada, seguindo o mesmo padrão já usado para `created_by_profile`:

```text
ANTES:
.select(`
  *,
  budget:trade_budgets(...),
  responsible:profiles!responsible_user_id(id, nome, email)  ← ERRO
`)

DEPOIS:
.select(`
  *,
  budget:trade_budgets(...)
`)
// Depois buscar profiles em query separada para created_by E responsible_user_id
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useTradeData.ts` | Remover join `profiles!responsible_user_id` e enriquecer dados com query separada |

---

## Detalhes Técnicos

O hook atualizado irá:

1. Buscar campanhas pendentes sem o join para `profiles`
2. Coletar todos os IDs únicos (`created_by` + `responsible_user_id`)  
3. Buscar profiles em uma única query
4. Enriquecer cada campanha com `created_by_profile` e `responsible_profile`

Isso garante compatibilidade com a estrutura atual do banco de dados que não possui a foreign key entre `trade_campaigns.responsible_user_id` e `profiles`.
