

## Plano: Ajustar Timeline de Gravação e Garantir Análise de até 1 Hora

### Diagnóstico

Os logs confirmam que a análise **funciona corretamente** (Phase 1 OK: ata 11.828 chars, 6 participantes; Phase 2 OK: 20 insights, 14 tasks, 8 risks, 18 highlights). O problema é visual e de robustez:

1. **Marcadores comprimidos**: Os highlights estão todos agrupados na metade esquerda da timeline porque os `timestamp_seconds` gerados pela IA não se distribuem bem ao longo da duração
2. **Scribe timeout**: Para áudios de 1h (~50-100MB), o download + upload do áudio pode levar mais tempo. O timeout de 120s no Scribe é OK, mas o download precisa de margem
3. **Timeline visual pobre**: Marcadores são barras finas difíceis de clicar; falta feedback visual do progresso de reprodução

### Alterações

#### 1. `supabase/functions/meeting-analyze/index.ts` — Melhorar distribuição dos highlights
- No prompt da Phase 2, adicionar instrução explícita: "Distribua os highlights **uniformemente** ao longo da duração total da reunião (${durationSeconds} segundos). Use timestamps proporcionais do início ao fim."
- Passar `duration_seconds` real ao prompt para que o modelo saiba o range correto de timestamps

#### 2. `supabase/functions/meeting-transcribe/index.ts` — Suportar 1h de áudio
- Aumentar timeout do Scribe de 120s para **300s** (5 min) — 1h de áudio pode demorar mais
- Aumentar progresso incremental durante download para dar feedback ao usuário

#### 3. `src/components/meetings/MeetingTimeline.tsx` — Melhorar visual dos marcadores
- Aumentar largura dos marcadores de `w-2.5` para `w-3` com bordas arredondadas
- Adicionar **tooltip persistente** ao passar o mouse (não apenas hover rápido)
- Melhorar a legenda com contadores mais visíveis
- Adicionar indicador de tempo atual mais visível (linha vertical com label)
- Quando `durationSeconds` é 0 mas há highlights, estimar duração pelo último highlight

#### 4. `src/pages/ReuniaoDetalhe.tsx` — Passar `duration_seconds` para o analyze
- Incluir `duration_seconds` no body do `meeting-analyze` invoke para o edge function ter o valor real

### Arquivos alterados
- `supabase/functions/meeting-analyze/index.ts`
- `supabase/functions/meeting-transcribe/index.ts`
- `src/components/meetings/MeetingTimeline.tsx`
- `src/pages/ReuniaoDetalhe.tsx`

