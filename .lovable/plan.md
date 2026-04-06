

# Fix: Classificação no DRE não salva no banco

## Problema identificado

A migração `20260331195429` **dropou todas as policies** da tabela `contas_pagar_historico` e recriou apenas a policy de **SELECT**. Não há policy de **INSERT** para essa tabela.

Quando o usuário clica "Salvar Alterações" no dialog de detalhes do lançamento, a mutation `salvarManual` tenta primeiro inserir registros manualmente em `contas_pagar_historico` (via `registrarHistorico`). Como não existe policy de INSERT, essa operação falha silenciosamente, e o `throw error` na mutation impede que o `UPDATE` em `contas_pagar` seja executado.

**Nota:** Já existe um trigger `SECURITY DEFINER` (`trg_contas_pagar_audit`) que registra automaticamente todas as alterações em `contas_pagar_historico` quando `contas_pagar` é atualizado. A inserção manual no código é redundante e é a causa da falha.

## Solução

### 1. Migração SQL — Adicionar INSERT policy em `contas_pagar_historico`

```sql
CREATE POLICY "cph_insert" ON contas_pagar_historico FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'admin'));
```

### 2. `DetalheLancamentoDialog.tsx` — Tratar erro na inserção de histórico

Alterar a função `registrarHistorico` para não bloquear o fluxo caso a inserção falhe (try/catch), garantindo que o `UPDATE` em `contas_pagar` sempre seja executado. A inserção manual serve para registrar metadados extras (justificativa, nome legível do campo), enquanto o trigger captura as colunas brutas.

- Envolver cada chamada a `registrarHistorico` dentro de um try/catch
- Garantir que erros no histórico não impeçam o salvamento da classificação

## Arquivos

| Arquivo | Alteração |
|---|---|
| Migração SQL | Adicionar INSERT policy em `contas_pagar_historico` |
| `src/components/financeiro/DetalheLancamentoDialog.tsx` | Try/catch em `registrarHistorico` para não bloquear o fluxo |

