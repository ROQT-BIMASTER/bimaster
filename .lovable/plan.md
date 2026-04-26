## Diagnóstico

A funcionalidade "Auditoria IA" que analisa se o produto vinculado corresponde ao contexto da tarefa está implementada em `supabase/functions/audit-produto-tarefa/index.ts` e é invocada automaticamente em `src/components/projetos/ProductLaunchPanel.tsx` (`runAudit`) sempre que um produto é vinculado.

**Causas prováveis da falha:**
1. **Modelo instável**: A função usa `openai/gpt-5.2` com `tool_choice` forçado. Conforme a memória `ai-gateway-constraints-and-model-policy`, esse modelo tem restrições no Lovable AI Gateway e frequentemente falha em retornar `tool_calls` quando combinado com tool calling obrigatório, fazendo o gateway responder 400/500 ou conteúdo vazio.
2. **Falha silenciosa**: O `catch` em `runAudit` apenas loga no console e marca como "informational", sem feedback visual ao usuário. O resultado é que o card de auditoria simplesmente nunca aparece, dando a impressão de que "não funciona".
3. **Sem logs no servidor**: A função não tem logs recentes, o que sugere que a falha pode estar ocorrendo no parsing da resposta (não nas exceções HTTP que logam).

## Plano de Correção

### 1. Migrar modelo com fallback automático (`supabase/functions/audit-produto-tarefa/index.ts`)
- **Modelo primário**: `google/gemini-2.5-flash` (estável, suporta tool calling estrito).
- **Fallback automático**: se a chamada primária não retornar `tool_calls`, repetir com `openai/gpt-5-mini`.
- **Propagação de erros**: manter tratamento direto para 402 (créditos) e 429 (rate-limit) para a UI exibir toast.
- **Logs detalhados**: registrar snippet da resposta em caso de ausência de tool call para diagnóstico futuro.

### 2. Melhorar feedback no frontend (`src/components/projetos/ProductLaunchPanel.tsx`)
- Substituir o `// Silent fail` por:
  - **Estado de erro** dedicado (ex: `auditError`).
  - Exibir um pequeno badge "Auditoria IA indisponível" com botão de retry quando ocorrer falha.
  - Mostrar `toast.error` somente em casos de 402/429 (créditos/rate-limit), para não poluir a UI em falhas transitórias.
- Manter o auto-run no vínculo de produto e adicionar botão **"Reanalisar"** quando houver erro ou após sucesso.

### 3. Validação
- Após o deploy, abrir uma tarefa com produto vinculado e verificar se o card de auditoria (ShieldCheck/ShieldAlert) aparece com motivo e nível de confiança.
- Conferir os logs da função para confirmar uso do modelo primário.

## Arquivos a modificar
- `supabase/functions/audit-produto-tarefa/index.ts` — trocar modelo, adicionar fallback e logs.
- `src/components/projetos/ProductLaunchPanel.tsx` — adicionar estado de erro + botão de reanalisar + toast para 402/429.

## Resultado esperado
Quando um produto for vinculado a uma tarefa, a IA executará a análise de contexto de forma consistente, exibindo o veredito (alto/médio/baixo match), confiança, motivo e alertas — alinhando-se ao mesmo padrão de estabilidade já aplicado nas funções `projeto-ia-assistant` e `importar-briefing-ia`.