# Fase 7 — Evidências da Unificação Submissão↔Projeto

> Esta fase é puramente de validação. Nenhum código de produção foi alterado.
> O objetivo é registrar evidências auditáveis de que as Fases 1–6 estão sãs e
> que o sistema **não regride** para o estado de duplicatas.

## 1. Estado pós-consolidação (produção)

Executado em produção via `supabase--read_query` após a migração da Fase 6:

```sql
SELECT submissao_id, count(*) AS n
FROM china_submissao_projetos
GROUP BY submissao_id HAVING count(*) > 1;
-- → 0 linhas
```

✅ Banco confirma: nenhuma submissão China possui mais de um projeto vinculado.

## 2. Defesa-em-profundidade ativa

| Camada | Mecanismo | Status |
| --- | --- | --- |
| Aplicação (frontend) | `ProjectService.findBySubmission` antes de qualquer create | ✅ Fase 1 |
| Aplicação (frontend) | Modal unificado atrás de `ff_unificacao_vincular_china` | ✅ Fase 4 |
| RPC backend | `rpc_china_criar_projeto_espelho` idempotente | ✅ existente |
| Banco | `UNIQUE INDEX china_submissao_projetos_submissao_id_uniq` | ✅ Fase 6 |
| Banco | Guard `guard_bulk_delete` em tabelas de domínio | ✅ pré-existente |
| CI | `scripts/ci/guard-destructive-migrations.sh` bloqueia DELETE sem token | ✅ pré-existente |

Mesmo que um caminho legado tente criar um vínculo duplicado, o `UNIQUE` rejeita
com `23505 unique_violation` e a operação falha de forma audível.

## 3. Auditoria dos arquivamentos da Fase 5

Cada projeto descartado carrega evidência estruturada em `projetos.metadata`:

```sql
SELECT id, nome, status,
       metadata->>'unificado_em'           AS canonico,
       metadata->>'unificado_em_submissao' AS submissao,
       metadata->>'unificado_at'           AS quando,
       metadata->>'unificacao_fase'        AS fase,
       metadata->>'unificacao_motivo'      AS motivo
FROM projetos
WHERE metadata ? 'unificado_em';
```

**Reversão (caso precise restaurar):**

```sql
UPDATE projetos
SET status = 'ativo',
    metadata = metadata
      - 'unificado_em'
      - 'unificado_em_submissao'
      - 'unificado_at'
      - 'unificacao_fase'
      - 'unificacao_motivo'
WHERE id = '<id-do-projeto>';
```

> Reversão também exige reinserir manualmente a linha em
> `china_submissao_projetos` (`submissao_id`, `projeto_id`). O `UNIQUE` da
> Fase 6 vai impedir conflito com o canônico — você deve primeiro decidir
> qual projeto vira o novo canônico.

## 4. Testes automatizados de regressão

Arquivo: `src/lib/projetos/__tests__/projectService.test.ts`

Cobertura:

| Cenário | Garante que |
| --- | --- |
| `findBySubmission("")` | Não consulta o banco para id vazio (evita ruído de telemetria) |
| `findBySubmission` espelho | Preferência por `is_espelho=true` (fonte única) |
| `findBySubmission` fallback | Retorna vínculo legado quando não há espelho |
| `createFromSubmission("")` | Lança erro explícito em vez de chamar RPC com payload inválido |
| `createFromSubmission` delegação | Chama `rpc_china_criar_projeto_espelho` com `p_substituir=false` |
| `linkExisting` | Passa `p_projeto_id` e nunca substitui |
| Propagação de erro do RPC | Não mascara erros do backend |

Rodar local:

```bash
bunx vitest run src/lib/projetos/__tests__/projectService.test.ts
```

## 5. Garantias para produção

- **Zero mudança visível** sem flag: `ff_unificacao_vincular_china` segue
  `ativo=false`. UI exibe o mesmo banner ausente e o mesmo fluxo histórico.
- **Coluna `projetos.metadata`** adicionada com `DEFAULT '{}'::jsonb NOT NULL` —
  zero risco de quebrar inserts antigos que não passam o campo.
- **Tabela `china_produto_submissoes`** ganhou apenas 4 colunas opcionais
  (`foto_oficial_*`) — todas nullable, nenhum consumer existente é afetado.
- **`UNIQUE INDEX`** criado com `IF NOT EXISTS` e validado pré-criação (Fase 5).
  Banco está consistente; nenhuma escrita futura legítima quebra.
- **Não há `DELETE` agendado para projetos arquivados.** Eles permanecem
  acessíveis e reversíveis indefinidamente.

## 6. Próximos passos opcionais (fora desta fase)

1. Ativar `ff_unificacao_vincular_china` em um único usuário admin para teste
   guiado em produção. Reverter via `UPDATE feature_flags SET ativo=false …`.
2. Após validação humana, ampliar `roles_permitidos` da flag gradualmente.
3. Quando 100% dos usuários estiverem no fluxo unificado por ≥30 dias sem
   incidente, remover o código legado de `/vincular-china` (Fase 8, fora do
   escopo atual).
