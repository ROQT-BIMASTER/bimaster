

## Corrigir reunião travada e prevenir futuras ocorrências

### Problema

A Edge Function `meeting-analyze` tem um timeout interno de 180s para Phase 2, mas a **wall clock da Edge Function** (limite do servidor) matou o processo antes disso. Sequência:
- 17:45:55 — Início da análise
- 17:48:05 — Phase 1 OK (130s)
- 17:49:14 — Shutdown forçado (apenas 69s após Phase 2 iniciar)

Quando o shutdown forçado acontece, nem o handler de timeout nem o catch block executam, deixando o meeting preso em `status: "processing"`.

### Correções

**1. Resetar a reunião travada (migração SQL)**

```sql
UPDATE meetings 
SET status = 'analyzed', 
    progress = 100, 
    progress_detail = 'Análise parcial (ata e mapa mental OK, extração de insights incompleta)'
WHERE id = 'e418c499-a335-42d0-b198-f89e7d541819' 
  AND status = 'processing';
```

Isso libera a tela para a Michele ver a ata e o mapa mental que já foram salvos na Phase 1.

**2. Adicionar mecanismo de recuperação automática no frontend**

No `ReuniaoDetalhe.tsx`, detectar reuniões presas em `processing` por mais de 10 minutos e resetar automaticamente para `analyzed` (parcial). Isso previne que qualquer futura ocorrência trave a tela.

**3. Reduzir timeout da Phase 2 para caber no wall clock**

No `meeting-analyze/index.ts`, reduzir o timeout da Phase 2 de 180s para 120s, garantindo que Phase 1 (~130s) + Phase 2 (~120s) caibam dentro do limite da Edge Function (~300s). Também usar o modelo `gemini-2.5-flash` que é mais rápido.

### Resultado

- A reunião atual será desbloqueada imediatamente com resultados parciais (ata + mapa mental)
- Futuras reuniões que travarem serão recuperadas automaticamente pelo frontend
- Phase 2 terá timeout mais curto para evitar o shutdown forçado

