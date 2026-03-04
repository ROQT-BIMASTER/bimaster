

## Plano: Correções pendentes nos fluxos de despesas

### Análise realizada

Revisei todos os módulos (Trade, Eventos, Departamentos) e o sistema de comunicação inline com o Financeiro. Identifiquei uma lacuna:

### Problema encontrado

| Funcionalidade | Trade | Eventos | Departamentos |
|---|---|---|---|
| Chat inline com Financeiro (ícone + dialog) | **Faltando** | OK | OK |
| `payment_queue_id` salvo na origem | OK | OK | OK |
| Policy banner no envio | OK | OK | OK |
| Sugestões IA no envio | OK | OK | OK |
| Portador como Select | OK | OK | OK |
| Parcelas/Boleto na tabela | OK | OK | OK |

O módulo **Trade (TradeLancamentos.tsx)** salva o `payment_queue_id` ao enviar ao financeiro, mas **não tem o ícone de chat** para o solicitante se comunicar com o financeiro — diferente de Eventos e Departamentos que já possuem.

### Correção

**`src/pages/TradeLancamentos.tsx`**:
- Importar `PaymentChatPanel`, `MessageCircle`, e `Dialog`
- Adicionar state `chatEntry` para controlar qual lançamento abre o chat
- Adicionar coluna "Chat" na tabela com ícone de balão quando `payment_queue_id` existir
- Adicionar menu dropdown item "Comunicação Financeiro"
- Adicionar Dialog com `PaymentChatPanel` embutido

Isso padroniza todos os 3 módulos com a mesma experiência de comunicação inline.

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/pages/TradeLancamentos.tsx` | Adicionar ícone chat + dialog comunicação |

