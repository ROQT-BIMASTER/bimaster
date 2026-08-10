# Corrigir a sincronização da Inteligência Municipal

O botão "Atualizar agora" falha por dois motivos independentes, ambos confirmados.

## Causa 1 — coluna inexistente na rotina que grava os clientes

A rotina que aplica os clientes vindos do ERP na base mestre procura o município do IBGE por um campo chamado `codigo_ibge`. A tabela de municípios do IBGE não tem esse campo: o código de 7 dígitos é o próprio identificador (`id`), verificado na base (ex.: Barcarena/PA = 1501303). Por isso a rotina aborta com "column im.codigo_ibge does not exist".

Correção: recriar a rotina usando o identificador correto do município. É a única mudança; nada de dados ou de regras de acesso é alterado.

## Causa 2 — nome da consulta do ERP inválido

A sincronização lê a consulta `Cust_ClientesSP` no ERP, que responde "Invalid object name" — esse nome não existe (ou foi renomeado) no ambiente atual. O nome vem de uma configuração com valor padrão fixo no código.

Correção em duas partes:

1. Antes de ler os dados, verificar se a consulta configurada existe no ERP. Se não existir, localizar automaticamente a consulta de clientes disponível (padrão `Cust_%Cliente%`) e usar a encontrada, registrando qual foi usada no resultado da sincronização.
2. Se nenhuma consulta compatível existir, retornar uma mensagem clara ("consulta de clientes não encontrada no ERP; consultas disponíveis: ...") em vez do erro cru do banco do ERP.

## Validação

- Rodar "Atualizar agora" na tela de Inteligência Municipal e confirmar o retorno sem erros, com contagem de registros lidos/atualizados.
- Conferir o selo de última sincronização e os indicadores da tela atualizados.

## Detalhes técnicos

- Migração: `CREATE OR REPLACE FUNCTION public.aplicar_clientes_rp_no_master()` trocando `im.codigo_ibge = r.ibge_codigo` por `im.id = r.ibge_codigo`; restante do corpo idêntico; `GRANT EXECUTE ... TO service_role` mantido.
- `supabase/functions/sync-erp-clientes/index.ts`: no bloco `/sync`, consultar `INFORMATION_SCHEMA.TABLES` para validar `viewName`; fallback para o primeiro candidato `Cust_%Cliente%`/`Cust_%Client%`; incluir `view_resolvida` na resposta e no `metadata` de `erp_sync_log`.
- Sem mudanças de UI; o toast já exibe a mensagem retornada.

## Fora de escopo

- Alterar o agendamento automático de sincronização e o mapeamento de colunas do ERP.
