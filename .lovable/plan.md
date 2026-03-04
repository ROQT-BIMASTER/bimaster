

## Plano: Configurar Aprovador para Receber Alertas Push em Despesas

### Objetivo
Ao criar uma despesa (Departamentos, Eventos, Trade), o usuário poderá selecionar qual aprovador receberá um alerta push no celular/navegador.

### O que será feito

**1. Adicionar campo "Notificar Aprovador" nos formulários de despesa**
- `NovaDespesaDepartamentoDialog.tsx` - campo Select com lista de perfis (supervisores/gestores)
- `NovaDespesaEventoDialog.tsx` - mesmo campo
- Buscar perfis via `profiles` filtrando por usuários com papel de gestor/supervisor ou acesso ao módulo de aprovações

**2. Disparar notificação push ao criar a despesa**
- Após o `createExpense.mutateAsync`, invocar a edge function `send-notifications` com o `userId` do aprovador selecionado
- Payload: tipo `expense_pending_approval`, título "Nova despesa aguardando aprovação", mensagem com valor e descrição

**3. O alerta chega automaticamente**
- O sistema existente já faz tudo: a edge function insere na tabela `notifications`, o Realtime detecta o INSERT, e o `usePushNotifications` dispara o `showNotification()` no navegador/celular do aprovador (se ele tiver concedido permissão de notificações)

### Arquivos a alterar
- `src/components/departments/NovaDespesaDepartamentoDialog.tsx` - adicionar Select de aprovador + chamada à edge function
- `src/components/events/NovaDespesaEventoDialog.tsx` - mesmo tratamento
- Nenhuma mudança de banco de dados necessária (tabelas `notifications` e `profiles` já existem)

### Fluxo
```text
Usuário cria despesa → Seleciona aprovador → Submete →
  1. Despesa criada no banco (status pending)
  2. Edge function send-notifications chamada com userId do aprovador
  3. Notificação inserida na tabela notifications
  4. Realtime dispara push no navegador/celular do aprovador
```

