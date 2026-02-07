

# Otimizacao Massiva de Performance - Reducao de Custos Cloud

## Diagnostico Resumido

| Problema | Impacto | Numeros |
|----------|---------|---------|
| user_roles scans | CRITICO | 2,68 bilhoes de seq_scans em 18 linhas |
| Policies duplicadas | CRITICO | 974 policies no total, dezenas de tabelas com 4-17 policies |
| Cascata de funcoes | ALTO | Uma query pode gerar 18+ lookups no user_roles |
| audit_logs crescendo | MEDIO | 679K linhas em 2 dias, retencao de 30 dias muito alta |
| contas_receber writes | MEDIO | 121M updates em 394K linhas |

### A Causa Raiz

Cada policy RLS permissiva e avaliada para toda linha retornada. No caso da tabela `contas_pagar`:
- 6 policies SELECT, cada uma chamando `has_role()` 2-3 vezes
- Total: ~18 lookups no `user_roles` POR LINHA POR QUERY
- Com 44K linhas, uma simples listagem gera ~792K lookups ao `user_roles`

Isso explica os 2,68 bilhoes de scans.

## Plano de Correcao em 4 Etapas

### Etapa 1: Funcao de Acesso Unificada (Maior Impacto)

Criar uma funcao que faz UMA UNICA query e retorna tudo que precisa saber sobre o usuario:

```text
check_user_access(user_id, module_code) -> boolean
```

Internamente, faz um unico SELECT que busca:
- O role do usuario
- Se tem permissao individual no modulo
- Se tem permissao por departamento
- Se tem permissao por role

Resultado: em vez de 3-5 funcoes encadeadas (has_role -> is_admin_or_supervisor -> usuario_tem_acesso_modulo -> has_role novamente), uma unica chamada resolve.

### Etapa 2: Consolidar Policies Duplicadas (30+ tabelas)

Para cada tabela com duplicatas, reduzir para exatamente 1 policy por operacao (SELECT, INSERT, UPDATE, DELETE).

Tabelas prioritarias (pior para melhor):

| Tabela | Policies Atuais | Policies Depois |
|--------|----------------|-----------------|
| fabrica_materias_primas | 17 | 4 |
| contas_pagar | 16 | 5 |
| trade_budgets | 15 | 4 |
| prospects | 15 | 4 |
| sales | 11 | 4 |
| trade_investments | 10 | 4 |
| competitor_intelligence | 10 | 4 |
| departamento_permissoes_modulos | 8 | 2 |
| departamento_permissoes_telas | 8 | 2 |
| contas_receber | 7 | 4 |
| cobrancas | 7 | 4 |
| ai_calls | 7 | 3 |
| photos | 7 | 4 |
| visits | 4 -> 1 SELECT | 1 |

**Exemplo contas_pagar** (de 16 para 5):
- Manter 1 SELECT: `check_user_access(auth.uid(), 'financeiro')` + deny anon
- Manter 1 INSERT: mesma logica
- Manter 1 UPDATE: mesma logica
- Manter 1 DELETE: apenas admin
- Remover o ALL e todas as demais 11 policies redundantes

### Etapa 3: Limpeza Agressiva de audit_logs

- Executar DELETE imediato de registros mais antigos que 7 dias
- Alterar a funcao `cleanup_audit_logs_daily` de 30 dias para 7 dias de retencao
- Isso reduzira de 679K para menos de 50K linhas imediatamente

### Etapa 4: Eliminar Funcoes Redundantes

Atualmente existem funcoes que fazem a mesma coisa de formas diferentes:
- `usuario_tem_acesso_modulo` (plpgsql, chama has_role internamente)
- `usuario_tem_permissao_modulo` (sql, chama has_role internamente)
- `has_finance_access` (plpgsql, query direta no user_roles)
- `can_access_cliente` (plpgsql, chama usuario_tem_acesso_modulo que chama has_role)
- `can_access_fabrica` (sql, chama is_admin_or_supervisor)
- `is_admin_or_supervisor` (sql, query direta no user_roles)

Substituir todas por versoes que nao se encadeiam:
- `check_user_access(user_id, module_code)` - verificacao unificada
- `is_admin_or_supervisor` - manter (ja e leve)
- Remover `usuario_tem_permissao_modulo` (duplicata de `usuario_tem_acesso_modulo`)

## Detalhes Tecnicos da Implementacao

### Migracao SQL Unica

Uma migracao SQL que executa na seguinte ordem:

1. Criar a funcao `check_user_access(uuid, text)` SECURITY DEFINER que faz uma unica query com JOINs
2. Dropar todas as policies duplicadas (listar cada DROP POLICY explicitamente)
3. Criar as policies consolidadas usando `check_user_access`
4. Atualizar `cleanup_audit_logs_daily` para retencao de 7 dias
5. Executar limpeza imediata dos audit_logs
6. Atualizar funcoes auxiliares para eliminar chamadas encadeadas

### Funcao check_user_access - Logica

```text
1. Se role = 'admin' -> retorna TRUE imediatamente
2. Se module_code = NULL -> retorna is_admin_or_supervisor
3. Verifica permissao individual do usuario no modulo
4. Verifica permissao do departamento no modulo
5. Verifica permissao do role no modulo
```

Tudo em um unico SELECT com LEFT JOINs, sem chamar outras funcoes.

### Tabelas Afetadas pela Consolidacao

Todas as tabelas com 3+ policies duplicadas por operacao serao consolidadas. Isso inclui aproximadamente 30 tabelas. A migracao vai:
- DROP POLICY de cada policy redundante (por nome exato)
- CREATE POLICY com a versao consolidada

### Impacto Esperado

- **Reducao de ~60% das policies** (de 974 para ~400)
- **Reducao de ~90% dos lookups no user_roles** por query
- **audit_logs** de 679K para ~50K linhas
- **Custo de cloud estimado**: reducao de 70-80% em operacoes de banco

### Nenhuma Alteracao no Frontend

Todas as mudancas sao no banco de dados (SQL). Nenhum arquivo do frontend precisa ser modificado. As funcoes RPC existentes continuam funcionando normalmente.

### Risco

- BAIXO: policies sao equivalentes (consolidacao, nao mudanca de logica)
- Teste recomendado: acessar cada modulo apos a migracao para validar que os acessos continuam funcionando

