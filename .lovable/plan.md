## Diagnóstico

O widget "Timeline Conclusões" (aba **Dashboard** em Central de Trabalho → Tarefas) consulta apenas tarefas com `status = 'concluida'` **e** `data_conclusao` preenchida nos últimos 14 dias.

Auditoria no banco mostrou:
- 991 tarefas concluídas no total
- **637 (64%) sem `data_conclusao`** — campo nunca foi preenchido
- Apenas 18 tarefas concluídas nos últimos 14 dias têm a data registrada
- Vários usuários têm 100% das suas conclusões sem `data_conclusao` (ex: 246 de 248, 36 de 36, 25 de 25)
- **Não existe trigger** garantindo o preenchimento automático

Resultado: o gráfico aparece praticamente vazio porque o dado-fonte está faltando.

## Plano de correção (v3.4.15)

### 1. Trigger no banco (garantir consistência futura)
Criar trigger `BEFORE INSERT OR UPDATE` em `projeto_tarefas`:
- Quando `status` muda para `'concluida'` e `data_conclusao` está nula → setar `data_conclusao = now()`
- Quando `status` sai de `'concluida'` → limpar `data_conclusao = NULL`

Isso elimina dependência do frontend e cobre todos os caminhos (UI, board, calendário, RPCs, atualizações em massa, Asana sync).

### 2. Backfill retroativo
Para as 637 tarefas órfãs, popular `data_conclusao` com a melhor estimativa disponível (`updated_at` da tarefa, fallback `created_at`). Migration única, sem perda de dados.

### 3. Robustez do widget (`WidgetTimelineConclusoes.tsx`)
- Manter janela de 14 dias mas adicionar **fallback visual**: quando todos os pontos forem zero, mostrar mensagem `"Sem conclusões registradas nos últimos 14 dias"` em vez de uma linha plana sem contexto
- Adicionar tooltip explicando o critério (data de conclusão, não de criação)
- Pequena melhoria estética: alinhar com identidade do `TaskEvolutionChart` (gradient + área leve)

### 4. Garantia no frontend (defesa em profundidade)
Auditar os pontos onde tarefas mudam de status para confirmar que `data_conclusao` é setada — mesmo com o trigger no lugar, manter o frontend correto evita race conditions de cache otimista. Pontos a revisar:
- `MinhasTarefasContent.tsx` (`handleBridgeToggle`) — já correto
- `MinhasTarefasBoard.tsx`
- `MinhasTarefasCalendar.tsx`
- Hooks de mutation em `src/hooks/useProjetoTarefas*.ts`

### 5. Versionamento e changelog
- Bump `APP_VERSION` para `3.4.15` em `src/lib/version.ts`
- Adicionar entrada PR-51 no changelog em `src/lib/version.ts` e `src/pages/ApiDocumentation.tsx` descrevendo:
  - Trigger automático de `data_conclusao`
  - Backfill de 637 tarefas históricas
  - Correção do gráfico Timeline Conclusões
- Padrão de release-changelog-discipline (grep-verifiable)

## Arquivos a modificar
- **Migration SQL** (nova): trigger + backfill
- `src/components/minhas-tarefas/widgets/WidgetTimelineConclusoes.tsx` — fallback visual + estética
- `src/lib/version.ts` — bump + changelog
- `src/pages/ApiDocumentation.tsx` — entrada PR-51
- (Opcional, se encontrarmos gaps) hooks/componentes de mutation de tarefa

## Resultado esperado
- Gráfico passa a exibir o histórico real de conclusões a partir do momento do backfill
- Toda nova conclusão registra `data_conclusao` automaticamente, sem depender do caminho de UI usado
- Mensagem amigável quando o usuário ainda não concluiu nada nos últimos 14 dias

Posso seguir com a implementação?