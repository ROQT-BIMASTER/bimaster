# Fase 5 — Backfill em Dry-Run (Submissão↔Projeto)

> Executado em produção em modo **somente leitura**. Nenhum dado foi alterado.
> Este relatório é o input obrigatório para a Fase 6 (UNIQUE constraint).

## 1. Panorama global

| Métrica | Valor |
| --- | --- |
| Vínculos totais em `china_submissao_projetos` | **11** |
| Vínculos `is_espelho = true` | 6 |
| Vínculos `is_espelho = false` | 5 |
| Submissões distintas com projeto | **7** |
| Projetos distintos vinculados | 11 |
| Submissões com **mais de um** projeto (duplicatas) | **2** |

## 2. Duplicatas encontradas

### 2.1 Submissão `979ea07a-f6ce-43e5-a457-352ed6265079` — *"Submissão teste 04 — liquid eyeliner"*

| projeto_id | is_espelho | criado em | tarefas |
| --- | :-: | --- | :-: |
| `299994ec-0b75-4408-80b8-49b1f27103b2` | ❌ | 2026-06-12 14:54 | 3 |
| `a1e8b158-615e-4055-826b-f76032a2ca4a` | ✅ | 2026-06-15 14:06 | 1 |

### 2.2 Submissão `e688df80-1854-471b-8e2e-8c3431f0da90` — *"Submissão 1 — compact powder"*

| projeto_id | is_espelho | criado em | tarefas |
| --- | :-: | --- | :-: |
| `a22e1661-aae2-4d8e-bd89-3983fd27a846` | ❌ | 2026-06-11 16:41 | **15** |
| `3db30522-c78c-4b2f-b4e2-f804c93cf1b6` | ❌ | 2026-06-11 17:26 | 9 |
| `1ab3b853-78df-4b31-9024-adcda34e0e92` | ❌ | 2026-06-11 17:40 | 9 |
| `857f5f4d-e499-4797-9dce-6727eebcca27` | ✅ | 2026-06-11 18:05 | 10 |

## 3. Análise

Os projetos duplicados **não estão vazios** — todos têm tarefas reais. Uma escolha
puramente automatizada (ex.: "manter sempre o espelho") perderia trabalho real
das equipes. **Backfill NÃO pode ser destrutivo sem revisão humana.**

## 4. Estratégia proposta (não executada)

Para cada submissão duplicada, o gestor responsável escolhe o **projeto canônico**
(em geral, o de maior atividade — `a22e1661` e `299994ec` nos casos acima).
Em seguida, a operação será (em migração revisável, **um caso por vez**):

1. Mover anexos/tarefas órfãs do(s) projeto(s) descartado(s) para o canônico
   (apenas se houver dado único, validado caso a caso).
2. Marcar projeto descartado com `status = 'arquivado'` e gravar `metadata->>'unificado_em' = projeto_canônico_id` para auditoria. **Nunca DELETE.**
3. Remover os vínculos extras em `china_submissao_projetos`, mantendo um único
   vínculo por `submissao_id`.
4. Setar `is_espelho = true` no vínculo remanescente (passa a ser fonte única).

## 5. Critérios de saída para liberar a Fase 6

- [ ] Decisão registrada (por escrito) sobre o projeto canônico de cada submissão duplicada.
- [ ] Migração de consolidação aplicada e validada — sem perda de tarefas.
- [ ] `SELECT submissao_id, COUNT(*) FROM china_submissao_projetos GROUP BY 1 HAVING COUNT(*) > 1` retorna **0 linhas**.
- [ ] Só então a Fase 6 cria `UNIQUE (submissao_id)`.

## 6. Garantia de não-quebra

Esta fase é puramente diagnóstica. Nenhum SQL `INSERT/UPDATE/DELETE` foi
executado em produção. Nenhum código de aplicação foi alterado.
