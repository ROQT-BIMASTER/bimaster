
# Plano: investigar e mitigar lentidão sistêmica + atraso na exibição de itens cadastrados

## Diagnóstico (com evidências)

Investiguei o banco, o React Query, hooks e mutations. Resumo do que está causando a lentidão:

### 1. Banco grande e mal escalado para o uso atual
Tamanho total do banco: **3.256 MB**. Tabelas mais pesadas:

| Tabela | Linhas | Tamanho |
|---|---:|---:|
| `Union` (movimentações de venda) | 1.041.445 | 481 MB |
| `contas_receber` | 464.849 | 545 MB |
| `contas_pagar_historico` | 492.012 | 95 MB |
| `contas_pagar` | 48.306 | 194 MB |
| `clientes` | 39.600 | 52 MB |

Operações de listagem nessas tabelas, mesmo com índices, ficam lentas porque o trabalho é **principalmente RLS + leitura grande**. Não há nada de errado nas queries em si — é volume real.

### 2. `staleTime` global de 5 min mascara mutations
Em `src/App.tsx` o `QueryClient` está com `staleTime: 5 * 60 * 1000` e `refetchOnWindowFocus: false`. Combinado com mutations que **dependem de `invalidateQueries` para mostrar o item novo**, qualquer falha de invalidação produz exatamente o sintoma "cadastrei e não aparece".

### 3. Auditoria das mutations (213 arquivos)
- 203 mutations invalidam o cache corretamente.
- Apenas **1 caso problemático real**: `src/pages/financeiro/CadastroTituloAP.tsx` (Cadastro de Título a Pagar) faz `useMutation` direto, sem `invalidateQueries` e sem `useMutationWithTimeout`. Após salvar, a lista de Contas a Pagar **só atualiza no próximo refetch natural** (5 min depois ou refresh manual).

### 4. Listagens que carregam tudo de uma vez (fetchAllRows)
Usado em `DREAnalitico.tsx`, `Financeiro.tsx`, `useClienteReativacao.ts`, `useCommercialMapData.ts`, `useFinancialPaymentQueue.ts`. Quando essas telas abrem, fazem paginação interna até trazer 100% das linhas para o navegador. Em `contas_receber` (465k linhas) isso é **centenas de MB transferidos** e congela o browser.

### 5. Hooks de permissão fazem `.select("*")` em toda renderização
`useUserDepartments`, `useUserEmpresas`, `useUIPermissions`, `useTradeUserApprovalLevels`, `useVisibilityBlocks` rodam em quase toda página e usam `.select("*")` sem projeção de colunas. São tabelas pequenas (centenas de linhas), mas multiplicam I/O sob carga.

## Ações propostas (em ordem de impacto vs custo)

### Fase 1 — Correções pontuais (fix imediato do "demora a aparecer")
1. **`CadastroTituloAP.tsx`**: trocar `useMutation` por `useMutationWithTimeout` com `invalidateKeys: [["contas_pagar"], ["contas_pagar_huggs"], ["contas_pagar_metrics"]]` (e outras keys usadas pela listagem). Garantir invalidação no `onSuccess` mesmo quando há side-effects (nfe, etc.).
2. **Padronizar invalidação após mutation em listas grandes**: revisar Contas a Pagar, Contas a Receber, Clientes, Produtos, Tabelas de Preço — confirmar que todas as listagens compartilham a mesma `queryKey` que as mutations invalidam.
3. **Fallback otimista**: em listas paginadas, ao criar um item, fazer `setQueryData` para inserir o registro retornado no início da página atual em vez de aguardar refetch. Reduz a percepção de "demora" para zero.

### Fase 2 — Reduzir volume transferido (impacto grande na lentidão geral)
4. **Eliminar `fetchAllRows` em telas operacionais**:
   - `Financeiro.tsx` e `DREAnalitico.tsx` devem agregar no banco (RPC com SQL `GROUP BY`/`SUM`) em vez de baixar 465k linhas e somar no JS.
   - Criar funções `SECURITY DEFINER` (ex: `dre_resumo_periodo(empresa_id, dt_ini, dt_fim)`) que retornam apenas os totais já consolidados.
5. **Paginação real em Contas a Pagar/Receber**: trocar `select` aberto por `range(start, end)` + contagem separada. Default 50 linhas/página.
6. **Projeção de colunas**: substituir `.select("*")` por `.select("id, nome, ...")` somente das colunas usadas na UI, especialmente em hooks de permissão e em listagens grandes.

### Fase 3 — Higiene do banco (ganho duradouro)
7. **Auditar a tabela `Union`**: nome estranho (palavra reservada SQL, capitalizada — quebra queries não-quotadas), 1M linhas. Verificar:
   - Qual módulo grava nela? Está sendo usada ou é histórico morto?
   - Se for histórica, mover para tabela `vendas_movimentacoes_historico` particionada por ano e arquivar dados antigos.
8. **Particionar `contas_receber`** (545 MB) por ano de vencimento. Listagens recentes ficam ~10x mais rápidas.
9. **Verificar índices ausentes** com `pg_stat_user_indexes` em `contas_receber`/`contas_pagar`/`Union` — se houver scans sequenciais frequentes, criar índices nos filtros mais comuns (empresa_id + data + status).
10. **Limpar `api_security_log` (94k linhas) e `contas_pagar_historico` (492k linhas)** se forem só auditoria — política de retenção de 90/180 dias.

### Fase 4 — Compute (último recurso, com aviso de custo)
Caso após Fases 1–3 ainda haja lentidão sob carga (muitos usuários simultâneos), o caminho é **aumentar o tamanho da instância Lovable Cloud**. Isso é uma decisão sua: dá mais CPU/memória/IO ao backend, mas afeta o consumo do plano. Acessível em **Backend → Configurações Avançadas → Upgrade Instance**.

## O que NÃO vou fazer agora

- Não vou tocar em RLS (tem padrão consolidado e sensível, pode quebrar segurança).
- Não vou apagar a tabela `Union` sem confirmação sua sobre o uso dela.
- Não vou alterar `staleTime` global de 5 min (a opção é correta para reduzir requests; o problema é mutations sem invalidação, que são localizadas).
- Não vou rodar nenhum DDL destrutivo sem migração revisada.

## Entrega da Fase 1 (vou implementar agora se aprovado)

Arquivos a alterar:
- `src/pages/financeiro/CadastroTituloAP.tsx` — adicionar `invalidateQueries` no `onSuccess` para todas as keys de Contas a Pagar (`contas_pagar`, `contas_pagar_huggs`, `contas_pagar_metrics`, `cp-list`, etc., mapeando antes pelas keys reais usadas em `ContasAPagar.tsx`).
- Adicionar `setQueryData` otimista para inserir o título recém-criado no topo da lista atual sem esperar refetch.
- Validar com `rg` que não há outras mutations órfãs em `src/components/financeiro/` ou `src/components/fabrica/` que tenham passado pela auditoria.

Critério de aceite Fase 1: ao cadastrar um título a pagar, ele aparece na lista **em menos de 1 segundo**, sem refresh da página.

## Pergunta antes de começar

A Fase 1 é segura e rápida (~10 min). As Fases 2 e 3 são maiores (envolvem migrações, RPCs novas, possível downtime curto). Confirme: começo só pela Fase 1 ou já preparo Fase 2 também (DRE + Financeiro com agregação no banco)?
