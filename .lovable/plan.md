

# Análise IA das fotos Trade não roda — diagnóstico e correção

## Causa raiz (confirmada)

Consulta na tabela `photo_analysis_queue` mostra:
- **2 fotos pendentes** desde **22/04 18:23** (hoje, sem erro registrado).
- **17 análises concluídas**, mas a **última foi em 07/01/2026** — três meses sem nenhuma execução.
- Logs das edge functions `process-photo-analysis-queue` e `trigger-photo-queue` estão **vazios** (apenas `Shutdown` events).

O processador depende exclusivamente de **dois gatilhos no frontend**:
1. `usePhotoQueueProcessor()` em `Dashboard.tsx:70` — só dispara enquanto a Home está aberta E o usuário tem permissão `trade`.
2. `supabase.functions.invoke('trigger-photo-queue')` chamado em `LancamentoPhotoCapture.tsx:125` quando o usuário envia foto via campanha.

**Problema**: o `QuickEntryDialog.tsx` (Lançamento Rápido — onde as 2 fotos travadas foram criadas) **insere na fila mas nunca chama o trigger**. Se nenhum admin/trade abrir o Dashboard depois, as fotos ficam pendentes indefinidamente. É o que aconteceu desde janeiro: fluxo dependente de presença humana = não confiável.

## Solução (3 camadas, defense-in-depth)

### 1. Cron job em background (camada principal — corrige a causa raiz)
Aproveitar `pg_cron` + `pg_net` (já habilitados no projeto) para chamar `process-photo-analysis-queue` automaticamente a cada **2 minutos**, independente de qualquer usuário estar online. Migration:

```sql
select cron.schedule(
  'process-photo-analysis-queue-every-2min',
  '*/2 * * * *',
  $$
    select net.http_post(
      url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/process-photo-analysis-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-queue-secret', '<QUEUE_PROCESSOR_SECRET>',
        'Authorization', 'Bearer <ANON_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);
```
O secret será lido via `vault` para não ficar em texto plano na definição do job.

### 2. Trigger imediato no `QuickEntryDialog`
Adicionar `supabase.functions.invoke('trigger-photo-queue').catch(() => {})` logo após o `INSERT` na fila (linha ~488), igual ao `LancamentoPhotoCapture`. Isso faz a análise começar em segundos quando o usuário acabou de enviar — sem esperar 2 min do cron.

### 3. Botão manual "Reprocessar fila" (admin-only)
Pequeno botão no componente `PhotoAnalysisStatus.tsx` (visível apenas se houver pendentes há mais de 5 min) que dispara `trigger-photo-queue`. Permite que o usuário desbloqueie sozinho sem esperar o cron.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<nova>.sql` | Cria cron job de 2 min via `pg_cron` + `pg_net`, lendo secret do `vault` |
| `src/components/trade/QuickEntryDialog.tsx` | Adiciona `invoke('trigger-photo-queue')` após inserir na fila (linha ~488) |
| `src/components/trade/PhotoAnalysisStatus.tsx` | Adiciona botão "Reprocessar agora" para itens travados há +5 min |

Sem alterar Edge Functions, sem mudar schema da `photo_analysis_queue`, sem APP_VERSION/SDK.

## Validação pós-correção

1. **Imediato**: rodar manualmente `select net.http_post(...)` para drenar as 2 fotos travadas hoje.
2. **5 min**: verificar `select status, count(*) from photo_analysis_queue group by status` — pendentes devem ir a 0.
3. **24h**: confirmar que `cron.job_run_details` mostra execuções a cada 2 min com sucesso.
4. **Funcional**: enviar nova foto pelo Lançamento Rápido — análise deve aparecer em <30s (trigger imediato + processamento).

## Não-escopo

- Sem mudança no prompt da IA, no modelo (`gemini-2.5-flash`) ou no schema de análise.
- Sem mudança na lógica de retry/`attempts` da edge function.
- Sem alteração em `usePhotoQueueProcessor` (mantém como camada extra quando há usuário no Dashboard).
- Sem mexer no fluxo de `LancamentoPhotoCapture` (já chama o trigger corretamente).

