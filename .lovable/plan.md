

# Correção: Visibilidade das Ordens de Compra para China

## Problema

O card "Ordens de Compra" no dashboard está marcado como `brasilOnly: true`, impedindo a China de ver as OCs. Mas a China **precisa** acessar as OCs para:
- Saber o que produzir (quantidades, cores, prazo)
- Registrar apontamentos de produção
- Preencher dados de embarque quando a produção termina

O fluxo correto é: **Brasil emite a OC** (isso já está certo — o botão "Emitir OC" é `isBrasilUser` only), mas **ambos os lados visualizam** a OC e seu progresso.

## Alterações

### 1. `src/pages/ChinaFabrica.tsx`
- Mudar o card "Ordens de Compra" de `brasilOnly: true` para `brasilOnly: false`
- Ajustar a descrição para China: mostrar quantas OCs estão ativas para produção

### 2. `src/pages/ChinaOrdemDetalhe.tsx`
- Adicionar `useChinaUserContext` para controle de permissões
- **China**: vê resumo da OC, registra apontamentos de produção, preenche embarque — tudo já funcional
- **Brasil**: adicionalmente vê botões de gestão (ex: cancelar OC, editar prazo) — futuro, mas a base de permissão fica pronta

### 3. `src/pages/ChinaOrdens.tsx`
- Sem mudanças de lógica — a lista já funciona para ambos
- Ajustar navegação do card: ao clicar, ir para `/dashboard/fabrica-china/ordens/${oc.id}` (detalhe da OC) em vez de redirecionar para a ficha do produto

Impacto mínimo: apenas 2 linhas no dashboard e 1 linha na navegação.

