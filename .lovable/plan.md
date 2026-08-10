# Clientes da Inteligência Municipal via conector

Migrar a carga de clientes do ERP Result do sync direto (que nunca funcionou, pois a consulta `Cust_ClientesSP` não existe no ERP) para o mesmo padrão das demais integrações: um conector externo lê o ERP e envia os dados para uma rotina de recepção.

Confirmado na base: o agendamento antigo `sync-erp-clientes-15min` (a cada 15 min) existe e continua disparando; a tabela de staging de clientes já tem todos os campos do contrato; o controle de sincronização hoje só conhece pedidos, histórico e contas a pagar.

## 1. Banco de dados

- Adicionar ao controle de sincronização (registro único) os campos de solicitação, última execução, status e mensagem para o alvo "clientes".
- Atualizar a rotina de solicitação de sincronização para aceitar o alvo "clientes", mantendo intacta a verificação de acesso do alvo financeiro.
- Remover o agendamento automático antigo (`sync-erp-clientes-15min`, id 140) que falha a cada 15 minutos.

Nada é apagado: a rotina antiga, a tabela de staging, a rotina de aplicação na base mestre e a visão de status permanecem como estão.

## 2. Recepção dos dados do conector

Nova rotina `receber-clientes-rubysp`, no mesmo molde de `receber-pedidos-rubysp`:

- Sem sessão de usuário; autenticação por token Bearer comparado em tempo constante com `RUBYSP_SYNC_TOKEN` ou `FUTURA_SYNC_TOKEN` (sem token válido → 401). Nenhum secret novo.
- Somente POST, corpo validado com Zod, lotes de até 500 clientes (acima disso → 400).
- Grava o lote na tabela de staging por `codigo_erp`, marcando o horário de sincronização.
- Na última página (`finalizar: true`), executa a aplicação na base mestre e registra o resultado no log de sincronização com origem `connector-rubysp`.
- Resposta `{ ok, upserts, finalizado, aplicado }`; falhas de gravação entram em `errors[]` sem derrubar a chamada.

O contrato enviado pelo conector é seguido exatamente como especificado (campos e tipos), com `codigo_erp` obrigatório e demais campos opcionais.

Ajuste na rotina de controle existente (`sync-control-rubysp`): incluir "clientes" entre os alvos aceitos, retornar os novos campos na consulta do conector e atualizar status/última execução quando o conector reportar conclusão.

## 3. Tela Inteligência Municipal

Em `ClientesSyncBadge.tsx`, mantendo o visual idêntico:

- O botão "Atualizar agora" passa a registrar uma solicitação de sincronização (alvo "clientes") em vez de chamar o sync direto.
- Mensagem de sucesso: "Solicitado — o conector sincroniza em até 1 minuto".
- Mantém as atualizações de dados atuais e agenda uma nova atualização do selo após ~90s, já que o conector é assíncrono.
- Texto do tooltip: "Sincronização automática via conector (a cada 60 min)".

Nenhuma outra tela muda.

## 4. Validação

- Conferir que os novos campos de clientes existem no controle.
- Executar a solicitação com alvo "clientes" e confirmar o carimbo de horário.
- Confirmar que o agendamento antigo não existe mais.
- Chamar a nova rotina de recepção sem token e confirmar 401.

## Detalhes técnicos

- Migration: `ALTER TABLE public.sync_control_rubysp ADD COLUMN IF NOT EXISTS solicitar_clientes_em/ultima_exec_clientes/status_clientes/mensagem_clientes`; `CREATE OR REPLACE FUNCTION public.solicitar_sync_rubysp` com a linha do novo alvo; `SELECT cron.unschedule(140)`.
- `supabase/functions/receber-clientes-rubysp/index.ts`: `Deno.serve(secureHandler({ auth: "none", rateLimit: 60, rateLimitPrefix: "receber-clientes-rubysp", skipWaf: true }, ...))`, `createClient` com service role, upsert `onConflict: "codigo_erp"`, `rpc("aplicar_clientes_rp_no_master")` e insert em `erp_sync_log` quando `finalizar`.
- `sync-control-rubysp/index.ts`: enum do `DoneSchema` + colunas no select do `pull` + branch `clientes` no `done`.
- Deploy das duas rotinas e aplicação da migration.
