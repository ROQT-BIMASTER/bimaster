# Diagnóstico — "Produto não fica salvo após submeter para aprovação"

## Contexto investigado

Tela: `src/pages/FabricaProdutosAcabados.tsx`
Diálogo de cadastro/edição: `src/components/fabrica/NovoProdutoAcabadoDialog.tsx`
Submissão para aprovação (Ficha de Custos): `src/hooks/useFichaRevisao.ts` → `submeterParaAprovacao`
Salvar ficha: `src/hooks/useFichaCustoProduto.ts` → `salvarFicha`

## O que já foi confirmado pelo banco

1. A tabela `fabrica_produtos` tem RLS:
   - INSERT/UPDATE/DELETE: exigem `check_user_access(uid, 'fabrica')`
   - SELECT pode passar via `check_user_access(uid, 'fabrica')` **OU** `check_user_access(uid, 'precos')`
2. Triggers ativos em `fabrica_produtos` (audit + updated_at) estão funcionando — não há erros recentes nos logs do Postgres relacionados ao módulo Fábrica.
3. Os produtos cadastrados estão fisicamente salvos (último em 24/04). O problema NÃO é perda de dados no banco — é uma falha de visibilidade ou de fluxo no front.

## Hipóteses prováveis (em ordem de probabilidade)

### Hipótese A — Falha silenciosa de RLS no UPDATE (mais provável)
O usuário tem acesso de SELECT via `precos` mas NÃO via `fabrica`. Ao editar um produto:
- O `.update(...).select()` retorna `data: []` SEM erro (RLS não bloqueia, apenas filtra a linha do retorno).
- O front não detecta isso porque não checa se `data.length === 0`.
- Resultado: usuário vê toast de sucesso mas a alteração nunca foi gravada.

### Hipótese B — Submissão da ficha falha em sub-etapa, mas mostra sucesso
Em `submeterParaAprovacao`, se o produto é Display/Kit, há um `for` que tenta criar config para filhos com colunas que possivelmente não existem mais (`margem_lucro`, `impostos_percentual`, etc.). O bloco interno tem `try/catch` que apenas faz `console.warn`, então o usuário vê "submetido com sucesso" mesmo quando filhos falham silenciosamente. Para o produto pai a submissão funciona, mas a *ficha* pode aparecer como "rascunho" se houver outra config concorrente.

### Hipótese C — Cache/refetch
A query `["fabrica-produtos-acabados"]` é invalidada após salvar (ver `invalidateKeys` na mutation). Se a aba/filtro selecionado esconde o produto recém-salvo (ex.: filtro por Marca/Linha vazio, "Mostrar ocultos" desligado, ou tipo `INTER` filtrado), o usuário acha que sumiu.

## Plano de correção

### Passo 1 — Detecção e diagnóstico explícito no front

Em `src/components/fabrica/NovoProdutoAcabadoDialog.tsx` (mutation `salvarMutation`):

1. Após `update(...).select()`, validar:
   ```ts
   const { data, error } = await supabase.from("fabrica_produtos").update(...).select();
   if (error) throw error;
   if (!data || data.length === 0) {
     throw new Error("Sem permissão para alterar este produto (ou produto não encontrado). Verifique seu perfil de acesso ao módulo Fábrica.");
   }
   ```
2. Mesmo tratamento no `insert(...).select().single()` — se vier `null`, lançar erro descritivo.
3. Logar no `console.error` o `payload` enviado e o `data` retornado para futura depuração.

### Passo 2 — Submissão da ficha: relatar falhas em vez de engolir

Em `src/hooks/useFichaRevisao.ts` → `submeterParaAprovacao`:

1. Trocar `console.warn` por acumular um array `falhas: string[]` e exibir um `toast.warning` final listando filhos que falharam (em vez de toast de sucesso simples).
2. Ao criar config do filho, remover colunas legadas (`margem_lucro`, `impostos_percentual`, `frete_percentual`, `comissao_percentual`, `markup_desejado`) e usar apenas as colunas atuais (`percentual_markup`, `base_calculo_markup`, `custo_mao_obra_nf`, `custo_mao_obra_servico`, `status_aprovacao`).
3. Após submeter, forçar `queryClient.invalidateQueries(["fabrica-produtos-acabados"])`, `["fabrica-produtos-fichas-config"]` e `["fabrica-produtos-revisoes-custos"]` — assim o status correto aparece imediatamente na listagem.

### Passo 3 — Garantir RLS coerente (servidor)

Em uma migration:

1. Adicionar uma função `can_edit_fabrica_produto(uid)` que retorna `true` para admin/supervisor/gerente e para usuários com permissão explícita em `fabrica` ou `fabrica_produtos`.
2. Substituir as policies `fp_insert` / `fp_update` para usar essa função.
3. **Importante:** acrescentar `USING (...)` na policy de UPDATE (`fp_update` hoje só tem WITH CHECK, sem USING). Sem `USING`, o `RETURNING` do PostgREST após `UPDATE` é filtrado pela policy de SELECT — se o usuário tem SELECT via `precos` mas a row passa, o update funciona e retorna; se não tem SELECT direto via `fabrica`, ele não enxerga o resultado e o front interpreta como "não salvou".

### Passo 4 — Verificação assistida na lista

Em `FabricaProdutosAcabados.tsx`:

1. Após salvar/submeter, se o filtro atual (marca/linha/tipo) esconderia o produto recém-tocado, exibir um toast `"Produto salvo. Ele pode estar fora do filtro atual — clique aqui para limpar filtros."` com ação "Limpar filtros".
2. No botão "Submeter para aprovação", desabilitar até `salvarFicha()` confirmar gravação (já existe parcialmente — reforçar com `await` sequencial).

### Passo 5 — Telemetria leve

1. Adicionar um `audit_log` (`logAuditAction`) ao salvar produto e ao submeter ficha, gravando `produto_id`, `acao`, `success/error`, `mensagem`. Permite, em casos futuros de "sumiu", identificar rapidamente se o INSERT/UPDATE chegou ao banco.

## Detalhes técnicos resumidos

- **Arquivos a editar**: `src/components/fabrica/NovoProdutoAcabadoDialog.tsx`, `src/hooks/useFichaRevisao.ts`, `src/pages/FabricaProdutosAcabados.tsx`.
- **Migration nova**: `add_using_clause_fabrica_produtos_update` + função `can_edit_fabrica_produto`.
- **Sem mudança de schema** em tabelas; só policies e código cliente.
- **Sem impacto** em produtos já cadastrados — apenas blindagem e feedback.

## Resultado esperado

- Se o usuário não tem permissão real de gravar, vê uma mensagem clara em vez de um falso "salvo com sucesso".
- Se a submissão da ficha falha em filhos, o usuário sabe quais.
- O produto recém-criado/editado aparece na listagem mesmo com filtros ativos (via aviso) e a policy de UPDATE devolve a linha corretamente.
- Logs de auditoria permitem rastrear cada save/submit.
