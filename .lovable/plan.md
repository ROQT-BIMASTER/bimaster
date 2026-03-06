

## Problema Identificado

A transcrição com ElevenLabs Scribe v2 está funcionando perfeitamente (70.973 caracteres). O problema é na **etapa de análise** (`meeting-analyze`):

1. **Timeout de 50s é curto demais** — O Gemini 2.5 Pro precisa de mais tempo para analisar 70K chars e gerar análise detalhada com mapa mental, ata, insights, tarefas e riscos. Ele está apressando a resposta e gerando menos itens.
2. **Para áudios de 1 hora** (~400K+ chars de transcrição), o limite de truncamento de 80K chars vai perder a maior parte do conteúdo.
3. **O prompt não exige quantidade mínima** de insights/tarefas/riscos, então o modelo gera poucos.

## Plano de Correção

### 1. `meeting-analyze/index.ts` — Otimizar análise

| Alteração | Detalhe |
|---|---|
| Aumentar timeout | 50s → 120s para dar tempo ao Gemini processar toda a transcrição |
| Aumentar limite de truncamento | 80K → 200K chars (Gemini 2.5 Pro suporta ~1M tokens de contexto) |
| Reforçar prompt | Exigir no mínimo 8-15 insights, 5-10 tarefas, 3-5 riscos. Instruir a ser **exaustivo** e não omitir nenhum tema discutido |
| Dividir análise para transcrições gigantes | Se > 200K chars, dividir em 2 chamadas (primeira e segunda metade) e consolidar resultados |

### 2. Detalhes do prompt reforçado

Adicionar ao system prompt:
- "Extraia **TODOS** os insights, não apenas os mais óbvios. Mínimo de 8 insights, 5 tarefas e 3 riscos."
- "Cada decisão mencionada deve virar um insight do tipo 'decisao'"
- "Cada ação mencionada deve virar uma tarefa com responsável e departamento"
- "Analise o texto INTEIRO, não apenas o início"

### Arquivos alterados

- `supabase/functions/meeting-analyze/index.ts`

