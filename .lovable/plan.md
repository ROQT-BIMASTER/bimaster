

## Diagnóstico

A análise dos 11 minutos **está funcionando** — os logs confirmam 20 insights, 14 tasks, 9 risks. O problema visível é um **log enganoso** na linha 110 que mostra "estimated minutes: 591" (fórmula antiga `length/120`), enquanto a estimativa real correta (linha 138) mostra "12 min". Isso gera confusão.

Para suportar reuniões de **até 1 hora**, há 3 ajustes necessários:

## Alterações em `supabase/functions/meeting-analyze/index.ts`

### 1. Corrigir o log enganoso (linha 110)
Usar `estimatedMinutes` real em vez de `transcription.length / 120`. Mover o log para depois do cálculo correto na linha 138.

### 2. Aumentar timeouts para 1 hora de áudio
- Phase 1 timeout: `120s → 180s` (ata de 1h é muito maior)
- Phase 2 timeout: `120s → 180s` (mais itens para extrair)

### 3. Aumentar limite de transcrição
- `MAX_TRANSCRIPTION_CHARS`: `200000 → 350000` (~1h de áudio diarizado gera ~40K-60K chars, com margem)

### 4. Adicionar log de duração estimada no início
Para que fique claro nos logs quantos minutos estão sendo processados desde o primeiro momento.

**Arquivo alterado:** `supabase/functions/meeting-analyze/index.ts`

