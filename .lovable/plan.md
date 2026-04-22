

# Diagnóstico e correção — CNPJ 02183783005261 não aparece após cadastro

## Diagnóstico

Consultei o banco diretamente: **não existe nenhuma loja com esse CNPJ na tabela `stores`** (testei com e sem máscara, em todos os formatos). Também:

- **Zero lojas** foram criadas nas últimas 4 horas (`stores` filtrada por `created_at >= now()-'4 hours'`).
- **Zero registros** em `audit_logs` com `action='cadastro_cliente_cnpj'` (nunca foi usado).
- O CNPJ é matematicamente válido (DV calculado: 61, confere).
- Os logs do Postgres não mostram erro na tabela `stores`.

**Conclusão**: o cadastro **nunca foi persistido**. O insert ou foi bloqueado silenciosamente, ou o usuário fechou o modal antes de submeter, ou viu um erro que não percebeu.

## Causas-raiz identificadas no código

### 1. `NovaLojaDialog.tsx` — falta indicador de erro persistente
- A validação Zod (linha 22) aceita `cnpj: ""` mas não valida o **dígito verificador** matemático. Um CNPJ digitalmente errado (ex: 02183783005262) passa pela validação e bate no banco — mas no caso atual não é o problema.
- Quando o INSERT falha (RLS, FK, unique), o `catch` mostra um `toast.error` que **some em 5 segundos**. Se o usuário estava em outra aba (Alt+Tab), perde a mensagem e acha que cadastrou.
- A duplicata (linha 218-228) só verifica `status='active'`. Se já existir uma loja **inativa** com o mesmo CNPJ, o INSERT prossegue e bate em uma constraint silenciosa — mas como `cnpj` não tem `UNIQUE`, isso não é o caso aqui.

### 2. `CadastroClienteCnpjDialog.tsx` — `onSuccess` só é chamado no fluxo "feliz"
- Após `setStep("success")` (linha 263), o componente espera o usuário clicar em "Concluir" (`handleSuccessClose`) para chamar `onSuccess?.()`.
- Se o usuário fecha pelo X ou clica fora **na tela de sucesso**, a loja é criada mas a listagem não recebe `refetch` → loja invisível por **5 minutos** (staleTime do `useFilteredStores`).

### 3. `useFilteredStores` — staleTime de 5 min sem invalidação global
- O hook tem `staleTime: 5 * 60 * 1000`. Qualquer fluxo que insira em `stores` mas esqueça de chamar `queryClient.invalidateQueries(['filtered-stores'])` resulta em loja "fantasma" até o cache expirar.

## Correções propostas

### A) Persistir e exibir erros de cadastro com clareza (`NovaLojaDialog.tsx`)
- Substituir o `toast.error` simples por **toast persistente** (`duration: Infinity` com botão de fechar) no catch, exibindo a mensagem de erro do Postgres por completo.
- Adicionar `console.error` detalhado com o payload enviado para facilitar diagnóstico futuro.
- Adicionar **validação matemática de DV do CNPJ** (função `validateCnpjDV`) reaproveitando a lógica já existente em `Empresas.tsx` (linha 48).

### B) Garantir refetch em qualquer fechamento após sucesso (`CadastroClienteCnpjDialog.tsx`)
- Mover a chamada `onSuccess?.(createdStoreId, createdStoreName)` para dentro do `useEffect` que dispara quando `step === "success"`, **disparando uma única vez** (com flag `successFiredRef`).
- Garante que mesmo fechando pelo X ou clique-fora após o INSERT bem-sucedido, a listagem é atualizada.

### C) Reduzir `staleTime` e invalidar cache no insert (`useFilteredStores.ts` + dialogs)
- Reduzir `staleTime` de 5 min para **30 segundos** (mantém ganho de performance, evita "lojas fantasma" por longos períodos).
- Adicionar `queryClient.invalidateQueries({ queryKey: ['filtered-stores'] })` logo após o INSERT bem-sucedido em `NovaLojaDialog.tsx` e `CadastroClienteCnpjDialog.tsx`, antes de chamar `onSuccess`.

### D) Reativar/inserir o CNPJ informado pelo usuário
- Como o registro nunca foi criado, **não há o que reativar**. Após as correções acima, basta o usuário re-cadastrar pela tela atual e o problema não se repetirá.
- Opcional: posso pré-cadastrar manualmente esse CNPJ via insert (vinculado ao usuário atual) se você confirmar.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/trade/NovaLojaDialog.tsx` | Validação DV CNPJ, toast persistente em erro, invalidate query, console.error detalhado |
| `src/components/trade/CadastroClienteCnpjDialog.tsx` | `useEffect` que dispara `onSuccess` ao entrar em `step="success"`, invalidate query |
| `src/hooks/useFilteredStores.ts` | `staleTime` de 5 min → 30 s |
| `src/lib/validations/cnpj.ts` *(novo)* | Função utilitária `validateCnpjDV(cnpj: string): boolean` reutilizável |

Sem mudanças em RLS, schema, edge functions, APP_VERSION ou SDK.

## Validação pós-correção

1. Tentar cadastrar CNPJ inválido (DV errado) → toast "CNPJ inválido (dígito verificador)".
2. Cadastrar `02183783005261` → loja aparece **imediatamente** na listagem.
3. Forçar erro de RLS (logar como usuário sem permissão `comercial`/`trade_marketing`) → toast persistente com "row violates row-level security policy" visível.
4. Fechar `CadastroClienteCnpjDialog` pelo X após sucesso → listagem é atualizada mesmo assim.

## Não-escopo

- Sem mexer no fluxo de duplicata (regras atuais estão corretas).
- Sem alterar a edge function `padronizar-nome-cliente` ou `opencnpj-consulta`.
- Sem alterar `QuickEntryDialog`, `EditarLojaDialog` ou `TradeImportStores`.

