

# Plano: Tela "Minhas Solicitações" — Acompanhamento de Protocolos

## O que será feito

Criar uma página onde o usuário vê todas as suas solicitações de materiais, com o protocolo, status (pendente, aprovado, recusado, enviado, entregue), material solicitado, loja e data. Acessível a partir do módulo Trade.

## Arquivos

| Arquivo | Tipo | O que muda |
|---|---|---|
| `src/pages/trade/MinhasSolicitacoes.tsx` | **Novo** | Página com lista de solicitações do usuário logado |
| `src/hooks/useTradeMateriais.ts` | **Editar** | Novo hook `useMinhasSolicitacoes()` filtrando por `user_id` do usuário autenticado |
| `src/App.tsx` | **Editar** | Rota `/dashboard/trade/minhas-solicitacoes` |
| `src/pages/modules/TradeModule.tsx` | **Editar** | Adicionar link/botão "Minhas Solicitações" na seção de ações rápidas ou no header de materiais |

## Detalhes

### Hook `useMinhasSolicitacoes()`
- Busca `trade_material_solicitacoes` com `select("*, trade_materiais(*)")` filtrado por `user_id = auth.uid()`
- Ordenado por `created_at desc`

### Página `MinhasSolicitacoes.tsx`
- Header com botão voltar e título "Minhas Solicitações"
- Lista de cards (mobile-first), cada card mostra:
  - Protocolo (extraído de `obs_interna`) em destaque com fonte mono
  - Nome do material + foto pequena
  - Loja destino (`loja_nome`)
  - Quantidade e data
  - Badge de status com cores: pendente (amarelo), aprovado (verde), recusado (vermelho), em_separacao (azul), enviado (roxo), entregue (verde escuro)
  - Motivo de recusa (se status = recusado)
  - Código de rastreio (se disponível)
- Estado vazio com ícone e texto "Você ainda não fez nenhuma solicitação"

### Acesso no TradeModule
- Adicionar card/botão "Minhas Solicitações" ou link na seção de materiais com ícone `ClipboardList`

