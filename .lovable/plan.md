## Problema

Nas demais telas do sistema, o admin enxerga o botão **"Visualizar como Usuário"** no header global — é o componente `ImpersonationSelector` montado em `src/components/dashboard/DashboardLayout.tsx` (linha 167). Esse botão é o ponto de entrada para "espelhar acesso" (ver o sistema como qualquer outro usuário).

As páginas do módulo Projetos não envolvem seu conteúdo no `DashboardLayout`. Elas têm cabeçalho próprio (`ProjetoHeader`, `CentralHeader`, etc.) e por isso o admin **nunca** vê o seletor — tem que sair do módulo, abrir outra tela, espelhar e só então voltar para Projetos.

Confirmado nos arquivos:
- `src/pages/CentralTrabalho.tsx` — usa `CentralHeader`
- `src/pages/Projetos.tsx` — header inline próprio
- `src/pages/ProjetoDetalhe.tsx` — usa `ProjetoHeader`
- `src/pages/ProjetoHome.tsx`, `ProjetoInbox.tsx`, `ProjetosMinhaEquipe.tsx` etc. — mesma estrutura

`CentralAprovacoes.tsx` é a única que já usa `DashboardLayout` e por isso já mostra o botão.

## Solução

Inserir o componente `ImpersonationSelector` nos cabeçalhos próprios do módulo Projetos, mantendo o exato mesmo componente das outras telas (mesmo dialog, mesma lógica de impersonação, mesma restrição `if (!isAdmin) return null`).

### Pontos onde o botão será adicionado

1. **`src/components/projetos/central/CentralHeader.tsx`** — cobre Central de Trabalho, ProjetoHome, ProjetoInbox (já que ambos renderizam `CentralTrabalho`).
2. **`src/components/projetos/ProjetoHeader.tsx`** — cobre Detalhe do Projeto.
3. **`src/pages/Projetos.tsx`** — listagem principal de projetos (header inline na linha ~164).
4. **`src/pages/ProjetosMinhaEquipe.tsx`** — Minha Equipe (verificar se tem header próprio ou herda de outro componente; se sim, inserir lá).

Em todos os casos: posicionar o botão à direita, no mesmo agrupamento de ações secundárias do header (próximo a Preferências / Restaurar / Salvar / etc.), discreto, com a mesma label "Visualizar como Usuário".

### Comportamento garantido

- **Admin only**: o próprio `ImpersonationSelector` já retorna `null` para não-admins (`if (!isAdmin) return null`), então nenhum outro usuário vê o botão.
- **Banner de impersonação**: o `ImpersonationBanner` continua sendo exibido pelo `DashboardLayout` quando aplicável, sem mudanças necessárias.
- **Estado**: usa o `ImpersonationContext` global existente — sem duplicação de estado.

### Validação

Após a alteração, com usuário admin (Leandro) logado:
- `/dashboard/projetos` → botão visível no header.
- `/dashboard/projetos/central` → botão visível.
- `/dashboard/projetos/:id` → botão visível.
- `/dashboard/projetos/minha-equipe` → botão visível.
- Para roles não-admin: nada muda (botão segue oculto).

## Arquivos que serão alterados

- `src/components/projetos/central/CentralHeader.tsx`
- `src/components/projetos/ProjetoHeader.tsx`
- `src/pages/Projetos.tsx`
- `src/pages/ProjetosMinhaEquipe.tsx` (se tiver header próprio)

Nenhuma mudança em RLS, banco ou no componente `ImpersonationSelector` — apenas montagem em locais adicionais.
